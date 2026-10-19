import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser,
  parseJsonBody,
  HttpError,
  errorResponse,
} from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  type: z.enum(["OUTAGE", "DEGRADED", "MAINTENANCE", "EQUIPMENT_FAILURE", "PROVIDER_ISSUE", "OTHER"]).default("OUTAGE"),
  startTime: z.string().min(1),
  notes: z.string().optional().nullable(),
});

/** List outage incidents for the company. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "ALL";

    const rows = await db.outageIncident.findMany({
      where: {
        companyId: user.companyId,
        ...(status !== "ALL" ? { status } : {}),
      },
      include: {
        service: {
          select: {
            id: true,
            serviceCode: true,
            branch: { select: { name: true, code: true } },
            shop: { select: { name: true, code: true } },
            provider: { select: { name: true, code: true } },
          },
        },
        reportedBy: { select: { name: true, email: true } },
        resolvedBy: { select: { name: true, email: true } },
      },
      orderBy: { startTime: "desc" },
      take: 200,
    });

    return NextResponse.json(
      rows.map((o) => ({
        id: o.id,
        serviceId: o.serviceId,
        serviceCode: o.service.serviceCode,
        branch: o.service.branch,
        shop: o.service.shop,
        provider: o.service.provider,
        type: o.type,
        status: o.status,
        startTime: o.startTime,
        endTime: o.endTime,
        downtimeMinutes: o.downtimeMinutes,
        notes: o.notes,
        reportedBy: o.reportedBy,
        resolvedBy: o.resolvedBy,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create a new outage incident (ONGOING by default). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await parseJsonBody(req));

    // Validate service ownership
    const service = await db.internetService.findUnique({ where: { id: body.serviceId } });
    if (!service || service.companyId !== user.companyId) {
      throw new HttpError(404, "Service not found");
    }

    const created = await db.outageIncident.create({
      data: {
        companyId: user.companyId,
        serviceId: body.serviceId,
        type: body.type,
        status: "ONGOING",
        startTime: new Date(body.startTime),
        notes: body.notes ?? null,
        reportedById: user.id,
      },
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "OutageIncident",
      entityId: created.id,
      after: { serviceId: body.serviceId, type: body.type, startTime: body.startTime },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
