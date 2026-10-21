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
  shopId: z.string().nullable().optional(),
  providerId: z.string().min(1).optional(),
  planId: z.string().nullable().optional(),
  serviceCode: z.string().min(1).max(64).optional(),
  accountId: z.string().max(64).optional().nullable(),
  customerId: z.string().max(64).optional().nullable(),
  ispServiceId: z.string().max(64).optional().nullable(),
  installationAddress: z.string().max(255).optional().nullable(),
  ipAddress: z.string().max(45).optional().nullable(),
  ipType: z.enum(["STATIC","DYNAMIC","CGNAT"]).optional(),
  username: z.string().max(128).optional().nullable(),
  status: z.enum(["ACTIVE","SUSPENDED","TERMINATED","PENDING"]).optional(),
  installedAt: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const s = await db.internetService.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        shop: { select: { id: true, name: true, code: true } },
        provider: { select: { id: true, name: true, code: true } },
        plan: { select: { id: true, name: true } },
        contracts: {
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
        },
      },
    });
    if (!s || s.companyId !== user.companyId) throw new HttpError(404, "Service not found");
    // Return username only on the detail endpoint (still: this is for authorized staff).
    return NextResponse.json({
      ...s,
      username: s.username,
      contracts: s.contracts.map((c) => ({ ...c, monthlyFee: c.monthlyFee.toString() })),
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

    const existing = await db.internetService.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) throw new HttpError(404, "Service not found");

    if (body.serviceCode && body.serviceCode !== existing.serviceCode) {
      const dup = await db.internetService.findUnique({
        where: { companyId_serviceCode: { companyId: user.companyId, serviceCode: body.serviceCode } },
      });
      if (dup) throw new HttpError(409, "Service code already used");
    }
    if (body.branchId) {
      const b = await db.branch.findUnique({ where: { id: body.branchId } });
      if (!b || b.companyId !== user.companyId) throw new HttpError(404, "Branch not found");
    }
    if (body.shopId) {
      const s = await db.shop.findUnique({ where: { id: body.shopId } });
      if (!s || s.companyId !== user.companyId) throw new HttpError(404, "Shop not found");
    }
    if (body.providerId) {
      const p = await db.internetProvider.findUnique({ where: { id: body.providerId } });
      if (!p || p.companyId !== user.companyId) throw new HttpError(404, "Provider not found");
    }

    const data: Prisma.InternetServiceUpdateInput = {};
    if (body.branchId) data.branch = { connect: { id: body.branchId } };
    if (body.shopId !== undefined) data.shop = body.shopId ? { connect: { id: body.shopId } } : { disconnect: true };
    if (body.providerId) data.provider = { connect: { id: body.providerId } };
    if (body.planId !== undefined) data.plan = body.planId ? { connect: { id: body.planId } } : { disconnect: true };
    if (body.serviceCode) data.serviceCode = body.serviceCode;
    if (body.accountId !== undefined) data.accountId = body.accountId;
    if (body.customerId !== undefined) data.customerId = body.customerId;
    if (body.ispServiceId !== undefined) data.ispServiceId = body.ispServiceId;
    if (body.installationAddress !== undefined) data.installationAddress = body.installationAddress;
    if (body.ipAddress !== undefined) data.ipAddress = body.ipAddress;
    if (body.ipType) data.ipType = body.ipType;
    if (body.username !== undefined) data.username = body.username;
    if (body.status) data.status = body.status;
    if (body.installedAt !== undefined) data.installedAt = body.installedAt ? new Date(body.installedAt) : null;

    const updated = await db.internetService.update({ where: { id }, data });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "UPDATE",
      entityType: "InternetService",
      entityId: id,
      before: redactSensitive({ serviceCode: existing.serviceCode, customerId: existing.customerId, ispServiceId: existing.ispServiceId, status: existing.status, username: existing.username }),
      after: redactSensitive({ serviceCode: updated.serviceCode, customerId: updated.customerId, ispServiceId: updated.ispServiceId, status: updated.status, username: updated.username }),
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
    const existing = await db.internetService.findUnique({ where: { id } });
    if (!existing || existing.companyId !== user.companyId) throw new HttpError(404, "Service not found");
    // Services with contracts can't be hard-deleted (FK Restrict).
    const contractCount = await db.internetContract.count({ where: { serviceId: id } });
    if (contractCount > 0) {
      throw new HttpError(400, `Service has ${contractCount} contract(s); archive instead of delete`);
    }
    await db.internetService.delete({ where: { id } });
    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "DELETE",
      entityType: "InternetService",
      entityId: id,
      before: { serviceCode: existing.serviceCode },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
