import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServicesView } from "@/components/views/services";
import { ProvidersView } from "@/components/views/providers";
import { PlansView } from "@/components/views/plans";
import { InvoicesView } from "@/components/views/invoices";
import { ShopsView } from "@/components/views/shops";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "usr-1",
        name: "Test Admin",
        role: "ADMIN",
        companyCurrency: "USD",
      },
    },
    status: "authenticated",
  }),
}));

const mockServices = [
  {
    id: "srv-1",
    serviceCode: "SRV-001",
    branch: { id: "b1", name: "HQ", code: "BR-01" },
    shop: null,
    provider: { id: "p1", name: "ISP Alpha", code: "ISP-A" },
    plan: { id: "pl1", name: "Fiber 100", speedMbps: 100 },
    ipAddress: "192.168.1.1",
    ipType: "STATIC",
    hasCredentials: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    contractsCount: 1,
  },
  {
    id: "srv-2",
    serviceCode: "SRV-002",
    branch: { id: "b2", name: "North", code: "BR-02" },
    shop: null,
    provider: { id: "p1", name: "ISP Alpha", code: "ISP-A" },
    plan: { id: "pl2", name: "Fiber 500", speedMbps: 500 },
    ipAddress: "192.168.1.2",
    ipType: "DYNAMIC",
    hasCredentials: false,
    installedAt: "2026-02-01T00:00:00.000Z",
    status: "ACTIVE",
    contractsCount: 0,
  },
];

const mockProviders = [
  {
    id: "prv-1",
    code: "ISP-A",
    name: "Alpha Net",
    contactPerson: "John Doe",
    phone: "555-1111",
    email: "john@alphanet.com",
    status: "ACTIVE",
    plansCount: 5,
    servicesCount: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "prv-2",
    code: "ISP-B",
    name: "Beta Fiber",
    contactPerson: "Jane Smith",
    phone: "555-2222",
    email: "jane@betafiber.com",
    status: "ACTIVE",
    plansCount: 2,
    servicesCount: 4,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

const mockPlans = [
  {
    id: "pln-1",
    code: "PLN-100",
    name: "100Mbps Fiber",
    providerId: "prv-1",
    provider: { id: "prv-1", name: "Alpha Net", code: "ISP-A" },
    downloadSpeed: 100,
    uploadSpeed: 50,
    connectionType: "FIBER",
    monthlyCost: "50",
    currency: "USD",
    status: "ACTIVE",
    servicesCount: 2,
  },
  {
    id: "pln-2",
    code: "PLN-500",
    name: "500Mbps Fiber",
    providerId: "prv-1",
    provider: { id: "prv-1", name: "Alpha Net", code: "ISP-A" },
    downloadSpeed: 500,
    uploadSpeed: 100,
    connectionType: "FIBER",
    monthlyCost: "120",
    currency: "USD",
    status: "ACTIVE",
    servicesCount: 0,
  },
];

const mockInvoices = [
  {
    id: "inv-1",
    invoiceNumber: "INV-2026-001",
    providerId: "prv-1",
    provider: { id: "prv-1", name: "Alpha Net", code: "ISP-A" },
    service: { id: "srv-1", serviceCode: "SRV-001" },
    branch: { id: "b1", name: "Downtown HQ", code: "BR-01" },
    shop: null,
    issueDate: "2026-10-01",
    dueDate: "2026-10-25",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    subtotal: "100.00",
    taxAmount: "10.00",
    totalAmount: "110.00",
    paidAmount: "0.00",
    outstanding: "110.00",
    currency: "USD",
    status: "ISSUED",
    paymentAllocations: [],
  },
];

const mockShops = [
  {
    id: "shp-1",
    code: "SHP-001",
    name: "Bakery Central",
    type: "KIOSK",
    branchId: "b1",
    branch: { id: "b1", name: "Downtown HQ", code: "BR-01" },
    contactPerson: "Sarah Baker",
    phone: "555-3333",
    email: "sarah@bakery.com",
    address: "Food Court, Stall 4",
    status: "ACTIVE",
    servicesCount: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "shp-2",
    code: "SHP-002",
    name: "Fashion Hub",
    type: "OFFICE",
    branchId: "b1",
    branch: { id: "b1", name: "Downtown HQ", code: "BR-01" },
    contactPerson: "David Miller",
    phone: "555-4444",
    email: "david@fashionhub.com",
    address: "Level 2, Suite 210",
    status: "ACTIVE",
    servicesCount: 0,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

vi.mock("@/lib/api-client", () => ({
  api: vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/services")) return Promise.resolve(mockServices);
    if (url.includes("/api/providers")) return Promise.resolve(mockProviders);
    if (url.includes("/api/plans")) return Promise.resolve(mockPlans);
    if (url.includes("/api/invoices")) return Promise.resolve(mockInvoices);
    if (url.includes("/api/shops")) return Promise.resolve(mockShops);
    if (url.includes("/api/branches")) return Promise.resolve([{ id: "b1", name: "Downtown HQ", code: "BR-01" }]);
    if (url.includes("/api/company")) return Promise.resolve({ useContract: true, currency: "USD" });
    if (url.includes("/api/contracts")) return Promise.resolve([]);
    return Promise.resolve([]);
  }),
}));

describe("Row number application across entity views", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it("renders row number column (#) in ServicesView with sequential numbers", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ServicesView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("SRV-001")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();

    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows.length).toBe(2);
    expect(tableRows[0].querySelector("td:first-child")).toHaveTextContent("1");
    expect(tableRows[1].querySelector("td:first-child")).toHaveTextContent("2");
  });

  it("renders row number column (#) in ProvidersView with sequential numbers", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ProvidersView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Alpha Net")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();

    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows.length).toBe(2);
    expect(tableRows[0].querySelector("td:first-child")).toHaveTextContent("1");
    expect(tableRows[1].querySelector("td:first-child")).toHaveTextContent("2");
  });

  it("renders row number column (#) in PlansView with sequential numbers", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <PlansView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("100Mbps Fiber")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();

    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows.length).toBe(2);
    expect(tableRows[0].querySelector("td:first-child")).toHaveTextContent("1");
    expect(tableRows[1].querySelector("td:first-child")).toHaveTextContent("2");
  });

  it("renders row number column (#) in InvoicesView with sequential numbers", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <InvoicesView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();

    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows.length).toBe(1);
    expect(tableRows[0].querySelector("td:first-child")).toHaveTextContent("1");
  });

  it("renders row number column (#) in ShopsView with sequential numbers", async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ShopsView />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Bakery Central")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();

    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows.length).toBe(2);
    expect(tableRows[0].querySelector("td:first-child")).toHaveTextContent("1");
    expect(tableRows[1].querySelector("td:first-child")).toHaveTextContent("2");
  });
});
