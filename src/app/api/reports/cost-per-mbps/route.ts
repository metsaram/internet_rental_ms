import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";

/**
 * Phase 7 — Cost-per-Mbps reporting.
 *
 * For each active service with a plan, calculates:
 *   costPerMbps = monthlyFee / bandwidthDownMbps
 *
 * Groups by provider for comparison. Excludes services with zero/missing
 * bandwidth or no plan (cannot compute a meaningful ratio). Currency is
 * shown per-service (no cross-currency summation without conversion data).
 */
export async function GET() {
  try {
    const user = await requireUser();

    const services = await db.internetService.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      include: {
        plan: { select: { id: true, name: true, bandwidthDownMbps: true, bandwidthUpMbps: true, connectionType: true } },
        provider: { select: { id: true, name: true, code: true } },
        branch: { select: { name: true, code: true } },
        shop: { select: { name: true, code: true } },
        contracts: {
          where: { status: { in: ["ACTIVE", "RENEWED"] } },
          select: { monthlyFee: true, currency: true, contractNumber: true },
          take: 1,
          orderBy: { startDate: "desc" },
        },
      },
      orderBy: { serviceCode: "asc" },
    });

    const rows = services
      .filter((s) => s.plan && s.plan.bandwidthDownMbps > 0)
      .map((s) => {
        const activeContract = s.contracts[0];
        const monthlyFee = activeContract ? Number(activeContract.monthlyFee) : 0;
        const currency = activeContract?.currency ?? user.companyCurrency;
        const bandwidth = s.plan!.bandwidthDownMbps;
        const costPerMbps = bandwidth > 0 ? monthlyFee / bandwidth : 0;

        return {
          id: s.id,
          serviceCode: s.serviceCode,
          branch: s.branch?.name ?? "—",
          shop: s.shop?.name ?? "—",
          provider: s.provider ? { name: s.provider.name, code: s.provider.code } : null,
          plan: s.plan!.name,
          bandwidthDown: bandwidth,
          bandwidthUp: s.plan!.bandwidthUpMbps,
          connectionType: s.plan!.connectionType,
          monthlyFee,
          currency,
          costPerMbps: Number(costPerMbps.toFixed(2)),
          hasContract: !!activeContract,
        };
      });

    // Group by provider for summary
    const byProvider = new Map<string, { provider: string; code: string; count: number; avgCostPerMbps: number; totalBandwidth: number; totalCost: number; currency: string }>();
    for (const r of rows) {
      if (!r.provider) continue;
      const key = r.provider.code;
      const entry = byProvider.get(key) ?? {
        provider: r.provider.name,
        code: key,
        count: 0,
        avgCostPerMbps: 0,
        totalBandwidth: 0,
        totalCost: 0,
        currency: r.currency,
      };
      entry.count += 1;
      entry.totalBandwidth += r.bandwidthDown;
      entry.totalCost += r.monthlyFee;
      entry.avgCostPerMbps = entry.totalBandwidth > 0 ? entry.totalCost / entry.totalBandwidth : 0;
      byProvider.set(key, entry);
    }

    return NextResponse.json({
      rows,
      summary: {
        currency: user.companyCurrency,
        totalServices: rows.length,
        excludedNoPlan: services.length - rows.length,
        byProvider: Array.from(byProvider.values())
          .map((v) => ({
            ...v,
            avgCostPerMbps: Number(v.avgCostPerMbps.toFixed(2)),
            totalCost: Number(v.totalCost.toFixed(2)),
          }))
          .sort((a, b) => a.avgCostPerMbps - b.avgCostPerMbps),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
