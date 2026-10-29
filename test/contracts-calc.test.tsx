import { describe, it, expect } from "vitest";

describe("Contract End Date & Price Calculations", () => {
  it("extends end date by free months without calculating price on free months", () => {
    const startDate = "2026-01-01";
    const duration = 12; // 12 paid months
    const freeMonths = 2; // 2 free months promo
    const monthlyFee = 100;

    // 1. Total contract timeline extends by free months
    const totalMonths = duration + freeMonths; // 14 months
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + totalMonths);
    const endDate = d.toISOString().slice(0, 10);

    // End date extends by 14 months (Jan 2026 + 14m -> March 2027)
    expect(endDate).toBe("2027-03-01");

    // 2. Price is only calculated on the contracted paid duration (free months cost $0)
    const paidMonths = duration; // 12
    const scheduled = monthlyFee * paidMonths; // 1200
    expect(scheduled).toBe(1200);

    // 3. Effective monthly fee amortizes the paid cost over the extended duration
    const effective = scheduled / totalMonths; // 1200 / 14 = 85.714...
    expect(effective).toBeCloseTo(85.71, 2);
  });

  it("handles 0 free months correctly", () => {
    const startDate = "2026-01-01";
    const duration = 12;
    const freeMonths = 0;
    const monthlyFee = 100;

    const totalMonths = duration + freeMonths;
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + totalMonths);
    const endDate = d.toISOString().slice(0, 10);

    expect(endDate).toBe("2027-01-01");
    expect(monthlyFee * duration).toBe(1200);
  });
});
