import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";

/**
 * Phase 6 — Monthly availability report.
 *
 * For each active service, calculates monthly availability over the last N
 * months using the formula:
 *   Availability % = (1 - eligibleDowntimeMinutes / eligibleServiceMinutes) × 100
 *
 * - eligibleDowntimeMinutes = Σ resolved incident downtime within the month
 * - eligibleServiceMinutes = minutes in the month (simplified — no exclusions
 *   for planned maintenance or partial-month service in this demo)
 * - Ongoing incidents count as downtime from startTime to end-of-month (or now)
 *
 * The formula alone does not establish SLA credit eligibility — the applicable
 * contract terms must define what counts as eligible downtime.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const monthsParam = parseInt(url.searchParams.get("months") ?? "3", 10);
    const months = Math.min(Math.max(monthsParam, 1), 12);

    const services = await db.internetService.findMany({
      where: { companyId: user.companyId },
      include: {
        provider: { select: { name: true, code: true } },
        branch: { select: { name: true, code: true } },
        shop: { select: { name: true, code: true } },
        outages: {
          where: { status: { in: ["RESOLVED", "ONGOING"] } },
          select: { startTime: true, endTime: true, downtimeMinutes: true, status: true, type: true },
        },
      },
    });

    const now = new Date();
    const monthsArr: { label: string; year: number; month: number; start: Date; end: Date }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      monthsArr.push({
        label: d.toLocaleString("en", { month: "short", year: "2-digit" }),
        year: d.getFullYear(),
        month: d.getMonth(),
        start,
        end: end > now ? now : end,
      });
    }

    const rows = services.map((s) => {
      const monthlyData = monthsArr.map((m) => {
        const serviceMinutes = Math.round((m.end.getTime() - m.start.getTime()) / 60000);
        let downtimeMinutes = 0;

        for (const o of s.outages) {
          const start = new Date(o.startTime);
          const end = o.endTime ? new Date(o.endTime) : (o.status === "ONGOING" ? now : null);
          if (!end) continue;

          // Clip to the month window
          const clipStart = start < m.start ? m.start : start;
          const clipEnd = end > m.end ? m.end : end;

          if (clipStart < clipEnd) {
            downtimeMinutes += Math.round((clipEnd.getTime() - clipStart.getTime()) / 60000);
          }
        }

        const availability = serviceMinutes > 0
          ? ((1 - downtimeMinutes / serviceMinutes) * 100)
          : 100;
        return {
          label: m.label,
          downtimeMinutes,
          availability: Number(availability.toFixed(3)),
        };
      });

      const avgAvailability = monthlyData.reduce((a, m) => a + m.availability, 0) / monthlyData.length;
      const totalDowntime = monthlyData.reduce((a, m) => a + m.downtimeMinutes, 0);

      return {
        id: s.id,
        serviceCode: s.serviceCode,
        branch: s.branch?.name ?? "—",
        shop: s.shop?.name ?? "—",
        provider: s.provider?.name ?? "—",
        status: s.status,
        circuitRole: s.circuitRole,
        avgAvailability: Number(avgAvailability.toFixed(3)),
        totalDowntimeMinutes: totalDowntime,
        monthly: monthlyData,
      };
    });

    return NextResponse.json({
      months: monthsArr.map((m) => m.label),
      rows: rows.sort((a, b) => a.avgAvailability - b.avgAvailability),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
