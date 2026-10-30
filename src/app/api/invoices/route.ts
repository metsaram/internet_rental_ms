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
  contractId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  invoiceNumber: z.string().min(1).max(64),
  invoiceDate: z.string().min(1),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  subtotal: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  currency: z.string().min(3).max(3).default("USD"),
  status: z.enum(["DRAFT", "ISSUED", "PAID", "OVERDUE", "PARTIAL"]).default("DRAFT"),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Schedule & Duration helper fields (client-only, not persisted)
  scheduledMonths: z.number().int().min(1).optional().nullable(),
  installationFee: z.number().nonnegative().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const providerId = url.searchParams.get("providerId") ?? url.searchParams.get("provider") ?? "ALL";

    const where: Prisma.InvoiceWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status: status as any } : {}),
      ...(providerId !== "ALL"
        ? {
            OR: [
              { contract: { service: { providerId } } },
              { service: { providerId } },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" } },
              { contract: { contractNumber: { contains: search, mode: "insensitive" } } },
              { contract: { service: { serviceCode: { contains: search, mode: "insensitive" } } } },
              { contract: { service: { branch: { name: { contains: search, mode: "insensitive" } } } } },
              { contract: { service: { provider: { name: { contains: search, mode: "insensitive" } } } } },
              { contract: { service: { provider: { code: { contains: search, mode: "insensitive" } } } } },
              { service: { serviceCode: { contains: search, mode: "insensitive" } } },
              { service: { branch: { name: { contains: search, mode: "insensitive" } } } },
              { service: { provider: { name: { contains: search, mode: "insensitive" } } } },
              { service: { provider: { code: { contains: search, mode: "insensitive" } } } },
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
                shop: { select: { id: true, name: true, code: true } },
                provider: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        service: {
          select: {
            id: true,
            serviceCode: true,
            branch: { select: { id: true, name: true, code: true } },
            shop: { select: { id: true, name: true, code: true } },
            provider: { select: { id: true, name: true, code: true } },
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
        const allocatedSum = r.allocations
          .filter((a) => a.payment?.status !== "VOID")
          .reduce((acc, a) => acc.plus(a.amount), new Decimal(0));
        let voidReason: string | null = null;
        if (r.notes && r.status === "VOID") {
          const match = r.notes.match(/\[Void reason\]:\s*(.+)$/m);
          if (match) voidReason = match[1].trim();
        }

        const svc = r.service ?? r.contract?.service;

        return {
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          contractId: r.contractId,
          contractNumber: r.contract?.contractNumber ?? "—",
          serviceId: r.serviceId ?? r.contract?.service?.id ?? null,
          branch: svc?.branch ?? null,
          shop: svc?.shop ?? null,
          provider: svc?.provider ?? null,
          serviceCode: svc?.serviceCode ?? "—",
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
          voidReason,
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

    // Look up company to check useContract setting.
    const company = await db.company.findUnique({ where: { id: user.companyId } });
    if (!company) throw new HttpError(404, "Company not found");

    const requiresContract = company.useContract;

    let contractId: string | null = body.contractId ?? null;
    let serviceId: string | null = body.serviceId ?? null;

    if (requiresContract) {
      if (!contractId) throw new HttpError(400, "Contract is required");
      const contract = await db.internetContract.findUnique({
        where: { id: contractId },
        select: { id: true, companyId: true, serviceId: true },
      });
      if (!contract || contract.companyId !== user.companyId) {
        throw new HttpError(404, "Contract not found");
      }
      serviceId = contract.serviceId;
    } else {
      // Contract is optional. If contract provided, validate it and link service.
      if (contractId) {
        const contract = await db.internetContract.findUnique({
          where: { id: contractId },
          select: { id: true, companyId: true, serviceId: true },
        });
        if (!contract || contract.companyId !== user.companyId) {
          throw new HttpError(404, "Contract not found");
        }
        serviceId = contract.serviceId;
      } else if (serviceId) {
        // Direct service link without contract
        const svc = await db.internetService.findUnique({
          where: { id: serviceId },
          select: { id: true, companyId: true },
        });
        if (!svc || svc.companyId !== user.companyId) {
          throw new HttpError(404, "Service not found");
        }
      } else {
        throw new HttpError(400, "Please select an installed service or contract for this invoice.");
      }
    }

    const dup = await db.invoice.findUnique({
      where: { companyId_invoiceNumber: { companyId: user.companyId, invoiceNumber: body.invoiceNumber } },
    });
    if (dup) throw new HttpError(409, "Invoice number already used");

    const created = await db.invoice.create({
      data: {
        companyId: user.companyId,
        contractId: contractId ?? null,
        serviceId: serviceId ?? null,
        invoiceNumber: body.invoiceNumber,
        invoiceDate: new Date(body.invoiceDate),
        periodStart: body.periodStart ? new Date(body.periodStart) : null,
        periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
        subtotal: body.subtotal,
        tax: body.tax,
        discount: body.discount,
        total: body.total,
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
      after: redactSensitive({ ...body, scheduledMonths: undefined, installationFee: undefined }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
