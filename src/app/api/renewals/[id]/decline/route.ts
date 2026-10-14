import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, parseJsonBody, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const declineSchema = z.object({
  reason: z.string().optional().nullable(),
});

/** Decline a pending renewal. Marks status=DECLINED; preserves the record. */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = declineSchema.parse(await parseJsonBody(req));

    const existing = await db.contractRenewal.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Renewal not found");
    }
    if (existing.status === "COMPLETED") {
      throw new HttpError(400, "Cannot decline a completed renewal");
    }

    const updated = await db.contractRenewal.update({
      where: { id },
      data: {
        status: "DECLINED",
        decisionDate: new Date(),
        decidedById: user.id,
        notes: body.reason ?? existing.notes,
      },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "ContractRenewal",
      entityId: id,
      after: { status: "DECLINED", reason: body.reason ?? null },
    });
    return NextResponse.json({ id: updated.id, status: "DECLINED" });
  } catch (err) {
    return errorResponse(err);
  }
}
