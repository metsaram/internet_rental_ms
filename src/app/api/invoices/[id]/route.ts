import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit, redactSensitive } from "@/lib/audit";
import { deriveInvoiceStatus, outstandingBalance } from "@/lib/billing";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

const updateSchema = z.object({
  invoiceNumber: z.string().min(1).max(64).optional(),
  invoiceDate: z.string().min(1).optional(),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  subtotal: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  status: z.enum(["DRAFT", "ISSUED", "PAID", "OVERDUE", "PARTIAL"]).optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const inv = await db.invoice.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            currency: true,
            service: {
              select: {
                id: true,
                serviceCode: true,
                branch: { select: { name: true, code: true } },
                provider: { select: { name: true, code: true } },
              },
            },
          },
        },
        createdBy: { select: { name: true, email: true } },
        allocations: {
          include: {
            payment: { select: { id: true, paymentDate: true, method: true, reference: true, status: true, currency: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!inv || inv.companyId !== user.companyId) throw new HttpError(404, "Invoice not found");
    const allocatedSum = inv.allocations
      .filter((a) => a.payment?.status !== "VOID")
      .reduce((acc, a) => acc.plus(a.amount), new Decimal(0));
    const outstanding = outstandingBalance(inv, inv.allocations);
    return NextResponse.json({
      ...inv,
      subtotal: inv.subtotal.toString(),
      tax: inv.tax.toString(),
      discount: inv.discount.toString(),
      total: inv.total.toString(),
      allocations: inv.allocations.map((a) => ({
        ...a,
        amount: a.amount.toString(),
      })),
      allocated: allocatedSum.toString(),
      outstanding: outstanding.toString(),
      derivedStatus: deriveInvoiceStatus(inv, inv.allocations),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = updateSchema.parse(await parseJsonBody(req));

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Invoice not found");
    }

    // VOID invoices are immutable (posted financial history preserved).
    if (existing.status === "VOID") {
      throw new HttpError(400, "Void invoices cannot be edited");
    }

    if (body.invoiceNumber && body.invoiceNumber !== existing.invoiceNumber) {
      const dup = await db.invoice.findUnique({
        where: { companyId_invoiceNumber: { companyId: user.companyId, invoiceNumber: body.invoiceNumber } },
      });
      if (dup) throw new HttpError(409, "Invoice number already used");
    }

    const data: Prisma.InvoiceUpdateInput = {};
    if (body.invoiceNumber) data.invoiceNumber = body.invoiceNumber;
    if (body.invoiceDate) data.invoiceDate = new Date(body.invoiceDate);
    if (body.periodStart !== undefined) data.periodStart = body.periodStart ? new Date(body.periodStart) : null;
    if (body.periodEnd !== undefined) data.periodEnd = body.periodEnd ? new Date(body.periodEnd) : null;
    if (body.subtotal !== undefined) data.subtotal = new Prisma.Decimal(body.subtotal);
    if (body.tax !== undefined) data.tax = new Prisma.Decimal(body.tax);
    if (body.discount !== undefined) data.discount = new Prisma.Decimal(body.discount);
    if (body.total !== undefined) data.total = new Prisma.Decimal(body.total);
    if (body.currency) data.currency = body.currency;
    if (body.status) data.status = body.status;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.notes !== undefined) data.notes = body.notes ?? null;

    const updated = await db.invoice.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Invoice",
      entityId: id,
      before: redactSensitive({ invoiceNumber: existing.invoiceNumber, status: existing.status, total: existing.total.toString() }),
      after: redactSensitive({ invoiceNumber: updated.invoiceNumber, status: updated.status, total: updated.total.toString() }),
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
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) throw new HttpError(404, "Invoice not found");
    // Only DRAFT invoices with no allocations can be hard-deleted.
    if (existing.status !== "DRAFT") {
      throw new HttpError(400, "Only draft invoices can be deleted; void instead to preserve history");
    }
    const allocCount = await db.paymentAllocation.count({ where: { invoiceId: id } });
    if (allocCount > 0) throw new HttpError(400, "Invoice has payments; void instead of delete");
    await db.invoice.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "Invoice",
      entityId: id,
      before: { invoiceNumber: existing.invoiceNumber },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
