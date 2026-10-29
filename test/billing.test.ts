import { describe, it, expect } from "vitest";
import {
  deriveInvoiceStatus,
  outstandingBalance,
  allocatePayment,
  sumAllocated,
} from "@/lib/billing";
import { Decimal } from "@prisma/client/runtime/library";

describe("Billing Helpers & Status Derivation", () => {
  it("calculates outstanding balance correctly and ignores void payments", () => {
    const invoice = { total: new Decimal(1000) };
    const allocations = [
      { amount: new Decimal(300), payment: { status: "COMPLETED" } },
      { amount: new Decimal(200), payment: { status: "VOID" } },
      { amount: new Decimal(400), payment: { status: "COMPLETED" } },
    ];

    expect(sumAllocated(allocations).toNumber()).toBe(700);
    expect(outstandingBalance(invoice, allocations).toNumber()).toBe(300);
  });

  it("derives 'paid' status when allocations equal or exceed invoice total", () => {
    const invoice = { status: "DRAFT", total: new Decimal(1000) };
    const allocations = [
      { amount: new Decimal(1000), payment: { status: "COMPLETED" } },
    ];
    expect(deriveInvoiceStatus(invoice, allocations)).toBe("paid");
  });

  it("derives 'partial' status when allocations are positive but less than total", () => {
    const invoice = { status: "ISSUED", total: new Decimal(1000) };
    const allocations = [
      { amount: new Decimal(400), payment: { status: "COMPLETED" } },
    ];
    expect(deriveInvoiceStatus(invoice, allocations)).toBe("partial");
  });

  it("derives 'overdue' status when past due date and balance remains", () => {
    const invoice = {
      status: "ISSUED",
      total: new Decimal(1000),
      dueDate: new Date(Date.now() - 86400000), // 1 day ago
    };
    const allocations: any[] = [];
    expect(deriveInvoiceStatus(invoice, allocations)).toBe("overdue");
  });

  it("preserves 'void' status regardless of dates or balances", () => {
    const invoice = {
      status: "VOID",
      total: new Decimal(1000),
      dueDate: new Date(Date.now() - 86400000),
    };
    const allocations = [
      { amount: new Decimal(1000), payment: { status: "COMPLETED" } },
    ];
    expect(deriveInvoiceStatus(invoice, allocations)).toBe("void");
  });

  it("allocates payments across invoices without over-allocation", () => {
    const invoices = [
      { id: "inv-1", outstanding: new Decimal(500) },
      { id: "inv-2", outstanding: new Decimal(800) },
    ];
    const allocations = allocatePayment(700, invoices);
    expect(allocations["inv-1"].toNumber()).toBe(500);
    expect(allocations["inv-2"].toNumber()).toBe(200);
  });
});
