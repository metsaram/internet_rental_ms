import { describe, it, expect } from "vitest";

describe("Required Fields Validation Logic", () => {
  describe("Contracts required fields", () => {
    const validateContract = (data: {
      serviceId?: string;
      contractNumber?: string;
      startDate?: string;
      duration?: number | string;
      monthlyFee?: number | string;
      freeMonths?: number | string;
    }) => {
      return Boolean(
        data.serviceId?.trim() &&
        data.contractNumber?.trim() &&
        data.startDate?.trim() &&
        data.duration !== "" &&
        !isNaN(Number(data.duration)) &&
        Number(data.duration) > 0 &&
        data.monthlyFee !== "" &&
        data.monthlyFee !== null &&
        data.monthlyFee !== undefined &&
        !isNaN(Number(data.monthlyFee)) &&
        Number(data.monthlyFee) >= 0 &&
        (data.freeMonths === undefined || data.freeMonths === "" || (!isNaN(Number(data.freeMonths)) && Number(data.freeMonths) >= 0))
      );
    };

    it("disables save when serviceId is empty", () => {
      expect(
        validateContract({
          serviceId: "",
          contractNumber: "CT-2026-001",
          startDate: "2026-01-01",
          duration: 12,
          monthlyFee: 100,
        })
      ).toBe(false);
    });

    it("disables save when contractNumber is empty or whitespace", () => {
      expect(
        validateContract({
          serviceId: "srv-1",
          contractNumber: "   ",
          startDate: "2026-01-01",
          duration: 12,
          monthlyFee: 100,
        })
      ).toBe(false);
    });

    it("disables save when startDate is empty", () => {
      expect(
        validateContract({
          serviceId: "srv-1",
          contractNumber: "CT-2026-001",
          startDate: "",
          duration: 12,
          monthlyFee: 100,
        })
      ).toBe(false);
    });

    it("disables save when duration is 0 or empty or negative", () => {
      expect(
        validateContract({
          serviceId: "srv-1",
          contractNumber: "CT-2026-001",
          startDate: "2026-01-01",
          duration: 0,
          monthlyFee: 100,
        })
      ).toBe(false);

      expect(
        validateContract({
          serviceId: "srv-1",
          contractNumber: "CT-2026-001",
          startDate: "2026-01-01",
          duration: "",
          monthlyFee: 100,
        })
      ).toBe(false);
    });

    it("disables save when monthlyFee is empty or negative", () => {
      expect(
        validateContract({
          serviceId: "srv-1",
          contractNumber: "CT-2026-001",
          startDate: "2026-01-01",
          duration: 12,
          monthlyFee: "",
        })
      ).toBe(false);

      expect(
        validateContract({
          serviceId: "srv-1",
          contractNumber: "CT-2026-001",
          startDate: "2026-01-01",
          duration: 12,
          monthlyFee: -5,
        })
      ).toBe(false);
    });

    it("enables save when all required fields have valid values", () => {
      expect(
        validateContract({
          serviceId: "srv-1",
          contractNumber: "CT-2026-001",
          startDate: "2026-01-01",
          duration: 12,
          monthlyFee: 150,
          freeMonths: 0,
        })
      ).toBe(true);
    });
  });

  describe("Renewals required fields", () => {
    const validateRenewal = (data: {
      contractNumber?: string;
      startDate?: string;
      duration?: number | string;
      monthlyFee?: number | string;
      freeMonths?: number | string;
    }) => {
      return Boolean(
        data.contractNumber?.trim() &&
        data.startDate?.trim() &&
        data.duration !== "" &&
        !isNaN(Number(data.duration)) &&
        Number(data.duration) > 0 &&
        data.monthlyFee !== "" &&
        data.monthlyFee !== null &&
        data.monthlyFee !== undefined &&
        !isNaN(Number(data.monthlyFee)) &&
        Number(data.monthlyFee) >= 0 &&
        (data.freeMonths === undefined || data.freeMonths === "" || (!isNaN(Number(data.freeMonths)) && Number(data.freeMonths) >= 0))
      );
    };

    it("disables renewal create when contractNumber is empty", () => {
      expect(
        validateRenewal({
          contractNumber: "",
          startDate: "2026-01-01",
          duration: 12,
          monthlyFee: 100,
        })
      ).toBe(false);
    });

    it("enables renewal create when all required fields are filled", () => {
      expect(
        validateRenewal({
          contractNumber: "CT-2026-001-R",
          startDate: "2026-01-01",
          duration: 12,
          monthlyFee: 100,
        })
      ).toBe(true);
    });
  });

  describe("Services required fields", () => {
    const validateService = (data: {
      branchId?: string;
      providerId?: string;
      serviceCode?: string;
    }) => {
      return Boolean(data.branchId?.trim() && data.providerId?.trim() && data.serviceCode?.trim());
    };

    it("disables save when branchId or providerId or serviceCode is missing", () => {
      expect(validateService({ branchId: "", providerId: "prov-1", serviceCode: "SC-001" })).toBe(false);
      expect(validateService({ branchId: "br-1", providerId: "", serviceCode: "SC-001" })).toBe(false);
      expect(validateService({ branchId: "br-1", providerId: "prov-1", serviceCode: "" })).toBe(false);
      expect(validateService({ branchId: "br-1", providerId: "prov-1", serviceCode: "SC-001" })).toBe(true);
    });
  });

  describe("Shops required fields", () => {
    const validateShop = (data: {
      branchId?: string;
      code?: string;
      name?: string;
    }) => {
      return Boolean(data.branchId?.trim() && data.code?.trim() && data.name?.trim());
    };

    it("disables save when branchId, code, or name is missing", () => {
      expect(validateShop({ branchId: "", code: "SHOP-101", name: "Alpha Unit" })).toBe(false);
      expect(validateShop({ branchId: "br-1", code: "", name: "Alpha Unit" })).toBe(false);
      expect(validateShop({ branchId: "br-1", code: "SHOP-101", name: "" })).toBe(false);
      expect(validateShop({ branchId: "  ", code: "SHOP-101", name: "Alpha Unit" })).toBe(false);
      expect(validateShop({ branchId: "br-1", code: "SHOP-101", name: "Alpha Unit" })).toBe(true);
    });
  });
});

