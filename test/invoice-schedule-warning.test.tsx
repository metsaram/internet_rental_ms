/**
 * @vitest-environment jsdom
 * 
 * Test suite for Invoice Schedule & Duration End date warnings, alert highlighting,
 * and filtering in InvoicesView.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  InvoicesView,
  getScheduleWarningState,
} from "@/components/views/invoices";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        name: "Test Admin",
        companyName: "Acme Corp",
        companyCurrency: "USD",
        companyWarningDays: 7,
      },
    },
    status: "authenticated",
  }),
}));

const mockApi = vi.fn();
vi.mock("@/lib/api-client", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe("getScheduleWarningState calculation logic", () => {
  const baseTime = new Date("2026-10-31T12:00:00Z");

  it("returns normal when periodEnd is null, empty, or missing", () => {
    expect(getScheduleWarningState({ periodEnd: null }, baseTime)).toEqual({
      daysLeft: null,
      tone: "normal",
    });
    expect(getScheduleWarningState({ periodEnd: "" }, baseTime)).toEqual({
      daysLeft: null,
      tone: "normal",
    });
    expect(getScheduleWarningState({}, baseTime)).toEqual({
      daysLeft: null,
      tone: "normal",
    });
  });

  it("returns normal when invoice status is VOID even if period has expired", () => {
    expect(
      getScheduleWarningState(
        { periodEnd: "2026-10-01", status: "VOID" },
        baseTime
      )
    ).toEqual({
      daysLeft: null,
      tone: "normal",
    });
  });

  it("returns warning (amber tone) when periodEnd is <= warningDays away", () => {
    // Ends today (0 days)
    const endsToday = getScheduleWarningState(
      { periodEnd: "2026-10-31", status: "ISSUED" },
      baseTime,
      7
    );
    expect(endsToday.tone).toBe("warning");
    expect(endsToday.daysLeft).toBe(0);

    // Ends in 3 days
    const endsIn3d = getScheduleWarningState(
      { periodEnd: "2026-11-03", status: "ISSUED" },
      baseTime,
      7
    );
    expect(endsIn3d.tone).toBe("warning");
    expect(endsIn3d.daysLeft).toBe(3);

    // Ends in exactly 7 days
    const endsIn7d = getScheduleWarningState(
      { periodEnd: "2026-11-07", status: "ISSUED" },
      baseTime,
      7
    );
    expect(endsIn7d.tone).toBe("warning");
    expect(endsIn7d.daysLeft).toBe(7);
  });

  it("returns normal when periodEnd is > warningDays away", () => {
    const endsIn30d = getScheduleWarningState(
      { periodEnd: "2026-11-30", status: "ISSUED" },
      baseTime,
      7
    );
    expect(endsIn30d.tone).toBe("normal");
    expect(endsIn30d.daysLeft).toBe(30);
  });

  it("returns overdue (rose tone) when periodEnd date has already passed", () => {
    const ended5dAgo = getScheduleWarningState(
      { periodEnd: "2026-10-26", status: "ISSUED" },
      baseTime,
      7
    );
    expect(ended5dAgo.tone).toBe("overdue");
    expect(ended5dAgo.daysLeft).toBe(-5);
  });
});

describe("InvoicesView Schedule & Duration Highlights & Alerts", () => {
  let queryClient: QueryClient;

  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ago5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const testInvoices = [
    {
      id: "inv-sched-warning",
      invoiceNumber: "INV-SCHED-001",
      contractId: "c1",
      contractNumber: "CTR-001",
      serviceId: "s1",
      serviceCode: "SRV-001",
      branch: { name: "Branch North", code: "BN" },
      shop: null,
      provider: { id: "p1", name: "Fiber Provider", code: "FP" },
      invoiceDate: "2026-10-01",
      dueDate: in30d, // payment not due soon
      periodStart: "2026-10-01",
      periodEnd: in3d, // Schedule ends in 3 days!
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
      id: "inv-sched-ended",
      invoiceNumber: "INV-SCHED-002",
      contractId: "c2",
      contractNumber: "CTR-002",
      serviceId: "s2",
      serviceCode: "SRV-002",
      branch: { name: "Branch South", code: "BS" },
      shop: null,
      provider: { id: "p2", name: "Telecom Plus", code: "TP" },
      invoiceDate: "2026-09-01",
      dueDate: in30d,
      periodStart: "2026-09-01",
      periodEnd: ago5d, // Schedule ended 5 days ago!
      subtotal: "200.00",
      tax: "20.00",
      discount: "0.00",
      total: "220.00",
      currency: "USD",
      status: "ISSUED",
      derivedStatus: "issued",
      notes: null,
      createdBy: null,
      createdAt: "2026-09-01T00:00:00Z",
      allocated: "0.00",
      outstanding: "220.00",
    },
    {
      id: "inv-sched-normal",
      invoiceNumber: "INV-SCHED-003",
      contractId: "c3",
      contractNumber: "CTR-003",
      serviceId: "s3",
      serviceCode: "SRV-003",
      branch: { name: "Branch East", code: "BE" },
      shop: null,
      provider: { id: "p1", name: "Fiber Provider", code: "FP" },
      invoiceDate: "2026-10-01",
      dueDate: in30d,
      periodStart: "2026-10-01",
      periodEnd: in30d, // Schedule ends in 30 days (normal)
      subtotal: "300.00",
      tax: "30.00",
      discount: "0.00",
      total: "330.00",
      currency: "USD",
      status: "ISSUED",
      derivedStatus: "issued",
      notes: null,
      createdBy: null,
      createdAt: "2026-10-01T00:00:00Z",
      allocated: "0.00",
      outstanding: "330.00",
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    mockApi.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    mockApi.mockImplementation((url: string) => {
      if (url.includes("/api/invoices/inv-sched-warning")) {
        return Promise.resolve(testInvoices[0]);
      }
      if (url.includes("/api/invoices")) {
        return Promise.resolve(testInvoices);
      }
      if (url.includes("/api/contracts")) return Promise.resolve([]);
      if (url.includes("/api/services")) return Promise.resolve([]);
      if (url.includes("/api/providers")) {
        return Promise.resolve([
          { id: "p1", code: "FP", name: "Fiber Provider" },
          { id: "p2", code: "TP", name: "Telecom Plus" },
        ]);
      }
      if (url.includes("/api/company")) {
        return Promise.resolve({ useContract: true, warningDays: 7 });
      }
      return Promise.resolve([]);
    });
  });

  it("renders Schedule & Duration column and highlights near end date with amber warning color and badge", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-SCHED-001")).toBeInTheDocument();
    });

    // Check Schedule & Duration column header exists
    expect(screen.getByText("Schedule & Duration")).toBeInTheDocument();

    // Check near schedule end date has amber highlight (text-amber-600)
    const schedWarning = screen.getByText(/3d left/i);
    expect(schedWarning).toBeInTheDocument();
    expect(schedWarning).toHaveClass("text-amber-700");

    // Check ended schedule has rose/destructive highlight
    const schedEnded = screen.getByText(/5d ended/i);
    expect(schedEnded).toBeInTheDocument();
  });

  it("renders schedule ending alert banner when invoices have schedules ending soon", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-SCHED-001")).toBeInTheDocument();
    });

    // Check banner text shows 1 invoice has Schedule & Duration ending within 7 days
    expect(
      screen.getByText(/Schedule & Duration ending within 7 days/i)
    ).toBeInTheDocument();

    // Click "View ending schedules" action button
    const viewEndingBtn = screen.getByRole("button", {
      name: /view ending schedules/i,
    });
    fireEvent.click(viewEndingBtn);

    // Only the ending soon invoice should be visible
    expect(screen.getByText("INV-SCHED-001")).toBeInTheDocument();
    expect(screen.queryByText("INV-SCHED-002")).not.toBeInTheDocument();
    expect(screen.queryByText("INV-SCHED-003")).not.toBeInTheDocument();

    // Click "Clear schedule filter" to restore all invoices
    const clearBtn = screen.getByRole("button", {
      name: /clear schedule filter/i,
    });
    fireEvent.click(clearBtn);

    expect(screen.getByText("INV-SCHED-001")).toBeInTheDocument();
    expect(screen.getByText("INV-SCHED-002")).toBeInTheDocument();
    expect(screen.getByText("INV-SCHED-003")).toBeInTheDocument();
  });

  it("displays Schedule & Duration in the invoice detail sheet with warning badge", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-SCHED-001")).toBeInTheDocument();
    });

    // Click on row to open detail sheet
    fireEvent.click(screen.getByText("INV-SCHED-001"));

    // Wait for detail sheet to render
    await waitFor(() => {
      expect(screen.getAllByText("Schedule & Duration").length).toBeGreaterThanOrEqual(2);
    });

    // Detail sheet shows "Ends in 3d" badge
    expect(screen.getAllByText(/Ends in 3d/i).length).toBeGreaterThanOrEqual(1);

    // Detail sheet includes "Copy invoice" button
    expect(screen.getByRole("button", { name: /copy invoice/i })).toBeInTheDocument();
  });

  it("prefills a new invoice with existing invoice data when 'Copy invoice' is clicked from row action, allowing edits and creating a new invoice", async () => {
    let submittedBody: any = null;
    mockApi.mockImplementation((url: string, opts?: any) => {
      if (url === "/api/invoices" && opts?.method === "POST") {
        submittedBody = JSON.parse(opts.body);
        return Promise.resolve({ id: "inv-new-copy", ...submittedBody });
      }
      if (url.includes("/api/invoices")) {
        return Promise.resolve(testInvoices);
      }
      if (url.includes("/api/contracts")) return Promise.resolve([]);
      if (url.includes("/api/services")) return Promise.resolve([]);
      if (url.includes("/api/providers")) {
        return Promise.resolve([
          { id: "p1", code: "FP", name: "Fiber Provider" },
          { id: "p2", code: "TP", name: "Telecom Plus" },
        ]);
      }
      if (url.includes("/api/company")) {
        return Promise.resolve({ useContract: false, warningDays: 7 });
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-SCHED-001")).toBeInTheDocument();
    });

    // Find the Copy invoice button for the invoice approaching its end date
    // (promoted as primary action for approaching end date invoice)
    const copyBtns = screen.getAllByRole("button", { name: /copy invoice/i });
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(copyBtns[0]);

    // Modal opens with copy-specific title
    await waitFor(() => {
      expect(screen.getByText(/copy of INV-SCHED-001/i)).toBeInTheDocument();
    });

    // Verify submit button says "Create invoice" (not "Save changes")
    const submitBtn = screen.getByRole("button", { name: /create invoice/i });
    expect(submitBtn).toBeInTheDocument();

    // Verify prefilled values
    const invInput = screen.getByLabelText(/invoice number/i) as HTMLInputElement;
    expect(invInput.value).toBe("INV-SCHED-001-COPY");

    // The user modifies the invoice number and notes
    fireEvent.change(invInput, { target: { value: "INV-2026-RENEWAL-001" } });
    expect(invInput.value).toBe("INV-2026-RENEWAL-001");

    // Click "Create invoice"
    fireEvent.click(submitBtn);

    // Verify it submitted via POST to create a new invoice
    await waitFor(() => {
      expect(submittedBody).not.toBeNull();
      expect(submittedBody.invoiceNumber).toBe("INV-2026-RENEWAL-001");
      expect(submittedBody.periodStart).toBe(in3d); // starts from previous invoice's periodEnd
    });
  });

  it("prefills a new invoice when 'Copy invoice' is clicked from InvoiceDetailSheet", async () => {
    mockApi.mockImplementation((url: string) => {
      if (url.includes("/api/invoices/inv-sched-warning")) {
        return Promise.resolve(testInvoices[0]);
      }
      if (url.includes("/api/invoices")) {
        return Promise.resolve(testInvoices);
      }
      if (url.includes("/api/company")) {
        return Promise.resolve({ useContract: false, warningDays: 7 });
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("INV-SCHED-001")).toBeInTheDocument();
    });

    // Click row to open detail sheet
    fireEvent.click(screen.getByText("INV-SCHED-001"));

    // Wait for detail sheet to render
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy invoice/i })).toBeInTheDocument();
    });

    // Click "Copy invoice" inside detail sheet
    fireEvent.click(screen.getByRole("button", { name: /copy invoice/i }));

    // Form dialog opens prefilled
    await waitFor(() => {
      expect(screen.getByText(/copy of INV-SCHED-001/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /create invoice/i })).toBeInTheDocument();
  });
});
