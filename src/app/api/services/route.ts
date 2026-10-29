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
  shopId: z.string().nullable().optional(),
  providerId: z.string().min(1, "Provider is required"),
  planId: z.string().nullable().optional(),
  serviceCode: z.string().min(1).max(64),
  accountId: z.string().max(64).optional().nullable(),
  customerId: z.string().max(64).optional().nullable(),
  ispServiceId: z.string().max(64).optional().nullable(),
  installationAddress: z.string().max(255).optional().nullable(),
  ipAddress: z.string().max(45).optional().nullable(),
  ipType: z.enum(["STATIC","DYNAMIC","CGNAT"]).default("DYNAMIC"),
  username: z.string().max(128).optional().nullable(),
  status: z.enum(["ACTIVE","SUSPENDED","TERMINATED","PENDING"]).default("PENDING"),
  installedAt: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const providerId = url.searchParams.get("providerId") ?? url.searchParams.get("provider") ?? "ALL";
    const min = url.searchParams.get("min") === "true";
    const sort = url.searchParams.get("sort") ?? "newest";

    const where: Prisma.InternetServiceWhereInput = {
      companyId: user.companyId,
      ...(status !== "ALL" ? { status: status as any } : {}),
      ...(providerId !== "ALL" ? { providerId } : {}),
      ...(search
        ? {
            OR: [
              { serviceCode: { contains: search, mode: "insensitive" } },
              { accountId: { contains: search, mode: "insensitive" } },
              { customerId: { contains: search, mode: "insensitive" } },
              { ispServiceId: { contains: search, mode: "insensitive" } },
              { installationAddress: { contains: search, mode: "insensitive" } },
              { ipAddress: { contains: search, mode: "insensitive" } },
              { branch: { name: { contains: search, mode: "insensitive" } } },
              { branch: { code: { contains: search, mode: "insensitive" } } },
              { shop: { name: { contains: search, mode: "insensitive" } } },
              { shop: { code: { contains: search, mode: "insensitive" } } },
              { provider: { name: { contains: search, mode: "insensitive" } } },
              { provider: { code: { contains: search, mode: "insensitive" } } },
              { plan: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.InternetServiceOrderByWithRelationInput =
      sort === "code"
        ? { serviceCode: "asc" }
        : sort === "oldest"
        ? { createdAt: "asc" }
        : { createdAt: "desc" };

    const rows = await db.internetService.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        shop: { select: { id: true, name: true, code: true } },
        provider: { select: { id: true, name: true, code: true } },
        plan: { select: { id: true, name: true } },
      },
      orderBy,
      take: 500,
    });

    if (min) {
      return NextResponse.json(
        rows.map((r) => ({
          id: r.id,
          serviceCode: r.serviceCode,
          customerId: r.customerId,
          ispServiceId: r.ispServiceId,
          branch: r.branch,
          shop: r.shop,
          provider: r.provider,
        }))
      );
    }

    // Full payload: username redacted in list view.
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        serviceCode: r.serviceCode,
        accountId: r.accountId,
        customerId: r.customerId,
        ispServiceId: r.ispServiceId,
        installationAddress: r.installationAddress,
        ipAddress: r.ipAddress,
        ipType: r.ipType,
        status: r.status,
        installedAt: r.installedAt,
        // username is sensitive — return only whether it is set.
        hasCredentials: !!r.username,
        branch: r.branch,
        shop: r.shop,
        provider: r.provider,
        plan: r.plan,
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

    // Branch ownership
    const branch = await db.branch.findUnique({ where: { id: body.branchId } });
    if (!branch || branch.companyId !== user.companyId) throw new HttpError(404, "Branch not found");
    if (body.shopId) {
      const shop = await db.shop.findUnique({ where: { id: body.shopId } });
      if (!shop || shop.companyId !== user.companyId) throw new HttpError(404, "Shop not found");
      if (shop.branchId !== body.branchId) throw new HttpError(400, "Shop does not belong to this branch");
    }
    const provider = await db.internetProvider.findUnique({ where: { id: body.providerId } });
    if (!provider || provider.companyId !== user.companyId) throw new HttpError(404, "Provider not found");
    if (body.planId) {
      const plan = await db.internetPlan.findUnique({ where: { id: body.planId } });
      if (!plan || plan.companyId !== user.companyId) throw new HttpError(404, "Plan not found");
      if (plan.providerId !== body.providerId) throw new HttpError(400, "Plan does not belong to this provider");
    }

    // Unique service code per company.
    const dup = await db.internetService.findUnique({
      where: { companyId_serviceCode: { companyId: user.companyId, serviceCode: body.serviceCode } },
    });
    if (dup) throw new HttpError(409, "Service code already used");

    const created = await db.internetService.create({
      data: {
        companyId: user.companyId,
        branchId: body.branchId,
        shopId: body.shopId ?? null,
        providerId: body.providerId,
        planId: body.planId ?? null,
        serviceCode: body.serviceCode,
        accountId: body.accountId ?? null,
        customerId: body.customerId ?? null,
        ispServiceId: body.ispServiceId ?? null,
        installationAddress: body.installationAddress ?? null,
        ipAddress: body.ipAddress ?? null,
        ipType: body.ipType,
        username: body.username ?? null,
        status: body.status,
        installedAt: body.installedAt ? new Date(body.installedAt) : null,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "InternetService",
      entityId: created.id,
      after: redactSensitive({ ...body }),
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
