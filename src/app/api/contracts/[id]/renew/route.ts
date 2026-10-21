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

const renewSchema = z.object({
  contractNumber: z.string().min(1).max(64),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  durationMonths: z.number().int().min(1).max(120),
  freeMonths: z.number().int().min(0).max(120).default(0),
  monthlyFee: z.number().nonnegative(),
  currency: z.string().min(3).max(3).default("USD"),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).default("MONTHLY"),
  notes: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Renew an existing (expiring/expired) contract by creating a NEW contract
 * period and linking it via a ContractRenewal record. The old contract is
 * preserved unchanged (historical terms stay intact).
 *
 * Atomic: the new contract + renewal link are created in a single
 * transaction. Prevents duplicate renewals via the `@@unique([oldContractId])`
 * constraint on ContractRenewal.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id: oldContractId } = await params;
    const body = renewSchema.parse(await parseJsonBody(req));

    const oldContract = await db.internetContract.findUnique({
      where: { id: oldContractId },
      include: { renewalsAsOld: true },
    });
    if (!oldContract || oldContract.companyId !== user.companyId) {
      throw new HttpError(404, "Contract not found");
    }

    // Prevent duplicate renewals — only one renewal record per old contract.
    if (oldContract.renewalsAsOld.length > 0) {
      const existing = oldContract.renewalsAsOld[0];
      if (existing.status === "COMPLETED") {
        throw new HttpError(409, "This contract has already been renewed");
      }
    }

    // Validate dates.
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) throw new HttpError(400, "End date must be on or after start date");
    if (body.freeMonths > body.durationMonths) {
      throw new HttpError(400, "Free months cannot exceed duration");
    }

    // Enforce unique contract number per company.
    const dup = await db.internetContract.findUnique({
      where: {
        companyId_contractNumber: {
          companyId: user.companyId,
          contractNumber: body.contractNumber,
        },
      },
    });
    if (dup) throw new HttpError(409, "Contract number already used");

    // Atomic create: new contract + renewal link.
    const result = await db.$transaction(async (tx) => {
      const newContract = await tx.internetContract.create({
        data: {
          companyId: user.companyId,
          serviceId: oldContract.serviceId,
          contractNumber: body.contractNumber,
          startDate: start,
          endDate: end,
          durationMonths: body.durationMonths,
          freeMonths: body.freeMonths,
          monthlyFee: new Prisma.Decimal(body.monthlyFee),
          currency: body.currency,
          billingCycle: body.billingCycle,
          status: "ACTIVE",
          notes: body.notes ?? null,
          createdById: user.id,
        },
      });

      // Mark old contract as RENEWED (preserves the record, signals it was
      // superseded rather than just expiring).
      await tx.internetContract.update({
        where: { id: oldContractId },
        data: { status: "RENEWED" },
      });

      // Upsert the renewal record (handles both a pre-existing PENDING
      // renewal and the no-prior-renewal case).
      const renewal = await tx.contractRenewal.upsert({
        where: { oldContractId },
        update: {
          newContractId: newContract.id,
          status: "COMPLETED",
          decisionDate: new Date(),
          decidedById: user.id,
          newStartDate: start,
          newEndDate: end,
          newMonthlyFee: new Prisma.Decimal(body.monthlyFee),
          newCurrency: body.currency,
          newDurationMonths: body.durationMonths,
          newFreeMonths: body.freeMonths,
          notes: body.notes ?? null,
        },
        create: {
          companyId: user.companyId,
          oldContractId,
          newContractId: newContract.id,
          serviceId: oldContract.serviceId,
          decisionDate: new Date(),
          decidedById: user.id,
          status: "COMPLETED",
          newStartDate: start,
          newEndDate: end,
          newMonthlyFee: new Prisma.Decimal(body.monthlyFee),
          newCurrency: body.currency,
          newDurationMonths: body.durationMonths,
          newFreeMonths: body.freeMonths,
          notes: body.notes ?? null,
          createdById: user.id,
        },
      });

      return { newContract, renewal };
    });

    await writeAudit({
      companyId: user.companyId,
      actorId: user.id,
      action: "CREATE",
      entityType: "ContractRenewal",
      entityId: result.renewal.id,
      after: redactSensitive({
        oldContractNumber: oldContract.contractNumber,
        newContractNumber: result.newContract.contractNumber,
        newMonthlyFee: body.monthlyFee,
        newDurationMonths: body.durationMonths,
      }),
    });

    return NextResponse.json(
      { id: result.renewal.id, newContractId: result.newContract.id },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
