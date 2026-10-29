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
  branchId: z.string().min(1).optional(),
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(128).optional(),
  type: z
    .enum([
      "KIOSK",
      "OFFICE",
      "RESTAURANT",
      "COFFEE",
      "MART",
      "RETAIL",
      "PHARMACY",
      "SALON",
      "FITNESS",
      "CLINIC",
      "STORAGE",
      "GARAGE",
      "OTHER",
    ])
    .optional(),
  contactPerson: z.string().max(128).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(128).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await db.shop.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        _count: { select: { services: true } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!s || s.companyId !== user.companyId) {
      throw new HttpError(404, "Shop not found");
    }
    return NextResponse.json({
      id: s.id,
      code: s.code,
      name: s.name,
      type: s.type,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      address: s.address,
      status: s.status,
      branchId: s.branchId,
      branch: s.branch,
      servicesCount: s._count.services,
      notes: s.notes.map((n) => ({
        id: n.id,
        body: n.body,
        authorId: n.authorId,
        author: n.author,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
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

    const existing = await db.shop.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Shop not found");
    }

    // Branch ownership if changing.
    if (body.branchId && body.branchId !== existing.branchId) {
      const b = await db.branch.findUnique({ where: { id: body.branchId } });
      if (!b || b.companyId !== user.companyId) {
        throw new HttpError(404, "Branch not found");
      }
    }

    // Unique (companyId, code) if changing.
    if (body.code && body.code !== existing.code) {
      const dup = await db.shop.findUnique({
        where: {
          companyId_code: { companyId: user.companyId, code: body.code },
        },
      });
      if (dup) throw new HttpError(409, "Shop code already used");
    }

    const data: Prisma.ShopUpdateInput = {};
    if (body.branchId) data.branch = { connect: { id: body.branchId } };
    if (body.code) data.code = body.code;
    if (body.name) data.name = body.name;
    if (body.type) data.type = body.type;
    if (body.contactPerson !== undefined)
      data.contactPerson = body.contactPerson ?? null;
    if (body.phone !== undefined) data.phone = body.phone ?? null;
    if (body.email !== undefined) data.email = body.email ?? null;
    if (body.address !== undefined) data.address = body.address ?? null;
    if (body.status) data.status = body.status;

    const updated = await db.shop.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "Shop",
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
    const existing = await db.shop.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) {
      throw new HttpError(404, "Shop not found");
    }
    // Refuse delete when the shop is referenced by internet services.
    const servicesCount = await db.internetService.count({
      where: { shopId: id },
    });
    if (servicesCount > 0) {
      throw new HttpError(
        400,
        `Shop has ${servicesCount} service(s); archive instead of delete`
      );
    }
    await db.shop.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "Shop",
      entityId: id,
      before: { code: existing.code, name: existing.name },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
