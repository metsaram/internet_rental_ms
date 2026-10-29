import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContractsView } from "@/components/views/contracts";

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

describe("ContractsView Prerequisite Warning & Loading States", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    mockApi.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("does not show prerequisite message while services are loading", () => {
    // Return a never-resolving promise to simulate ongoing loading state
    mockApi.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/services")) {
        return new Promise(() => {});
      }
      if (typeof url === "string" && url.includes("/api/contracts")) {
        return new Promise(() => {});
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ContractsView />
      </QueryClientProvider>
    );

    // Prerequisite message must NOT be displayed while loading data
    expect(
      screen.queryByText(/You need at least one Internet service before you can create a contract/i)
    ).not.toBeInTheDocument();

    // New contract button must be disabled while loading
    const newContractBtn = screen.getByRole("button", { name: /new contract/i });
    expect(newContractBtn).toBeDisabled();
  });

  it("displays prerequisite message when services have loaded and count is 0", async () => {
    mockApi.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/services")) {
        return Promise.resolve([]);
      }
      if (typeof url === "string" && url.includes("/api/contracts")) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ContractsView />
      </QueryClientProvider>
    );

    // After resolution of 0 services, the message should appear
    expect(
      await screen.findByText(/You need at least one Internet service before you can create a contract/i)
    ).toBeInTheDocument();

    // New contract button must remain disabled
    const newContractBtn = screen.getByRole("button", { name: /new contract/i });
    expect(newContractBtn).toBeDisabled();
  });

  it("does not display prerequisite message and enables button when services exist", async () => {
    mockApi.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/services")) {
        return Promise.resolve([
          {
            id: "svc-1",
            serviceCode: "SVC-001",
            branch: { name: "Branch A" },
            provider: { name: "Provider A" },
          },
        ]);
      }
      if (typeof url === "string" && url.includes("/api/contracts")) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ContractsView />
      </QueryClientProvider>
    );

    // Wait for queries to resolve and the button to be enabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new contract/i })).not.toBeDisabled();
    });

    // Prerequisite message must NOT be displayed
    expect(
      screen.queryByText(/You need at least one Internet service before you can create a contract/i)
    ).not.toBeInTheDocument();
  });
});
