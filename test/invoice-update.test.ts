import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing route
vi.mock("@/lib/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1", companyId: "comp-1" }),
  parseJsonBody: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  errorResponse: vi.fn((err) => ({
    status: err.status || 500,
    json: async () => ({ error: err.message }),
  })),
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
  redactSensitive: vi.fn((data) => data),
}));

vi.mock("@/lib/db", () => ({
  db: {
    invoice: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    internetContract: {
      findUnique: vi.fn(),
    },
    internetService: {
      findUnique: vi.fn(),
    },
  },
}));

import { PATCH } from "@/app/api/invoices/[id]/route";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/session";

describe("Invoice PATCH Route", () => {
  const existingInvoice = {
    id: "inv-1",
    companyId: "comp-1",
    invoiceNumber: "INV-2026-8573",
    status: "DRAFT",
    total: 858,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.invoice.findUnique as any).mockResolvedValue(existingInvoice);
    (db.invoice.update as any).mockImplementation(({ data }: any) => ({
      id: "inv-1",
      ...data,
      total: data.total ?? existingInvoice.total,
      invoiceNumber: data.invoiceNumber ?? existingInvoice.invoiceNumber,
      status: data.status ?? existingInvoice.status,
    }));
  });

  it("updates invoice with disconnected contract and connected direct service without unknown serviceId scalar", async () => {
    (parseJsonBody as any).mockResolvedValue({
      invoiceNumber: "INV-2026-8573",
      contractId: null,
      serviceId: "svc-123",
      subtotal: 780,
      total: 858,
    });

    (db.internetService.findUnique as any).mockResolvedValue({
      id: "svc-123",
      companyId: "comp-1",
    });

    const res = await PATCH(new Request("http://localhost/api/invoices/inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });

    expect(db.invoice.update).toHaveBeenCalledTimes(1);
    const updateCall = (db.invoice.update as any).mock.calls[0][0];

    // Assert target ID
    expect(updateCall.where).toEqual({ id: "inv-1" });

    // Assert that serviceId scalar is NOT present in data
    expect(updateCall.data).not.toHaveProperty("serviceId");

    // Assert relations are properly constructed for Prisma
    expect(updateCall.data.contract).toEqual({ disconnect: true });
    expect(updateCall.data.service).toEqual({ connect: { id: "svc-123" } });
  });

  it("updates invoice with connected contract and connects service linked to the contract", async () => {
    (parseJsonBody as any).mockResolvedValue({
      invoiceNumber: "INV-2026-8573",
      contractId: "contract-456",
      subtotal: 780,
      total: 858,
    });

    (db.internetContract.findUnique as any).mockResolvedValue({
      id: "contract-456",
      companyId: "comp-1",
      serviceId: "svc-contract-linked",
    });

    const res = await PATCH(new Request("http://localhost/api/invoices/inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });

    expect(db.invoice.update).toHaveBeenCalledTimes(1);
    const updateCall = (db.invoice.update as any).mock.calls[0][0];

    // Assert that serviceId scalar is NOT present in data
    expect(updateCall.data).not.toHaveProperty("serviceId");

    // Assert contract and service relations
    expect(updateCall.data.contract).toEqual({ connect: { id: "contract-456" } });
    expect(updateCall.data.service).toEqual({ connect: { id: "svc-contract-linked" } });
  });

  it("disconnects both contract and service when neither is provided", async () => {
    (parseJsonBody as any).mockResolvedValue({
      invoiceNumber: "INV-2026-8573",
      contractId: null,
      serviceId: null,
    });

    const res = await PATCH(new Request("http://localhost/api/invoices/inv-1"), {
      params: Promise.resolve({ id: "inv-1" }),
    });

    expect(db.invoice.update).toHaveBeenCalledTimes(1);
    const updateCall = (db.invoice.update as any).mock.calls[0][0];

    expect(updateCall.data).not.toHaveProperty("serviceId");
    expect(updateCall.data.contract).toEqual({ disconnect: true });
    expect(updateCall.data.service).toEqual({ disconnect: true });
  });
});

