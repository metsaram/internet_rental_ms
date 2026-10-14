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
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { formatMoney, formatDate, formatDateTime, formatBandwidth } from "@/lib/format";

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

export function ReportsView() {
  const { data: session } = useSession();
  const currency = (session?.user as any)?.companyCurrency ?? "THB";
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const { data: dash, isLoading: dashLoading } = useQuery<Dash>({
    queryKey: ["dashboard"],
    queryFn: () => api<Dash>("/api/dashboard"),
  });
  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["contracts", "", "ALL"],
    queryFn: () => api<Contract[]>("/api/contracts"),
  });
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services-all"],
    queryFn: () => api<Service[]>("/api/services"),
  });
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices", "", "ALL"],
    queryFn: () => api<Invoice[]>("/api/invoices"),
  });
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments-all"],
    queryFn: () => api<Payment[]>("/api/payments"),
  });
  const { data: audit = [] } = useQuery<Audit[]>({
    queryKey: ["audit"],
    queryFn: () => api<Audit[]>("/api/audit"),
    enabled: isAdmin,
  });

  // Contract expiration report: soonest-ending active/expiring first.
  const expiring = [...contracts]
    .filter((c) => c.derivedStatus === "active" || c.derivedStatus === "expiring")
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

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

  const cost = dash?.costByCurrency?.[0] ?? { currency, expectedMonthly: "0", effectiveMonthly: "0" };

  const download = (entity: string) => {
    const url = `/api/export?entity=${entity}`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Reconciled management reports. Totals are computed server-side from your scoped data."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => download("branches")}>
              <Download className="size-4" /> Branches
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("shops")}>
              <Download className="size-4" /> Shops
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("services")}>
              <Download className="size-4" /> Services
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("contracts")}>
              <Download className="size-4" /> Contracts
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("invoices")}>
              <Download className="size-4" /> Invoices
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("payments")}>
              <Download className="size-4" /> Payments
            </Button>
          </div>
        }
      />

      {/* Cost summary */}
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

      {/* Contract expiration */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-amber-500" />
              Contract expiration report
            </CardTitle>
            <CardDescription className="text-xs">
              Active contracts ending soonest — plan renewals
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => download("contracts")}>
            <Download className="size-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ReportTable
            headers={["Contract", "Branch", "Provider", "End", "Monthly", "Status"]}
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

      {/* Service / bandwidth inventory */}
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

      {/* Outstanding invoices (Phase 12) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4 text-rose-500" />
              Outstanding invoices
            </CardTitle>
            <CardDescription className="text-xs">
              Non-void invoices with a positive outstanding balance
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => download("invoices")}>
            <Download className="size-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ReportTable
            headers={["Invoice", "Branch", "Due", "Total", "Outstanding", "Status"]}
            rows={invoices
              .filter((i) => i.status !== "VOID" && Number(i.outstanding) > 0)
              .sort((a, b) => Number(b.outstanding) - Number(a.outstanding))
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

      {/* Payment summary (Phase 12) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-emerald-500" />
              Recent payments
            </CardTitle>
            <CardDescription className="text-xs">
              Completed payments with their allocations
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => download("payments")}>
            <Download className="size-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ReportTable
            headers={["Date", "Amount", "Method", "Reference", "Allocated to", "Status"]}
            rows={payments
              .filter((p) => p.status === "COMPLETED")
              .map((p) => [
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

      {/* Audit log (admin) */}
      {isAdmin && (
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ReportTable({
  headers,
  rows,
  empty,
  loading,
}: {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
  empty: string;
  loading?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b last:border-0">
                {headers.map((_, j) => (
                  <td key={j} className="px-4 py-2.5">
                    <Skeleton className="h-4 w-full max-w-[10rem]" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="h-20 text-center text-sm text-muted-foreground"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
