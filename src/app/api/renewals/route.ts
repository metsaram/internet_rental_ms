import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";
import { daysUntil } from "@/lib/renewals";

/**
 * List renewals for the caller's company, classified by status.
 * Query: ?tab=upcoming|overdue|completed (default: all)
 *
 * - upcoming:  pending renewals whose old contract ends within ~30 days
 * - overdue:   pending renewals whose old contract end date already passed
 * - completed: renewals with status COMPLETED (history)
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") ?? "all";

    const rows = await db.contractRenewal.findMany({
      where: { companyId: user.companyId },
      include: {
        oldContract: {
          select: {
            id: true,
            contractNumber: true,
            startDate: true,
            endDate: true,
            monthlyFee: true,
            currency: true,
            durationMonths: true,
            freeMonths: true,
            status: true,
            service: {
              select: {
                id: true,
                serviceCode: true,
                branch: { select: { name: true, code: true } },
                shop: { select: { name: true, code: true } },
                provider: { select: { name: true, code: true } },
              },
            },
          },
        },
        newContract: {
          select: {
            id: true,
            contractNumber: true,
            startDate: true,
            endDate: true,
            monthlyFee: true,
            currency: true,
            durationMonths: true,
            freeMonths: true,
            status: true,
          },
        },
        decidedBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const now = new Date();
    const WARNING_DAYS = 30;
    const mapped = rows.map((r) => {
      const daysLeft = daysUntil(r.oldContract.endDate, now);
      let bucket: "upcoming" | "overdue" | "completed";
      if (r.status === "COMPLETED") bucket = "completed";
      else if (daysLeft < 0) bucket = "overdue";
      else bucket = "upcoming";
      return {
        id: r.id,
        status: r.status,
        bucket,
        daysLeft,
        warningDate: r.warningDate,
        noticeDate: r.noticeDate,
        decisionDate: r.decisionDate,
        decidedBy: r.decidedBy,
        createdBy: r.createdBy,
        notes: r.notes,
        createdAt: r.createdAt,
        oldContract: {
          id: r.oldContract.id,
          contractNumber: r.oldContract.contractNumber,
          startDate: r.oldContract.startDate,
          endDate: r.oldContract.endDate,
          monthlyFee: r.oldContract.monthlyFee.toString(),
          currency: r.oldContract.currency,
          durationMonths: r.oldContract.durationMonths,
          freeMonths: r.oldContract.freeMonths,
          status: r.oldContract.status,
          service: r.oldContract.service,
        },
        newContract: r.newContract
          ? {
              id: r.newContract.id,
              contractNumber: r.newContract.contractNumber,
              startDate: r.newContract.startDate,
              endDate: r.newContract.endDate,
              monthlyFee: r.newContract.monthlyFee.toString(),
              currency: r.newContract.currency,
              durationMonths: r.newContract.durationMonths,
              freeMonths: r.newContract.freeMonths,
              status: r.newContract.status,
            }
          : null,
        newTerms: r.newStartDate
          ? {
              newStartDate: r.newStartDate,
              newEndDate: r.newEndDate,
              newMonthlyFee: r.newMonthlyFee?.toString() ?? null,
              newCurrency: r.newCurrency,
              newDurationMonths: r.newDurationMonths,
              newFreeMonths: r.newFreeMonths,
            }
          : null,
      };
    });

    const filtered = tab === "all" ? mapped : mapped.filter((m) => m.bucket === tab);
    const counts = {
      upcoming: mapped.filter((m) => m.bucket === "upcoming").length,
      overdue: mapped.filter((m) => m.bucket === "overdue").length,
      completed: mapped.filter((m) => m.bucket === "completed").length,
    };

    return NextResponse.json({ rows: filtered, counts });
  } catch (err) {
    return errorResponse(err);
  }
}
