import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";

/**
 * Phase 5 — Connectivity redundancy matrix.
 *
 * Groups active services by shop (or branch for shop-less services) and
 * classifies redundancy:
 *   - REDUNDANT: ≥2 active circuits (PRIMARY + BACKUP, or 2+ ACTIVE)
 *   - SINGLE: exactly 1 active circuit
 *   - NONE: no active circuits
 *   - UNKNOWN: missing data (no shop assignment)
 *
 * Distinguishes logical redundancy (≥2 circuits) from verified physical/
 * provider diversity (different providers). Multiple circuits from the same
 * provider may share a fiber route — flagged as "same-provider".
 */
export async function GET() {
  try {
    const user = await requireUser();

    const services = await db.internetService.findMany({
      where: { companyId: user.companyId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        shop: { select: { id: true, name: true, code: true } },
        provider: { select: { id: true, name: true, code: true } },
        plan: { select: { name: true, bandwidthDownMbps: true } },
      },
      orderBy: { serviceCode: "asc" },
    });

    // Group by shop (fall back to branch if no shop).
    const groups = new Map<string, {
      key: string;
      shop: { name: string; code: string } | null;
      branch: { name: string; code: string };
      circuits: typeof services;
    }>();

    for (const s of services) {
      const key = s.shop?.id ?? `branch:${s.branch.id}`;
      const entry = groups.get(key) ?? {
        key,
        shop: s.shop ? { name: s.shop.name, code: s.shop.code } : null,
        branch: s.branch ? { name: s.branch.name, code: s.branch.code } : { name: "—", code: "—" },
        circuits: [],
      };
      entry.circuits.push(s);
      groups.set(key, entry);
    }

    const rows = Array.from(groups.values()).map((g) => {
      const active = g.circuits.filter((c) => c.status === "ACTIVE");
      const providers = new Set(active.map((c) => c.provider?.id));
      const hasPrimary = active.some((c) => c.circuitRole === "PRIMARY");
      const hasBackup = active.some((c) => c.circuitRole === "BACKUP");
      const sameProvider = providers.size === 1 && active.length > 1;

      let classification: "REDUNDANT" | "SINGLE" | "NONE" | "UNKNOWN";
      if (active.length === 0) classification = "NONE";
      else if (active.length >= 2) classification = "REDUNDANT";
      else classification = "SINGLE";

      return {
        key: g.key,
        shop: g.shop,
        branch: g.branch,
        totalCircuits: g.circuits.length,
        activeCircuits: active.length,
        classification,
        hasPrimary,
        hasBackup,
        providerDiversity: providers.size,
        sameProviderCircuits: sameProvider,
        circuits: g.circuits.map((c) => ({
          id: c.id,
          serviceCode: c.serviceCode,
          provider: c.provider ? { name: c.provider.name, code: c.provider.code } : null,
          plan: c.plan?.name ?? "—",
          bandwidth: c.plan?.bandwidthDownMbps ?? null,
          status: c.status,
          circuitRole: c.circuitRole,
        })),
      };
    });

    const summary = {
      total: rows.length,
      redundant: rows.filter((r) => r.classification === "REDUNDANT").length,
      single: rows.filter((r) => r.classification === "SINGLE").length,
      none: rows.filter((r) => r.classification === "NONE").length,
      sameProviderRisk: rows.filter((r) => r.sameProviderCircuits).length,
    };

    return NextResponse.json({ rows, summary });
  } catch (err) {
    return errorResponse(err);
  }
}
