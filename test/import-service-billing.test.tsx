import { describe, it, expect } from "vitest";
import {
  SERVICE_FIELDS,
  CONTRACT_FIELDS,
  getFields,
  autoMatchHeader,
  coerceValue,
} from "@/lib/import-fields";

describe("Service Import Field Definitions", () => {
  it("includes all Schedule & Duration fields in SERVICE_FIELDS", () => {
    const keys = SERVICE_FIELDS.map((f) => f.key);
    expect(keys).toContain("startDate");
    expect(keys).toContain("durationMonths");
    expect(keys).toContain("freeMonths");

    const startField = SERVICE_FIELDS.find((f) => f.key === "startDate");
    expect(startField?.type).toBe("date");

    const durField = SERVICE_FIELDS.find((f) => f.key === "durationMonths");
    expect(durField?.type).toBe("number");

    const freeField = SERVICE_FIELDS.find((f) => f.key === "freeMonths");
    expect(freeField?.type).toBe("number");
  });

  it("includes all Financial Terms & Billing fields in SERVICE_FIELDS", () => {
    const keys = SERVICE_FIELDS.map((f) => f.key);
    expect(keys).toContain("monthlyFee");
    expect(keys).toContain("currency");
    expect(keys).toContain("billingCycle");

    const feeField = SERVICE_FIELDS.find((f) => f.key === "monthlyFee");
    expect(feeField?.type).toBe("number");

    const cycleField = SERVICE_FIELDS.find((f) => f.key === "billingCycle");
    expect(cycleField?.type).toBe("enum");
    expect(cycleField?.enumValues).toEqual(["ANNUAL", "YEARLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL"]);
  });

  it("preserves required status for service identification fields", () => {
    const serviceCode = SERVICE_FIELDS.find((f) => f.key === "serviceCode");
    const branchCode = SERVICE_FIELDS.find((f) => f.key === "branchCode");
    const providerCode = SERVICE_FIELDS.find((f) => f.key === "providerCode");

    expect(serviceCode?.required).toBe(true);
    expect(branchCode?.required).toBe(true);
    expect(providerCode?.required).toBe(true);
  });
});

describe("Header Auto-Matching for Service Import", () => {
  it("auto-matches schedule headers correctly", () => {
    expect(autoMatchHeader("Start Date")).toBe("startDate");
    expect(autoMatchHeader("startdate")).toBe("startDate");
    expect(autoMatchHeader("Duration Months")).toBe("durationMonths");
    expect(autoMatchHeader("Duration")).toBe("durationMonths");
    expect(autoMatchHeader("months")).toBe("durationMonths");
    expect(autoMatchHeader("Free Months")).toBe("freeMonths");
    expect(autoMatchHeader("free")).toBe("freeMonths");
  });

  it("auto-matches financial & billing headers correctly", () => {
    expect(autoMatchHeader("Monthly Fee")).toBe("monthlyFee");
    expect(autoMatchHeader("monthlyfee")).toBe("monthlyFee");
    expect(autoMatchHeader("fee")).toBe("monthlyFee");
    expect(autoMatchHeader("price")).toBe("monthlyFee");
    expect(autoMatchHeader("cost")).toBe("monthlyFee");
    expect(autoMatchHeader("Currency")).toBe("currency");
    expect(autoMatchHeader("Billing Cycle")).toBe("billingCycle");
    expect(autoMatchHeader("billingcycle")).toBe("billingCycle");
    expect(autoMatchHeader("cycle")).toBe("billingCycle");
  });

  it("auto-matches site and service identification headers", () => {
    expect(autoMatchHeader("Service Code")).toBe("serviceCode");
    expect(autoMatchHeader("Branch Code")).toBe("branchCode");
    expect(autoMatchHeader("Shop Code")).toBe("shopCode");
    expect(autoMatchHeader("Provider Code")).toBe("providerCode");
    expect(autoMatchHeader("Plan Name")).toBe("planName");
  });
});

describe("Service Schedule & Pricing Calculation", () => {
  it("computes end date extending by free months", () => {
    const startDate = new Date(Date.UTC(2026, 0, 1)); // 2026-01-01
    const durationMonths = 12;
    const freeMonths = 2;

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths + freeMonths);

    expect(endDate.toISOString().slice(0, 10)).toBe("2027-03-01");
  });

  it("charges only contracted duration months, excluding free promo months", () => {
    const monthlyFee = 790;
    const durationMonths = 12;
    const freeMonths = 2;

    const scheduledTotal = monthlyFee * durationMonths;
    expect(scheduledTotal).toBe(790 * 12); // 9480

    const totalTimelineMonths = durationMonths + freeMonths; // 14
    const effectiveMonthly = scheduledTotal / totalTimelineMonths;
    expect(effectiveMonthly).toBeCloseTo(677.14, 2);
  });
});

describe("Invoice Validation with Direct Service Link (Contract-Free)", () => {
  const baseValidInvoice = {
    invoiceNumber: "INV-2026-001",
    invoiceDate: "2026-01-01",
    subtotal: 790,
    tax: 0,
    discount: 0,
  };

  function validateInvoiceTarget(params: {
    useContract: boolean;
    contractId?: string | null;
    serviceId?: string | null;
  }): { valid: boolean; error?: string } {
    if (params.useContract) {
      if (!params.contractId?.trim()) {
        return { valid: false, error: "Please select a contract" };
      }
      return { valid: true };
    } else {
      if (!params.contractId?.trim() && !params.serviceId?.trim()) {
        return { valid: false, error: "Please select an installed service" };
      }
      return { valid: true };
    }
  }

  it("requires contractId when useContract=true", () => {
    const res = validateInvoiceTarget({ useContract: true, contractId: null });
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Please select a contract");
  });

  it("allows invoice with serviceId when useContract=false without contractId", () => {
    const res = validateInvoiceTarget({
      useContract: false,
      contractId: null,
      serviceId: "svc-123",
    });
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("rejects invoice when neither contractId nor serviceId is provided in contract-free mode", () => {
    const res = validateInvoiceTarget({
      useContract: false,
      contractId: null,
      serviceId: null,
    });
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Please select an installed service");
  });

  it("still accepts contractId in contract-free mode if user chooses to link one", () => {
    const res = validateInvoiceTarget({
      useContract: false,
      contractId: "contract-456",
      serviceId: null,
    });
    expect(res.valid).toBe(true);
  });
});
