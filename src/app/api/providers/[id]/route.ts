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
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(128).optional(),
  contactPerson: z.string().max(128).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(128).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const p = await db.internetProvider.findUnique({
      where: { id },
      include: {
        _count: { select: { plans: true, services: true } },
      },
    });
    if (!p || p.companyId !== user.companyId) {
      throw new HttpError(404, "Provider not found");
    }
    return NextResponse.json({
      id: p.id,
      code: p.code,
      name: p.name,
      contactPerson: p.contactPerson,
      phone: p.phone,
      email: p.email,
      website: p.website,
      status: p.status,
      notes: p.notes,
      plansCount: p._count.plans,
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

    const existing = await db.internetProvider.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Provider not found");
    }

    // Unique (companyId, code) if changing.
    if (body.code && body.code !== existing.code) {
      const dup = await db.internetProvider.findUnique({
        where: {
          companyId_code: { companyId: user.companyId, code: body.code },
        },
      });
      if (dup) throw new HttpError(409, "Provider code already used");
    }

    const data: Prisma.InternetProviderUpdateInput = {};
    if (body.code) data.code = body.code;
    if (body.name) data.name = body.name;
    if (body.contactPerson !== undefined)
      data.contactPerson = body.contactPerson ?? null;
    if (body.phone !== undefined) data.phone = body.phone ?? null;
    if (body.email !== undefined) data.email = body.email ?? null;
    if (body.website !== undefined) data.website = body.website ?? null;
    if (body.status) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes ?? null;

    const updated = await db.internetProvider.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "InternetProvider",
      entityId: id,
      before: redactSensitive({
        code: existing.code,
        name: existing.name,
        status: existing.status,
      }),
      after: redactSensitive({
        code: updated.code,
        name: updated.name,
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
    const existing = await db.internetProvider.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Provider not found");
    }
    // Refuse to delete when the provider is referenced by plans or services.
    const [plansCount, servicesCount] = await Promise.all([
      db.internetPlan.count({ where: { providerId: id } }),
      db.internetService.count({ where: { providerId: id } }),
    ]);
    if (plansCount > 0 || servicesCount > 0) {
      throw new HttpError(
        400,
        "Provider has plans or services; archive instead"
      );
    }
    await db.internetProvider.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "InternetProvider",
      entityId: id,
      before: { code: existing.code, name: existing.name },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
