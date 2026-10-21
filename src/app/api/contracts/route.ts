import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit, redactSensitive } from "@/lib/audit";
import { computeContractCosts, deriveContractStatus } from "@/lib/contracts";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  contractNumber: z.string().min(1, "Contract number is required").max(64),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  durationMonths: z.number().int().min(1).max(120),
  freeMonths: z.number().int().min(0).max(120).default(0),
  monthlyFee: z.number().nonnegative(),
  currency: z.string().min(3).max(3).default("USD"),
  billingCycle: z.enum(["MONTHLY","QUARTERLY","SEMI_ANNUAL","ANNUAL"]).default("MONTHLY"),
  status: z.enum(["DRAFT","ACTIVE","EXPIRED","TERMINATED","RENEWED"]).default("DRAFT"),
  notes: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";

    const where: Prisma.InternetContractWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { contractNumber: { contains: search, mode: "insensitive" } },
              { service: { serviceCode: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const rows = await db.internetContract.findMany({
      where,
      include: {
        service: {
          select: {
            id: true,
            serviceCode: true,
            branch: { select: { id: true, name: true, code: true } },
            shop: { select: { id: true, name: true, code: true } },
            provider: { select: { id: true, name: true, code: true } },
            plan: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { endDate: "asc" },
      take: 500,
    });

    const now = new Date();
    return NextResponse.json(
      rows.map((r) => {
        const costs = computeContractCosts(r);
        const derived = deriveContractStatus(r, now, 30);
        return {
          id: r.id,
          contractNumber: r.contractNumber,
          serviceId: r.serviceId,
          serviceCode: r.service.serviceCode,
          branch: r.service.branch,
          shop: r.service.shop,
          provider: r.service.provider,
          plan: r.service.plan,
          startDate: r.startDate,
          endDate: r.endDate,
          durationMonths: r.durationMonths,
          freeMonths: r.freeMonths,
          monthlyFee: r.monthlyFee.toString(),
          currency: r.currency,
          billingCycle: r.billingCycle,
          status: r.status,
          derivedStatus: derived,
          notes: r.notes,
          createdBy: r.createdBy,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          paidMonths: costs.paidMonths,
          scheduledTotal: costs.scheduledTotal.toString(),
          effectiveMonthly: costs.effectiveMonthly.toString(),
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

    // Validate the service belongs to the caller's company.
    const service = await db.internetService.findUnique({
      where: { id: body.serviceId },
    });
    if (!service || service.companyId !== user.companyId) {
      throw new HttpError(404, "Service not found");
    }

    // Date validation: end >= start; end matches duration roughly.
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) throw new HttpError(400, "End date must be on or after start date");
    if (body.freeMonths > body.durationMonths) {
      throw new HttpError(400, "Free months cannot exceed contract duration");
    }

    // Enforce unique contract number per company.
    const exists = await db.internetContract.findUnique({
      where: { companyId_contractNumber: { companyId: user.companyId, contractNumber: body.contractNumber } },
    });
    if (exists) throw new HttpError(409, "Contract number already used");

    const created = await db.internetContract.create({
      data: {
        companyId: user.companyId,
        serviceId: body.serviceId,
        contractNumber: body.contractNumber,
        startDate: start,
        endDate: end,
        durationMonths: body.durationMonths,
        freeMonths: body.freeMonths,
        monthlyFee: new Prisma.Decimal(body.monthlyFee),
        currency: body.currency,
        billingCycle: body.billingCycle,
        status: body.status,
        notes: body.notes ?? null,
        createdById: user.id,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "InternetContract",
      entityId: created.id,
      after: redactSensitive({ ...body }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
