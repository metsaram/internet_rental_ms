"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Ban,
  History,
  CalendarClock,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FormDialog, Field } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatMoney, formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Service = {
  serviceCode: string;
  branch: { name: string; code: string } | null;
  shop: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
};

type Renewal = {
  id: string;
  status: string;
  bucket: "upcoming" | "overdue" | "completed";
  daysLeft: number;
  warningDate: string | null;
  noticeDate: string | null;
  decisionDate: string | null;
  decidedBy: { name: string | null; email: string } | null;
  createdBy: { name: string | null; email: string } | null;
  notes: string | null;
  createdAt: string;
  oldContract: {
    id: string;
    contractNumber: string;
    startDate: string;
    endDate: string;
    monthlyFee: string;
    currency: string;
    durationMonths: number;
    freeMonths: number;
    status: string;
    service: Service;
  };
  newContract: {
    id: string;
    contractNumber: string;
    startDate: string;
    endDate: string;
    monthlyFee: string;
    currency: string;
    durationMonths: number;
    freeMonths: number;
    status: string;
  } | null;
  newTerms: {
    newStartDate: string;
    newEndDate: string;
    newMonthlyFee: string | null;
    newCurrency: string | null;
    newDurationMonths: number | null;
    newFreeMonths: number | null;
  } | null;
};

type RenewalsResponse = {
  rows: Renewal[];
  counts: { upcoming: number; overdue: number; completed: number };
};

type TabKey = "upcoming" | "overdue" | "completed";

const TAB_META: Record<TabKey, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  upcoming: { label: "Upcoming", icon: Clock, tone: "text-amber-600" },
  overdue: { label: "Overdue", icon: AlertTriangle, tone: "text-rose-600" },
  completed: { label: "Completed", icon: CheckCircle2, tone: "text-emerald-600" },
};

export function RenewalsView() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<TabKey>("upcoming");
  const [renewFor, setRenewFor] = React.useState<Renewal | null>(null);
  const [declining, setDeclining] = React.useState<Renewal | null>(null);

  const { data, isLoading } = useQuery<RenewalsResponse>({
    queryKey: ["renewals", tab],
    queryFn: () => api<RenewalsResponse>(`/api/renewals?tab=${tab}`),
  });

  const renewMut = async (oldId: string, payload: Record<string, unknown>) => {
    await api(`/api/contracts/${oldId}/renew`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    toast.success("Contract renewed — new period created");
    setRenewFor(null);
    qc.invalidateQueries({ queryKey: ["renewals"] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const declineMut = async (id: string, reason?: string) => {
    await api(`/api/renewals/${id}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? null }),
    });
    toast.success("Renewal declined");
    setDeclining(null);
    qc.invalidateQueries({ queryKey: ["renewals"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const rows = data?.rows ?? [];
  const counts = data?.counts ?? { upcoming: 0, overdue: 0, completed: 0 };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contract renewals"
        description="Track contracts approaching expiry, renew them with new terms, and preserve the old commercial history. Old terms never change when you renew."
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(TAB_META) as TabKey[]).map((k) => {
          const meta = TAB_META[k];
          const Icon = meta.icon;
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition hover:shadow-sm",
                active && "border-primary/50 ring-1 ring-primary/20"
              )}
            >
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  k === "upcoming" && "bg-amber-500/10",
                  k === "overdue" && "bg-rose-500/10",
                  k === "completed" && "bg-emerald-500/10"
                )}
              >
                <Icon className={cn("size-5", meta.tone)} />
              </div>
              <div>
                <p className="text-2xl font-semibold leading-tight tabular-nums">
                  {isLoading ? "—" : counts[k]}
                </p>
                <p className="text-[11px] text-muted-foreground">{meta.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          {(Object.keys(TAB_META) as TabKey[]).map((k) => {
            const Icon = TAB_META[k].icon;
            return (
            <TabsTrigger key={k} value={k} className="gap-1.5">
              <Icon className="size-3.5" />
              {TAB_META[k].label}
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {counts[k]}
              </Badge>
            </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${tab} renewals`}
          description={
            tab === "upcoming"
              ? "Contracts ending within the next 30 days will appear here."
              : tab === "overdue"
                ? "Contracts past their end date without a renewal decision will appear here."
                : "Completed renewals (old → new contract links) will appear here."
          }
          icon={<History className="size-5" />}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RenewalCard
              key={r.id}
              renewal={r}
              onRenew={() => setRenewFor(r)}
              onDecline={() => setDeclining(r)}
            />
          ))}
        </div>
      )}

      <RenewDialog
        renewal={renewFor}
        onClose={() => setRenewFor(null)}
        onSubmit={(payload) => renewFor && renewMut(renewFor.oldContract.id, payload)}
      />

      <DeclineDialog
        renewal={declining}
        onClose={() => setDeclining(null)}
        onConfirm={(reason) => declining && declineMut(declining.id, reason)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renewal card — shows old contract, new contract/terms, and actions
// ---------------------------------------------------------------------------

function RenewalCard({
  renewal,
  onRenew,
  onDecline,
}: {
  renewal: Renewal;
  onRenew: () => void;
  onDecline: () => void;
}) {
  const { oldContract: oldC, newContract: newC, daysLeft } = renewal;
  const feeDelta = newC
    ? Number(newC.monthlyFee) - Number(oldC.monthlyFee)
    : renewal.newTerms?.newMonthlyFee
      ? Number(renewal.newTerms.newMonthlyFee) - Number(oldC.monthlyFee)
      : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{oldC.contractNumber}</span>
            <span className="text-[11px] text-muted-foreground">
              {oldC.service.serviceCode} · {oldC.service.branch?.name ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={renewal.status} tone={renewal.status === "COMPLETED" ? "green" : renewal.status === "DECLINED" ? "slate" : "amber"} />
            {renewal.bucket !== "completed" && (
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  daysLeft < 0 ? "text-rose-600" : daysLeft <= 14 ? "text-amber-600" : "text-muted-foreground"
                )}
              >
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
              </span>
            )}
          </div>
        </div>

        {/* Old → New comparison */}
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          {/* Old terms */}
          <div className="rounded-lg border border-muted bg-muted/20 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Current terms
            </p>
            <TermGrid
              rows={[
                ["Period", `${formatDate(oldC.startDate)} → ${formatDate(oldC.endDate)}`],
                ["Duration", `${oldC.durationMonths}m · ${oldC.freeMonths} free`],
                ["Monthly", formatMoney(oldC.monthlyFee, oldC.currency)],
                ["Provider", oldC.service.provider?.name ?? "—"],
              ]}
            />
          </div>

          {/* New terms */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <ArrowRight className="size-3" />
              {newC ? "Renewed terms" : "Proposed renewal"}
            </p>
            {newC ? (
              <TermGrid
                rows={[
                  ["Contract", newC.contractNumber],
                  ["Period", `${formatDate(newC.startDate)} → ${formatDate(newC.endDate)}`],
                  ["Duration", `${newC.durationMonths}m · ${newC.freeMonths} free`],
                  ["Monthly", formatMoney(newC.monthlyFee, newC.currency)],
                ]}
              />
            ) : renewal.newTerms?.newStartDate ? (
              <TermGrid
                rows={[
                  ["Period", `${formatDate(renewal.newTerms.newStartDate)} → ${formatDate(renewal.newTerms.newEndDate)}`],
                  ["Duration", `${renewal.newTerms.newDurationMonths ?? "—"}m · ${renewal.newTerms.newFreeMonths ?? 0} free`],
                  ["Monthly", renewal.newTerms.newMonthlyFee ? formatMoney(renewal.newTerms.newMonthlyFee, renewal.newTerms.newCurrency ?? oldC.currency) : "—"],
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No renewal terms proposed yet. Click “Renew” to define new terms.
              </p>
            )}
          </div>
        </div>

        {/* Footer: delta + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {feeDelta !== 0 && newC && (
              <span
                className={cn(
                  "font-medium",
                  feeDelta > 0 ? "text-amber-600" : "text-emerald-600"
                )}
              >
                {feeDelta > 0 ? "▲" : "▼"} {formatMoney(Math.abs(feeDelta), oldC.currency)}/mo
              </span>
            )}
            {renewal.decidedBy && (
              <span>
                by {renewal.decidedBy.name ?? renewal.decidedBy.email}
                {renewal.decisionDate && ` · ${formatRelative(renewal.decisionDate)}`}
              </span>
            )}
            {renewal.createdBy && renewal.status === "PENDING" && (
              <span>created {formatRelative(renewal.createdAt)}</span>
            )}
          </div>
          <div className="flex gap-2">
            {renewal.status === "PENDING" && (
              <>
                <Button variant="outline" size="sm" onClick={onDecline} className="text-muted-foreground">
                  <Ban className="size-3.5" /> Decline
                </Button>
                <Button size="sm" onClick={onRenew}>
                  <RefreshCw className="size-3.5" /> Renew contract
                </Button>
              </>
            )}
            {renewal.status === "COMPLETED" && newC && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { window.location.hash = "contracts"; }}
              >
                View contracts
              </Button>
            )}
          </div>
        </div>

        {renewal.notes && (
          <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Notes:</span> {renewal.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TermGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-medium">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renew dialog — define new terms for the expiring contract
// ---------------------------------------------------------------------------

function RenewDialog({
  renewal,
  onClose,
  onSubmit,
}: {
  renewal: Renewal | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const open = !!renewal;
  const oldC = renewal?.oldContract;
  const [contractNumber, setContractNumber] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [duration, setDuration] = React.useState(12);
  const [freeMonths, setFreeMonths] = React.useState(0);
  const [monthlyFee, setMonthlyFee] = React.useState(0);
  const [currency, setCurrency] = React.useState("THB");
  const [billingCycle, setBillingCycle] = React.useState("MONTHLY");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!renewal || !oldC) return;
    // Suggest: start = old end, same fee/duration, no free months.
    const oldEnd = new Date(oldC.endDate);
    setContractNumber(`${oldC.contractNumber}-R`);
    setStartDate(oldEnd.toISOString().slice(0, 10));
    setDuration(oldC.durationMonths);
    setFreeMonths(0);
    setMonthlyFee(Number(oldC.monthlyFee));
    setCurrency(oldC.currency);
    setBillingCycle("MONTHLY");
    setNotes(renewal.notes ?? "");
    setError(null);
  }, [renewal, oldC]);

  const endDate = React.useMemo(() => {
    if (!startDate) return "";
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + Number(duration || 0));
    return d.toISOString().slice(0, 10);
  }, [startDate, duration]);

  const feeDelta = oldC ? Number(monthlyFee) - Number(oldC.monthlyFee) : 0;

  const submit = async () => {
    setError(null);
    if (!renewal || !oldC) return;
    if (!contractNumber.trim()) return setError("Contract number is required");
    if (freeMonths > duration) return setError("Free months cannot exceed duration");
    try {
      await onSubmit({
        contractNumber: contractNumber.trim(),
        startDate,
        endDate,
        durationMonths: Number(duration),
        freeMonths: Number(freeMonths),
        monthlyFee: Number(monthlyFee),
        currency,
        billingCycle,
        notes: notes.trim() || null,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!renewal || !oldC) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={`Renew ${oldC.contractNumber}`}
      description="Create a new contract period. The old contract is marked RENEWED and preserved for history — its terms never change."
      submitText="Create renewal"
      onSubmit={submit}
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Old → new comparison banner */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Old monthly</p>
            <p className="font-medium">{formatMoney(oldC.monthlyFee, oldC.currency)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">New monthly</p>
            <p className="flex items-center gap-1.5 font-medium">
              {formatMoney(monthlyFee, currency)}
              {feeDelta !== 0 && (
                <span className={cn("text-xs", feeDelta > 0 ? "text-amber-600" : "text-emerald-600")}>
                  {feeDelta > 0 ? "▲" : "▼"} {formatMoney(Math.abs(feeDelta), currency)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="New contract number" required>
            <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
          </Field>
          <Field label="Billing cycle">
            <Select value={billingCycle} onValueChange={setBillingCycle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                <SelectItem value="SEMI_ANNUAL">Semi-annual</SelectItem>
                <SelectItem value="ANNUAL">Annual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Start date" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Duration (mo)" required>
            <Input type="number" min={1} max={120} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </Field>
          <Field label="Free months">
            <Input type="number" min={0} max={120} value={freeMonths} onChange={(e) => setFreeMonths(Number(e.target.value))} />
          </Field>
          <Field label="End date" hint="Auto-computed">
            <Input type="date" value={endDate} disabled className="bg-muted/40" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monthly fee" required>
            <Input type="number" min={0} step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(Number(e.target.value))} />
          </Field>
          <Field label="Currency">
            <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </Field>
        </div>

        <Field label="Renewal notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Negotiated 5% discount, extended to 24 months..." />
        </Field>
      </div>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Decline dialog
// ---------------------------------------------------------------------------

function DeclineDialog({
  renewal,
  onClose,
  onConfirm,
}: {
  renewal: Renewal | null;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => { setReason(""); }, [renewal]);

  const open = !!renewal;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Decline renewal"
      description={
        renewal
          ? `Decline the pending renewal for ${renewal.oldContract.contractNumber}? The contract will be left to expire. You can always create a new renewal later.`
          : ""
      }
      confirmText="Decline"
      destructive
      loading={loading}
      onConfirm={async () => {
        setLoading(true);
        try {
          await onConfirm(reason.trim() || undefined);
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}
