import { db } from "@/lib/db";
import { deriveInvoiceStatus, outstandingBalance } from "@/lib/billing";
import { daysUntil, DEFAULT_WARNING_DAYS } from "@/lib/renewals";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Phase 16 — Notification generation.
 *
 * Scans the company's contracts + invoices + renewals and creates
 * Notification records for any threshold crossings that don't already have a
 * pending notification. Idempotent: existing unread notifications of the same
 * type + entity are not duplicated.
 *
 * Designed to be called from a scheduled endpoint (cron) or on-demand from
 * the notifications API GET (lightweight scan).
 */

interface NotifyOpts {
  companyId: string;
  userId: string;
}

export async function generateNotifications({ companyId, userId }: NotifyOpts) {
  const now = new Date();
  const created: Array<{ id: string; type: string; title: string }> = [];

  // 1. Contract renewals — upcoming (≤30 days) + overdue
  const renewals = await db.contractRenewal.findMany({
    where: { companyId, status: "PENDING" },
    include: {
      oldContract: {
        select: {
          id: true,
          contractNumber: true,
          endDate: true,
          service: { select: { serviceCode: true, branch: { select: { name: true } } } },
        },
      },
    },
  });

  for (const r of renewals) {
    const days = daysUntil(r.oldContract.endDate, now);
    const contractRef = r.oldContract.contractNumber;
    const branch = r.oldContract.service.branch?.name ?? "—";

    if (days < 0) {
      // overdue renewal
      await tryCreate({
        companyId,
        userId,
        type: "RENEWAL_OVERDUE",
        title: `Renewal overdue: ${contractRef}`,
        message: `Contract ${contractRef} (${branch}) expired ${Math.abs(days)} days ago and has no renewal decision.`,
        entityType: "ContractRenewal",
        entityId: r.id,
      }).then((n) => n && created.push({ id: n.id, type: "RENEWAL_OVERDUE", title: n.title }));
    } else if (days <= DEFAULT_WARNING_DAYS) {
      await tryCreate({
        companyId,
        userId,
        type: "RENEWAL_UPCOMING",
        title: `Renewal due in ${days}d: ${contractRef}`,
        message: `Contract ${contractRef} (${branch}) ends on ${r.oldContract.endDate.toISOString().slice(0, 10)}. Review and renew before expiry.`,
        entityType: "ContractRenewal",
        entityId: r.id,
      }).then((n) => n && created.push({ id: n.id, type: "RENEWAL_UPCOMING", title: n.title }));
    }
  }

  // 2. Invoices — daily payment alerts (1 week before due until 1 week overdue, unless paid or void)
  const invoices = await db.invoice.findMany({
    where: { companyId },
    include: { allocations: { include: { payment: { select: { status: true } } } } },
  });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  for (const inv of invoices) {
    const outstanding = outstandingBalance(inv, inv.allocations);
    const alert = getInvoicePaymentAlert(inv, outstanding, now);

    if (!alert) {
      // If invoice is void, paid, or outside the alert window (>7d before or >7d overdue),
      // dismiss any lingering unread daily reminders so inbox stays accurate and clean.
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      const isPastLimit = due ? Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - startOfToday.getTime()) / 86400000) < -7 : false;

      if (inv.status === "VOID" || outstanding.lte(0) || isPastLimit) {
        await db.notification.deleteMany({
          where: {
            companyId,
            userId,
            entityType: "Invoice",
            entityId: inv.id,
            readAt: null,
          },
        });
      }
      continue;
    }

    // Check if an alert was ALREADY created or updated today for this invoice
    const alertedToday = await db.notification.findFirst({
      where: {
        companyId,
        userId,
        entityType: "Invoice",
        entityId: inv.id,
        createdAt: { gte: startOfToday },
      },
      select: { id: true },
    });

    if (alertedToday) {
      // Already alerted today
      continue;
    }

    // Check if there is an existing unread alert for this invoice from an earlier day
    const existingUnread = await db.notification.findFirst({
      where: {
        companyId,
        userId,
        entityType: "Invoice",
        entityId: inv.id,
        readAt: null,
      },
      select: { id: true },
    });

    if (existingUnread) {
      // Refresh the existing unread alert to today's count & timestamp so inbox doesn't duplicate
      const updated = await db.notification.update({
        where: { id: existingUnread.id },
        data: {
          type: alert.type,
          title: alert.title,
          message: alert.message,
          createdAt: now,
        },
        select: { id: true, title: true },
      });
      created.push({ id: updated.id, type: alert.type, title: updated.title });
    } else {
      // Create fresh notification for today
      const fresh = await db.notification.create({
        data: {
          companyId,
          userId,
          type: alert.type,
          title: alert.title,
          message: alert.message,
          entityType: "Invoice",
          entityId: inv.id,
          createdAt: now,
        },
        select: { id: true, title: true },
      });
      created.push({ id: fresh.id, type: alert.type, title: fresh.title });
    }
  }

  return { generated: created.length, items: created };
}

async function tryCreate(opts: {
  companyId: string;
  userId: string;
  type: "RENEWAL_UPCOMING" | "RENEWAL_OVERDUE" | "INVOICE_OVERDUE" | "INVOICE_DUE_SOON" | "IMPORT_COMPLETED" | "IMPORT_FAILED";
  title: string;
  message: string;
  entityType: string;
  entityId: string;
}) {
  // Idempotency: skip if there's ANY notification (read or unread) of the same
  // type for this entity + user created in the last 24h. This prevents
  // re-creating a notification immediately after the user dismisses it.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.notification.findFirst({
    where: {
      companyId: opts.companyId,
      userId: opts.userId,
      type: opts.type,
      entityType: opts.entityType,
      entityId: opts.entityId,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (existing) return null;

  return db.notification.create({
    data: {
      companyId: opts.companyId,
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType,
      entityId: opts.entityId,
    },
    select: { id: true, title: true },
  });
}

/** Create a one-off notification (e.g. import completed/failed). */
export async function notifyImport({
  companyId,
  userId,
  jobId,
  fileName,
  imported,
  errors,
  total,
}: {
  companyId: string;
  userId: string;
  jobId: string;
  fileName: string;
  imported: number;
  errors: number;
  total: number;
}) {
  const success = errors === 0;
  return db.notification.create({
    data: {
      companyId,
      userId,
      type: success ? "IMPORT_COMPLETED" : "IMPORT_FAILED",
      title: success ? `Import completed: ${fileName}` : `Import partial: ${fileName}`,
      message: success
        ? `Imported ${imported} of ${total} rows from ${fileName}.`
        : `Imported ${imported} of ${total} rows; ${errors} row(s) had errors. Review the import history.`,
      entityType: "ImportJob",
      entityId: jobId,
    },
  });
}

export type InvoiceAlertInfo = {
  type: "INVOICE_DUE_SOON" | "INVOICE_OVERDUE";
  title: string;
  message: string;
  daysToDue: number;
} | null;

/**
 * Calculates whether an invoice requires a daily payment alert.
 * Rules:
 * 1. If invoice is VOID or fully paid (outstanding <= 0) -> null (no alert).
 * 2. If no dueDate -> null (no alert).
 * 3. Starts alerting 1 week (7 days) before due date.
 * 4. Keeps alerting every day while due soon (daysToDue: 7 down to 0) and while overdue up to 1 week (daysToDue: -1 down to -7).
 * 5. Stops alerting once overdue more than 1 week (daysToDue < -7).
 */
export function getInvoicePaymentAlert(
  invoice: {
    invoiceNumber: string;
    dueDate: Date | string | null;
    status: string;
    currency?: string | null;
  },
  outstandingAmount: number | Decimal,
  now: Date = new Date()
): InvoiceAlertInfo {
  if (invoice.status === "VOID") return null;
  const bal = typeof outstandingAmount === "number" ? outstandingAmount : Number(outstandingAmount);
  if (bal <= 0) return null;

  if (!invoice.dueDate) return null;
  const due = typeof invoice.dueDate === "string" ? new Date(invoice.dueDate) : invoice.dueDate;
  if (isNaN(due.getTime())) return null;

  // Calendar-day calculation (midnight to midnight)
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysToDue = Math.round((dueMidnight.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24));

  // Alert window: [7 days before due date (+7) ... 7 days after due date (-7)]
  if (daysToDue > 7 || daysToDue < -7) {
    return null;
  }

  const cur = invoice.currency ?? "USD";
  const formattedBal = `${cur} ${bal.toFixed(2)}`;
  const dueStr = due.toISOString().slice(0, 10);

  if (daysToDue >= 0) {
    let title: string;
    let message: string;
    if (daysToDue === 0) {
      title = `Invoice due today: ${invoice.invoiceNumber}`;
      message = `Payment reminder: Invoice ${invoice.invoiceNumber} is due today (${dueStr}). Outstanding: ${formattedBal}. Please make payment.`;
    } else if (daysToDue === 1) {
      title = `Invoice due tomorrow: ${invoice.invoiceNumber}`;
      message = `Payment reminder: Invoice ${invoice.invoiceNumber} is due tomorrow (${dueStr}). Outstanding: ${formattedBal}. Please make payment.`;
    } else {
      title = `Invoice due in ${daysToDue}d: ${invoice.invoiceNumber}`;
      message = `Payment reminder: Invoice ${invoice.invoiceNumber} is due in ${daysToDue} days (${dueStr}). Outstanding: ${formattedBal}. Please make payment.`;
    }

    return {
      type: "INVOICE_DUE_SOON",
      title,
      message,
      daysToDue,
    };
  } else {
    const daysOverdue = Math.abs(daysToDue);
    let title: string;
    let message: string;
    if (daysOverdue === 1) {
      title = `Invoice 1d overdue: ${invoice.invoiceNumber}`;
      message = `Urgent payment alert: Invoice ${invoice.invoiceNumber} was due yesterday (${dueStr}). Outstanding: ${formattedBal}. Please make payment immediately.`;
    } else {
      title = `Invoice ${daysOverdue}d overdue: ${invoice.invoiceNumber}`;
      message = `Urgent payment alert: Invoice ${invoice.invoiceNumber} is ${daysOverdue} days past due (${dueStr}). Outstanding: ${formattedBal}. Please make payment immediately.`;
    }

    return {
      type: "INVOICE_OVERDUE",
      title,
      message,
      daysToDue,
    };
  }
}
