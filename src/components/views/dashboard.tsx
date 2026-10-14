"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Store,
  Network,
  FileText,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Receipt,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney, formatNumber, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Dash = {
  counts: {
    branches: number;
    shops: number;
    services: number;
    providers: number;
    plans: number;
    contracts: number;
    activeContracts: number;
    expiringSoon: number;
    expired: number;
    upcoming: number;
    invoices: number;
    overdueInvoices: number;
  };
  billing: {
    invoicedTotal: string;
    collectedTotal: string;
    outstandingTotal: string;
    overdueCount: number;
  };
  costByCurrency: Array<{ currency: string; expectedMonthly: string; effectiveMonthly: string }>;
  costByProvider: Array<{ provider: string; code: string; count: number; expectedMonthly: string }>;
  costByBranch: Array<{ branch: string; code: string; count: number; expectedMonthly: string }>;
  renewals: Array<{
    id: string;
    contractNumber: string;
    serviceCode: string;
    branch: string;
    endDate: string;
    daysLeft: number;
    monthlyFee: string;
    currency: string;
    status: string;
  }>;
  renewalSummary: { upcoming: number; overdue: number; completed: number; total: number };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actor: string;
    createdAt: string;
  }>;
  costTrend: Array<{ label: string; value: number }>;
};

const CHART_COLORS = [
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#6366f1",
];

export function DashboardView() {
  const { data: session } = useSession();
  const currency = (session?.user as any)?.companyCurrency ?? "THB";
  const company = (session?.user as any)?.companyName ?? "Your company";

  const { data, isLoading, isError, refetch } = useQuery<Dash>({
    queryKey: ["dashboard"],
    queryFn: () => api<Dash>("/api/dashboard"),
  });

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load dashboard data"
        description="The server returned an error. Try again."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const c = data?.counts;
  const billing = data?.billing;
  const cost =
    data?.costByCurrency?.[0] ?? {
      currency,
      expectedMonthly: "0",
      effectiveMonthly: "0",
    };

  const kpis = [
    {
      label: "Branches",
      value: c?.branches,
      icon: Building2,
      tone: "text-emerald-600 bg-emerald-500/10",
      hash: "branches",
    },
    {
      label: "Shops",
      value: c?.shops,
      icon: Store,
      tone: "text-fuchsia-600 bg-fuchsia-500/10",
      hash: "shops",
    },
    {
      label: "Internet services",
      value: c?.services,
      icon: Network,
      tone: "text-cyan-600 bg-cyan-500/10",
      hash: "services",
    },
    {
      label: "Contracts",
      value: c?.contracts,
      icon: FileText,
      tone: "text-amber-600 bg-amber-500/10",
      hash: "contracts",
    },
  ];

  const statusCards = [
    {
      label: "Active",
      value: c?.activeContracts,
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20",
    },
    {
      label: "Expiring ≤30d",
      value: c?.expiringSoon,
      icon: Clock,
      tone: "text-amber-600 bg-amber-500/10 ring-amber-500/20",
    },
    {
      label: "Expired",
      value: c?.expired,
      icon: XCircle,
      tone: "text-rose-600 bg-rose-500/10 ring-rose-500/20",
    },
    {
      label: "Upcoming",
      value: c?.upcoming,
      icon: TrendingUp,
      tone: "text-slate-600 bg-slate-500/10 ring-slate-500/20",
    },
  ];

  const providerData = (data?.costByProvider ?? []).slice(0, 6).map((p, i) => ({
    name: p.code,
    value: Number(p.expectedMonthly),
    count: p.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const branchData = (data?.costByBranch ?? []).slice(0, 6).map((b, i) => ({
    name: b.code,
    value: Number(b.expectedMonthly),
    count: b.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {(session?.user as any)?.name?.split(" ")[0] ?? "team"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time overview for <span className="font-medium text-foreground">{company}</span>.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} loading={isLoading} hash={k.hash} />
        ))}
      </div>

      {/* Cost summary + status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4 text-primary" />
                Monthly contract cost
              </CardTitle>
              <CardDescription className="text-xs">
                Aggregated from active contracts · {cost.currency}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Expected vs effective
            </Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <CostStat
              label="Expected monthly"
              value={formatMoney(cost.expectedMonthly, cost.currency)}
              hint="Σ monthly fees"
              loading={isLoading}
            />
            <CostStat
              label="Effective monthly"
              value={formatMoney(cost.effectiveMonthly, cost.currency)}
              hint="incl. free months"
              loading={isLoading}
            />
            <div className="col-span-2 mt-1 rounded-lg border bg-muted/30 p-3 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Effective</span>{" "}
              normalises the contract total over its full duration (free
              months spread across the term), giving a fairer cost-per-month.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              Contract status
            </CardTitle>
            <CardDescription className="text-xs">
              Derived from dates & stored status
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {statusCards.map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ring-1 ${s.tone}`}
              >
                <s.icon className="size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight">
                    {isLoading ? "—" : s.value}
                  </p>
                  <p className="text-[11px] truncate">{s.label}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Billing summary (Phase 12) */}
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4 text-primary" />
              Billing &amp; outstanding
            </CardTitle>
            <CardDescription className="text-xs">
              Invoiced vs collected vs outstanding · {cost.currency}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.hash = "invoices"; }}
          >
            Go to invoices
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CostStat
              label="Total invoiced"
              value={formatMoney(billing?.invoicedTotal, cost.currency)}
              hint={`${c?.invoices ?? 0} invoices`}
              loading={isLoading}
            />
            <CostStat
              label="Collected"
              value={formatMoney(billing?.collectedTotal, cost.currency)}
              hint="Σ completed payments"
              loading={isLoading}
            />
            <CostStat
              label="Outstanding"
              value={formatMoney(billing?.outstandingTotal, cost.currency)}
              hint="unpaid balances"
              loading={isLoading}
            />
            <CostStat
              label="Overdue"
              value={String(billing?.overdueCount ?? 0)}
              hint="invoices past due"
              loading={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* 6-month cost trend */}
      {(data?.costTrend ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" />
              Monthly cost trend
            </CardTitle>
            <CardDescription className="text-xs">
              Σ monthly fees of contracts active in each month · last 6 months · {cost.currency}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.costTrend ?? []} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    cursor={{ stroke: "#10b981", strokeWidth: 1 }}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v: number) => [formatMoney(v, cost.currency), "Monthly cost"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#costGrad)"
                    dot={{ r: 3, fill: "#10b981" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by provider</CardTitle>
            <CardDescription className="text-xs">
              Expected monthly fee, active contracts only
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : providerData.length === 0 ? (
              <EmptyState title="No active contracts" />
            ) : (
              <Chart data={providerData} dataKey="value" nameKey="name" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by branch</CardTitle>
            <CardDescription className="text-xs">
              Expected monthly fee, active contracts only
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : branchData.length === 0 ? (
              <EmptyState title="No active contracts" />
            ) : (
              <Chart data={branchData} dataKey="value" nameKey="name" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Renewals summary strip + table */}
      <div className="grid grid-cols-3 gap-3">
        <RenewalTile
          label="Upcoming renewals"
          value={data?.renewalSummary?.upcoming}
          tone="amber"
          icon={Clock}
          loading={isLoading}
          hash="renewals"
        />
        <RenewalTile
          label="Overdue renewals"
          value={data?.renewalSummary?.overdue}
          tone="rose"
          icon={AlertTriangle}
          loading={isLoading}
          hash="renewals"
        />
        <RenewalTile
          label="Completed renewals"
          value={data?.renewalSummary?.completed}
          tone="emerald"
          icon={CheckCircle2}
          loading={isLoading}
          hash="renewals"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Renewals */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Upcoming renewals &amp; expiries</CardTitle>
            <CardDescription className="text-xs">
              Contracts ending soonest, ordered by end date
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.hash = "renewals";
            }}
          >
            Manage renewals
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.renewals ?? []).length === 0 ? (
            <EmptyState title="No upcoming renewals" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Contract</th>
                    <th className="px-4 py-2 font-semibold">Branch</th>
                    <th className="px-4 py-2 font-semibold">End date</th>
                    <th className="px-4 py-2 font-semibold">Days left</th>
                    <th className="px-4 py-2 font-semibold">Monthly</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.renewals.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.contractNumber}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.serviceCode}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{r.branch}</td>
                      <td className="px-4 py-2.5">{formatDate(r.endDate)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            r.daysLeft < 0
                              ? "font-semibold text-rose-600"
                              : r.daysLeft <= 14
                                ? "font-semibold text-amber-600"
                                : "text-foreground"
                          }
                        >
                          {r.daysLeft}d
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {formatMoney(r.monthlyFee, r.currency)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          status={r.status.toUpperCase()}
                          tone={r.status === "expiring" ? "amber" : r.status === "active" ? "green" : "slate"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity feed (audit-based) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-primary" />
            Recent activity
          </CardTitle>
          <CardDescription className="text-xs">
            Latest changes across your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (data?.recentActivity ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {data?.recentActivity.map((a) => (
                <li key={a.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-background",
                      a.action === "CREATE" && "bg-emerald-500",
                      a.action === "UPDATE" && "bg-amber-500",
                      a.action === "DELETE" && "bg-rose-500",
                      a.action === "LOGIN" && "bg-cyan-500",
                      !["CREATE", "UPDATE", "DELETE", "LOGIN"].includes(a.action) && "bg-slate-400"
                    )}
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">{a.actor}</span>{" "}
                      <span className="text-muted-foreground">
                        {actionVerb(a.action)}
                      </span>{" "}
                      <span className="font-medium">{entityLabel(a.entityType)}</span>
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatRelative(a.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function RenewalTile({
  label,
  value,
  tone,
  icon: Icon,
  loading,
  hash,
}: {
  label: string;
  value?: number;
  tone: "amber" | "rose" | "emerald";
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  hash: string;
}) {
  const toneCls = {
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
  }[tone];
  return (
    <button
      onClick={() => { window.location.hash = hash; }}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className={cn("flex size-10 items-center justify-center rounded-lg", toneCls)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-tight tabular-nums">
          {loading ? <Skeleton className="h-6 w-8" /> : value ?? 0}
        </div>
        <p className="text-[11px] text-muted-foreground group-hover:text-foreground">
          {label}
        </p>
      </div>
    </button>
  );
}

function actionVerb(action: string): string {
  const map: Record<string, string> = {
    CREATE: "created",
    UPDATE: "updated",
    DELETE: "deleted",
    LOGIN: "signed in",
    LOGOUT: "signed out",
    IMPORT: "imported",
    EXPORT: "exported",
  };
  return map[action] ?? action.toLowerCase();
}

function entityLabel(entityType: string): string {
  const map: Record<string, string> = {
    Branch: "a branch",
    Shop: "a shop",
    Note: "a note",
    InternetProvider: "a provider",
    InternetPlan: "a plan",
    InternetService: "a service",
    InternetContract: "a contract",
    Invoice: "an invoice",
    Payment: "a payment",
    Company: "company profile",
    ContractRenewal: "a renewal",
  };
  return map[entityType] ?? entityType;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  hash,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  loading?: boolean;
  hash: string;
}) {
  return (
    <button
      onClick={() => (window.location.hash = hash)}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className={`flex size-10 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-tight">
          {loading ? <Skeleton className="h-6 w-10" /> : formatNumber(value ?? 0)}
        </div>
        <p className="text-[11px] text-muted-foreground group-hover:text-foreground">
          {label}
        </p>
      </div>
    </button>
  );
}

function CostStat({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-28" />
      ) : (
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      )}
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Chart({
  data,
  dataKey,
  nameKey,
}: {
  data: Array<{ name: string; value: number; count: number; fill: string }>;
  dataKey: string;
  nameKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey={nameKey}
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 12,
          }}
          formatter={(v: number) => [v.toLocaleString(), "Monthly"]}
        />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
