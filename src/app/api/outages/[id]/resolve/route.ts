import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, parseJsonBody, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const resolveSchema = z.object({
  endTime: z.string().optional(),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Resolve an ongoing outage incident. Sets status=RESOLVED, endTime=now (or
 * provided), and computes downtimeMinutes = (endTime - startTime) in minutes.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = resolveSchema.parse(await parseJsonBody(req));

    const existing = await db.outageIncident.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Outage incident not found");
    }
    if (existing.status === "RESOLVED") {
      throw new HttpError(400, "Incident is already resolved");
    }

    const endTime = body.endTime ? new Date(body.endTime) : new Date();
    if (endTime < existing.startTime) {
      throw new HttpError(400, "End time cannot be before start time");
    }
    const downtimeMinutes = Math.round(
      (endTime.getTime() - existing.startTime.getTime()) / 60000
    );

    const updated = await db.outageIncident.update({
      where: { id },
      data: {
        status: "RESOLVED",
        endTime,
        downtimeMinutes,
        resolvedById: user.id,
        notes: body.notes ?? existing.notes,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "OutageIncident",
      entityId: id,
      before: { status: existing.status },
      after: { status: "RESOLVED", downtimeMinutes },
    });

    return NextResponse.json({ id: updated.id, status: "RESOLVED", downtimeMinutes });
  } catch (err) {
    return errorResponse(err);
  }
}
