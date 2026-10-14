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
  providerId: z.string().min(1, "Provider is required"),
  name: z.string().min(1, "Name is required").max(128),
  bandwidthDownMbps: z.coerce.number().int().min(0),
  bandwidthUpMbps: z.coerce.number().int().min(0),
  connectionType: z
    .enum(["FIBER", "DSL", "CABLE", "WIRELESS", "SATELLITE", "OTHER"])
    .default("FIBER"),
  catalogMonthlyPrice: z.coerce.number().min(0),
  currency: z.string().min(3).max(3).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  description: z.string().max(2000).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const provider = url.searchParams.get("provider") ?? "";
    const min = url.searchParams.get("min") === "true";

    const where: Prisma.InternetPlanWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status } : {}),
      ...(provider ? { providerId: provider } : {}),
      ...(search ? { name: { contains: search } } : {}),
    };

    const rows = await db.internetPlan.findMany({
      where,
      include: {
        provider: { select: { id: true, code: true, name: true } },
        _count: { select: { services: true } },
      },
      orderBy: [{ name: "asc" }],
      take: 500,
    });

    if (min) {
      return NextResponse.json(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          providerId: r.providerId,
          bandwidthDownMbps: r.bandwidthDownMbps,
          status: r.status,
        }))
      );
    }

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        providerId: r.providerId,
        name: r.name,
        bandwidthDownMbps: r.bandwidthDownMbps,
        bandwidthUpMbps: r.bandwidthUpMbps,
        connectionType: r.connectionType,
        catalogMonthlyPrice: r.catalogMonthlyPrice.toString(),
        currency: r.currency,
        status: r.status,
        description: r.description,
        provider: r.provider,
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

    // Provider ownership check.
    const provider = await db.internetProvider.findUnique({
      where: { id: body.providerId },
    });
    if (!provider || provider.companyId !== user.companyId) {
      throw new HttpError(404, "Provider not found");
    }

    // Enforce unique (companyId, providerId, name).
    const dup = await db.internetPlan.findFirst({
      where: {
        companyId: user.companyId,
        providerId: body.providerId,
        name: body.name,
      },
    });
    if (dup) throw new HttpError(409, "Plan name already used for this provider");

    const created = await db.internetPlan.create({
      data: {
        companyId: user.companyId,
        providerId: body.providerId,
        name: body.name,
        bandwidthDownMbps: body.bandwidthDownMbps,
        bandwidthUpMbps: body.bandwidthUpMbps,
        connectionType: body.connectionType,
        catalogMonthlyPrice: new Prisma.Decimal(body.catalogMonthlyPrice),
        currency: body.currency ?? user.companyCurrency ?? "THB",
        status: body.status,
        description: body.description ?? null,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "InternetPlan",
      entityId: created.id,
      after: redactSensitive({ ...body }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
