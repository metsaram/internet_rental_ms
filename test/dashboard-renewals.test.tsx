import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardView } from "@/components/views/dashboard";

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

const mockDashboardData = {
  counts: {
    branches: 5,
    shops: 10,
    services: 15,
    providers: 3,
    plans: 8,
    contracts: 12,
    activeContracts: 10,
    expiringSoon: 2,
    expired: 1,
    upcoming: 3,
    invoices: 20,
    overdueInvoices: 2,
  },
  billing: {
    invoicedTotal: "5000",
    collectedTotal: "4000",
    outstandingTotal: "1000",
    overdueCount: 2,
  },
  costByCurrency: [
    { currency: "USD", expectedMonthly: "1200", effectiveMonthly: "1150" },
  ],
  costByProvider: [],
  costByBranch: [],
  renewals: [
    {
      id: "ren-1",
      contractNumber: "CTR-2026-001",
      serviceCode: "SRV-FIBER-01",
      branch: "Downtown HQ",
      endDate: "2026-11-05T00:00:00.000Z",
      daysLeft: 8,
      monthlyFee: "250.00",
      currency: "USD",
      status: "expiring",
    },
    {
      id: "ren-2",
      contractNumber: "CTR-2026-002",
      serviceCode: "SRV-LTE-02",
      branch: "North Branch",
      endDate: "2026-10-20T00:00:00.000Z",
      daysLeft: -8,
      monthlyFee: "150.00",
      currency: "USD",
      status: "expired",
    },
  ],
  renewalSummary: { upcoming: 2, overdue: 1, completed: 5, total: 8 },
  recentActivity: [],
  costTrend: [],
};

vi.mock("@/lib/api-client", () => ({
  api: vi.fn().mockImplementation((url: string) => {
    if (url === "/api/dashboard") {
      return Promise.resolve(mockDashboardData);
    }
    return Promise.resolve({});
  }),
}));

describe("DashboardView Upcoming renewals & expiries refactor", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("renders Upcoming renewals & expiries table with ReportTable headers, rows, and right-aligned title button", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <DashboardView />
      </QueryClientProvider>
    );

    // Verify title and Manage renewals button in the title flex row
    const title = screen.getByText("Upcoming renewals & expiries");
    const manageBtn = screen.getByRole("button", { name: /manage renewals/i });
    expect(title).toBeInTheDocument();
    expect(manageBtn).toBeInTheDocument();

    // Verify the button is inside the same flex-row container as the title on the right
    const titleRowContainer = manageBtn.closest(".flex.items-center.justify-between");
    expect(titleRowContainer).not.toBeNull();
    expect(titleRowContainer).toContainElement(title);
    expect(titleRowContainer).toContainElement(manageBtn);

    // Verify ReportTable column headers asynchronously
    expect(await screen.findByText("CTR-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Contract")).toBeInTheDocument();
    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByText("End date")).toBeInTheDocument();
    expect(screen.getByText("Days left")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();

    // Verify min and max column widths are applied on colgroup
    const cols = container.querySelectorAll("colgroup col");
    expect(cols.length).toBe(6);
    expect(cols[0].getAttribute("style")).toContain("min-width: 160px");
    expect(cols[0].getAttribute("style")).toContain("max-width: 360px");
    expect(cols[0].getAttribute("style")).toContain("width: 220px");

    expect(cols[1].getAttribute("style")).toContain("min-width: 120px");
    expect(cols[1].getAttribute("style")).toContain("max-width: 260px");
    expect(cols[1].getAttribute("style")).toContain("width: 160px");

    // Verify renewal records
    expect(screen.getByText("SRV-FIBER-01")).toBeInTheDocument();
    expect(screen.getByText("Downtown HQ")).toBeInTheDocument();
    expect(screen.getByText("8d")).toBeInTheDocument();
    expect(screen.getByText("$250.00")).toBeInTheDocument();

    expect(screen.getByText("CTR-2026-002")).toBeInTheDocument();
    expect(screen.getByText("SRV-LTE-02")).toBeInTheDocument();
    expect(screen.getByText("North Branch")).toBeInTheDocument();
    expect(screen.getByText("-8d")).toBeInTheDocument();
    expect(screen.getByText("$150.00")).toBeInTheDocument();

    // Verify column chooser is present
    const columnsBtn = screen.getByRole("button", { name: /customize visible columns/i });
    expect(columnsBtn).toBeInTheDocument();
  });
});
