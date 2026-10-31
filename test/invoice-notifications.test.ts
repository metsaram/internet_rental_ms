import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInvoicePaymentAlert } from "@/lib/notifications";
import { Decimal } from "@prisma/client/runtime/library";

describe("Invoice Payment Notifications Logic", () => {
  const baseInvoice = {
    invoiceNumber: "INV-2026-1001",
    dueDate: "2026-11-07T00:00:00.000Z",
    status: "PENDING",
    currency: "USD",
  };

  it("returns null if invoice status is VOID", () => {
    const now = new Date("2026-11-05T10:00:00.000Z");
    const alert = getInvoicePaymentAlert(
      { ...baseInvoice, status: "VOID" },
      100,
      now
    );
    expect(alert).toBeNull();
  });

  it("returns null if invoice has zero or negative outstanding balance (paid)", () => {
    const now = new Date("2026-11-05T10:00:00.000Z");
    expect(getInvoicePaymentAlert(baseInvoice, 0, now)).toBeNull();
    expect(getInvoicePaymentAlert(baseInvoice, -10, now)).toBeNull();
    expect(getInvoicePaymentAlert(baseInvoice, new Decimal(0), now)).toBeNull();
  });

  it("returns null if invoice has no dueDate", () => {
    const now = new Date("2026-11-05T10:00:00.000Z");
    const alert = getInvoicePaymentAlert(
      { ...baseInvoice, dueDate: null },
      150,
      now
    );
    expect(alert).toBeNull();
  });

  it("returns null if invoice dueDate is more than 7 days away (e.g. 8 days before)", () => {
    // Due: 2026-11-07, Now: 2026-10-30 -> 8 days difference
    const now = new Date("2026-10-30T10:00:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, 150, now);
    expect(alert).toBeNull();
  });

  it("alerts 1 week (7 days) before due date with INVOICE_DUE_SOON", () => {
    // Due: 2026-11-07, Now: 2026-10-31 -> 7 days
    const now = new Date("2026-10-31T08:00:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, 250.5, now);
    expect(alert).not.toBeNull();
    expect(alert?.type).toBe("INVOICE_DUE_SOON");
    expect(alert?.daysToDue).toBe(7);
    expect(alert?.title).toBe("Invoice due in 7d: INV-2026-1001");
    expect(alert?.message).toContain("250.50");
    expect(alert?.message).toContain("7 days");
  });

  it("alerts 3 days before due date with INVOICE_DUE_SOON", () => {
    // Due: 2026-11-07, Now: 2026-11-04 -> 3 days
    const now = new Date("2026-11-04T12:00:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, 100, now);
    expect(alert?.type).toBe("INVOICE_DUE_SOON");
    expect(alert?.daysToDue).toBe(3);
    expect(alert?.title).toBe("Invoice due in 3d: INV-2026-1001");
  });

  it("alerts 1 day before due date (due tomorrow)", () => {
    // Due: 2026-11-07, Now: 2026-11-06 -> 1 day
    const now = new Date("2026-11-06T15:00:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, 100, now);
    expect(alert?.type).toBe("INVOICE_DUE_SOON");
    expect(alert?.daysToDue).toBe(1);
    expect(alert?.title).toBe("Invoice due tomorrow: INV-2026-1001");
    expect(alert?.message).toContain("due tomorrow");
  });

  it("alerts on the due date (due today)", () => {
    // Due: 2026-11-07, Now: 2026-11-07 -> 0 days
    const now = new Date("2026-11-07T14:30:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, new Decimal("320.00"), now);
    expect(alert?.type).toBe("INVOICE_DUE_SOON");
    expect(alert?.daysToDue).toBe(0);
    expect(alert?.title).toBe("Invoice due today: INV-2026-1001");
    expect(alert?.message).toContain("is due today");
  });

  it("alerts 1 day overdue with INVOICE_OVERDUE", () => {
    // Due: 2026-11-07, Now: 2026-11-08 -> -1 day
    const now = new Date("2026-11-08T09:00:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, 100, now);
    expect(alert?.type).toBe("INVOICE_OVERDUE");
    expect(alert?.daysToDue).toBe(-1);
    expect(alert?.title).toBe("Invoice 1d overdue: INV-2026-1001");
    expect(alert?.message).toContain("was due yesterday");
  });

  it("alerts up to 7 days overdue (1 week overdue)", () => {
    // Due: 2026-11-07, Now: 2026-11-14 -> -7 days
    const now = new Date("2026-11-14T11:00:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, 100, now);
    expect(alert?.type).toBe("INVOICE_OVERDUE");
    expect(alert?.daysToDue).toBe(-7);
    expect(alert?.title).toBe("Invoice 7d overdue: INV-2026-1001");
    expect(alert?.message).toContain("7 days past due");
  });

  it("stops alerting when overdue for more than 1 week (e.g. 8 days overdue)", () => {
    // Due: 2026-11-07, Now: 2026-11-15 -> -8 days
    const now = new Date("2026-11-15T09:00:00.000Z");
    const alert = getInvoicePaymentAlert(baseInvoice, 100, now);
    expect(alert).toBeNull();
  });
});

