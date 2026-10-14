import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const p = await db.payment.findUnique({
      where: { id },
      include: {
        allocations: {
          include: { invoice: { select: { invoiceNumber: true, currency: true } } },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });
    if (!p || p.companyId !== user.companyId) throw new HttpError(404, "Payment not found");
    const allocated = p.allocations.reduce((acc, a) => acc.plus(a.amount), new Decimal(0));
    return NextResponse.json({
      ...p,
      amount: p.amount.toString(),
      allocations: p.allocations.map((a) => ({ ...a, amount: a.amount.toString() })),
      allocated: allocated.toString(),
      unallocated: new Decimal(p.amount).minus(allocated).toString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = z.object({
      reference: z.string().max(128).optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(await parseJsonBody(req));

    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) throw new HttpError(404, "Payment not found");
    if (existing.status === "VOID") throw new HttpError(400, "Void payments cannot be edited");

    const data: Prisma.PaymentUpdateInput = {};
    if (body.reference !== undefined) data.reference = body.reference;
    if (body.notes !== undefined) data.notes = body.notes;

    const updated = await db.payment.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Payment",
      entityId: id,
      after: { reference: updated.reference, notes: updated.notes },
    });
    return NextResponse.json({ id: updated.id });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) throw new HttpError(404, "Payment not found");
    if (existing.status === "VOID") throw new HttpError(400, "Payment already void");
    // Void rather than hard-delete to preserve financial history.
    const updated = await db.payment.update({ where: { id }, data: { status: "VOID" } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Payment",
      entityId: id,
      before: { status: existing.status },
      after: { status: "VOID" },
    });
    return NextResponse.json({ id: updated.id, status: "VOID" });
  } catch (err) {
    return errorResponse(err);
  }
}
