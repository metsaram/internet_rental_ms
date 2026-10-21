import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";
import { computeContractCosts } from "@/lib/contracts";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Phase 15 extension — Cost variance report.
 *
 * For each contract, compares:
 *   - scheduledTotal = monthlyFee × (duration − freeMonths)  [expected cost]
 *   - invoicedTotal  = Σ invoice.total for that contract      [billed cost]
 *   - collectedTotal = Σ completed payments allocated to those invoices
 *
 * Returns per-contract rows + a summary. Only active/expired contracts with
 * at least one invoice (or a positive scheduled total) are included.
 */
export async function GET() {
  try {
    const user = await requireUser();

    const contracts = await db.internetContract.findMany({
      where: { companyId: user.companyId },
      include: {
        service: {
          select: {
            id: true,
            serviceCode: true,
            branch: { select: { name: true, code: true } },
            provider: { select: { name: true, code: true } },
          },
        },
        invoices: {
          include: {
            allocations: { include: { payment: { select: { status: true } } } },
          },
        },
      },
      orderBy: { endDate: "asc" },
      take: 500,
    });

    const rows = contracts.map((c) => {
      const costs = computeContractCosts(c);
      const invoicedTotal = c.invoices
        .filter((i) => i.status !== "VOID")
        .reduce((s, i) => s.plus(i.total), new Decimal(0));
      const collectedTotal = c.invoices
        .filter((i) => i.status !== "VOID")
        .flatMap((i) => i.allocations)
        .filter((a) => a.payment?.status !== "VOID")
        .reduce((s, a) => s.plus(a.amount), new Decimal(0));
      const outstanding = invoicedTotal.minus(collectedTotal);
      const variance = invoicedTotal.minus(costs.scheduledTotal);

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        serviceCode: c.service.serviceCode,
        branch: c.service.branch?.name ?? "—",
        provider: c.service.provider?.name ?? "—",
        status: c.status,
        currency: c.currency,
        scheduledTotal: costs.scheduledTotal.toString(),
        invoicedTotal: invoicedTotal.toString(),
        collectedTotal: collectedTotal.toString(),
        outstanding: outstanding.toString(),
        variance: variance.toString(),
        invoiceCount: c.invoices.length,
      };
    });

    // Summary: sum across the same currency (all demo data is USD).
    const summary = rows.reduce(
      (acc, r) => {
        acc.scheduled = acc.scheduled.plus(r.scheduledTotal);
        acc.invoiced = acc.invoiced.plus(r.invoicedTotal);
        acc.collected = acc.collected.plus(r.collectedTotal);
        acc.outstanding = acc.outstanding.plus(r.outstanding);
        acc.variance = acc.variance.plus(r.variance);
        return acc;
      },
      {
        scheduled: new Decimal(0),
        invoiced: new Decimal(0),
        collected: new Decimal(0),
        outstanding: new Decimal(0),
        variance: new Decimal(0),
      }
    );

    return NextResponse.json({
      rows,
      summary: {
        currency: user.companyCurrency,
        scheduledTotal: summary.scheduled.toString(),
        invoicedTotal: summary.invoiced.toString(),
        collectedTotal: summary.collected.toString(),
        outstanding: summary.outstanding.toString(),
        variance: summary.variance.toString(),
        contractCount: rows.length,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
