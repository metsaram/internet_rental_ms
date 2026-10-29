"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Activity,
  Zap,
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { FormDialog, Field } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Outage = {
  id: string;
  serviceId: string;
  serviceCode: string;
  branch: { name: string; code: string } | null;
  shop: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
  type: string;
  status: string;
  startTime: string;
  endTime: string | null;
  downtimeMinutes: number | null;
  notes: string | null;
  reportedBy: { name: string | null; email: string } | null;
  resolvedBy: { name: string | null; email: string } | null;
  createdAt: string;
};

const TYPE_OPTS = [
  { value: "OUTAGE", label: "Outage" },
  { value: "DEGRADED", label: "Degraded" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "EQUIPMENT_FAILURE", label: "Equipment failure" },
  { value: "PROVIDER_ISSUE", label: "Provider issue" },
  { value: "OTHER", label: "Other" },
] as const;

export function OutagesView() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [resolving, setResolving] = React.useState<Outage | null>(null);
  const [deleting, setDeleting] = React.useState<Outage | null>(null);

  const { data: outages = [], isLoading } = useQuery<Outage[]>({
    queryKey: ["outages"],
    queryFn: () => api<Outage[]>("/api/outages"),
  });

  const { data: services = [] } = useQuery<Array<{ id: string; serviceCode: string; branch: { name: string } | null; provider: { name: string } | null }>>({
    queryKey: ["services-min"],
    queryFn: () => api("/api/services?min=true"),
  });

  const resolveMut = async (id: string, notes?: string) => {
    await api(`/api/outages/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
    toast.success("Incident resolved");
    setResolving(null);
    qc.invalidateQueries({ queryKey: ["outages"] });
  };

  const deleteMut = async (id: string) => {
    await api(`/api/outages/${id}`, { method: "DELETE" });
    toast.success("Incident deleted");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["outages"] });
  };

  const ongoing = outages.filter((o) => o.status === "ONGOING");
  const resolved = outages.filter((o) => o.status === "RESOLVED");

  const columns = [
    { key: "svc", header: "Service" },
    { key: "type", header: "Type" },
    { key: "start", header: "Started" },
    { key: "duration", header: "Duration" },
    { key: "status", header: "Status" },
    { key: "actions", header: "" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Outage tracking"
        description="Track circuit-level incidents, resolve them with computed downtime, and feed availability calculations. Estimates only — SLA credit eligibility requires contract terms."
        actions={
          <Button onClick={() => setDialogOpen(true)} disabled={services.length === 0}>
            <Plus className="size-4" /> Report incident
          </Button>
        }
      />

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        <OutageTile label="Ongoing" value={ongoing.length} tone="text-rose-600" icon={AlertCircle} />
        <OutageTile label="Resolved" value={resolved.length} tone="text-emerald-600" icon={CheckCircle2} />
        <OutageTile
          label="Total downtime"
          value={`${resolved.reduce((s, o) => s + (o.downtimeMinutes ?? 0), 0)}m`}
          tone="text-amber-600"
          icon={Clock}
        />
      </div>

      {/* Ongoing incidents */}
      {ongoing.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-rose-600">Ongoing incidents</p>
          {ongoing.map((o) => (
            <OutageCard key={o.id} outage={o} onResolve={() => setResolving(o)} onDelete={() => setDeleting(o)} />
          ))}
        </div>
      )}

      {/* Resolved incidents */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Recent incidents</p>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : resolved.length === 0 && ongoing.length === 0 ? (
          <EmptyState title="No incidents recorded" description="Report an outage when a circuit goes down or degrades." illustration />
        ) : (
          resolved.slice(0, 20).map((o) => (
            <OutageCard key={o.id} outage={o} onResolve={() => setResolving(o)} onDelete={() => setDeleting(o)} />
          ))
        )}
      </div>

      <CreateOutageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        services={services}
        onSaved={() => {
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["outages"] });
        }}
      />

      <ResolveDialog
        outage={resolving}
        onClose={() => setResolving(null)}
        onConfirm={(notes) => resolving && resolveMut(resolving.id, notes)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete incident"
        description={deleting ? `Delete the "${deleting.type}" incident for ${deleting.serviceCode}? Only non-resolved incidents can be deleted.` : ""}
        confirmText="Delete"
        destructive
        onConfirm={() => deleting && deleteMut(deleting.id)}
      />
    </div>
  );
}

function OutageCard({
  outage: o,
  onResolve,
  onDelete,
}: {
  outage: Outage;
  onResolve: () => void;
  onDelete: () => void;
}) {
  const isOngoing = o.status === "ONGOING";
  return (
    <div className={cn(
      "rounded-lg border p-3",
      isOngoing ? "border-rose-500/30 bg-rose-500/5" : "border-border"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            isOngoing ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
          )}>
            {isOngoing ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{o.serviceCode}</span>
              <Badge variant="outline" className="text-[10px]">{o.type}</Badge>
              {isOngoing ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
                  <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
                  ONGOING
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">RESOLVED</span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {o.branch?.name ?? "—"} · {o.provider?.name ?? "—"}
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <p>Started {formatRelative(o.startTime)}</p>
          {o.endTime && <p>Resolved {formatRelative(o.endTime)}</p>}
          {o.downtimeMinutes != null && <p className="font-medium text-foreground">{o.downtimeMinutes}m downtime</p>}
        </div>
      </div>
      {o.notes && <p className="mt-2 text-xs text-muted-foreground">{o.notes}</p>}
      <div className="mt-2 flex justify-end gap-1">
        {isOngoing && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onResolve}>
            <CheckCircle2 className="size-3.5" /> Resolve
          </Button>
        )}
        {!isOngoing && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function OutageTile({ label, value, tone, icon: Icon }: { label: string; value: string | number; tone: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <div className={cn("flex size-9 items-center justify-center rounded-lg bg-muted/40", tone)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-tight tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function CreateOutageDialog({
  open,
  onOpenChange,
  services,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  services: Array<{ id: string; serviceCode: string; branch: { name: string } | null; provider: { name: string } | null }>;
  onSaved: () => void;
}) {
  const [serviceId, setServiceId] = React.useState("");
  const [type, setType] = React.useState("OUTAGE");
  const [startTime, setStartTime] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setServiceId("");
      setType("OUTAGE");
      setStartTime(new Date().toISOString().slice(0, 16));
      setNotes("");
      setError(null);
    }
  }, [open]);

  const isFormValid = Boolean(serviceId?.trim() && type?.trim() && startTime?.trim());

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!serviceId) return setError("Select a service");
    try {
      await api("/api/outages", {
        method: "POST",
        body: JSON.stringify({ serviceId, type, startTime, notes: notes || null }),
      });
      toast.success("Incident reported");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Report outage incident" description="Create an ongoing incident for a service. Resolve it later to compute downtime." submitText="Report incident" submitDisabled={!isFormValid} onSubmit={submit} size="md">
      <div className="space-y-4">
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <Field label="Service" required>
          <SearchableSelect
            value={serviceId}
            onValueChange={setServiceId}
            placeholder="Select service..."
            options={services.map((s) => ({
              value: s.id,
              label: `${s.serviceCode} — ${s.branch?.name ?? "—"} · ${s.provider?.name ?? "?"}`,
            }))}
          />
        </Field>
        <Field label="Incident type" required>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Start time" required>
          <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ticket #, symptoms, actions taken..." />
        </Field>
      </div>
    </FormDialog>
  );
}

function ResolveDialog({
  outage,
  onClose,
  onConfirm,
}: {
  outage: Outage | null;
  onClose: () => void;
  onConfirm: (notes?: string) => Promise<void>;
}) {
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => { setNotes(""); }, [outage]);

  const submit = async () => {
    setLoading(true);
    try {
      await onConfirm(notes.trim() || undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={!!outage}
      onOpenChange={(v) => !v && onClose()}
      title={`Resolve incident — ${outage?.serviceCode ?? ""}`}
      description={outage ? `Started ${formatDateTime(outage.startTime)}. Downtime will be computed on resolve.` : ""}
      submitText="Resolve"
      onSubmit={submit}
      size="sm"
    >
      <div className="space-y-3">
        <Field label="Resolution notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Root cause, actions taken, resolution..." />
        </Field>
        {loading && <p className="text-xs text-muted-foreground">Resolving…</p>}
      </div>
    </FormDialog>
  );
}
