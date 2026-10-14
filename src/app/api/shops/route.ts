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

const createSchema = z.object({
  branchId: z.string().min(1, "Branch is required"),
  code: z.string().min(1, "Code is required").max(64),
  name: z.string().min(1, "Name is required").max(128),
  type: z
    .enum(["UNIT", "KIOSK", "OFFICE", "RESTAURANT", "OTHER"])
    .default("UNIT"),
  contactPerson: z.string().max(128).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(128).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const min = url.searchParams.get("min") === "true";

    const where: Prisma.ShopWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { name: { contains: search } },
              { contactPerson: { contains: search } },
              { branch: { name: { contains: search } } },
            ],
          }
        : {}),
    };

    const rows = await db.shop.findMany({
      where,
      include: {
        branch: { select: { id: true, code: true, name: true } },
        _count: { select: { services: true } },
      },
      orderBy: [{ code: "asc" }],
      take: 500,
    });

    if (min) {
      return NextResponse.json(
        rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          branchId: r.branchId,
          status: r.status,
        }))
      );
    }

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        address: r.address,
        status: r.status,
        branchId: r.branchId,
        branch: r.branch,
        servicesCount: r._count.services,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await parseJsonBody(req));

    // Branch must belong to caller's company.
    const branch = await db.branch.findUnique({ where: { id: body.branchId } });
    if (!branch || branch.companyId !== user.companyId) {
      throw new HttpError(404, "Branch not found");
    }

    // Enforce unique (companyId, code).
    const exists = await db.shop.findUnique({
      where: {
        companyId_code: { companyId: user.companyId, code: body.code },
      },
    });
    if (exists) throw new HttpError(409, "Shop code already used");

    const created = await db.shop.create({
      data: {
        companyId: user.companyId,
        branchId: body.branchId,
        code: body.code,
        name: body.name,
        type: body.type,
        contactPerson: body.contactPerson ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        status: body.status,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Shop",
      entityId: created.id,
      after: redactSensitive({ ...body }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
