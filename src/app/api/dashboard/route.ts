import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";
import { computeContractCosts, deriveContractStatus, daysUntilEnd } from "@/lib/contracts";
import { deriveInvoiceStatus, outstandingBalance } from "@/lib/billing";
import { Decimal } from "@prisma/client/runtime/library";

export async function GET() {
  try {
    const user = await requireUser();
    const cid = user.companyId;
  const now = new Date();

  const [company, branches, shops, services, providers, plans, contractsRaw, servicesWithSpend, invoicesRaw, paymentsRaw, renewalsRaw, recentAudit] =
    await Promise.all([
      db.company.findUnique({ where: { id: cid }, select: { useContract: true, currency: true } }),
      db.branch.count({ where: { companyId: cid } }),
      db.shop.count({ where: { companyId: cid } }),
      db.internetService.count({ where: { companyId: cid } }),
      db.internetProvider.count({ where: { companyId: cid } }),
      db.internetPlan.count({ where: { companyId: cid } }),
      db.internetContract.findMany({
        where: { companyId: cid },
        include: {
          service: {
            select: {
              id: true,
              serviceCode: true,
              branch: { select: { id: true, name: true, code: true } },
              shop: { select: { id: true, name: true, code: true } },
              provider: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      db.internetService.findMany({
        where: { companyId: cid, status: { in: ["ACTIVE", "PENDING"] } },
        select: {
          id: true,
          serviceCode: true,
          monthlyFee: true,
          currency: true,
          branch: { select: { id: true, name: true, code: true } },
          shop: { select: { id: true, name: true, code: true } },
          provider: { select: { id: true, name: true, code: true } },
        },
      }),
      db.invoice.findMany({
        where: { companyId: cid },
        include: {
          allocations: { include: { payment: { select: { status: true } } } },
          service: {
            select: {
              serviceCode: true,
              branch: { select: { name: true } },
              shop: { select: { name: true } },
            },
          },
          contract: {
            select: {
              contractNumber: true,
              service: {
                select: {
                  branch: { select: { name: true } },
                  shop: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { invoiceDate: "desc" },
      }),
      db.payment.findMany({
        where: { companyId: cid, status: "COMPLETED" },
      }),
      db.contractRenewal.findMany({
        where: { companyId: cid },
        include: {
          oldContract: { select: { contractNumber: true, endDate: true, service: { select: { serviceCode: true, branch: { select: { name: true } } } } } },
        },
      }),
      db.auditLog.findMany({
        where: { companyId: cid },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);

  // Derive runtime statuses and cost figures server-side.
  type Row = (typeof contractsRaw)[number] & {
    _derived: ReturnType<typeof deriveContractStatus>;
    _costs: ReturnType<typeof computeContractCosts>;
    _daysLeft: number;
  };

  const rows: Row[] = contractsRaw.map((c) => ({
    ...c,
    _derived: deriveContractStatus(c, now, 30),
    _costs: computeContractCosts(c),
    _daysLeft: daysUntilEnd(c.endDate, now),
  }));

  const active = rows.filter((r) => r._derived === "active");
  const expiring = rows.filter((r) => r._derived === "expiring");
  const expired = rows.filter((r) => r._derived === "expired");
  const upcoming = rows.filter((r) => r._derived === "upcoming");

  // Aggregate monthly cost (active contracts only, grouped by currency).
  const byCurrency = new Map<string, { expected: Decimal; effective: Decimal }>();
  for (const r of active) {
    const cur = r.currency;
    const entry = byCurrency.get(cur) ?? {
      expected: new Decimal(0),
      effective: new Decimal(0),
    };
    entry.expected = entry.expected.plus(r._costs.monthlyFee);
    entry.effective = entry.effective.plus(r._costs.effectiveMonthly);
    byCurrency.set(cur, entry);
  }

  // Cost by provider (active only).
  const byProvider = new Map<string, { provider: string; code: string; expected: Decimal; count: number }>();
  for (const r of active) {
    const key = r.service.provider?.id ?? "unknown";
    const name = r.service.provider?.name ?? "Unknown";
    const code = r.service.provider?.code ?? "?";
    const entry = byProvider.get(key) ?? { provider: name, code, expected: new Decimal(0), count: 0 };
    entry.expected = entry.expected.plus(r._costs.monthlyFee);
    entry.count += 1;
    byProvider.set(key, entry);
  }

  // Cost by branch (active only).
  const byBranch = new Map<string, { branch: string; code: string; expected: Decimal; count: number }>();
  for (const r of active) {
    const key = r.service.branch?.id ?? "unknown";
    const name = r.service.branch?.name ?? "Unknown";
    const code = r.service.branch?.code ?? "?";
    const entry = byBranch.get(key) ?? { branch: name, code, expected: new Decimal(0), count: 0 };
    entry.expected = entry.expected.plus(r._costs.monthlyFee);
    entry.count += 1;
    byBranch.set(key, entry);
  }

  // If company operates in contract-free mode or has no active contracts, aggregate directly from services
  const useContractMode = company?.useContract ?? true;
  if (!useContractMode || active.length === 0) {
    for (const s of servicesWithSpend) {
      const fee = s.monthlyFee ? Number(s.monthlyFee) : 0;
      if (fee <= 0) continue;
      const cur = s.currency ?? user.companyCurrency ?? "USD";
      const curEntry = byCurrency.get(cur) ?? { expected: new Decimal(0), effective: new Decimal(0) };
      curEntry.expected = curEntry.expected.plus(fee);
      curEntry.effective = curEntry.effective.plus(fee);
      byCurrency.set(cur, curEntry);

      const pKey = s.provider?.id ?? "unknown";
      const pName = s.provider?.name ?? "Unknown";
      const pCode = s.provider?.code ?? "?";
      const pEntry = byProvider.get(pKey) ?? { provider: pName, code: pCode, expected: new Decimal(0), count: 0 };
      pEntry.expected = pEntry.expected.plus(fee);
      pEntry.count += 1;
      byProvider.set(pKey, pEntry);

      const bKey = s.branch?.id ?? "unknown";
      const bName = s.branch?.name ?? "Unknown";
      const bCode = s.branch?.code ?? "?";
      const bEntry = byBranch.get(bKey) ?? { branch: bName, code: bCode, expected: new Decimal(0), count: 0 };
      bEntry.expected = bEntry.expected.plus(fee);
      bEntry.count += 1;
      byBranch.set(bKey, bEntry);
    }
  }

  // Renewals within next 60 days (active+expiring, soon), ordered by end date.
  const renewals = rows
    .filter((r) => r._derived === "active" || r._derived === "expiring")
    .sort((a, b) => a._daysLeft - b._daysLeft)
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      contractNumber: r.contractNumber,
      serviceCode: r.service.serviceCode,
      branch: r.service.branch?.name ?? "—",
      endDate: r.endDate,
      daysLeft: r._daysLeft,
      monthlyFee: r._costs.monthlyFee.toString(),
      currency: r.currency,
      status: r._derived,
    }));

  // Billing aggregates (Phase 12) -------------------------------------------
  let outstandingTotal = new Decimal(0);
  let invoicedTotal = new Decimal(0);
  let collectedTotal = new Decimal(0);
  let overdueCount = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let partialCount = 0;
  let draftCount = 0;
  for (const inv of invoicesRaw) {
    if (inv.status === "VOID") continue;
    invoicedTotal = invoicedTotal.plus(inv.total);
    const outstanding = outstandingBalance(inv, inv.allocations);
    outstandingTotal = outstandingTotal.plus(outstanding);
    const derived = deriveInvoiceStatus(inv, inv.allocations, now);
    if (derived === "overdue") overdueCount += 1;
    else if (derived === "paid") paidCount += 1;
    else if (derived === "partial") partialCount += 1;
    else if (derived === "pending") pendingCount += 1;
    else if (derived === "draft") draftCount += 1;
  }
  for (const p of paymentsRaw) {
    collectedTotal = collectedTotal.plus(p.amount);
  }

  const recentInvoices = invoicesRaw.slice(0, 6).map((inv) => {
    const branchName =
      inv.service?.branch?.name ??
      inv.contract?.service?.branch?.name ??
      "—";
    const serviceCode =
      inv.service?.serviceCode ??
      inv.contract?.contractNumber ??
      "—";
    const derived = deriveInvoiceStatus(inv, inv.allocations, now);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      serviceCode,
      branch: branchName,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      total: inv.total.toString(),
      currency: inv.currency,
      status: derived,
    };
  });

  return NextResponse.json({
    useContract: useContractMode,
    counts: {
      branches,
      shops,
      services,
      providers,
      plans,
      contracts: contractsRaw.length,
      activeContracts: active.length,
      expiringSoon: expiring.length,
      expired: expired.length,
      upcoming: upcoming.length,
      invoices: invoicesRaw.length,
      paidInvoices: paidCount,
      pendingInvoices: pendingCount,
      partialInvoices: partialCount,
      overdueInvoices: overdueCount,
      draftInvoices: draftCount,
    },
    billing: {
      invoicedTotal: invoicedTotal.toString(),
      collectedTotal: collectedTotal.toString(),
      outstandingTotal: outstandingTotal.toString(),
      overdueCount,
    },
    costByCurrency: Array.from(byCurrency.entries()).map(([currency, v]) => ({
      currency,
      expectedMonthly: v.expected.toString(),
      effectiveMonthly: v.effective.toString(),
    })),
    costByProvider: Array.from(byProvider.values())
      .map((v) => ({
        provider: v.provider,
        code: v.code,
        count: v.count,
        expectedMonthly: v.expected.toString(),
      }))
      .sort((a, b) => Number(b.expectedMonthly) - Number(a.expectedMonthly)),
    costByBranch: Array.from(byBranch.values())
      .map((v) => ({
        branch: v.branch,
        code: v.code,
        count: v.count,
        expectedMonthly: v.expected.toString(),
      }))
      .sort((a, b) => Number(b.expectedMonthly) - Number(a.expectedMonthly)),
    renewals,
    recentInvoices,
    renewalSummary: (() => {
      let upcoming = 0;
      let overdue = 0;
      let completed = 0;
      for (const r of renewalsRaw) {
        if (r.status === "COMPLETED") { completed += 1; continue; }
        const d = Math.floor(
          (new Date(r.oldContract.endDate).getTime() - now.getTime()) / 86400000
        );
        if (d < 0) overdue += 1;
        else upcoming += 1;
      }
      return { upcoming, overdue, completed, total: renewalsRaw.length };
    })(),
    recentActivity: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      actor: a.actor ? a.actor.name ?? a.actor.email : "system",
      createdAt: a.createdAt,
    })),
    // 6-month cost trend: for each of the last 6 months, sum the monthly fee
    // of contracts that were active during that month (start <= month-end &&
    // end >= month-start). Gives a realistic "what was my monthly cost" view.
    costTrend: (() => {
      const months: Array<{ label: string; value: number }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        let total = new Decimal(0);
        for (const c of contractsRaw) {
          const cs = new Date(c.startDate);
          const ce = new Date(c.endDate);
          // Contract is active in this month if it started on/before month-end
          // and ends on/after month-start.
          if (cs <= monthEnd && ce >= monthStart) {
            total = total.plus(c.monthlyFee);
          }
        }
        months.push({
          label: d.toLocaleString("en", { month: "short" }),
          value: total.toNumber(),
        });
      }
      return months;
    })(),
  });
  } catch (err) {
    return errorResponse(err);
  }
}
