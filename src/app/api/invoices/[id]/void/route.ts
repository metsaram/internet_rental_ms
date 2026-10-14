import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, HttpError, errorResponse } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/**
 * Void an invoice. This preserves posted financial history — the invoice
 * record stays but is marked VOID. Related allocations are left in place so
 * the audit trail is intact; outstanding-balance calculations treat VOID
 * invoices as irrelevant (the derived status returns "void").
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Invoice not found");
    }
    if (existing.status === "VOID") {
      throw new HttpError(400, "Invoice is already void");
    }
    const updated = await db.invoice.update({
      where: { id },
      data: { status: "VOID" },
    });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      before: { invoiceNumber: existing.invoiceNumber, status: existing.status },
      after: { invoiceNumber: updated.invoiceNumber, status: "VOID" },
    });
    return NextResponse.json({ id: updated.id, status: "VOID" });
  } catch (err) {
    return errorResponse(err);
  }
}
