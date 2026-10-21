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

  // 2. Invoices — overdue + due soon
  const invoices = await db.invoice.findMany({
    where: { companyId, status: { not: "VOID" } },
    include: { allocations: { include: { payment: { select: { status: true } } } } },
  });

  for (const inv of invoices) {
    const outstanding = outstandingBalance(inv, inv.allocations);
    if (outstanding.lte(0)) continue; // paid
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    if (!due) continue;
    const daysToDue = Math.floor((due.getTime() - now.getTime()) / 86400000);

    if (daysToDue < 0) {
      await tryCreate({
        companyId,
        userId,
        type: "INVOICE_OVERDUE",
        title: `Invoice overdue: ${inv.invoiceNumber}`,
        message: `Invoice ${inv.invoiceNumber} is ${Math.abs(daysToDue)} days past due. Outstanding: $${outstanding.toFixed(2)}.`,
        entityType: "Invoice",
        entityId: inv.id,
      }).then((n) => n && created.push({ id: n.id, type: "INVOICE_OVERDUE", title: n.title }));
    } else if (daysToDue <= 7) {
      await tryCreate({
        companyId,
        userId,
        type: "INVOICE_DUE_SOON",
        title: `Invoice due in ${daysToDue}d: ${inv.invoiceNumber}`,
        message: `Invoice ${inv.invoiceNumber} is due on ${due.toISOString().slice(0, 10)}. Outstanding: $${outstanding.toFixed(2)}.`,
        entityType: "Invoice",
        entityId: inv.id,
      }).then((n) => n && created.push({ id: n.id, type: "INVOICE_DUE_SOON", title: n.title }));
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
