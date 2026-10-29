import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, parseJsonBody, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const voidSchema = z.object({
  reason: z.string().trim().min(1, "Void reason is required").max(500, "Reason too long"),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Void an invoice. This preserves posted financial history — the invoice
 * record stays but is marked VOID with a mandatory void reason.
 * Related allocations are left in place so the audit trail is intact.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = voidSchema.parse(await parseJsonBody(req));

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Invoice not found");
    }
    if (existing.status === "VOID") {
      throw new HttpError(400, "Invoice is already void");
    }

    const updatedNotes = existing.notes
      ? `${existing.notes}\n[Void reason]: ${body.reason}`
      : `[Void reason]: ${body.reason}`;

    const updated = await db.invoice.update({
      where: { id },
      data: {
        status: "VOID",
        notes: updatedNotes,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      before: { invoiceNumber: existing.invoiceNumber, status: existing.status },
      after: { invoiceNumber: updated.invoiceNumber, status: "VOID", voidReason: body.reason },
    });

    return NextResponse.json({ id: updated.id, status: "VOID", voidReason: body.reason });
  } catch (err) {
    return errorResponse(err);
  }
}

