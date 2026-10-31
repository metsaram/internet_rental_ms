/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  InvoicesView,
  matchesInvoiceTab,
  getDueWarningState,
  INVOICE_TAB_META,
  type InvoiceTabKey,
} from "@/components/views/invoices";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Test Admin",
        companyName: "Acme Corp",
        companyCurrency: "USD",
      },
    },
    status: "authenticated",
  }),
}));

const mockApi = vi.fn();
vi.mock("@/lib/api-client", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

const sampleInvoices = [
  {
    id: "inv-issued",
    invoiceNumber: "INV-2026-001",
    contractId: "c1",
    contractNumber: "CTR-001",
    serviceId: "s1",
    serviceCode: "SRV-001",
    branch: { name: "Branch North", code: "BN" },
    shop: null,
    provider: { id: "p1", name: "Fiber Provider", code: "FP" },
    invoiceDate: "2026-10-01",
    dueDate: "2026-11-01",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    subtotal: "100.00",
    tax: "10.00",
    discount: "0.00",
    total: "110.00",
    currency: "USD",
    status: "ISSUED",
    derivedStatus: "issued",
    notes: null,
    createdBy: null,
    createdAt: "2026-10-01T00:00:00Z",
    allocated: "0.00",
    outstanding: "110.00",
  },
  {
    id: "inv-partial",
    invoiceNumber: "INV-2026-002",
    contractId: "c1",
    contractNumber: "CTR-001",
    serviceId: "s1",
    serviceCode: "SRV-001",
    branch: { name: "Branch North", code: "BN" },
    shop: null,
    provider: { id: "p1", name: "Fiber Provider", code: "FP" },
    invoiceDate: "2026-09-01",
    dueDate: "2026-11-05",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    subtotal: "100.00",
    tax: "10.00",
    discount: "0.00",
    total: "110.00",
    currency: "USD",
    status: "PARTIAL",
    derivedStatus: "partial",
    notes: null,
    createdBy: null,
    createdAt: "2026-09-01T00:00:00Z",
    allocated: "50.00",
    outstanding: "60.00",
  },
  {
    id: "inv-overdue",
    invoiceNumber: "INV-2026-003",
    contractId: "c2",
    contractNumber: "CTR-002",
    serviceId: "s2",
    serviceCode: "SRV-002",
    branch: { name: "Branch South", code: "BS" },
    shop: null,
    provider: { id: "p2", name: "Telecom Plus", code: "TP" },
    invoiceDate: "2026-08-01",
    dueDate: "2026-09-01",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    subtotal: "200.00",
    tax: "20.00",
    discount: "0.00",
    total: "220.00",
    currency: "USD",
    status: "OVERDUE",
    derivedStatus: "overdue",
    notes: null,
    createdBy: null,
    createdAt: "2026-08-01T00:00:00Z",
    allocated: "0.00",
    outstanding: "220.00",
  },
  {
    id: "inv-paid",
    invoiceNumber: "INV-2026-004",
    contractId: "c1",
    contractNumber: "CTR-001",
    serviceId: "s1",
    serviceCode: "SRV-001",
    branch: { name: "Branch North", code: "BN" },
    shop: null,
    provider: { id: "p1", name: "Fiber Provider", code: "FP" },
    invoiceDate: "2026-07-01",
    dueDate: "2026-08-01",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    subtotal: "100.00",
    tax: "10.00",
    discount: "0.00",
    total: "110.00",
    currency: "USD",
    status: "PAID",
    derivedStatus: "paid",
    notes: null,
    createdBy: null,
    createdAt: "2026-07-01T00:00:00Z",
    allocated: "110.00",
    outstanding: "0.00",
  },
  {
    id: "inv-draft",
    invoiceNumber: "INV-2026-005",
    contractId: "c3",
    contractNumber: "CTR-003",
    serviceId: "s3",
    serviceCode: "SRV-003",
    branch: { name: "Branch East", code: "BE" },
    shop: null,
    provider: { id: "p1", name: "Fiber Provider", code: "FP" },
    invoiceDate: "2026-10-25",
    dueDate: "2026-11-25",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    subtotal: "50.00",
    tax: "5.00",
    discount: "0.00",
    total: "55.00",
    currency: "USD",
    status: "DRAFT",
    derivedStatus: "draft",
    notes: null,
    createdBy: null,
    createdAt: "2026-10-25T00:00:00Z",
    allocated: "0.00",
    outstanding: "55.00",
  },
  {
    id: "inv-void",
    invoiceNumber: "INV-2026-006",
    contractId: "c1",
    contractNumber: "CTR-001",
    serviceId: "s1",
    serviceCode: "SRV-001",
    branch: { name: "Branch North", code: "BN" },
    shop: null,
    provider: { id: "p1", name: "Fiber Provider", code: "FP" },
    invoiceDate: "2026-06-01",
    dueDate: "2026-07-01",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    subtotal: "100.00",
    tax: "10.00",
    discount: "0.00",
    total: "110.00",
    currency: "USD",
    status: "VOID",
    derivedStatus: "void",
    notes: "[Void reason]: Duplicate billing",
    createdBy: null,
    createdAt: "2026-06-01T00:00:00Z",
    allocated: "0.00",
    outstanding: "110.00",
  },
];

describe("matchesInvoiceTab filter logic", () => {
  it("matches 'all' tab for any invoice", () => {
    for (const inv of sampleInvoices) {
      expect(matchesInvoiceTab(inv as any, "all")).toBe(true);
    }
  });

  it("matches 'unpaid' (Needs payment) tab for issued, partial, and overdue invoices with balance > 0", () => {
    // Issued
    expect(matchesInvoiceTab(sampleInvoices[0] as any, "unpaid")).toBe(true);
    // Partial
    expect(matchesInvoiceTab(sampleInvoices[1] as any, "unpaid")).toBe(true);
    // Overdue
    expect(matchesInvoiceTab(sampleInvoices[2] as any, "unpaid")).toBe(true);

    // Paid should not match unpaid
    expect(matchesInvoiceTab(sampleInvoices[3] as any, "unpaid")).toBe(false);
    // Draft should not match unpaid (must be issued first)
    expect(matchesInvoiceTab(sampleInvoices[4] as any, "unpaid")).toBe(false);
    // Void should not match unpaid
    expect(matchesInvoiceTab(sampleInvoices[5] as any, "unpaid")).toBe(false);
  });

  it("matches 'overdue' tab only for invoices with overdue status and balance > 0", () => {
    expect(matchesInvoiceTab(sampleInvoices[0] as any, "overdue")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[1] as any, "overdue")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[2] as any, "overdue")).toBe(true);
    expect(matchesInvoiceTab(sampleInvoices[3] as any, "overdue")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[4] as any, "overdue")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[5] as any, "overdue")).toBe(false);
  });

  it("matches 'paid' tab only for fully settled invoices", () => {
    expect(matchesInvoiceTab(sampleInvoices[0] as any, "paid")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[1] as any, "paid")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[2] as any, "paid")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[3] as any, "paid")).toBe(true);
    expect(matchesInvoiceTab(sampleInvoices[4] as any, "paid")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[5] as any, "paid")).toBe(false);
  });

  it("matches 'draft' tab for draft invoices", () => {
    expect(matchesInvoiceTab(sampleInvoices[4] as any, "draft")).toBe(true);
    expect(matchesInvoiceTab(sampleInvoices[0] as any, "draft")).toBe(false);
    expect(matchesInvoiceTab(sampleInvoices[5] as any, "draft")).toBe(false);
  });

  it("matches 'void' tab for voided invoices", () => {
    expect(matchesInvoiceTab(sampleInvoices[5] as any, "void")).toBe(true);
    expect(matchesInvoiceTab(sampleInvoices[0] as any, "void")).toBe(false);
  });
});

describe("getDueWarningState calculation logic", () => {
  const baseTime = new Date("2026-10-31T12:00:00Z");

  it("returns normal when dueDate is null or empty", () => {
    expect(getDueWarningState({ dueDate: null, status: "ISSUED", outstanding: "100" }, baseTime)).toEqual({
      daysLeft: null,
      tone: "normal",
    });
    expect(getDueWarningState({ dueDate: "", status: "ISSUED", outstanding: "100" }, baseTime)).toEqual({
      daysLeft: null,
      tone: "normal",
    });
  });

  it("returns normal when invoice is VOID, PAID, or outstanding <= 0", () => {
    // Due tomorrow, but already paid
    expect(
      getDueWarningState({ dueDate: "2026-11-01", status: "PAID", outstanding: "0" }, baseTime)
    ).toEqual({ daysLeft: null, tone: "normal" });

    // Due in 3 days, but void
    expect(
      getDueWarningState({ dueDate: "2026-11-03", status: "VOID", outstanding: "100" }, baseTime)
    ).toEqual({ daysLeft: null, tone: "normal" });
  });

  it("returns warning when dueDate is <= 7 days away", () => {
    // Due today (0 days)
    const dueToday = getDueWarningState({ dueDate: "2026-10-31", status: "ISSUED", outstanding: "100" }, baseTime);
    expect(dueToday.tone).toBe("warning");
    expect(dueToday.daysLeft).toBe(0);

    // Due in 3 days
    const dueIn3d = getDueWarningState({ dueDate: "2026-11-03", status: "ISSUED", outstanding: "100" }, baseTime);
    expect(dueIn3d.tone).toBe("warning");
    expect(dueIn3d.daysLeft).toBe(3);

    // Due in exactly 7 days
    const dueIn7d = getDueWarningState({ dueDate: "2026-11-07", status: "ISSUED", outstanding: "100" }, baseTime);
    expect(dueIn7d.tone).toBe("warning");
    expect(dueIn7d.daysLeft).toBe(7);
  });

  it("returns normal when dueDate is > 7 days away", () => {
    // Due in 8 days
    const dueIn8d = getDueWarningState({ dueDate: "2026-11-08", status: "ISSUED", outstanding: "100" }, baseTime);
    expect(dueIn8d.tone).toBe("normal");
    expect(dueIn8d.daysLeft).toBe(8);

    // Due in 30 days
    const dueIn30d = getDueWarningState({ dueDate: "2026-11-30", status: "ISSUED", outstanding: "100" }, baseTime);
    expect(dueIn30d.tone).toBe("normal");
    expect(dueIn30d.daysLeft).toBe(30);
  });

  it("returns overdue when dueDate has passed (< 0 days)", () => {
    const overdue = getDueWarningState({ dueDate: "2026-10-25", status: "OVERDUE", outstanding: "100" }, baseTime);
    expect(overdue.tone).toBe("overdue");
    expect(overdue.daysLeft).toBeLessThan(0);
  });
});

describe("InvoicesView Status Tabs & Tiles Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    mockApi.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockApi.mockImplementation((url: string) => {
      if (url.includes("/api/invoices")) {
        return Promise.resolve(sampleInvoices);
      }
      if (url.includes("/api/contracts")) {
        return Promise.resolve([]);
      }
      if (url.includes("/api/services")) {
        return Promise.resolve([]);
      }
      if (url.includes("/api/providers")) {
        return Promise.resolve([
          { id: "p1", code: "FP", name: "Fiber Provider" },
          { id: "p2", code: "TP", name: "Telecom Plus" },
        ]);
      }
      if (url.includes("/api/company")) {
        return Promise.resolve({ useContract: true });
      }
      return Promise.resolve([]);
    });
  });

  it("renders summary tiles and tabs with accurate counts matching renewals pattern", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    // Wait for invoices to load
    await waitFor(() => {
      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    });

    // Check all 6 tabs exist in TabsList
    const tabTriggers = screen.getAllByRole("tab");
    expect(tabTriggers.length).toBe(6);

    // Verify summary tiles render the labels
    expect(screen.getAllByText("All invoices").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Needs payment").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Overdue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Paid").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Void").length).toBeGreaterThanOrEqual(1);

    // Counts:
    // Total: 6
    // Needs payment (issued, partial, overdue): 3
    // Overdue: 1
    // Paid: 1
    // Draft: 1
    // Void: 1
    expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it("defaults to 'Needs payment' tab and filters table rows to invoices needing payment", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    });

    // Should display issued (INV-2026-001), partial (INV-2026-002), and overdue (INV-2026-003) by default
    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-002")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-003")).toBeInTheDocument();

    // Paid, draft, and void should be excluded by default
    expect(screen.queryByText("INV-2026-004")).not.toBeInTheDocument();
    expect(screen.queryByText("INV-2026-005")).not.toBeInTheDocument();
    expect(screen.queryByText("INV-2026-006")).not.toBeInTheDocument();

    // Switching to All tab shows all invoices
    const allTab = screen.getByRole("tab", { name: /all/i });
    fireEvent.click(allTab);
    expect(screen.getByText("INV-2026-004")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-005")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-006")).toBeInTheDocument();
  });

  it("filters table rows when summary tile is clicked", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    });

    // Find the 'Paid' summary tile button
    const paidTile = screen.getByRole("button", { name: /paid/i });
    fireEvent.click(paidTile);

    // Only paid invoice should be displayed
    expect(screen.getByText("INV-2026-004")).toBeInTheDocument();
    expect(screen.queryByText("INV-2026-001")).not.toBeInTheDocument();
    expect(screen.queryByText("INV-2026-002")).not.toBeInTheDocument();
    expect(screen.queryByText("INV-2026-003")).not.toBeInTheDocument();
  });

  it("filters table rows to overdue, draft, and void respectively", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    });

    // Test Overdue
    fireEvent.click(screen.getByRole("tab", { name: /overdue/i }));
    expect(screen.getByText("INV-2026-003")).toBeInTheDocument();
    expect(screen.queryByText("INV-2026-001")).not.toBeInTheDocument();

    // Test Draft
    fireEvent.click(screen.getByRole("tab", { name: /draft/i }));
    expect(screen.getByText("INV-2026-005")).toBeInTheDocument();
    expect(screen.queryByText("INV-2026-003")).not.toBeInTheDocument();

    // Test Void
    fireEvent.click(screen.getByRole("tab", { name: /void/i }));
    expect(screen.getByText("INV-2026-006")).toBeInTheDocument();
    expect(screen.queryByText("INV-2026-005")).not.toBeInTheDocument();
  });

  it("displays tailored empty state when no invoices match the active tab", async () => {
    // Only return paid invoices
    mockApi.mockImplementation((url: string) => {
      if (url.includes("/api/invoices")) {
        return Promise.resolve([sampleInvoices[3]]); // only paid
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    // Because default active tab is "unpaid" and only a paid invoice was returned:
    // It should immediately display the tailored empty message for the unpaid tab!
    await waitFor(() => {
      expect(screen.getByText(/No invoices currently need payment/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("INV-2026-004")).not.toBeInTheDocument();

    // Clicking "Paid" tab displays the paid invoice
    fireEvent.click(screen.getByRole("tab", { name: /paid/i }));
    await waitFor(() => {
      expect(screen.getByText("INV-2026-004")).toBeInTheDocument();
    });
  });

  it("renders Due date at top with warning color when due date <= 7 days", async () => {
    const now = new Date();
    const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const testInvoices = [
      {
        ...sampleInvoices[0],
        id: "inv-warning",
        invoiceNumber: "INV-WARN-001",
        dueDate: in3d,
        invoiceDate: "2026-10-01",
      },
      {
        ...sampleInvoices[0],
        id: "inv-normal",
        invoiceNumber: "INV-NORM-002",
        dueDate: in30d,
        invoiceDate: "2026-10-01",
      },
    ];

    mockApi.mockImplementation((url: string) => {
      if (url.includes("/api/invoices")) {
        return Promise.resolve(testInvoices);
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-WARN-001")).toBeInTheDocument();
    });

    // Check column header shows Due / Date
    expect(screen.getByText("Due / Date")).toBeInTheDocument();

    // Check due date with <= 7 days has warning styling
    const dueWarningEl = screen.getByText(/Due/i, { selector: ".text-amber-600" });
    expect(dueWarningEl).toBeInTheDocument();
    expect(dueWarningEl).toHaveClass("text-amber-600");

    // Check invoice date rendered below as Inv ...
    expect(screen.getAllByText(/Inv Oct 1, 2026/i).length).toBeGreaterThanOrEqual(1);
  });
});
