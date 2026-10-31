/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsView } from "@/components/views/settings";
import { getDueWarningState } from "@/components/views/invoices";
import { classifyRenewal, DEFAULT_WARNING_DAYS } from "@/lib/renewals";
import { deriveContractStatus } from "@/lib/contracts";
import { getInvoicePaymentAlert } from "@/lib/notifications";

let mockSessionUser: {
  name: string;
  email: string;
  role: string;
  companyId: string;
  companyName: string;
  companyCurrency: string;
  companyUseContract?: boolean;
  companyWarningDays?: number;
} = {
  name: "Admin User",
  email: "admin@netrent.com",
  role: "ADMIN",
  companyId: "comp-1",
  companyName: "Acme Corp",
  companyCurrency: "USD",
  companyUseContract: true,
  companyWarningDays: 30,
};

const mockUpdateSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: mockSessionUser },
    status: "authenticated",
    update: mockUpdateSession,
  }),
}));

const mockApi = vi.fn();
vi.mock("@/lib/api-client", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

const mockCompanyData = {
  id: "comp-1",
  code: "ACME",
  name: "Acme Corp",
  taxId: "TAX-123",
  address: "123 Main St",
  city: "Metropolis",
  phone: "+1-555-0199",
  email: "ops@acme.com",
  currency: "USD",
  useContract: true,
  warningDays: 30,
  status: "ACTIVE",
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Days Before Warning - Settings & System-wide Threshold Validations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = {
      name: "Admin User",
      email: "admin@netrent.com",
      role: "ADMIN",
      companyId: "comp-1",
      companyName: "Acme Corp",
      companyCurrency: "USD",
      companyUseContract: true,
      companyWarningDays: 30,
    };
  });

  describe("SettingsView - Configurable Days Before Warning", () => {
    it("renders the 'Days Before Warning' input with current company setting", async () => {
      mockApi.mockImplementation((url: string) => {
        if (url === "/api/company") {
          return Promise.resolve({ ...mockCompanyData, warningDays: 45 });
        }
        return Promise.resolve([]);
      });

      renderWithClient(<SettingsView />);

      expect(await screen.findByText("Days Before Warning")).toBeInTheDocument();
      const input = (await screen.findByLabelText("Days Before Warning")) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("45");
      expect(input).not.toBeDisabled();
    });

    it("allows clearing the input without immediately resetting to 30, permitting clean entry of 7 or 10", async () => {
      mockApi.mockImplementation((url: string) => {
        if (url === "/api/company") {
          return Promise.resolve({ ...mockCompanyData, warningDays: 30 });
        }
        return Promise.resolve([]);
      });

      renderWithClient(<SettingsView />);

      const input = (await screen.findByLabelText("Days Before Warning")) as HTMLInputElement;
      expect(input.value).toBe("30");

      // User clears the input
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");

      // User types 7
      fireEvent.change(input, { target: { value: "7" } });
      expect(input.value).toBe("7");

      // User clears again and types 10
      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
      fireEvent.change(input, { target: { value: "10" } });
      expect(input.value).toBe("10");
    });

    it("allows admin to update Days Before Warning and submits to company API", async () => {
      mockApi.mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
        if (url === "/api/company" && opts?.method === "PATCH") {
          const body = JSON.parse(opts.body ?? "{}");
          return Promise.resolve({ ...mockCompanyData, ...body });
        }
        if (url === "/api/company") {
          return Promise.resolve({ ...mockCompanyData, warningDays: 30 });
        }
        return Promise.resolve([]);
      });

      renderWithClient(<SettingsView />);

      const input = (await screen.findByLabelText("Days Before Warning")) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "14" } });
      expect(input.value).toBe("14");

      const saveBtn = screen.getByRole("button", { name: /Save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith(
          "/api/company",
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"warningDays":14'),
          })
        );
      });
    });

    it("disables the Days Before Warning input for non-admin users", async () => {
      mockSessionUser.role = "STAFF";
      mockApi.mockImplementation((url: string) => {
        if (url === "/api/company") {
          return Promise.resolve({ ...mockCompanyData, warningDays: 30 });
        }
        return Promise.resolve([]);
      });

      renderWithClient(<SettingsView />);

      const input = (await screen.findByLabelText("Days Before Warning")) as HTMLInputElement;
      expect(input).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Save changes/i })).not.toBeInTheDocument();
    });
  });

  describe("Invoice Due Warning Threshold - getDueWarningState", () => {
    const fixedNow = new Date("2026-10-31T12:00:00Z");

    it("triggers warning tone dynamically when invoice is within custom warning threshold", () => {
      // Due in 12 days (Nov 12, 2026)
      const invoice = {
        dueDate: "2026-11-12",
        status: "ISSUED",
        outstanding: "100.00",
      };

      // With default 7 days warning: 12 days away is "normal"
      const defaultState = getDueWarningState(invoice, fixedNow, 7);
      expect(defaultState.daysLeft).toBe(12);
      expect(defaultState.tone).toBe("normal");

      // With configured company warningDays = 14: 12 days away is "warning"
      const configuredState = getDueWarningState(invoice, fixedNow, 14);
      expect(configuredState.daysLeft).toBe(12);
      expect(configuredState.tone).toBe("warning");
    });

    it("correctly identifies overdue vs warning vs normal states based on threshold", () => {
      const warningDays = 10;

      // Overdue
      const overdueInv = { dueDate: "2026-10-25", status: "ISSUED", outstanding: "50.00" };
      expect(getDueWarningState(overdueInv, fixedNow, warningDays).tone).toBe("overdue");

      // Within warning threshold (5 days left <= 10)
      const warningInv = { dueDate: "2026-11-05", status: "ISSUED", outstanding: "50.00" };
      expect(getDueWarningState(warningInv, fixedNow, warningDays).tone).toBe("warning");

      // Beyond warning threshold (20 days left > 10)
      const normalInv = { dueDate: "2026-11-20", status: "ISSUED", outstanding: "50.00" };
      expect(getDueWarningState(normalInv, fixedNow, warningDays).tone).toBe("normal");

      // Paid / Settled invoices always normal
      const paidInv = { dueDate: "2026-11-05", status: "PAID", outstanding: "0.00" };
      expect(getDueWarningState(paidInv, fixedNow, warningDays).tone).toBe("normal");
    });
  });

  describe("Contract Expiry & Renewal Thresholds - classifyRenewal & deriveContractStatus", () => {
    const fixedNow = new Date("2026-10-31T00:00:00Z");

    it("classifies contract renewal as upcoming dynamically according to warningDays", () => {
      // Contract ends in 20 days (Nov 20, 2026)
      const candidate = {
        contractId: "ctr-1",
        endDate: "2026-11-20",
        renewalStatus: "PENDING",
      };

      // At warningDays = 15: 20 days left is "none"
      expect(classifyRenewal(candidate, fixedNow, 15)).toBe("none");

      // At warningDays = 30: 20 days left is "upcoming"
      expect(classifyRenewal(candidate, fixedNow, 30)).toBe("upcoming");

      // At warningDays = 20: 20 days left is "upcoming"
      expect(classifyRenewal(candidate, fixedNow, 20)).toBe("upcoming");
    });

    it("derives contract status as expiring based on configurable warningDays", () => {
      // Contract ends in 25 days
      const contract = {
        status: "ACTIVE",
        startDate: new Date("2025-11-25"),
        endDate: new Date("2026-11-25"),
      };

      // At warningDays = 15: 25 days left is "active"
      expect(deriveContractStatus(contract, fixedNow, 15)).toBe("active");

      // At warningDays = 30: 25 days left is "expiring"
      expect(deriveContractStatus(contract, fixedNow, 30)).toBe("expiring");

      // At warningDays = 60: 25 days left is "expiring"
      expect(deriveContractStatus(contract, fixedNow, 60)).toBe("expiring");
    });
  });

  describe("Invoice Notification Payment Alert Threshold - getInvoicePaymentAlert", () => {
    const fixedNow = new Date("2026-10-31T00:00:00Z");

    it("generates INVOICE_DUE_SOON alerts within configurable warning window", () => {
      // Due in 10 days (Nov 10, 2026)
      const invoice = {
        invoiceNumber: "INV-100",
        dueDate: "2026-11-10",
        status: "ISSUED",
        currency: "USD",
      };

      // With warningDays = 7: 10 days away produces null (outside 7d window)
      expect(getInvoicePaymentAlert(invoice, 150, fixedNow, 7)).toBeNull();

      // With warningDays = 14: 10 days away produces INVOICE_DUE_SOON alert
      const alert = getInvoicePaymentAlert(invoice, 150, fixedNow, 14);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe("INVOICE_DUE_SOON");
      expect(alert?.title).toContain("Invoice due in 10d: INV-100");
    });

    it("stops alerting when invoice exceeds overdue threshold based on warningDays", () => {
      // Overdue by 10 days (Oct 21, 2026)
      const overdueInvoice = {
        invoiceNumber: "INV-200",
        dueDate: "2026-10-21",
        status: "ISSUED",
        currency: "USD",
      };

      // With warningDays = 7: 10 days overdue produces null (beyond -7d limit)
      expect(getInvoicePaymentAlert(overdueInvoice, 200, fixedNow, 7)).toBeNull();

      // With warningDays = 14: 10 days overdue produces INVOICE_OVERDUE alert
      const alert = getInvoicePaymentAlert(overdueInvoice, 200, fixedNow, 14);
      expect(alert).not.toBeNull();
      expect(alert?.type).toBe("INVOICE_OVERDUE");
      expect(alert?.title).toContain("Invoice 10d overdue: INV-200");
    });
  });
});

