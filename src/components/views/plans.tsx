"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Plus, Pencil } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import {
  DataTable,
  FilterSelect,
  ActionMenu,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { FormDialog, Field } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatBandwidth, formatMoney } from "@/lib/format";

type Provider = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type Plan = {
  id: string;
  providerId: string;
  name: string;
  bandwidthDownMbps: number;
  bandwidthUpMbps: number;
  connectionType: string;
  catalogMonthlyPrice: string;
  currency: string;
  status: string;
  description: string | null;
  provider: { id: string; code: string; name: string };
  servicesCount: number;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

const FORM_STATUS_OPTS = [...STATUS_OPTS] as const;

const CONNECTION_OPTS = [
  { value: "FIBER", label: "Fiber" },
  { value: "DSL", label: "DSL" },
  { value: "CABLE", label: "Cable" },
  { value: "WIRELESS", label: "Wireless" },
  { value: "SATELLITE", label: "Satellite" },
  { value: "OTHER", label: "Other" },
] as const;

export function PlansView() {
  const { data: session } = useSession();
  const currency = (session?.user as any)?.companyCurrency ?? "USD";
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [providerFilter, setProviderFilter] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Plan | null>(null);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["plans", search, statusFilter, providerFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      if (providerFilter !== "ALL") qs.set("provider", providerFilter);
      return api<Plan[]>(`/api/plans?${qs.toString()}`);
    },
  });

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["providers-min"],
    queryFn: () => api<Provider[]>("/api/providers?min=true"),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/api/plans", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Plan created");
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["plans-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) =>
      api(`/api/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["plans"] });
      qc.invalidateQueries({ queryKey: ["plans-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: DataTableColumn<Plan>[] = [
    {
      key: "name",
      header: "Plan",
      width: 240,
      minWidth: 160,
      maxWidth: 340,
      cell: (p) => (
        <div>
          <div className="font-medium">{p.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {p.provider.code} — {p.provider.name}
          </div>
        </div>
      ),
    },
    {
      key: "bandwidth",
      header: "Bandwidth",
      width: 150,
      minWidth: 120,
      maxWidth: 200,
      cell: (p) => (
        <div className="text-sm tabular-nums">
          <div>↓ {formatBandwidth(p.bandwidthDownMbps)}</div>
          <div className="text-[11px] text-muted-foreground">
            ↑ {formatBandwidth(p.bandwidthUpMbps)}
          </div>
        </div>
      ),
    },
    {
      key: "connection",
      header: "Connection",
      width: 140,
      minWidth: 100,
      maxWidth: 180,
      cell: (p) => (
        <span className="text-sm capitalize">{p.connectionType.toLowerCase()}</span>
      ),
    },
    {
      key: "price",
      header: "Catalog price",
      width: 140,
      minWidth: 110,
      maxWidth: 190,
      cell: (p) => (
        <span className="text-sm font-medium tabular-nums">
          {formatMoney(p.catalogMonthlyPrice, p.currency)}
        </span>
      ),
    },
    {
      key: "services",
      header: "Services",
      width: 90,
      minWidth: 70,
      maxWidth: 120,
      cell: (p) => (
        <span className="text-sm tabular-nums">{p.servicesCount}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      minWidth: 90,
      maxWidth: 140,
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      width: 80,
      minWidth: 70,
      maxWidth: 100,
      resizable: false,
      cell: (p) => (
        <ActionMenu
          actions={[
            {
              id: "edit",
              label: "Edit plan",
              icon: <Pencil className="size-4" />,
              isPrimary: true,
              onClick: () => {
                setEditing(p);
                setDialogOpen(true);
              },
            },
          ]}
        />
      ),
    },
  ];

  const canCreate = providers.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plans"
        description="Catalog plans offered by providers. Catalog prices are master data — existing contract prices are not affected by changes here."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={!canCreate}
          >
            <Plus className="size-4" />
            New plan
          </Button>
        }
      />
      {!canCreate && !isLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          You need at least one provider before adding plans.{" "}
          <button
            className="font-medium underline"
            onClick={() => (window.location.hash = "providers")}
          >
            Go to providers →
          </button>
        </div>
      )}

      <DataTable
        storageKey="plans"
        columns={columns}
        rows={plans}
        rowKey={(p) => p.id}
        loading={isLoading}
        emptyMessage="No plans match your filters."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search plans...",
        }}
        toolbar={
          <>
            <Select
              value={providerFilter}
              onValueChange={(v) => setProviderFilter(v)}
            >
              <SelectTrigger className="h-8 w-[12rem] text-xs">
                <SelectValue placeholder="All providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">
                  All providers
                </SelectItem>
                {providers.map((pv) => (
                  <SelectItem key={pv.id} value={pv.id} className="text-xs">
                    {pv.code} — {pv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FilterSelect
              value={statusFilter as "ACTIVE" | "INACTIVE" | "ALL"}
              onChange={(v) => setStatusFilter(v as string)}
              options={STATUS_OPTS.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
              placeholder="Status"
            />
          </>
        }
      />

      <PlanForm
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        providers={providers}
        currency={currency}
        onSubmit={async (data) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------

function PlanForm({
  open,
  onOpenChange,
  editing,
  providers,
  currency,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Plan | null;
  providers: Provider[];
  currency: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [providerId, setProviderId] = React.useState("");
  const [name, setName] = React.useState("");
  const [bandwidthDown, setBandwidthDown] = React.useState<number | string>(100);
  const [bandwidthUp, setBandwidthUp] = React.useState<number | string>(100);
  const [connectionType, setConnectionType] =
    React.useState<string>("FIBER");
  const [price, setPrice] = React.useState<number | string>(0);
  const [cur, setCur] = React.useState(currency);
  const [status, setStatus] = React.useState("ACTIVE");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setProviderId(editing.providerId);
      setName(editing.name);
      setBandwidthDown(editing.bandwidthDownMbps);
      setBandwidthUp(editing.bandwidthUpMbps);
      setConnectionType(editing.connectionType);
      setPrice(Number(editing.catalogMonthlyPrice));
      setCur(editing.currency);
      setStatus(editing.status);
      setDescription(editing.description ?? "");
    } else {
      setProviderId("");
      setName("");
      setBandwidthDown(100);
      setBandwidthUp(100);
      setConnectionType("FIBER");
      setPrice(0);
      setCur(currency);
      setStatus("ACTIVE");
      setDescription("");
    }
    setError(null);
  }, [open, editing, currency]);

  const isFormValid = Boolean(
    providerId?.trim() &&
    name?.trim() &&
    bandwidthDown !== "" &&
    !isNaN(Number(bandwidthDown)) &&
    Number(bandwidthDown) >= 0 &&
    bandwidthUp !== "" &&
    !isNaN(Number(bandwidthUp)) &&
    Number(bandwidthUp) >= 0 &&
    price !== "" &&
    !isNaN(Number(price)) &&
    Number(price) >= 0
  );

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!providerId) return setError("Select a provider");
    if (!name.trim()) return setError("Plan name is required");
    if (Number(bandwidthDown || 0) < 0) return setError("Download bandwidth must be ≥ 0");
    if (Number(bandwidthUp || 0) < 0) return setError("Upload bandwidth must be ≥ 0");
    if (Number(price || 0) < 0) return setError("Catalog price must be ≥ 0");
    const payload: Record<string, unknown> = {
      providerId,
      name: name.trim(),
      bandwidthDownMbps: Number(bandwidthDown || 0),
      bandwidthUpMbps: Number(bandwidthUp || 0),
      connectionType,
      catalogMonthlyPrice: Number(price || 0),
      currency: cur.trim().toUpperCase() || currency,
      status,
      description: description.trim() || null,
    };
    await onSubmit(payload);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit plan ${editing?.name}` : "New plan"}
      description="Catalog plan offered by a provider. Prices here are master data — existing contracts keep their own monthly fee."
      submitText={isEdit ? "Save changes" : "Create plan"}
      submitDisabled={!isFormValid}
      onSubmit={submit}
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Provider" required>
            <Select
              value={providerId}
              onValueChange={setProviderId}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider..." />
              </SelectTrigger>
              <SelectContent>
                {providers.map((pv) => (
                  <SelectItem key={pv.id} value={pv.id}>
                    {pv.code} — {pv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Download (Mbps)" required>
            <Input
              type="number"
              min={0}
              value={bandwidthDown}
              onChange={(e) => setBandwidthDown(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field label="Upload (Mbps)" required>
            <Input
              type="number"
              min={0}
              value={bandwidthUp}
              onChange={(e) => setBandwidthUp(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field label="Connection type">
            <Select
              value={connectionType}
              onValueChange={setConnectionType}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTION_OPTS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Catalog monthly price" required>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={cur}
              onChange={(e) =>
                setCur(e.target.value.toUpperCase().slice(0, 3))
              }
              maxLength={3}
            />
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_STATUS_OPTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </FormDialog>
  );
}
