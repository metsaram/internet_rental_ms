import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BranchesView } from "@/components/views/branches";

const mockBranches = [
  {
    id: "br-1",
    code: "BR-001",
    name: "Downtown Central",
    address: "123 Main Street, Suite 400",
    city: "Metropolis",
    manager: "Alice Johnson",
    phone: "555-0101",
    email: "alice@example.com",
    status: "ACTIVE",
    shopsCount: 4,
    servicesCount: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "br-2",
    code: "BR-002",
    name: "Uptown North",
    address: null,
    city: "Gotham",
    manager: "Bob Smith",
    phone: "555-0202",
    email: "bob@example.com",
    status: "INACTIVE",
    shopsCount: 0,
    servicesCount: 0,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

vi.mock("@/lib/api-client", () => ({
  api: vi.fn().mockImplementation((url: string) => {
    if (url.startsWith("/api/branches")) {
      return Promise.resolve(mockBranches);
    }
    return Promise.resolve([]);
  }),
}));

describe("BranchesView - Address column & branch listing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("renders table header with Address column between Branch and City", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BranchesView />
      </QueryClientProvider>
    );

    // Wait for branch rows to load
    expect(await screen.findByText("Downtown Central")).toBeInTheDocument();

    // Verify column headers
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /branch/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /address/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /city/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /manager/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /phone/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /shops/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /services/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
  });

  it("renders branch address text and fallback dash when address is null", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BranchesView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("123 Main Street, Suite 400")).toBeInTheDocument();
    expect(screen.getByText("Downtown Central")).toBeInTheDocument();
    expect(screen.getByText("BR-001")).toBeInTheDocument();

    // For br-2 with null address, verify fallback '—' is rendered
    expect(screen.getByText("Uptown North")).toBeInTheDocument();
    expect(screen.getByText("BR-002")).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders row index as row numbers (1, 2) in the row number column", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <BranchesView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Downtown Central")).toBeInTheDocument();

    // Verify row number column in tbody displays 1 and 2
    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows.length).toBe(2);
    expect(tableRows[0].querySelector("td:first-child")).toHaveTextContent("1");
    expect(tableRows[1].querySelector("td:first-child")).toHaveTextContent("2");
  });

  it("includes Address and Row Number in the column chooser menu", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <BranchesView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Downtown Central")).toBeInTheDocument();

    // Open Column chooser
    const columnsBtn = screen.getByRole("button", { name: /customize visible columns/i });
    await user.click(columnsBtn);

    // Verify Row Number checkbox option is present
    const rowNumOption = await screen.findByRole("menuitemcheckbox", { name: /row number/i });
    expect(rowNumOption).toBeInTheDocument();
    expect(rowNumOption).toHaveAttribute("aria-checked", "true");

    // Verify Address checkbox option is present
    const addressOption = await screen.findByRole("menuitemcheckbox", { name: /address/i });
    expect(addressOption).toBeInTheDocument();
    expect(addressOption).toHaveAttribute("aria-checked", "true");
  });
});

