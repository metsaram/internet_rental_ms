"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Download,
  Building2,
  Clock,
  Network,
  History,
  Wallet,
  Receipt,
  CreditCard,
  Scale,
  LayoutDashboard,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  RotateCcw,
  // Gauge,
  // Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { compareSortValues } from "@/components/shared/data-table";
import { formatMoney, formatDate, formatDateTime /*, formatBandwidth */ } from "@/lib/format";
import { cn } from "@/lib/utils";

type Dash = {
  costByBranch: Array<{ branch: string; code: string; count: number; expectedMonthly: string }>;
  costByProvider: Array<{ provider: string; code: string; count: number; expectedMonthly: string }>;
  costByCurrency: Array<{ currency: string; expectedMonthly: string; effectiveMonthly: string }>;
  counts: { contracts: number; activeContracts: number; expiringSoon: number; expired: number; invoices: number; overdueInvoices: number };
  billing: { invoicedTotal: string; collectedTotal: string; outstandingTotal: string; overdueCount: number };
};

type Contract = {
  id: string;
  contractNumber: string;
  serviceCode: string;
  branch: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
  plan: { name: string } | null;
  startDate: string;
  endDate: string;
  durationMonths: number;
  freeMonths: number;
  monthlyFee: string;
  currency: string;
  status: string;
  derivedStatus: string;
  effectiveMonthly: string;
};

type Service = {
  id: string;
  serviceCode: string;
  branch: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
  plan: { name: string } | null;
  ipType: string;
  status: string;
  hasCredentials: boolean;
};

type Audit = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  contractNumber: string;
  branch: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
  invoiceDate: string;
  dueDate: string | null;
  total: string;
  outstanding: string;
  currency: string;
  status: string;
  derivedStatus: string;
};

type Payment = {
  id: string;
  paymentDate: string;
  amount: string;
  currency: string;
  method: string;
  reference: string | null;
  status: string;
  unallocated: string;
  allocations: Array<{ invoiceId: string; invoiceNumber: string; amount: string }>;
};

type VarianceRow = {
  id: string;
  contractNumber: string;
  serviceCode: string;
  branch: string;
  provider: string;
  status: string;
  currency: string;
  scheduledTotal: string;
  invoicedTotal: string;
  collectedTotal: string;
  outstanding: string;
  variance: string;
  invoiceCount: number;
};

type VarianceReport = {
  rows: VarianceRow[];
  summary: {
    currency: string;
    scheduledTotal: string;
    invoicedTotal: string;
    collectedTotal: string;
    outstanding: string;
    variance: string;
    contractCount: number;
  };
};

/*
type CostPerMbpsRow = {
  id: string;
  serviceCode: string;
  branch: string;
  shop: string;
  provider: { name: string; code: string } | null;
  plan: string;
  bandwidthDown: number;
  bandwidthUp: number;
  connectionType: string;
  monthlyFee: number;
  currency: string;
  costPerMbps: number;
  hasContract: boolean;
};

type CostPerMbpsReport = {
  rows: CostPerMbpsRow[];
  summary: {
    currency: string;
    totalServices: number;
    excludedNoPlan: number;
    byProvider: Array<{
      provider: string;
      code: string;
      count: number;
      avgCostPerMbps: number;
      totalBandwidth: number;
      totalCost: number;
      currency: string;
    }>;
  };
};

type RedundancyRow = {
  key: string;
  shop: { name: string; code: string } | null;
  branch: { name: string; code: string };
  totalCircuits: number;
  activeCircuits: number;
  classification: "REDUNDANT" | "SINGLE" | "NONE" | "UNKNOWN";
  hasPrimary: boolean;
  hasBackup: boolean;
  providerDiversity: number;
  sameProviderCircuits: boolean;
  circuits: Array<{
    id: string;
    serviceCode: string;
    provider: { name: string; code: string } | null;
    plan: string;
    bandwidth: number | null;
    status: string;
    circuitRole: string;
  }>;
};

type RedundancyReport = {
  rows: RedundancyRow[];
  summary: { total: number; redundant: number; single: number; none: number; sameProviderRisk: number };
};

type AvailabilityRow = {
  id: string;
  serviceCode: string;
  branch: string;
  shop: string;
  provider: string;
  status: string;
  circuitRole: string;
  avgAvailability: number;
  totalDowntimeMinutes: number;
  monthly: Array<{ label: string; downtimeMinutes: number; availability: number }>;
};

type AvailabilityReport = {
  months: string[];
  rows: AvailabilityRow[];
};
*/

export function ReportsView() {
  const { data: session } = useSession();
  const currency = (session?.user as any)?.companyCurrency ?? "USD";
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const { data: dash, isLoading: dashLoading } = useQuery<Dash>({
    queryKey: ["dashboard"],
    queryFn: () => api<Dash>("/api/dashboard"),
  });
  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["contracts", "", "ALL"],
    queryFn: () => api<Contract[]>("/api/contracts"),
  });
  /*
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services-all"],
    queryFn: () => api<Service[]>("/api/services"),
  });
  */
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices", "", "ALL"],
    queryFn: () => api<Invoice[]>("/api/invoices"),
  });
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments-all"],
    queryFn: () => api<Payment[]>("/api/payments"),
  });
  const { data: variance, isLoading: varianceLoading } = useQuery<VarianceReport>({
    queryKey: ["variance"],
    queryFn: () => api<VarianceReport>("/api/reports/variance"),
  });
  /*
  const { data: costPerMbps } = useQuery<CostPerMbpsReport>({
    queryKey: ["cost-per-mbps"],
    queryFn: () => api<CostPerMbpsReport>("/api/reports/cost-per-mbps"),
  });
  const { data: redundancy } = useQuery<RedundancyReport>({
    queryKey: ["redundancy"],
    queryFn: () => api<RedundancyReport>("/api/reports/redundancy"),
  });
  const { data: availability } = useQuery<AvailabilityReport>({
    queryKey: ["availability"],
    queryFn: () => api<AvailabilityReport>("/api/reports/availability?months=3"),
  });
  */
  const { data: audit = [] } = useQuery<Audit[]>({
    queryKey: ["audit"],
    queryFn: () => api<Audit[]>("/api/audit"),
    enabled: isAdmin,
  });

  // Contract expiration report: soonest-ending active/expiring first.
  const expiring = [...contracts]
    .filter((c) => c.derivedStatus === "active" || c.derivedStatus === "expiring")
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  /*
  // Bandwidth inventory: group by provider, sum counts + avg max down.
  const byProvider = React.useMemo(() => {
    const map = new Map<string, { provider: string; code: string; count: number }>();
    for (const s of services) {
      const key = s.provider?.code ?? "?";
      const e = map.get(key) ?? { provider: s.provider?.name ?? "Unknown", code: key, count: 0 };
      e.count += 1;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [services]);
  */

  const cost = dash?.costByCurrency?.[0] ?? { currency, expectedMonthly: "0", effectiveMonthly: "0" };

  type ReportType =
    | "all"
    | "contracts"
    | "invoices"
    | "payments"
    | "variance"
    | "audit";

  const [reportType, setReportType] = React.useState<ReportType>("all");

  const outstandingInvoices = React.useMemo(
    () => invoices.filter((i) => i.status !== "VOID" && Number(i.outstanding) > 0),
    [invoices]
  );

  const completedPayments = React.useMemo(
    () => payments.filter((p) => p.status === "COMPLETED"),
    [payments]
  );

  const download = (entity: string) => {
    const url = `/api/export?entity=${entity}`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Reconciled management reports. Totals are computed server-side from your scoped data."
      />

      {/* Button tap to filter report type */}
      <Tabs
        value={reportType}
        onValueChange={(v) => setReportType(v as ReportType)}
        className="w-full"
      >
        <div className="flex items-center overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="h-auto flex-wrap gap-1.5 p-1.5 bg-muted/60 rounded-xl border border-border/80">
            <TabsTrigger
              value="all"
              className="gap-2 px-3 py-1.5 text-xs sm:text-sm rounded-lg"
            >
              <LayoutDashboard className="size-4 text-primary" />
              <span>All Reports</span>
            </TabsTrigger>
            <TabsTrigger
              value="contracts"
              className="gap-2 px-3 py-1.5 text-xs sm:text-sm rounded-lg"
            >
              <Clock className="size-4 text-amber-500" />
              <span>Contract expiration report</span>
              {expiring.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1.5 py-0 font-medium"
                >
                  {expiring.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="gap-2 px-3 py-1.5 text-xs sm:text-sm rounded-lg"
            >
              <Receipt className="size-4 text-rose-500" />
              <span>Outstanding invoices</span>
              {outstandingInvoices.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1.5 py-0 font-medium text-rose-600 dark:text-rose-400"
                >
                  {outstandingInvoices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="gap-2 px-3 py-1.5 text-xs sm:text-sm rounded-lg"
            >
              <CreditCard className="size-4 text-emerald-500" />
              <span>Recent payments</span>
              {completedPayments.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1.5 py-0 font-medium text-emerald-600 dark:text-emerald-400"
                >
                  {completedPayments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="variance"
              className="gap-2 px-3 py-1.5 text-xs sm:text-sm rounded-lg"
            >
              <Scale className="size-4 text-primary" />
              <span>Cost variance</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="audit"
                className="gap-2 px-3 py-1.5 text-xs sm:text-sm rounded-lg"
              >
                <History className="size-4 text-muted-foreground" />
                <span>Audit log</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>
      </Tabs>

      {/* Cost summary & Breakdown by branch/provider (shown in All Reports overview) */}
      {reportType === "all" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4 text-primary" />
                Expected vs effective monthly cost
              </CardTitle>
              <CardDescription className="text-xs">
                Aggregated from active contracts. Currency: {cost.currency}. Never
                sums across currencies without conversion data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Expected monthly" value={formatMoney(cost.expectedMonthly, cost.currency)} />
                <Stat label="Effective monthly" value={formatMoney(cost.effectiveMonthly, cost.currency)} />
                <Stat label="Active contracts" value={String(dash?.counts.activeContracts ?? "—")} />
                <Stat label="Total contracts" value={String(dash?.counts.contracts ?? "—")} />
              </div>
              {/* Billing strip */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                <Stat label="Total invoiced" value={formatMoney(dash?.billing?.invoicedTotal, cost.currency)} />
                <Stat label="Collected" value={formatMoney(dash?.billing?.collectedTotal, cost.currency)} />
                <Stat label="Outstanding" value={formatMoney(dash?.billing?.outstandingTotal, cost.currency)} />
                <Stat label="Overdue invoices" value={String(dash?.billing?.overdueCount ?? 0)} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Cost by branch */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4 text-primary" />
                  Internet cost by branch
                </CardTitle>
                <CardDescription className="text-xs">
                  Expected monthly fee, active contracts only
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  loading={dashLoading}
                  headers={["Branch", "Code", "Contracts", "Expected/mo"]}
                  rows={(dash?.costByBranch ?? []).map((b) => [
                    b.branch,
                    b.code,
                    String(b.count),
                    formatMoney(b.expectedMonthly, cost.currency),
                  ])}
                  empty="No active contracts"
                />
              </CardContent>
            </Card>

            {/* Cost by provider */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="size-4 text-primary" />
                  Internet cost by provider
                </CardTitle>
                <CardDescription className="text-xs">
                  Expected monthly fee, active contracts only
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ReportTable
                  loading={dashLoading}
                  headers={["Provider", "Code", "Contracts", "Expected/mo"]}
                  rows={(dash?.costByProvider ?? []).map((p) => [
                    p.provider,
                    p.code,
                    String(p.count),
                    formatMoney(p.expectedMonthly, cost.currency),
                  ])}
                  empty="No active contracts"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Contract expiration */}
      {(reportType === "all" || reportType === "contracts") && (
        <Card>
          <CardHeader className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-amber-500" />
                Contract expiration report
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => download("contracts")}>
                <Download className="size-4" /> Export
              </Button>
            </div>
            <CardDescription className="text-xs">
              Active contracts ending soonest — plan renewals
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ReportTable
              headers={["Contract", "Branch", "Provider", "End", "Monthly", "Status"]}
              defaultSort={{ columnIndex: 3, direction: "asc" }}
              rows={expiring.map((c) => [
                c.contractNumber,
                c.branch?.name ?? "—",
                c.provider?.name ?? "—",
                formatDate(c.endDate),
                formatMoney(c.monthlyFee, c.currency),
                <StatusBadge key={c.id} status={c.derivedStatus.toUpperCase()} tone={c.derivedStatus === "expiring" ? "amber" : "green"} />,
              ])}
              empty="No active contracts"
            />
          </CardContent>
        </Card>
      )}

      {/* Service / bandwidth inventory
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="size-4 text-primary" />
            Service &amp; bandwidth inventory by provider
          </CardTitle>
          <CardDescription className="text-xs">
            Counts of installed services per provider
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ReportTable
            headers={["Provider", "Code", "Services"]}
            rows={byProvider.map((p) => [p.provider, p.code, String(p.count)])}
            empty="No services"
          />
          <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
            Bandwidth is normalised to Mbps in the catalog; totals shown per
            provider above. See the Plans view for per-plan bandwidth.
          </div>
        </CardContent>
      </Card>
      */}

      {/* Outstanding invoices (Phase 12) */}
      {(reportType === "all" || reportType === "invoices") && (
        <Card>
          <CardHeader className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4 text-rose-500" />
                Outstanding invoices
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => download("invoices")}>
                <Download className="size-4" /> Export
              </Button>
            </div>
            <CardDescription className="text-xs">
              Non-void invoices with a positive outstanding balance
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ReportTable
              headers={["Invoice", "Branch", "Due", "Total", "Outstanding", "Status"]}
              defaultSort={{ columnIndex: 4, direction: "desc" }}
              rows={outstandingInvoices
                .map((i) => [
                  i.invoiceNumber,
                  i.branch?.name ?? "—",
                  formatDate(i.dueDate),
                  formatMoney(i.total, i.currency),
                  <span key={i.id} className="font-medium text-rose-600">
                    {formatMoney(i.outstanding, i.currency)}
                  </span>,
                  <StatusBadge
                    key={i.id + "st"}
                    status={i.derivedStatus.toUpperCase()}
                    tone={i.derivedStatus === "overdue" ? "red" : i.derivedStatus === "partial" ? "amber" : "blue"}
                  />,
                ])}
              empty="No outstanding invoices"
            />
          </CardContent>
        </Card>
      )}

      {/* Payment summary (Phase 12) */}
      {(reportType === "all" || reportType === "payments") && (
        <Card>
          <CardHeader className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="size-4 text-emerald-500" />
                Recent payments
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => download("payments")}>
                <Download className="size-4" /> Export
              </Button>
            </div>
            <CardDescription className="text-xs">
              Completed payments with their allocations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ReportTable
              headers={["Date", "Amount", "Method", "Reference", "Allocated to", "Status"]}
              defaultSort={{ columnIndex: 0, direction: "desc" }}
              rows={completedPayments.map((p) => [
                formatDate(p.paymentDate),
                formatMoney(p.amount, p.currency),
                <Badge key={p.id} variant="outline" className="text-[10px]">{p.method}</Badge>,
                p.reference ?? "—",
                p.allocations.map((a) => a.invoiceNumber).join(", ") || <span className="text-muted-foreground">—</span>,
                <StatusBadge key={p.id + "st"} status={p.status} tone="green" />,
              ])}
              empty="No payments yet"
            />
          </CardContent>
        </Card>
      )}

      {/* Cost variance report (scheduled vs invoiced vs paid) */}
      {(reportType === "all" || reportType === "variance") && (
        <Card>
          <CardHeader className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="size-4 text-primary" />
                Cost variance — scheduled vs invoiced vs paid
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => download("contracts")}>
                <Download className="size-4" /> Export
              </Button>
            </div>
            <CardDescription className="text-xs">
              Per-contract: scheduled total (monthly fee × paid months) vs invoiced vs collected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Summary strip */}
            {variance && (
              <div className="grid grid-cols-2 gap-3 border-b pb-3 sm:grid-cols-5">
                <Stat label="Scheduled" value={formatMoney(variance.summary.scheduledTotal, variance.summary.currency)} />
                <Stat label="Invoiced" value={formatMoney(variance.summary.invoicedTotal, variance.summary.currency)} />
                <Stat label="Collected" value={formatMoney(variance.summary.collectedTotal, variance.summary.currency)} />
                <Stat label="Outstanding" value={formatMoney(variance.summary.outstanding, variance.summary.currency)} />
                <Stat
                  label="Variance"
                  value={formatMoney(variance.summary.variance, variance.summary.currency)}
                  tone={Number(variance.summary.variance) !== 0 ? "text-amber-600" : "text-muted-foreground"}
                />
              </div>
            )}
            <ReportTable
              loading={varianceLoading}
              headers={["Contract", "Branch", "Scheduled", "Invoiced", "Collected", "Outstanding", "Variance"]}
              defaultSort={{ columnIndex: 0, direction: "asc" }}
              rows={(variance?.rows ?? [])
                .filter((r) => Number(r.invoicedTotal) > 0 || Number(r.scheduledTotal) > 0)
                .map((r) => [
                  r.contractNumber,
                  r.branch,
                  <span key="s" className="tabular-nums">{formatMoney(r.scheduledTotal, r.currency)}</span>,
                  <span key="i" className="tabular-nums">{formatMoney(r.invoicedTotal, r.currency)}</span>,
                  <span key="c" className="tabular-nums text-emerald-600">{formatMoney(r.collectedTotal, r.currency)}</span>,
                  <span key="o" className="tabular-nums text-rose-600">{formatMoney(r.outstanding, r.currency)}</span>,
                  <span
                    key="v"
                    className={cn(
                      "tabular-nums font-medium",
                      Number(r.variance) > 0 ? "text-amber-600" : Number(r.variance) < 0 ? "text-cyan-600" : "text-muted-foreground"
                    )}
                  >
                    {Number(r.variance) > 0 ? "+" : ""}{formatMoney(r.variance, r.currency)}
                  </span>,
                ])}
              empty="No contracts with invoiced data"
            />
          </CardContent>
        </Card>
      )}

      {/* Cost per Mbps (Phase 7)
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4 text-primary" />
            Cost per Mbps
          </CardTitle>
          <CardDescription className="text-xs">
            Monthly recurring cost ÷ download bandwidth — a procurement comparison signal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {costPerMbps && costPerMbps.summary.byProvider.length > 0 && (
            <div className="grid grid-cols-2 gap-3 border-b pb-3 sm:grid-cols-4">
              {costPerMbps.summary.byProvider.slice(0, 4).map((p) => (
                <Stat key={p.code} label={p.provider} value={formatMoney(p.avgCostPerMbps, p.currency) + "/Mbps"} tone={p.avgCostPerMbps > 5 ? "text-amber-600" : "text-emerald-600"} />
              ))}
            </div>
          )}
          <ReportTable
            headers={["Service", "Provider", "Plan", "↓ Mbps", "Monthly", "Cost/Mbps"]}
            rows={(costPerMbps?.rows ?? []).map((r) => [
              r.serviceCode,
              r.provider?.name ?? "—",
              r.plan,
              String(r.bandwidthDown),
              formatMoney(r.monthlyFee, r.currency),
              <span key="cpm" className={cn("font-medium tabular-nums", r.costPerMbps > 5 ? "text-amber-600" : "text-emerald-600")}>
                {formatMoney(r.costPerMbps, r.currency)}
              </span>,
            ])}
            empty="No services with plan data"
          />
        </CardContent>
      </Card>
      */}

      {/* Connectivity redundancy (Phase 5)
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="size-4 text-primary" />
            Connectivity redundancy matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Per-shop circuit classification — flags single-circuit risk and same-provider circuits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {redundancy && (
            <div className="grid grid-cols-4 gap-3 border-b pb-3">
              <Stat label="Redundant" value={String(redundancy.summary.redundant)} tone="text-emerald-600" />
              <Stat label="Single circuit" value={String(redundancy.summary.single)} tone="text-amber-600" />
              <Stat label="No active" value={String(redundancy.summary.none)} tone="text-rose-600" />
              <Stat label="Same-provider risk" value={String(redundancy.summary.sameProviderRisk)} tone="text-amber-600" />
            </div>
          )}
          <ReportTable
            headers={["Shop / Branch", "Active", "Classification", "Providers", "Circuits"]}
            rows={(redundancy?.rows ?? []).map((r) => [
              r.shop?.name ?? r.branch.name,
              String(r.activeCircuits),
              <span key="cls" className={cn(
                "font-medium",
                r.classification === "REDUNDANT" ? "text-emerald-600" :
                r.classification === "SINGLE" ? "text-amber-600" : "text-rose-600"
              )}>
                {r.classification}
              </span>,
              String(r.providerDiversity),
              r.circuits.map((c) => `${c.serviceCode}(${c.circuitRole.toLowerCase()})`).join(", "),
            ])}
            empty="No services found"
          />
        </CardContent>
      </Card>
      */}

      {/* Availability / SLA (Phase 6)
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-primary" />
            Monthly availability & SLA
          </CardTitle>
          <CardDescription className="text-xs">
            Availability % = (1 − downtime / service minutes) × 100 — last 3 months. Estimates only; credit eligibility requires contract terms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {availability && availability.rows.length > 0 && (
            <ReportTable
              headers={["Service", "Provider", ...availability.months, "Avg %", "Downtime"]}
              rows={availability.rows.map((r) => [
                r.serviceCode,
                r.provider,
                ...r.monthly.map((m) => (
                  <span key={m.label} className={cn(
                    "tabular-nums",
                    m.availability >= 99.5 ? "text-emerald-600" :
                    m.availability >= 99.0 ? "text-amber-600" : "text-rose-600"
                  )}>
                    {m.availability.toFixed(2)}%
                  </span>
                )),
                <span key="avg" className={cn(
                  "font-bold tabular-nums",
                  r.avgAvailability >= 99.5 ? "text-emerald-600" :
                  r.avgAvailability >= 99.0 ? "text-amber-600" : "text-rose-600"
                )}>
                  {r.avgAvailability.toFixed(2)}%
                </span>,
                `${r.totalDowntimeMinutes}m`,
              ])}
              empty="No availability data"
            />
          )}
        </CardContent>
      </Card>
      */}

      {/* Audit log (admin) */}
      {isAdmin && (reportType === "all" || reportType === "audit") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-primary" />
              Audit log
            </CardTitle>
            <CardDescription className="text-xs">
              Recent 100 security-relevant changes. Sensitive values are
              redacted. Logs cannot be edited or deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <ReportTable
                headers={["Time", "Actor", "Action", "Entity", "ID"]}
                defaultSort={{ columnIndex: 0, direction: "desc" }}
                rows={audit.map((a) => [
                  formatDateTime(a.createdAt),
                  a.actor,
                  <Badge key={a.id} variant="outline" className="text-[10px]">
                    {a.action}
                  </Badge>,
                  a.entityType,
                  a.entityId?.slice(-8) ?? "—",
                ])}
                empty="No audit entries yet"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone ?? "")}>{value}</p>
    </div>
  );
}

export interface ReportTableSort {
  columnIndex: number;
  direction: "asc" | "desc";
}

export interface ColumnConfig {
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
}

export interface ReportTableProps {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
  empty: string;
  loading?: boolean;
  defaultSort?: ReportTableSort;
  sortable?: boolean;
  resizable?: boolean;
  striped?: boolean;
  density?: "compact" | "normal" | "comfortable";
  bordered?: boolean;
  truncate?: boolean;
  columnChooser?: boolean;
  storageKey?: string;
  persistColumnVisibility?: boolean;
  persistColumnWidths?: boolean;
  onRowClick?: (row: React.ReactNode[], index: number) => void;
  rowClassName?: (row: React.ReactNode[], index: number) => string | undefined;
  className?: string;
  columnConfigs?: ColumnConfig[];
  widths?: (number | string | undefined)[] | Record<number, number | string>;
  minWidths?: (number | undefined)[] | Record<number, number>;
  maxWidths?: (number | undefined)[] | Record<number, number>;
  defaultMinWidth?: number;
  defaultMaxWidth?: number;
}

export function extractNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join(" ");
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    if (props.status) return String(props.status);
    if (props.label) return String(props.label);
    if (props.children) return extractNodeText(props.children as React.ReactNode);
  }
  return "";
}

export function extractCellSortValue(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    if (props["data-sort-value"] !== undefined && props["data-sort-value"] !== null) {
      return String(props["data-sort-value"]);
    }
  }
  return extractNodeText(node);
}

export function ReportTable({
  headers,
  rows,
  empty,
  loading,
  defaultSort,
  sortable = true,
  resizable = true,
  striped = false,
  density = "normal",
  bordered = false,
  truncate = true,
  columnChooser = true,
  storageKey,
  persistColumnVisibility = true,
  persistColumnWidths = true,
  onRowClick,
  rowClassName,
  className,
  columnConfigs,
  widths,
  minWidths,
  maxWidths,
  defaultMinWidth = 60,
  defaultMaxWidth = 1000,
}: ReportTableProps) {
  const [sort, setSort] = React.useState<ReportTableSort | null>(defaultSort ?? null);

  const getColConstraints = React.useCallback(
    (index: number) => {
      const cfg = columnConfigs?.[index];
      const minW =
        cfg?.minWidth ??
        (Array.isArray(minWidths) ? minWidths[index] : minWidths?.[index]) ??
        defaultMinWidth ??
        60;
      const maxW =
        cfg?.maxWidth ??
        (Array.isArray(maxWidths) ? maxWidths[index] : maxWidths?.[index]) ??
        defaultMaxWidth ??
        1000;
      const configuredWidth =
        cfg?.width ??
        (Array.isArray(widths) ? widths[index] : widths?.[index]);

      return { minWidth: minW, maxWidth: maxW, configuredWidth };
    },
    [columnConfigs, minWidths, maxWidths, defaultMinWidth, defaultMaxWidth, widths]
  );

  const [columnWidths, setColumnWidths] = React.useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    headers.forEach((_, i) => {
      const cfg = columnConfigs?.[i];
      const configuredW = cfg?.width ?? (Array.isArray(widths) ? widths[i] : widths?.[i]);
      if (typeof configuredW === "number") {
        initial[i] = configuredW;
      }
    });
    return initial;
  });

  const [resizingIndex, setResizingIndex] = React.useState<number | null>(null);
  const resizeRef = React.useRef<{
    index: number;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
  } | null>(null);

  const headerSig = React.useMemo(() => {
    return headers.map((h, i) => extractNodeText(h) || String(i)).join("_");
  }, [headers]);

  const colStorageKey = React.useMemo(() => {
    const key = storageKey?.trim() || headerSig;
    return `netrent_reptbl_cols_${key}`;
  }, [storageKey, headerSig]);

  const widthStorageKey = React.useMemo(() => {
    const key = storageKey?.trim() || headerSig;
    return `netrent_reptbl_widths_${key}`;
  }, [storageKey, headerSig]);

  const [hiddenIndices, setHiddenIndices] = React.useState<number[]>([]);

  // Hydrate hidden indices from localStorage
  React.useEffect(() => {
    if (persistColumnVisibility === false || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(colStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (idx) => typeof idx === "number" && idx >= 0 && idx < headers.length
          );
          setHiddenIndices(valid);
        }
      }
    } catch {
      // Ignore
    }
  }, [colStorageKey, persistColumnVisibility, headers.length]);

  // Hydrate column widths from localStorage
  React.useEffect(() => {
    if (persistColumnWidths === false || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(widthStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setColumnWidths((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // Ignore
    }
  }, [widthStorageKey, persistColumnWidths]);

  const visibleIndices = React.useMemo(() => {
    return headers.map((_, i) => i).filter((i) => !hiddenIndices.includes(i));
  }, [headers, hiddenIndices]);

  const toggleColumn = React.useCallback(
    (index: number) => {
      setHiddenIndices((prev) => {
        const isHidden = prev.includes(index);
        let next: number[];
        if (isHidden) {
          next = prev.filter((i) => i !== index);
        } else {
          if (headers.length - prev.length <= 1) {
            return prev;
          }
          next = [...prev, index];
        }

        if (persistColumnVisibility !== false && typeof window !== "undefined") {
          try {
            localStorage.setItem(colStorageKey, JSON.stringify(next));
          } catch {
            // Ignore
          }
        }
        return next;
      });
    },
    [headers.length, persistColumnVisibility, colStorageKey]
  );

  const showAllColumns = React.useCallback(() => {
    setHiddenIndices([]);
    if (persistColumnVisibility !== false && typeof window !== "undefined") {
      try {
        localStorage.setItem(colStorageKey, JSON.stringify([]));
      } catch {
        // Ignore
      }
    }
  }, [persistColumnVisibility, colStorageKey]);

  const resetColumns = React.useCallback(() => {
    setHiddenIndices([]);
    setColumnWidths({});
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(colStorageKey);
        localStorage.removeItem(widthStorageKey);
      } catch {
        // Ignore
      }
    }
  }, [colStorageKey, widthStorageKey]);

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { index, startX, startWidth } = resizeRef.current;
      const diff = e.clientX - startX;
      const nextWidth = Math.max(60, Math.min(1000, Math.round(startWidth + diff)));
      setColumnWidths((prev) => ({ ...prev, [index]: nextWidth }));
    };

    const onMouseUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      setResizingIndex(null);

      if (persistColumnWidths !== false && typeof window !== "undefined") {
        setColumnWidths((current) => {
          try {
            localStorage.setItem(widthStorageKey, JSON.stringify(current));
          } catch {
            // Ignore
          }
          return current;
        });
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [persistColumnWidths, widthStorageKey]);

  React.useEffect(() => {
    if (resizingIndex === null) return;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [resizingIndex]);

  const handleResizeStart = (e: React.MouseEvent, index: number, th: HTMLElement | null) => {
    e.preventDefault();
    e.stopPropagation();
    const { minWidth, maxWidth, configuredWidth } = getColConstraints(index);
    const startWidth =
      columnWidths[index] ??
      (typeof configuredWidth === "number"
        ? configuredWidth
        : th
        ? th.getBoundingClientRect().width
        : 120);

    resizeRef.current = {
      index,
      startX: e.clientX,
      startWidth,
      minWidth,
      maxWidth,
    };
    setResizingIndex(index);
  };

  const handleResizeReset = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const { configuredWidth } = getColConstraints(index);
    setColumnWidths((prev) => {
      const next = { ...prev };
      if (typeof configuredWidth === "number") {
        next[index] = configuredWidth;
      } else {
        delete next[index];
      }
      if (persistColumnWidths !== false && typeof window !== "undefined") {
        try {
          localStorage.setItem(widthStorageKey, JSON.stringify(next));
        } catch {
          // Ignore
        }
      }
      return next;
    });
  };

  const prevDefaultSortRef = React.useRef(defaultSort);
  React.useEffect(() => {
    if (defaultSort !== prevDefaultSortRef.current) {
      prevDefaultSortRef.current = defaultSort;
      setSort(defaultSort ?? null);
    }
  }, [defaultSort]);

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows;
    const { columnIndex, direction } = sort;

    return [...rows].sort((rowA, rowB) => {
      const cellA = rowA[columnIndex];
      const cellB = rowB[columnIndex];

      const valA = extractCellSortValue(cellA);
      const valB = extractCellSortValue(cellB);

      const aEmpty = valA === "";
      const bEmpty = valB === "";

      if (aEmpty && !bEmpty) return 1;
      if (bEmpty && !aEmpty) return -1;
      if (aEmpty && bEmpty) return 0;

      const cmp = compareSortValues(valA, valB);
      return direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sort]);

  const handleSort = (index: number) => {
    let nextSort: ReportTableSort | null = null;
    if (!sort || sort.columnIndex !== index) {
      nextSort = { columnIndex: index, direction: "asc" };
    } else if (sort.direction === "asc") {
      nextSort = { columnIndex: index, direction: "desc" };
    } else {
      if (defaultSort && defaultSort.columnIndex === index && defaultSort.direction === "desc") {
        nextSort = { columnIndex: index, direction: "asc" };
      } else {
        nextSort = defaultSort ? { ...defaultSort } : null;
      }
    }
    setSort(nextSort);
  };

  const getColStyle = React.useCallback(
    (index: number): React.CSSProperties => {
      const { minWidth, maxWidth, configuredWidth } = getColConstraints(index);
      const activeW = columnWidths[index] ?? configuredWidth;

      const wStr =
        activeW !== undefined
          ? typeof activeW === "number"
            ? `${activeW}px`
            : activeW
          : undefined;

      return {
        width: wStr,
        minWidth: minWidth !== undefined ? `${minWidth}px` : undefined,
        maxWidth: maxWidth !== undefined ? `${maxWidth}px` : undefined,
      };
    },
    [getColConstraints, columnWidths]
  );

  const hasCustomWidths =
    Object.keys(columnWidths).length > 0 ||
    (columnConfigs !== undefined && columnConfigs.length > 0) ||
    (widths !== undefined && (Array.isArray(widths) ? widths.length > 0 : Object.keys(widths).length > 0)) ||
    (minWidths !== undefined && (Array.isArray(minWidths) ? minWidths.length > 0 : Object.keys(minWidths).length > 0)) ||
    (maxWidths !== undefined && (Array.isArray(maxWidths) ? maxWidths.length > 0 : Object.keys(maxWidths).length > 0));

  return (
    <div className={className}>
      {columnChooser !== false && headers.length > 1 && (
        <div className="flex items-center justify-end px-3 py-1.5 border-b bg-muted/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-label="Customize visible columns"
              >
                <Columns3 className="size-3.5" />
                <span>Columns</span>
                {hiddenIndices.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                    {headers.length - hiddenIndices.length}/{headers.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                <span>Toggle columns</span>
                <span className="text-[10px] font-normal">
                  {headers.length - hiddenIndices.length} of {headers.length}
                </span>
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-60 overflow-y-auto py-0.5">
                {headers.map((h, i) => {
                  const isVisible = !hiddenIndices.includes(i);
                  const isLast = isVisible && headers.length - hiddenIndices.length <= 1;
                  const label =
                    typeof h === "string" ? h : extractNodeText(h) || `Column ${i + 1}`;

                  return (
                    <DropdownMenuCheckboxItem
                      key={i}
                      checked={isVisible}
                      onCheckedChange={() => toggleColumn(i)}
                      disabled={isLast}
                      className="text-xs"
                    >
                      <span className="truncate">{label}</span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </div>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between gap-1 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={showAllColumns}
                  disabled={hiddenIndices.length === 0}
                  className="h-7 text-[11px] font-normal px-2"
                >
                  Show all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetColumns}
                  className="h-7 text-[11px] font-normal px-2 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3 mr-1" />
                  Reset
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={cn("w-full text-sm", hasCustomWidths && "table-fixed")}>
          <colgroup>
            {visibleIndices.map((i) => (
              <col key={i} style={getColStyle(i)} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              {visibleIndices.map((i) => {
                const h = headers[i];
                const canSort = sortable !== false;
                const isSorted = sort?.columnIndex === i;
                const isAsc = sort?.direction === "asc";
                const colWidth = columnWidths[i];
                const isResizingThis = resizingIndex === i;

              return (
                <th
                  key={i}
                  style={{ width: colWidth ? `${colWidth}px` : undefined }}
                  aria-sort={
                    isSorted
                      ? isAsc
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    "relative font-semibold",
                    density === "compact"
                      ? "px-2.5 py-1.5 text-[10px]"
                      : density === "comfortable"
                      ? "px-4 py-3 text-xs"
                      : "px-4 py-2",
                    canSort &&
                      "group cursor-pointer select-none hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    bordered && "border-r border-border/40 last:border-r-0"
                  )}
                  onClick={canSort ? () => handleSort(i) : undefined}
                  onKeyDown={
                    canSort
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSort(i);
                          }
                        }
                      : undefined
                  }
                  tabIndex={canSort ? 0 : undefined}
                  role={canSort ? "columnheader button" : "columnheader"}
                >
                  <div className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                    <span
                      className="truncate min-w-0"
                      title={typeof h === "string" ? h : undefined}
                    >
                      {h}
                    </span>
                    {canSort && (
                      <span className="inline-flex shrink-0">
                        {isSorted ? (
                          isAsc ? (
                            <ArrowUp
                              className="size-3 text-primary"
                              aria-label="Sorted ascending"
                            />
                          ) : (
                            <ArrowDown
                              className="size-3 text-primary"
                              aria-label="Sorted descending"
                            />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                        )}
                      </span>
                    )}
                  </div>

                  {resizable && (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize column"
                      className={cn(
                        "absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none touch-none z-10",
                        "flex items-center justify-center",
                        "group/resizer hover:after:bg-primary after:transition-colors",
                        "after:h-4 after:w-[2px] after:rounded-full after:bg-border/60",
                        isResizingThis && "after:bg-primary after:h-full after:w-[2px] bg-primary/10"
                      )}
                      onMouseDown={(e) => {
                        const th = e.currentTarget.closest("th");
                        handleResizeStart(e, i, th);
                      }}
                      onDoubleClick={(e) => handleResizeReset(e, i)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b last:border-0">
                {visibleIndices.map((j) => (
                  <td
                    key={j}
                    style={getColStyle(j)}
                    className={cn(
                      density === "compact" ? "px-2.5 py-1.5" : density === "comfortable" ? "px-4 py-3" : "px-4 py-2.5",
                      bordered && "border-r border-border/40 last:border-r-0"
                    )}
                  >
                    <Skeleton className="h-4 w-full max-w-[10rem]" />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={visibleIndices.length}
                className="h-20 text-center text-sm text-muted-foreground"
              >
                {empty}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                className={cn(
                  "border-b last:border-0 hover:bg-muted/30 transition-colors",
                  onRowClick && "cursor-pointer",
                  striped && i % 2 === 1 && "bg-muted/20 dark:bg-muted/10",
                  rowClassName?.(row, i)
                )}
              >
                {visibleIndices.map((j) => {
                  const cell = row[j];
                  const cellTooltip = truncate ? extractNodeText(cell) : undefined;
                  return (
                    <td
                      key={j}
                      className={cn(
                        "align-middle",
                        density === "compact"
                          ? "px-2.5 py-1.5 text-xs"
                          : density === "comfortable"
                          ? "px-4 py-3 text-sm"
                          : "px-4 py-2.5 text-sm",
                        bordered && "border-r border-border/40 last:border-r-0",
                        truncate && "max-w-0 overflow-hidden"
                      )}
                    >
                      {truncate ? (
                        <div
                          className="truncate max-w-full [&_div]:truncate [&_span]:truncate [&_p]:truncate [&_a]:truncate"
                          title={cellTooltip || undefined}
                        >
                          {cell}
                        </div>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
  );
}
