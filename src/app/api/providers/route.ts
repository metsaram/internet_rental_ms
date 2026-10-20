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
  contactPerson: z.string().max(128).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(128).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const min = url.searchParams.get("min") === "true";

    const where: Prisma.InternetProviderWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { contactPerson: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await db.internetProvider.findMany({
      where,
      include: {
        _count: { select: { plans: true, services: true } },
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
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        website: r.website,
        status: r.status,
        notes: r.notes,
        plansCount: r._count.plans,
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
    const exists = await db.internetProvider.findUnique({
      where: {
        companyId_code: { companyId: user.companyId, code: body.code },
      },
    });
    if (exists) throw new HttpError(409, "Provider code already used");

    const created = await db.internetProvider.create({
      data: {
        companyId: user.companyId,
        code: body.code,
        name: body.name,
        contactPerson: body.contactPerson ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        website: body.website ?? null,
        status: body.status,
        notes: body.notes ?? null,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "InternetProvider",
      entityId: created.id,
      after: redactSensitive({ ...body }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
