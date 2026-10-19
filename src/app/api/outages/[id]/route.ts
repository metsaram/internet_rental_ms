import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Delete an outage incident (only if CANCELLED). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await db.outageIncident.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Outage incident not found");
    }
    if (existing.status === "RESOLVED") {
      throw new HttpError(400, "Resolved incidents cannot be deleted (preserve history)");
    }
    await db.outageIncident.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "OutageIncident",
      entityId: id,
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
