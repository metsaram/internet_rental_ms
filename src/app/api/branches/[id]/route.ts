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
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(128).optional().nullable(),
  manager: z.string().max(128).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(128).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const b = await db.branch.findUnique({
      where: { id },
      include: {
        _count: { select: { shops: true, services: true } },
      },
    });
    if (!b || b.companyId !== user.companyId) {
      throw new HttpError(404, "Branch not found");
    }
    return NextResponse.json({
      id: b.id,
      code: b.code,
      name: b.name,
      address: b.address,
      city: b.city,
      manager: b.manager,
      phone: b.phone,
      email: b.email,
      status: b.status,
      shopsCount: b._count.shops,
      servicesCount: b._count.services,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
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

    const existing = await db.branch.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Branch not found");
    }

    // Unique (companyId, code) if changing.
    if (body.code && body.code !== existing.code) {
      const dup = await db.branch.findUnique({
        where: {
          companyId_code: { companyId: user.companyId, code: body.code },
        },
      });
      if (dup) throw new HttpError(409, "Branch code already used");
    }

    const data: Prisma.BranchUpdateInput = {};
    if (body.code) data.code = body.code;
    if (body.name) data.name = body.name;
    if (body.address !== undefined) data.address = body.address ?? null;
    if (body.city !== undefined) data.city = body.city ?? null;
    if (body.manager !== undefined) data.manager = body.manager ?? null;
    if (body.phone !== undefined) data.phone = body.phone ?? null;
    if (body.email !== undefined) data.email = body.email ?? null;
    if (body.status) data.status = body.status;

    const updated = await db.branch.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Branch",
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
    const existing = await db.branch.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Branch not found");
    }
    // Refuse to delete when the branch is referenced by shops or services.
    const [shopsCount, servicesCount] = await Promise.all([
      db.shop.count({ where: { branchId: id } }),
      db.internetService.count({ where: { branchId: id } }),
    ]);
    if (shopsCount > 0 || servicesCount > 0) {
      throw new HttpError(
        400,
        "Branch has shops or services; archive instead"
      );
    }
    await db.branch.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "Branch",
      entityId: id,
      before: { code: existing.code, name: existing.name },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
