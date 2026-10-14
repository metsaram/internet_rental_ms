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

const createSchema = z.object({
  contractId: z.string().min(1, "Contract is required"),
  invoiceNumber: z.string().min(1).max(64),
  invoiceDate: z.string().min(1),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  subtotal: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  currency: z.string().min(3).max(3).default("THB"),
  status: z.enum(["DRAFT", "ISSUED", "PAID", "OVERDUE", "PARTIAL"]).default("DRAFT"),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";

    const where: Prisma.InvoiceWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search } },
              { contract: { contractNumber: { contains: search } } },
            ],
          }
        : {}),
    };

    const rows = await db.invoice.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            service: {
              select: {
                id: true,
                serviceCode: true,
                branch: { select: { id: true, name: true, code: true } },
                provider: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        allocations: { include: { payment: { select: { status: true, reference: true, method: true, paymentDate: true } } } },
      },
      orderBy: { invoiceDate: "desc" },
      take: 500,
    });

    const now = new Date();
    return NextResponse.json(
      rows.map((r) => {
        const allocated = outstandingBalance(r, r.allocations);
        // allocated here is outstanding, but we want both numbers
        const allocatedSum = r.allocations
          .filter((a) => a.payment?.status !== "VOID")
          .reduce((acc, a) => acc.plus(a.amount), new Decimal(0));
        return {
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          contractId: r.contractId,
          contractNumber: r.contract.contractNumber,
          branch: r.contract.service.branch,
          provider: r.contract.service.provider,
          serviceCode: r.contract.service.serviceCode,
          invoiceDate: r.invoiceDate,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          subtotal: r.subtotal.toString(),
          tax: r.tax.toString(),
          discount: r.discount.toString(),
          total: r.total.toString(),
          currency: r.currency,
          status: r.status,
          derivedStatus: deriveInvoiceStatus(r, r.allocations, now),
          dueDate: r.dueDate,
          notes: r.notes,
          createdBy: r.createdBy,
          createdAt: r.createdAt,
          allocated: allocatedSum.toString(),
          outstanding: allocated.toString(),
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

    // Validate contract ownership.
    const contract = await db.internetContract.findUnique({
      where: { id: body.contractId },
    });
    if (!contract || contract.companyId !== user.companyId) {
      throw new HttpError(404, "Contract not found");
    }

    const dup = await db.invoice.findUnique({
      where: { companyId_invoiceNumber: { companyId: user.companyId, invoiceNumber: body.invoiceNumber } },
    });
    if (dup) throw new HttpError(409, "Invoice number already used");

    const created = await db.invoice.create({
      data: {
        companyId: user.companyId,
        contractId: body.contractId,
        invoiceNumber: body.invoiceNumber,
        invoiceDate: new Date(body.invoiceDate),
        periodStart: body.periodStart ? new Date(body.periodStart) : null,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
        subtotal: new Prisma.Decimal(body.subtotal),
        tax: new Prisma.Decimal(body.tax),
        discount: new Prisma.Decimal(body.discount),
        total: new Prisma.Decimal(body.total),
        currency: body.currency,
        status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes ?? null,
        createdById: user.id,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Invoice",
      entityId: created.id,
      after: redactSensitive({ ...body }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
