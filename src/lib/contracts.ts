import { Decimal } from "@prisma/client/runtime/library";
import type { InternetContract } from "@prisma/client";

/**
 * Contract cost math, per Phase 7 rules:
 *   paidMonths        = contractMonths - freeMonths
 *   scheduledTotal    = monthlyFee × paidMonths
 *   effectiveMonthly  = scheduledTotal / contractMonths
 */
export interface ContractCosts {
  contractMonths: number;
  freeMonths: number;
  paidMonths: number;
  monthlyFee: Decimal;
  scheduledTotal: Decimal;
  effectiveMonthly: Decimal;
}

export function computeContractCosts(c: {
  durationMonths: number;
  freeMonths: number;
  monthlyFee: Decimal | number | string;
}): ContractCosts {
  const months = Math.max(0, Math.floor(c.durationMonths));
  const free = Math.max(0, Math.min(months, Math.floor(c.freeMonths)));
  const fee = new Decimal(c.monthlyFee ?? 0);
  const paidMonths = Math.max(0, months - free);
  const scheduledTotal = fee.mul(paidMonths);
  const effectiveMonthly = months > 0 ? scheduledTotal.div(months) : new Decimal(0);
  return {
    contractMonths: months,
    freeMonths: free,
    paidMonths,
    monthlyFee: fee,
    scheduledTotal,
    effectiveMonthly,
  };
}

export type ContractDerivedStatus = "upcoming" | "active" | "expiring" | "expired" | "terminated";

/** Derive a runtime status from dates + stored status. */
export function deriveContractStatus(
  c: Pick<InternetContract, "status" | "startDate" | "endDate">,
  now: Date = new Date(),
  warningDays = 30
): ContractDerivedStatus {
  if (c.status === "TERMINATED") return "terminated";
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  if (now < start) return "upcoming";
  if (now > end) return "expired";
  const msUntilEnd = end.getTime() - now.getTime();
  const daysUntilEnd = msUntilEnd / (1000 * 60 * 60 * 24);
  if (daysUntilEnd <= warningDays) return "expiring";
  return "active";
}

/** Remaining days until end date (can be negative if expired). */
export function daysUntilEnd(endDate: Date | string, now: Date = new Date()): number {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  return Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
