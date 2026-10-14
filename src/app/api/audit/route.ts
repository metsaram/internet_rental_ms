import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/session";

/**
 * Recent audit log entries for the caller's company.
 * Admin-only view; returns actor/action/entity/timestamps and redacted
 * before/after JSON. Ordinary users cannot access this.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.auditLog.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { name: true, email: true } } },
    });
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actor: r.actor ? r.actor.name ?? r.actor.email : "system",
        before: r.before ? tryParse(r.before) : null,
        after: r.after ? tryParse(r.after) : null,
        correlationId: r.correlationId,
        createdAt: r.createdAt,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
