/**
 * Tests for GET /api/contracts
 *
 * Verifies that the handler:
 *  - Calls findMany and company findUnique in parallel (Promise.all).
 *  - Returns the mapped contract shape.
 *  - Falls back to warningDays = 30 when the company record is null.
 *  - Applies search / status filters to the Prisma `where` clause.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Use vi.hoisted so mock vars are available inside vi.mock factories ─────────
const {
  mockFindMany,
  mockCompanyFindUnique,
  mockContractCreate,
  mockServiceFindUnique,
  mockContractFindUnique,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCompanyFindUnique: vi.fn(),
  mockContractCreate: vi.fn(),
  mockServiceFindUnique: vi.fn(),
  mockContractFindUnique: vi.fn(),
}));

// ── Mock dependencies before importing the route ──────────────────────────────

vi.mock("@/lib/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "user-1",
    companyId: "comp-1",
    companyCurrency: "USD",
  }),
  parseJsonBody: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  errorResponse: vi.fn((err: Error & { status?: number }) =>
    new Response(JSON.stringify({ error: err.message }), {
      status: err.status ?? 500,
    })
  ),
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
  redactSensitive: vi.fn((d: unknown) => d),
}));

vi.mock("@/lib/contracts", () => ({
  computeContractCosts: vi.fn().mockReturnValue({
    paidMonths: 12,
    scheduledTotal: { toString: () => "1200.00" },
    effectiveMonthly: { toString: () => "100.00" },
    monthlyFee: { toString: () => "100.00" },
  }),
  deriveContractStatus: vi.fn().mockReturnValue("active"),
}));

vi.mock("@/lib/db", () => ({
  db: {
    internetContract: {
      findMany: mockFindMany,
      findUnique: mockContractFindUnique,
      create: mockContractCreate,
    },
    company: {
      findUnique: mockCompanyFindUnique,
    },
    internetService: {
      findUnique: mockServiceFindUnique,
    },
  },
}));

// ── Import the route after mocks ──────────────────────────────────────────────
import { GET } from "@/app/api/contracts/route";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: "ctr-1",
    contractNumber: "CN-001",
    serviceId: "svc-1",
    startDate: new Date("2025-01-01"),
    endDate: new Date("2026-01-01"),
    durationMonths: 12,
    freeMonths: 0,
    monthlyFee: { toString: () => "100.00" },
    currency: "USD",
    billingCycle: "ANNUAL",
    status: "ACTIVE",
    notes: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    service: {
      id: "svc-1",
      serviceCode: "SVC-001",
      branch: { id: "br-1", name: "HQ", code: "HQ" },
      shop: { id: "sh-1", name: "Shop A", code: "SA" },
      provider: { id: "prov-1", name: "Provider X", code: "PX" },
      plan: { id: "plan-1", name: "Business" },
    },
    createdBy: { id: "user-1", name: "Alice", email: "alice@example.com" },
    ...overrides,
  };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/contracts");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("GET /api/contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([makeContract()]);
    mockCompanyFindUnique.mockResolvedValue({ warningDays: 45 });
  });

  it("fires findMany and company findUnique concurrently via Promise.all", async () => {
    const req = makeRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);

    // Both should be called exactly once
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockCompanyFindUnique).toHaveBeenCalledWith({
      where: { id: "comp-1" },
      select: { warningDays: true },
    });
  });

  it("returns mapped contract shape with string Decimal fields", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const c = body[0];
    expect(c).toMatchObject({
      id: "ctr-1",
      contractNumber: "CN-001",
      serviceCode: "SVC-001",
      currency: "USD",
    });
    // Decimal fields must be serialized as strings
    expect(typeof c.monthlyFee).toBe("string");
    expect(typeof c.scheduledTotal).toBe("string");
    expect(typeof c.effectiveMonthly).toBe("string");
  });

  it("uses warningDays from company record", async () => {
    const { deriveContractStatus } = await import("@/lib/contracts");
    await GET(makeRequest());
    expect(deriveContractStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Date),
      45 // company.warningDays
    );
  });

  it("falls back to warningDays = 30 when company is null", async () => {
    mockCompanyFindUnique.mockResolvedValue(null);
    const { deriveContractStatus } = await import("@/lib/contracts");
    await GET(makeRequest());
    expect(deriveContractStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Date),
      30 // default fallback
    );
  });

  it("passes status filter to findMany where clause", async () => {
    await GET(makeRequest({ status: "ACTIVE" }));
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe("ACTIVE");
  });

  it("passes search filter to findMany where clause", async () => {
    await GET(makeRequest({ search: "cn-001" }));
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
  });

  it("returns empty array when no contracts exist", async () => {
    mockFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
