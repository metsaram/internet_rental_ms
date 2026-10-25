import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { generateNotifications } from "@/lib/notifications";

/**
 * GET /api/notifications — list notifications for the current user.
 * Query: ?unreadOnly=true to filter.
 *
 * Side effect: on each GET we run the lightweight notification generator
 * (scans pending renewals + outstanding invoices) so the bell badge stays
 * fresh without a separate cron job. This is acceptable for a demo with a
 * small dataset.
 */
const lastGeneratedMap = new Map<string, number>();

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    // Refresh notifications (idempotent, throttled to at most once every 60s).
    const lastRun = lastGeneratedMap.get(user.companyId) ?? 0;
    if (Date.now() - lastRun > 60_000) {
      lastGeneratedMap.set(user.companyId, Date.now());
      try {
        await generateNotifications({ companyId: user.companyId, userId: user.id });
      } catch (genErr) {
        console.warn("[notifications] Background generation skipped/failed:", genErr);
      }
    }

    const where: Record<string, unknown> = {
      companyId: user.companyId,
      userId: user.id,
    };
    if (unreadOnly) where.readAt = null;

    const rows = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await db.notification.count({
      where: { companyId: user.companyId, userId: user.id, readAt: null },
    });

    return NextResponse.json({
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entityType,
        entityId: n.entityId,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unreadCount,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Mark all as read (POST with no body). */
export async function POST() {
  try {
    const user = await requireUser();
    const result = await db.notification.updateMany({
      where: { companyId: user.companyId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ updated: result.count });
  } catch (err) {
    return errorResponse(err);
  }
}
