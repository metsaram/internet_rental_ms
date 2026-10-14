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

const updateSchema = createPartial();

function createPartial() {
  return z.object({
    contractNumber: z.string().min(1).max(64).optional(),
    serviceId: z.string().min(1).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    durationMonths: z.number().int().min(1).max(120).optional(),
    freeMonths: z.number().int().min(0).max(120).optional(),
    monthlyFee: z.number().nonnegative().optional(),
    currency: z.string().min(3).max(3).optional(),
    billingCycle: z.enum(["MONTHLY","QUARTERLY","SEMI_ANNUAL","ANNUAL"]).optional(),
    status: z.enum(["DRAFT","ACTIVE","EXPIRED","TERMINATED","RENEWED"]).optional(),
    notes: z.string().optional().nullable(),
  });
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const r = await db.internetContract.findUnique({
      where: { id },
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
    });
    if (!r || r.companyId !== user.companyId) throw new HttpError(404, "Contract not found");
    const costs = computeContractCosts(r);
    const derived = deriveContractStatus(r);
    // Also fetch contract history for this service (prior/renewed terms).
    const history = await db.internetContract.findMany({
      where: { serviceId: r.serviceId, companyId: user.companyId },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyFee: true,
        currency: true,
        status: true,
        durationMonths: true,
        freeMonths: true,
      },
    });
    return NextResponse.json({
      ...r,
      // Flatten service relations for UI consistency with the list payload.
      serviceCode: r.service.serviceCode,
      branch: r.service.branch,
      shop: r.service.shop,
      provider: r.service.provider,
      plan: r.service.plan,
      monthlyFee: r.monthlyFee.toString(),
      costs: {
        paidMonths: costs.paidMonths,
        scheduledTotal: costs.scheduledTotal.toString(),
        effectiveMonthly: costs.effectiveMonthly.toString(),
      },
      derivedStatus: derived,
      history: history.map((h) => ({
        ...h,
        monthlyFee: h.monthlyFee.toString(),
        current: h.id === r.id,
      })),
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

    const existing = await db.internetContract.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Contract not found");
    }

    // If serviceId is changing, validate ownership.
    if (body.serviceId && body.serviceId !== existing.serviceId) {
      const svc = await db.internetService.findUnique({ where: { id: body.serviceId } });
      if (!svc || svc.companyId !== user.companyId) throw new HttpError(404, "Service not found");
    }

    // Unique contract number if changed.
    if (body.contractNumber && body.contractNumber !== existing.contractNumber) {
      const dup = await db.internetContract.findUnique({
        where: { companyId_contractNumber: { companyId: user.companyId, contractNumber: body.contractNumber } },
      });
      if (dup) throw new HttpError(409, "Contract number already used");
    }

    const data: Prisma.InternetContractUpdateInput = {};
    if (body.contractNumber) data.contractNumber = body.contractNumber;
    if (body.serviceId) data.serviceId = body.serviceId;
    if (body.startDate) data.startDate = new Date(body.startDate);
    if (body.endDate) data.endDate = new Date(body.endDate);
    if (body.durationMonths !== undefined) data.durationMonths = body.durationMonths;
    if (body.freeMonths !== undefined) data.freeMonths = body.freeMonths;
    if (body.monthlyFee !== undefined) data.monthlyFee = new Prisma.Decimal(body.monthlyFee);
    if (body.currency) data.currency = body.currency;
    if (body.billingCycle) data.billingCycle = body.billingCycle;
    if (body.status) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes ?? null;

    // Consistency checks after merge.
    const mergedDuration = data.durationMonths ?? existing.durationMonths;
    const mergedFree = data.freeMonths ?? existing.freeMonths;
    if (mergedFree > mergedDuration) throw new HttpError(400, "Free months exceed duration");
    const mergedStart = data.startDate ? new Date(body.startDate) : existing.startDate;
    const mergedEnd = data.endDate ? new Date(body.endDate) : existing.endDate;
    if (mergedEnd < mergedStart) throw new HttpError(400, "End date must be on or after start date");

    const updated = await db.internetContract.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "InternetContract",
      entityId: id,
      before: redactSensitive({
        contractNumber: existing.contractNumber,
        monthlyFee: existing.monthlyFee.toString(),
        status: existing.status,
      }),
      after: redactSensitive({
        contractNumber: updated.contractNumber,
        monthlyFee: updated.monthlyFee.toString(),
        status: updated.status,
      }),
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
    const existing = await db.internetContract.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Contract not found");
    }
    // Only drafts may be hard-deleted; others are archived via status change.
    if (existing.status !== "DRAFT") {
      throw new HttpError(400, "Only draft contracts can be deleted; archive instead");
    }
    await db.internetContract.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "InternetContract",
      entityId: id,
      before: { contractNumber: existing.contractNumber },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
