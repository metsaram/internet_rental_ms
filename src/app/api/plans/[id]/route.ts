import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit, redactSensitive } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  providerId: z.string().min(1).optional(),
  name: z.string().min(1).max(128).optional(),
  bandwidthDownMbps: z.coerce.number().int().min(0).optional(),
  bandwidthUpMbps: z.coerce.number().int().min(0).optional(),
  connectionType: z
    .enum(["FIBER", "DSL", "CABLE", "WIRELESS", "SATELLITE", "OTHER"])
    .optional(),
  catalogMonthlyPrice: z.coerce.number().min(0).optional(),
  currency: z.string().min(3).max(3).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  description: z.string().max(2000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const p = await db.internetPlan.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, code: true, name: true } },
        _count: { select: { services: true } },
      },
    });
    if (!p || p.companyId !== user.companyId) {
      throw new HttpError(404, "Plan not found");
    }
    return NextResponse.json({
      id: p.id,
      providerId: p.providerId,
      name: p.name,
      bandwidthDownMbps: p.bandwidthDownMbps,
      bandwidthUpMbps: p.bandwidthUpMbps,
      connectionType: p.connectionType,
      catalogMonthlyPrice: p.catalogMonthlyPrice.toString(),
      currency: p.currency,
      status: p.status,
      description: p.description,
      provider: p.provider,
      servicesCount: p._count.services,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
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

    const existing = await db.internetPlan.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Plan not found");
    }

    // Plans are fixed to a provider — disallow changing providerId.
    if (body.providerId && body.providerId !== existing.providerId) {
      throw new HttpError(400, "Plan cannot be moved between providers");
    }

    // Enforce unique (companyId, providerId, name) if changing name.
    if (body.name && body.name !== existing.name) {
      const dup = await db.internetPlan.findFirst({
        where: {
          companyId: user.companyId,
          providerId: existing.providerId,
          name: body.name,
        },
      });
      if (dup) throw new HttpError(409, "Plan name already used for this provider");
    }

    const data: Prisma.InternetPlanUpdateInput = {};
    if (body.name) data.name = body.name;
    if (body.bandwidthDownMbps !== undefined)
      data.bandwidthDownMbps = body.bandwidthDownMbps;
    if (body.bandwidthUpMbps !== undefined)
      data.bandwidthUpMbps = body.bandwidthUpMbps;
    if (body.connectionType) data.connectionType = body.connectionType;
    if (body.catalogMonthlyPrice !== undefined)
      data.catalogMonthlyPrice = new Prisma.Decimal(body.catalogMonthlyPrice);
    if (body.currency) data.currency = body.currency;
    if (body.status) data.status = body.status;
    if (body.description !== undefined)
      data.description = body.description ?? null;

    const updated = await db.internetPlan.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "InternetPlan",
      entityId: id,
      before: redactSensitive({
        name: existing.name,
        status: existing.status,
        catalogMonthlyPrice: existing.catalogMonthlyPrice.toString(),
      }),
      after: redactSensitive({
        name: updated.name,
        status: updated.status,
        catalogMonthlyPrice: updated.catalogMonthlyPrice.toString(),
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
    const existing = await db.internetPlan.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Plan not found");
    }
    // Refuse to delete when the plan is referenced by services.
    const servicesCount = await db.internetService.count({
      where: { planId: id },
    });
    if (servicesCount > 0) {
      throw new HttpError(
        400,
        "Plan is referenced by services; archive instead"
      );
    }
    await db.internetPlan.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "InternetPlan",
      entityId: id,
      before: { name: existing.name },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
