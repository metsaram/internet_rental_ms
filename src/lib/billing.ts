import { Decimal } from "@prisma/client/runtime/library";

/**
 * Phase 12 billing helpers. Server-side only (imports Decimal).
 * Outstanding balance = invoice.total − Σ(completed allocations to it).
 */

export interface AllocationLike {
  amount: Decimal | string | number;
  payment?: { status?: string } | null;
}

export function sumAllocated(allocations: AllocationLike[]): Decimal {
  return allocations
    .filter((a) => !a.payment || a.payment.status !== "VOID")
    .reduce((acc, a) => acc.plus(new Decimal(a.amount ?? 0)), new Decimal(0));
}

export function outstandingBalance(
  invoice: { total: Decimal | string | number },
  allocations: AllocationLike[]
): Decimal {
  return new Decimal(invoice.total ?? 0).minus(sumAllocated(allocations));
}

export type InvoiceDerivedStatus =
  | "draft"
  | "issued"
  | "partial"
  | "paid"
  | "overdue"
  | "void";

/**
 * Derive a runtime invoice status from stored status + due date + balance.
 *  - VOID stays void
 *  - balance <= 0 → paid
 *  - 0 < balance < total → partial
 *  - due date in the past and balance > 0 → overdue
 *  - otherwise the stored status
 */
export function deriveInvoiceStatus(
  invoice: {
    status: string;
    total: Decimal | string | number;
    dueDate?: Date | string | null;
  },
  allocations: AllocationLike[],
  now: Date = new Date()
): InvoiceDerivedStatus {
  if (invoice.status === "VOID") return "void";
  const bal = outstandingBalance(invoice, allocations);
  const total = new Decimal(invoice.total ?? 0);
  if (bal.lte(0)) return "paid";
  if (total.gt(0) && bal.lt(total)) return "partial";
  if (invoice.dueDate) {
    const due = typeof invoice.dueDate === "string" ? new Date(invoice.dueDate) : invoice.dueDate;
    if (due < now && bal.gt(0)) return "overdue";
  }
  return invoice.status.toLowerCase() as InvoiceDerivedStatus;
}

/** Allocate a payment amount across a set of (invoiceId, outstanding) pairs.
 *  Supports proportional or full-split strategies. Returns a map of
 *  invoiceId → allocated amount, never over-allocating any invoice. */
export function allocatePayment(
  paymentAmount: Decimal | string | number,
  invoices: Array<{ id: string; outstanding: Decimal | string | number }>
): Record<string, Decimal> {
  let remaining = new Decimal(paymentAmount);
  const out: Record<string, Decimal> = {};
  for (const inv of invoices) {
    if (remaining.lte(0)) break;
    const cap = new Decimal(inv.outstanding ?? 0);
    if (cap.lte(0)) continue;
    const give = Decimal.min(remaining, cap);
    out[inv.id] = give;
    remaining = remaining.minus(give);
  }
  return out;
}
