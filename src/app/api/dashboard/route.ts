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

  const [branches, shops, services, providers, plans, contractsRaw, invoicesRaw, paymentsRaw] =
    await Promise.all([
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
      db.invoice.findMany({
        where: { companyId: cid },
        include: { allocations: { include: { payment: { select: { status: true } } } } },
      }),
      db.payment.findMany({
        where: { companyId: cid, status: "COMPLETED" },
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
  for (const inv of invoicesRaw) {
    if (inv.status === "VOID") continue;
    invoicedTotal = invoicedTotal.plus(inv.total);
    const outstanding = outstandingBalance(inv, inv.allocations);
    outstandingTotal = outstandingTotal.plus(outstanding);
    const derived = deriveInvoiceStatus(inv, inv.allocations, now);
    if (derived === "overdue") overdueCount += 1;
  }
  for (const p of paymentsRaw) {
    collectedTotal = collectedTotal.plus(p.amount);
  }

  return NextResponse.json({
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
      overdueInvoices: overdueCount,
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
  });
  } catch (err) {
    return errorResponse(err);
  }
}
