import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit, redactSensitive } from "@/lib/audit";
import { outstandingBalance } from "@/lib/billing";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

const allocationSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().nonnegative(),
});

const createSchema = z.object({
  paymentDate: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().min(3).max(3).default("THB"),
  method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "CHEQUE", "ONLINE", "OTHER"]).default("BANK_TRANSFER"),
  reference: z.string().max(128).optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z.array(allocationSchema).default([]),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";

    const where: Prisma.PaymentWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status } : {}),
      ...(search
        ? { OR: [{ reference: { contains: search, mode: "insensitive" } }, { notes: { contains: search, mode: "insensitive" } }] }
        : {}),
    };

    const rows = await db.payment.findMany({
      where,
      include: {
        allocations: {
          include: { invoice: { select: { invoiceNumber: true, currency: true } } },
        },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { paymentDate: "desc" },
      take: 200,
    });

    return NextResponse.json(
      rows.map((p) => {
        const allocated = p.allocations.reduce(
          (acc, a) => acc.plus(a.amount),
          new Decimal(0)
        );
        return {
          id: p.id,
          paymentDate: p.paymentDate,
          amount: p.amount.toString(),
          currency: p.currency,
          method: p.method,
          reference: p.reference,
          status: p.status,
          notes: p.notes,
          createdBy: p.createdBy,
          allocations: p.allocations.map((a) => ({
            id: a.id,
            invoiceId: a.invoiceId,
            invoiceNumber: a.invoice.invoiceNumber,
            amount: a.amount.toString(),
          })),
          unallocated: new Decimal(p.amount).minus(allocated).toString(),
        };
      })
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await parseJsonBody(req));

    // Validate every allocation's invoice belongs to the company and the
    // allocated amount does not exceed the invoice's outstanding balance.
    if (body.allocations.length > 0) {
      const invoiceIds = Array.from(new Set(body.allocations.map((a) => a.invoiceId)));
      const invoices = await db.invoice.findMany({
        where: { id: { in: invoiceIds }, companyId: user.companyId },
        include: { allocations: { include: { payment: { select: { status: true } } } } },
      });
      if (invoices.length !== invoiceIds.length) {
        throw new HttpError(404, "One or more invoices not found in your company");
      }
      for (const inv of invoices) {
        const outstanding = outstandingBalance(inv, inv.allocations);
        const alloc = body.allocations.filter((a) => a.invoiceId === inv.id).reduce((s, a) => s + a.amount, 0);
        if (new Decimal(alloc).gt(outstanding)) {
          throw new HttpError(400, `Allocation for ${inv.invoiceNumber} (฿${alloc}) exceeds outstanding balance (฿${outstanding})`);
        }
      }
    }

    // Validate total allocated does not exceed payment amount.
    const totalAllocated = body.allocations.reduce((s, a) => s + a.amount, 0);
    if (totalAllocated > body.amount) {
      throw new HttpError(400, "Total allocated exceeds payment amount");
    }

    // Atomic create of payment + allocations.
    const created = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          companyId: user.companyId,
          paymentDate: new Date(body.paymentDate),
          amount: new Prisma.Decimal(body.amount),
          currency: body.currency,
          method: body.method,
          reference: body.reference ?? null,
          status: "COMPLETED",
          notes: body.notes ?? null,
          createdById: user.id,
        },
      });
      for (const a of body.allocations) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: a.invoiceId,
            amount: new Prisma.Decimal(a.amount),
          },
        });
      }
      return payment;
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Payment",
      entityId: created.id,
      after: redactSensitive({ amount: body.amount, method: body.method, allocations: body.allocations.length }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
