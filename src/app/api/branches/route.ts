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
  code: z.string().min(1, "Code is required").max(64),
  name: z.string().min(1, "Name is required").max(128),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(128).optional().nullable(),
  manager: z.string().max(128).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(128).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const min = url.searchParams.get("min") === "true";

    const where: Prisma.BranchWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { manager: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await db.branch.findMany({
      where,
      include: {
        _count: { select: { shops: true, services: true } },
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
          status: r.status,
        }))
      );
    }

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        address: r.address,
        city: r.city,
        manager: r.manager,
        phone: r.phone,
        email: r.email,
        status: r.status,
        shopsCount: r._count.shops,
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

    // Enforce unique (companyId, code).
    const exists = await db.branch.findUnique({
      where: {
        companyId_code: { companyId: user.companyId, code: body.code },
      },
    });
    if (exists) throw new HttpError(409, "Branch code already used");

    const created = await db.branch.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        name: body.name,
        address: body.address ?? null,
        city: body.city ?? null,
        manager: body.manager ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        status: body.status,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "Branch",
      entityId: created.id,
      after: redactSensitive({ ...body }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
