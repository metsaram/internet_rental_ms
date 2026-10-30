/**
 * @vitest-environment jsdom
 * Tests for:
 *   1. Contract-matching Schedule & Duration (timeline and endDate calculation)
 *   2. Financial terms calculation (scheduled total, effective monthly, auto-calculate 10% tax, net total)
 *   3. useContract / serviceId guard and validation logic
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic matching contracts.tsx and invoices.tsx
// ---------------------------------------------------------------------------

function computeTimeline(startDate: string, duration: number, freeMonths = 0) {
  const totalMonths = Math.max(0, Number(duration || 0) + Number(freeMonths || 0));
  if (!startDate) return { totalMonths, endDate: "" };

  const [y, m, d] = startDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + totalMonths, d));
  return {
    totalMonths,
    endDate: dt.toISOString().slice(0, 10),
  };
}

function computeMonthlyFee(feeInput: number | string, feeBasis: "MONTHLY" | "YEARLY"): number {
  if (feeInput === "" || isNaN(Number(feeInput))) return 0;
  const num = Number(feeInput);
  return feeBasis === "YEARLY" ? (num > 0 ? num / 12 : 0) : num;
}

function convertFeeBasis(feeInput: number | string, newBasis: "MONTHLY" | "YEARLY"): number | string {
  if (feeInput === "" || isNaN(Number(feeInput))) return feeInput;
  const num = Number(feeInput);
  if (newBasis === "YEARLY") {
    return Number((num * 12).toFixed(2));
  } else {
    return Number((num / 12).toFixed(2));
  }
}

function computeFinancials(
  monthlyFee: number,
  duration: number,
  freeMonths = 0,
  taxRate: number | string = 10,
  customTax: number | string | null = null,
  discount: number | string = 0,
  hasInstallationFee = false,
  installationFee: number | string = 0
) {
  const totalMonths = Math.max(0, Number(duration || 0) + Number(freeMonths || 0));
  const paidMonths = Math.max(0, Number(duration || 0));
  const scheduled = Number(monthlyFee || 0) * paidMonths;
  const installAmount = hasInstallationFee ? Math.max(0, Number(installationFee || 0)) : 0;
  const subtotal = scheduled + installAmount;
  const effective = totalMonths > 0 ? subtotal / totalMonths : 0;

  // Auto-calculate tax default 10% (price excluded: added on top of subtotal)
  const autoTax = Number(((subtotal * Number(taxRate || 0)) / 100).toFixed(2));
  const currentTax = customTax !== null ? Number(customTax) : autoTax;
  const total = Math.max(0, subtotal + currentTax - Number(discount || 0));

  return {
    paidMonths,
    totalMonths,
    scheduled,
    installAmount,
    subtotal,
    effective,
    autoTax,
    currentTax,
    total,
  };
}

function buildIsFormValid({
  useContract,
  contractId,
  serviceId,
  invoiceNumber,
  invoiceDate,
  startDate,
  duration,
  monthlyFee,
  freeMonths,
  hasInstallationFee = false,
  installationFee = 0,
  tax = 0,
  discount = 0,
}: {
  useContract: boolean;
  contractId?: string;
  serviceId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  startDate: string;
  duration: number | string;
  monthlyFee: number | string;
  freeMonths?: number | string;
  hasInstallationFee?: boolean;
  installationFee?: number | string;
  tax?: number | string;
  discount?: number | string;
}) {
  const hasTarget = useContract ? Boolean(contractId?.trim()) : Boolean(contractId?.trim() || serviceId?.trim());
  return Boolean(
    hasTarget &&
    invoiceNumber?.trim() &&
    invoiceDate?.trim() &&
    startDate?.trim() &&
    duration !== "" &&
    !isNaN(Number(duration)) &&
    Number(duration) > 0 &&
    monthlyFee !== "" &&
    monthlyFee !== null &&
    monthlyFee !== undefined &&
    !isNaN(Number(monthlyFee)) &&
    Number(monthlyFee) >= 0 &&
    (freeMonths === undefined || freeMonths === "" || (!isNaN(Number(freeMonths)) && Number(freeMonths) >= 0)) &&
    (!hasInstallationFee || (installationFee !== "" && !isNaN(Number(installationFee)) && Number(installationFee) >= 0)) &&
    (tax === "" || (!isNaN(Number(tax)) && Number(tax) >= 0)) &&
    (discount === "" || (!isNaN(Number(discount)) && Number(discount) >= 0))
  );
}

// ---------------------------------------------------------------------------
// Schedule & Duration calculation tests
// ---------------------------------------------------------------------------

describe("Contract-matching Schedule & Duration calculation", () => {
  it("calculates 12 months from 2025-11-27 to 2026-11-27 with 0 free months", () => {
    const { totalMonths, endDate } = computeTimeline("2025-11-27", 12, 0);
    expect(totalMonths).toBe(12);
    expect(endDate).toBe("2026-11-27");
  });

  it("extends end date by free months (12 duration + 2 free months = 14 months)", () => {
    const { totalMonths, endDate } = computeTimeline("2025-11-27", 12, 2);
    expect(totalMonths).toBe(14);
    expect(endDate).toBe("2027-01-27");
  });

  it("handles 1-month duration correctly", () => {
    const { totalMonths, endDate } = computeTimeline("2026-01-15", 1, 0);
    expect(totalMonths).toBe(1);
    expect(endDate).toBe("2026-02-15");
  });

  it("handles year rollover cleanly", () => {
    const { totalMonths, endDate } = computeTimeline("2026-10-01", 3, 0);
    expect(totalMonths).toBe(3);
    expect(endDate).toBe("2027-01-01");
  });

  it("returns empty string if startDate is empty", () => {
    const { totalMonths, endDate } = computeTimeline("", 12, 0);
    expect(totalMonths).toBe(12);
    expect(endDate).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Financial terms & auto-calculated 10% tax tests
// ---------------------------------------------------------------------------

describe("Contract-matching Financial calculation with 10% default Tax (price excluded)", () => {
  it("computes scheduled total = monthlyFee x paid duration", () => {
    // 60.5 monthlyFee x 12 paid months = 726.00
    const { scheduled, paidMonths } = computeFinancials(60.5, 12, 0);
    expect(paidMonths).toBe(12);
    expect(scheduled).toBe(726);
  });

  it("auto-calculates tax default 10% (price excluded: added on top of subtotal)", () => {
    // Subtotal $726.00 -> 10% tax = $72.60 -> Total Payable = $798.60
    const { scheduled, autoTax, currentTax, total } = computeFinancials(60.5, 12, 0, 10, null, 0);
    expect(scheduled).toBe(726);
    expect(autoTax).toBe(72.6);
    expect(currentTax).toBe(72.6);
    expect(total).toBe(798.6);
  });

  it("recomputes 10% tax dynamically when duration or monthlyFee changes", () => {
    // 100/mo x 1 month = $100 subtotal -> $10 tax -> $110 total
    const res1 = computeFinancials(100, 1, 0, 10, null, 0);
    expect(res1.scheduled).toBe(100);
    expect(res1.currentTax).toBe(10);
    expect(res1.total).toBe(110);

    // 100/mo x 6 months = $600 subtotal -> $60 tax -> $660 total
    const res2 = computeFinancials(100, 6, 0, 10, null, 0);
    expect(res2.scheduled).toBe(600);
    expect(res2.currentTax).toBe(60);
    expect(res2.total).toBe(660);
  });

  it("supports custom tax rate (e.g. 7% or 0%)", () => {
    // 7% tax on $726.00 = $50.82 -> total = $776.82
    const res7 = computeFinancials(60.5, 12, 0, 7, null, 0);
    expect(res7.currentTax).toBe(50.82);
    expect(res7.total).toBe(776.82);

    // 0% tax on $726.00 = $0 -> total = $726.00
    const res0 = computeFinancials(60.5, 12, 0, 0, null, 0);
    expect(res0.currentTax).toBe(0);
    expect(res0.total).toBe(726);
  });

  it("allows custom dollar tax override", () => {
    // Overriding tax to $50.00 directly
    const resCustom = computeFinancials(60.5, 12, 0, 10, 50, 0);
    expect(resCustom.currentTax).toBe(50);
    expect(resCustom.total).toBe(776);
  });

  it("free months cost $0 (scheduled total is based ONLY on paid duration)", () => {
    // 60.5 monthlyFee x 12 paid months = 726 (free months cost 0)
    const { scheduled, paidMonths, totalMonths, effective, currentTax, total } = computeFinancials(60.5, 12, 2, 10);
    expect(paidMonths).toBe(12);
    expect(totalMonths).toBe(14);
    expect(scheduled).toBe(726);
    expect(currentTax).toBe(72.6);
    expect(total).toBe(798.6);
    // Effective rate is diluted across all 14 months: 726 / 14 ≈ 51.857
    expect(effective).toBeCloseTo(51.857, 2);
  });

  it("computes net payable total with 10% tax and discount", () => {
    // Scheduled 1000 + tax (10% = 100) - discount 50 = 1050
    const { scheduled, currentTax, total } = computeFinancials(100, 10, 0, 10, null, 50);
    expect(scheduled).toBe(1000);
    expect(currentTax).toBe(100);
    expect(total).toBe(1050);
  });

  it("prevents negative net payable total", () => {
    const { total } = computeFinancials(50, 1, 0, 10, null, 200);
    expect(total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Form validation tests (Contract mode vs Service-only mode)
// ---------------------------------------------------------------------------

describe("isFormValid with Contract & Service guards", () => {
  it("requires contractId when useContract=true", () => {
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
      })
    ).toBe(false);
  });

  it("valid when contractId provided and useContract=true", () => {
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
        tax: 72.6,
      })
    ).toBe(true);
  });

  it("valid with serviceId when useContract=false (contract-free mode)", () => {
    expect(
      buildIsFormValid({
        useContract: false,
        serviceId: "srv-456",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
        tax: 72.6,
      })
    ).toBe(true);
  });

  it("invalid when neither contractId nor serviceId provided in contract-free mode", () => {
    expect(
      buildIsFormValid({
        useContract: false,
        contractId: "",
        serviceId: "",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
      })
    ).toBe(false);
  });

  it("requires duration > 0", () => {
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 0,
        monthlyFee: 60.5,
      })
    ).toBe(false);
  });

  it("requires monthlyFee >= 0", () => {
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: -10,
      })
    ).toBe(false);
  });

  it("requires freeMonths >= 0", () => {
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
        freeMonths: -1,
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fee calculation option (Monthly vs Yearly fee input) tests
// ---------------------------------------------------------------------------

describe("Fee calculation option (Monthly vs Yearly fee input)", () => {
  it("derives monthly fee directly when feeBasis is MONTHLY", () => {
    expect(computeMonthlyFee(60.5, "MONTHLY")).toBe(60.5);
    expect(computeMonthlyFee("100", "MONTHLY")).toBe(100);
    expect(computeMonthlyFee(0, "MONTHLY")).toBe(0);
  });

  it("derives monthly fee by dividing by 12 when feeBasis is YEARLY", () => {
    // $726 / 12 = $60.50
    expect(computeMonthlyFee(726, "YEARLY")).toBe(60.5);
    // $1200 / 12 = $100.00
    expect(computeMonthlyFee(1200, "YEARLY")).toBe(100);
  });

  it("scales feeInput by 12 when switching from MONTHLY to YEARLY", () => {
    // $60.50/mo -> $726.00/yr
    expect(convertFeeBasis(60.5, "YEARLY")).toBe(726);
    expect(convertFeeBasis("100", "YEARLY")).toBe(1200);
  });

  it("scales feeInput by / 12 when switching from YEARLY to MONTHLY", () => {
    // $726.00/yr -> $60.50/mo
    expect(convertFeeBasis(726, "MONTHLY")).toBe(60.5);
    expect(convertFeeBasis(1200, "MONTHLY")).toBe(100);
  });

  it("computes identical subtotal and 10% tax whether input as monthly or yearly fee", () => {
    // 12 months with $60.50 monthly fee
    const monthlyRate = computeMonthlyFee(60.5, "MONTHLY");
    const resMonthly = computeFinancials(monthlyRate, 12, 0, 10);

    // 12 months with $726.00 yearly fee
    const yearlyRate = computeMonthlyFee(726, "YEARLY");
    const resYearly = computeFinancials(yearlyRate, 12, 0, 10);

    expect(resMonthly.scheduled).toBe(726);
    expect(resYearly.scheduled).toBe(726);
    expect(resMonthly.autoTax).toBe(72.6);
    expect(resYearly.autoTax).toBe(72.6);
    expect(resMonthly.total).toBe(798.6);
    expect(resYearly.total).toBe(798.6);
  });

  it("calculates subtotal and 10% tax for partial year duration with yearly fee ($1200/yr for 6 months)", () => {
    // $1200/yr = $100/mo. For 6 months: subtotal = $600, 10% tax = $60, total = $660
    const monthlyRate = computeMonthlyFee(1200, "YEARLY");
    const res = computeFinancials(monthlyRate, 6, 0, 10);
    expect(res.paidMonths).toBe(6);
    expect(res.scheduled).toBe(600);
    expect(res.autoTax).toBe(60);
    expect(res.total).toBe(660);
  });

  it("calculates subtotal and 10% tax with yearly fee and free months ($1200/yr with 12 paid + 2 free months)", () => {
    // $1200/yr = $100/mo. 12 paid months = $1200 subtotal, 10% tax = $120, total = $1320
    // Total months = 14, effective = $1200 / 14 ≈ $85.71/mo
    const monthlyRate = computeMonthlyFee(1200, "YEARLY");
    const res = computeFinancials(monthlyRate, 12, 2, 10);
    expect(res.paidMonths).toBe(12);
    expect(res.totalMonths).toBe(14);
    expect(res.scheduled).toBe(1200);
    expect(res.autoTax).toBe(120);
    expect(res.total).toBe(1320);
    expect(res.effective).toBeCloseTo(85.714, 2);
  });
});

// ---------------------------------------------------------------------------
// Service installation fee option & calculation tests
// ---------------------------------------------------------------------------

describe("Service installation fee option & calculations", () => {
  it("defaults to 0 installation fee and base subtotal when checkbox is unchecked", () => {
    // $60.50/mo x 12 months = $726.00 subtotal, tax $72.60, total $798.60
    const res = computeFinancials(60.5, 12, 0, 10, null, 0, false, 0);
    expect(res.scheduled).toBe(726);
    expect(res.installAmount).toBe(0);
    expect(res.subtotal).toBe(726);
    expect(res.autoTax).toBe(72.6);
    expect(res.total).toBe(798.6);
  });

  it("adds installation fee into subtotal and auto-calculates 10% tax on combined charges", () => {
    // $60.50/mo x 12 months = $726.00 scheduled + $100.00 installation fee = $826.00 subtotal
    // 10% tax on $826.00 = $82.60 -> Total Payable = $908.60
    const res = computeFinancials(60.5, 12, 0, 10, null, 0, true, 100);
    expect(res.scheduled).toBe(726);
    expect(res.installAmount).toBe(100);
    expect(res.subtotal).toBe(826);
    expect(res.autoTax).toBe(82.6);
    expect(res.total).toBe(908.6);
  });

  it("dynamically adjusts subtotal and tax when installation fee amount changes", () => {
    // $100/mo x 1 month = $100 scheduled + $50 installation fee = $150 subtotal -> $15 tax -> $165 total
    const res1 = computeFinancials(100, 1, 0, 10, null, 0, true, 50);
    expect(res1.subtotal).toBe(150);
    expect(res1.autoTax).toBe(15);
    expect(res1.total).toBe(165);

    // Change installation fee to $250 -> $350 subtotal -> $35 tax -> $385 total
    const res2 = computeFinancials(100, 1, 0, 10, null, 0, true, 250);
    expect(res2.subtotal).toBe(350);
    expect(res2.autoTax).toBe(35);
    expect(res2.total).toBe(385);
  });

  it("dilutes installation fee into effective monthly rate across total contract duration", () => {
    // $60.50 x 12 months = $726 + $100 installation = $826 subtotal across 14 months (12 paid + 2 free)
    // Effective = 826 / 14 = 59.00
    const res = computeFinancials(60.5, 12, 2, 10, null, 0, true, 100);
    expect(res.totalMonths).toBe(14);
    expect(res.subtotal).toBe(826);
    expect(res.effective).toBe(59);
  });

  it("requires valid installationFee >= 0 when hasInstallationFee is true", () => {
    // Invalid when hasInstallationFee=true but amount is negative
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
        hasInstallationFee: true,
        installationFee: -50,
      })
    ).toBe(false);

    // Invalid when hasInstallationFee=true but amount is empty
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
        hasInstallationFee: true,
        installationFee: "",
      })
    ).toBe(false);

    // Valid when hasInstallationFee=true and amount is positive
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
        hasInstallationFee: true,
        installationFee: 100,
      })
    ).toBe(true);

    // Valid when hasInstallationFee=false even if installationFee is 0 or empty
    expect(
      buildIsFormValid({
        useContract: true,
        contractId: "ctr-123",
        invoiceNumber: "INV-001",
        invoiceDate: "2026-01-01",
        startDate: "2026-01-01",
        duration: 12,
        monthlyFee: 60.5,
        hasInstallationFee: false,
        installationFee: "",
      })
    ).toBe(true);
  });

  it("calculates billing purely based on Schedule & Duration (start date to end date) without billing cycle", () => {
    // Scenario: 6-month contract with 1 free month promo at $50/month
    const { totalMonths, endDate } = computeTimeline("2026-03-01", 6, 1);
    expect(totalMonths).toBe(7);
    expect(endDate).toBe("2026-10-01");

    const fin = computeFinancials(50, 6, 1, 10, null, 0);
    expect(fin.paidMonths).toBe(6);
    expect(fin.totalMonths).toBe(7);
    expect(fin.scheduled).toBe(300); // 6 paid months * 50
    expect(fin.autoTax).toBe(30);    // 10% tax on 300
    expect(fin.total).toBe(330);      // 300 + 30
    expect(fin.effective).toBeCloseTo(42.86, 2); // 300 / 7 months

    // Scenario: Schedule badge formatting
    const startDate = "2026-03-01";
    const badgeText = startDate && endDate ? `${startDate} → ${endDate}` : `${totalMonths} Months`;
    expect(badgeText).toBe("2026-03-01 → 2026-10-01");
  });

  describe("Old Invoice Structure Compatibility & Migration", () => {
    it("deduces serviceId from contract when old invoice has serviceId: null", () => {
      const oldInvoice = {
        id: "inv-old-1",
        invoiceNumber: "INV-2026-4170",
        contractId: "ctr-2026-2587",
        serviceId: null,
      };

      const contracts = [
        { id: "ctr-2026-2587", contractNumber: "CT-2026-2587", serviceId: "svc-2075" },
      ];

      const resolvedContractId = oldInvoice.contractId ?? "";
      const linkedContract = contracts.find((c) => c.id === resolvedContractId);
      const resolvedServiceId = (oldInvoice as any).serviceId || linkedContract?.serviceId || "";

      expect(resolvedContractId).toBe("ctr-2026-2587");
      expect(resolvedServiceId).toBe("svc-2075");
    });

    it("recovers promotional free months and matches stored timeline for old invoice with 14-month span", () => {
      // Historical invoice INV-2026-4170:
      // periodStart: 2026-11-27, periodEnd: 2028-01-27, subtotal: 726 (12 * 60.50), tax: 72.60
      const oldInvoice = {
        periodStart: "2026-11-27T00:00:00.000Z",
        periodEnd: "2028-01-27T00:00:00.000Z",
        subtotal: "726",
        tax: "72.6",
      };

      const linkedContract = {
        durationMonths: 12,
        freeMonths: 0,
        monthlyFee: "60.5",
      };

      let initDuration: number = Math.max(1, (linkedContract.durationMonths || 12) - Number(linkedContract.freeMonths || 0));
      let initFreeMonths = linkedContract.freeMonths || 0;
      let initMonthlyFee = Number(linkedContract.monthlyFee);

      // Deduce promo free months
      if (oldInvoice.periodStart && oldInvoice.periodEnd) {
        const s = new Date(oldInvoice.periodStart);
        const e = new Date(oldInvoice.periodEnd);
        const totalPeriodMonths = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
        if (totalPeriodMonths > initDuration) {
          initFreeMonths = totalPeriodMonths - initDuration;
        }
      }

      expect(initDuration).toBe(12);
      expect(initFreeMonths).toBe(2);

      // Verify computed timeline matches old periodEnd
      const { totalMonths, endDate } = computeTimeline("2026-11-27", initDuration, initFreeMonths);
      expect(totalMonths).toBe(14);
      expect(endDate).toBe("2028-01-27");

      // Verify financial calculation reproduces subtotal, tax, and total
      const fin = computeFinancials(initMonthlyFee, initDuration, initFreeMonths, 10, null, 0);
      expect(fin.paidMonths).toBe(12);
      expect(fin.scheduled).toBe(726);
      expect(fin.subtotal).toBe(726);
      expect(fin.autoTax).toBe(72.6);
      expect(fin.total).toBe(798.6);
    });

    it("correctly handles old invoices without contracts using direct service linkage", () => {
      const contractFreeInvoice = {
        id: "inv-direct-svc",
        contractId: null,
        serviceId: "svc-direct-10",
        periodStart: "2026-05-01",
        periodEnd: "2027-05-01",
        subtotal: "1200",
      };

      const services = [
        {
          id: "svc-direct-10",
          serviceCode: "SVC-DIRECT-10",
          monthlyFee: "100",
          durationMonths: 12,
          freeMonths: 0,
        },
      ];

      const resolvedContractId = contractFreeInvoice.contractId ?? "";
      const resolvedServiceId = contractFreeInvoice.serviceId ?? "";
      const linkedService = services.find((s) => s.id === resolvedServiceId);

      expect(resolvedContractId).toBe("");
      expect(resolvedServiceId).toBe("svc-direct-10");
      expect(linkedService?.monthlyFee).toBe("100");
    });
  });
});

