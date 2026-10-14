import { Decimal } from "@prisma/client/runtime/library";

/**
 * Phase 13 — Contract renewal helpers (server-side; imports Decimal).
 *
 * Classification:
 *  - upcoming:  contract still active, end date within `warningDays` from now
 *  - overdue:   contract end date already passed but no renewal decided
 *  - completed: a renewal record with status COMPLETED linking old→new
 */

export type RenewalClassification = "upcoming" | "overdue" | "completed" | "none";

export interface RenewalCandidate {
  contractId: string;
  endDate: Date | string;
  renewalStatus?: string | null; // PENDING | COMPLETED | DECLINED | null
}

/**
 * Default warning window: contracts ending within this many days are
 * considered "upcoming" renewal candidates.
 */
export const DEFAULT_WARNING_DAYS = 30;

export function daysUntil(endDate: Date | string, now: Date = new Date()): number {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  return Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function classifyRenewal(
  c: RenewalCandidate,
  now: Date = new Date(),
  warningDays = DEFAULT_WARNING_DAYS
): RenewalClassification {
  if (c.renewalStatus === "COMPLETED") return "completed";
  const d = daysUntil(c.endDate, now);
  if (d < 0) return "overdue";
  if (d <= warningDays) return "upcoming";
  return "none";
}

/**
 * Suggest new renewal terms based on the old contract: same monthly fee,
 * same duration, no free months by default. The caller can override.
 */
export function suggestRenewalTerms(old: {
  endDate: Date | string;
  monthlyFee: Decimal | string | number;
  currency: string;
  durationMonths: number;
  freeMonths: number;
}) {
  const end = typeof old.endDate === "string" ? new Date(old.endDate) : old.endDate;
  // New start = old end (continuous); new end = start + duration.
  const newStart = new Date(end);
  const newEnd = new Date(newStart);
  newEnd.setMonth(newEnd.getMonth() + old.durationMonths);
  return {
    newStartDate: newStart,
    newEndDate: newEnd,
    newDurationMonths: old.durationMonths,
    newFreeMonths: 0,
    newMonthlyFee: new Decimal(old.monthlyFee ?? 0),
    newCurrency: old.currency,
  };
}

/**
 * Compute the monthly-fee delta for a renewal (new − old). Negative means
 * the renewal is cheaper.
 */
export function renewalFeeDelta(
  oldFee: Decimal | string | number,
  newFee: Decimal | string | number
): Decimal {
  return new Decimal(newFee ?? 0).minus(new Decimal(oldFee ?? 0));
}
