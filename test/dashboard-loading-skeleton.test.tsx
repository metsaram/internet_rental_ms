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
        companyUseContract: false,
      },
    },
    status: "authenticated",
  }),
}));

vi.mock("@/lib/api-client", () => ({
  api: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves -> stays in isLoading
}));

describe("DashboardView Loading Skeleton (Contract-Free Mode)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("netrent_use_contract", "false");
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  it("renders invoice skeletons and invoice labels while loading when contract is not required", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardView />
      </QueryClientProvider>
    );

    // Verify KPI card renders "Invoices" skeleton (NOT "Contracts")
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.queryByText("Contracts")).not.toBeInTheDocument();

    // Verify Monthly spend card renders "Monthly service spend" skeleton (NOT "Monthly contract cost")
    expect(screen.getByText("Monthly service spend")).toBeInTheDocument();
    expect(screen.queryByText("Monthly contract cost")).not.toBeInTheDocument();

    // Verify Status card renders "Invoice status" skeleton (NOT "Contract status")
    expect(screen.getByText("Invoice status")).toBeInTheDocument();
    expect(screen.queryByText("Contract status")).not.toBeInTheDocument();

    // Verify Table renders "Recent invoices" skeleton (NOT "Upcoming renewals & expiries")
    expect(screen.getByText("Recent invoices")).toBeInTheDocument();
    expect(screen.queryByText("Upcoming renewals & expiries")).not.toBeInTheDocument();

    // Verify renewals strip is NOT rendered
    expect(screen.queryByText("Upcoming renewals")).not.toBeInTheDocument();
    expect(screen.queryByText("Overdue renewals")).not.toBeInTheDocument();
  });
});

