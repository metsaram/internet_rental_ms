"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, KeyRound, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatBandwidth, formatDate } from "@/lib/format";

type Provider = { id: string; code: string; name: string; status: string };
type Branch = { id: string; code: string; name: string; status: string };
type Plan = { id: string; name: string; providerId: string; bandwidthDownMbps: number };
type Shop = { id: string; code: string; name: string; branchId: string };

type Service = {
  id: string;
  serviceCode: string;
  accountId: string | null;
  customerId: string | null;
  ispServiceId: string | null;
  installationAddress: string | null;
  ipAddress: string | null;
  ipType: string;
  status: string;
  installedAt: string | null;
  hasCredentials: boolean;
  contractsCount?: number;
  branch: { id: string; name: string; code: string } | null;
  shop: { id: string; name: string; code: string } | null;
  provider: { id: string; name: string; code: string } | null;
  plan: { id: string; name: string } | null;
};

const STATUS_OPTS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "TERMINATED", label: "Terminated" },
] as const;

const SORT_OPTS = [
  { value: "newest", label: "Newest first" },
  { value: "code", label: "Service code (A-Z)" },
  { value: "oldest", label: "Oldest first" },
] as const;

export function ServicesView() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [providerFilter, setProviderFilter] = React.useState<string>("ALL");
  const [sort, setSort] = React.useState<string>("newest");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Service | null>(null);
  const [deleting, setDeleting] = React.useState<Service | null>(null);

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["services", search, statusFilter, providerFilter, sort],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      if (providerFilter !== "ALL") qs.set("providerId", providerFilter);
      if (sort) qs.set("sort", sort);
      return api<Service[]>(`/api/services?${qs.toString()}`);
    },
  });
  const { data: branches = [], isLoading: isBranchesLoading } = useQuery<Branch[]>({ queryKey: ["branches-min"], queryFn: () => api<Branch[]>("/api/branches?min=true") });
  const { data: shops = [] } = useQuery<Shop[]>({ queryKey: ["shops-min"], queryFn: () => api<Shop[]>("/api/shops?min=true") });
  const { data: providers = [], isLoading: isProvidersLoading } = useQuery<Provider[]>({ queryKey: ["providers-min"], queryFn: () => api<Provider[]>("/api/providers?min=true") });
  const { data: plans = [] } = useQuery<Plan[]>({ queryKey: ["plans-min"], queryFn: () => api<Plan[]>("/api/plans?min=true") });

  const filtered = React.useMemo(() => {
    let list = services;
    if (providerFilter !== "ALL") {
      list = list.filter((sv) => sv.provider?.id === providerFilter);
    }
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((sv) =>
      [
        sv.serviceCode,
        sv.accountId,
        sv.customerId,
        sv.ispServiceId,
        sv.installationAddress,
        sv.ipAddress,
        sv.branch?.name,
        sv.branch?.code,
        sv.shop?.name,
        sv.shop?.code,
        sv.provider?.name,
        sv.provider?.code,
        sv.plan?.name,
      ].some((v) => v?.toLowerCase().includes(s))
    );
  }, [services, providerFilter, search]);

  const createMut = async (data: Record<string, unknown>) => {
    try {
      await api("/api/services", { method: "POST", body: JSON.stringify(data) });
      toast.success("Service created");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["services-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error((err as Error).message || "Failed to create service");
    }
  };

  const updateMut = async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
    try {
      await api(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      toast.success("Service updated");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["services-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error((err as Error).message || "Failed to update service");
    }
  };

  const deleteMut = async (id: string) => {
    try {
      await api(`/api/services/${id}`, { method: "DELETE" });
      toast.success("Service deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["services-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete service");
    }
  };

  const columns: DataTableColumn<Service>[] = [
    {
      key: "code",
      header: "Service code",
      width: 180,
      minWidth: 140,
      maxWidth: 260,
      cell: (s) => (
        <div>
          <div className="font-medium">{s.serviceCode}</div>
          <div className="text-[11px] text-muted-foreground">{s.accountId ? `Acct: ${s.accountId}` : "—"}</div>
        </div>
      ),
    },
    {
      key: "ispCheck",
      header: "ISP Info (CID / SID)",
      width: 180,
      minWidth: 145,
      maxWidth: 260,
      cell: (s) => (
        <div className="text-xs space-y-0.5 min-w-[130px]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[10px] text-muted-foreground bg-muted/80 px-1 py-0.5 rounded border border-border/40">CID</span>
            <span className="font-mono text-xs">{s.customerId || "—"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[10px] text-muted-foreground bg-muted/80 px-1 py-0.5 rounded border border-border/40">SID</span>
            <span className="font-mono text-xs">{s.ispServiceId || "—"}</span>
          </div>
        </div>
      ),
    },
    { key: "branch", header: "Branch / Shop", width: 180, minWidth: 130, maxWidth: 260, cell: (s) => (<div className="text-sm"><div>{s.branch?.name ?? "—"}</div><div className="text-[11px] text-muted-foreground">{s.shop?.name ?? "—"}</div></div>) },
    { key: "provider", header: "Provider / Plan", width: 180, minWidth: 130, maxWidth: 260, cell: (s) => (<div className="text-sm"><div>{s.provider?.name ?? "—"}</div><div className="text-[11px] text-muted-foreground">{s.plan?.name ?? "—"}</div></div>) },
    { key: "ip", header: "IP", width: 150, minWidth: 120, maxWidth: 210, cell: (s) => (<div className="text-sm"><div className="tabular-nums">{s.ipAddress ?? "—"}</div><div className="text-[11px] text-muted-foreground">{s.ipType}</div></div>) },
    { key: "creds", header: "Creds", width: 90, minWidth: 70, maxWidth: 120, cell: (s) => (s.hasCredentials ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><KeyRound className="size-3.5" /> set</span> : <span className="text-muted-foreground text-xs">—</span>) },
    { key: "installed", header: "Installed", width: 120, minWidth: 100, maxWidth: 160, cell: (s) => <span className="text-sm">{formatDate(s.installedAt)}</span> },
    { key: "status", header: "Status", width: 110, minWidth: 90, maxWidth: 140, cell: (s) => <StatusBadge status={s.status} /> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      width: 90,
      minWidth: 80,
      maxWidth: 110,
      resizable: false,
      cell: (s) => (
        <ActionMenu
          actions={[
            {
              id: "edit",
              label: "Edit service",
              icon: <Pencil className="size-4" />,
              isPrimary: true,
              priority: 1,
              onClick: () => {
                setEditing(s);
                setDialogOpen(true);
              },
            },
            {
              id: "delete",
              label: "Delete service",
              icon: <Trash2 className="size-4" />,
              variant: "destructive" as const,
              priority: 2,
              disabled: (s.contractsCount ?? 0) > 0,
              disabledReason:
                (s.contractsCount ?? 0) > 0
                  ? `Service has ${s.contractsCount} contract(s); archive instead of delete`
                  : undefined,
              onClick: () => setDeleting(s),
            },
          ]}
        />
      ),
    },
  ];

  const canCreate = branches.length > 0 && providers.length > 0;
  const isPrereqLoading = isBranchesLoading || isProvidersLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Internet services"
        description="Inventory of installed connections. ISP credentials are stored server-side and redacted in lists."
        actions={<Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!canCreate}><Plus className="size-4" /> New service</Button>}
      />
      {!canCreate && !isPrereqLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {branches.length === 0 && providers.length === 0 ? (
            <>
              You need at least one branch and one provider before adding services.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => (window.location.hash = "branches")}
              >
                Go to branches →
              </button>
            </>
          ) : branches.length === 0 ? (
            <>
              You need at least one branch before adding services.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => (window.location.hash = "branches")}
              >
                Go to branches →
              </button>
            </>
          ) : (
            <>
              You need at least one provider before adding services.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => (window.location.hash = "providers")}
              >
                Go to providers →
              </button>
            </>
          )}
        </div>
      )}
      <DataTable
        storageKey="services"
        columns={columns}
        rows={filtered}
        rowKey={(s) => s.id}
        loading={isLoading}
        pageSize={25}
        emptyMessage="No services match your filters."
        search={{ value: search, onChange: setSearch, placeholder: "Search services, CID, SID, branch, shop, provider, IP..." }}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              value={statusFilter as any}
              onChange={(v) => setStatusFilter(v as string)}
              options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Select Status"
              showPlaceholderOnAll
              allLabel="All statuses"
              disabled={isLoading}
            />
            <FilterSelect
              value={providerFilter as any}
              onChange={(v) => setProviderFilter(v as string)}
              options={providers.map((p) => ({
                value: p.id,
                label: `${p.name} — ${p.code}`,
              }))}
              placeholder="Select Provider"
              showPlaceholderOnAll
              allLabel="All providers"
              className="w-[11rem] sm:w-[13rem]"
              disabled={isLoading || isProvidersLoading}
            />
            <FilterSelect
              value={sort as any}
              onChange={(v) => setSort(v as string)}
              options={SORT_OPTS.map((s) => ({ value: s.value, label: s.label }))}
              placeholder="Sort"
              disabled={isLoading}
            />
          </div>
        }
      />
      <ServiceForm
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        branches={branches}
        shops={shops}
        providers={providers}
        plans={plans}
        onSubmit={async (data) => {
          if (editing) await updateMut({ id: editing.id, data });
          else await createMut(data);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete service"
        description={
          deleting
            ? `Delete "${deleting.serviceCode}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        destructive
        onConfirm={() => {
          if (deleting) return deleteMut(deleting.id);
        }}
      />
    </div>
  );
}

function ServiceForm({
  open, onOpenChange, editing, branches, shops, providers, plans, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Service | null;
  branches: Branch[];
  shops: Shop[];
  providers: Provider[];
  plans: Plan[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [branchId, setBranchId] = React.useState("");
  const [shopId, setShopId] = React.useState<string>("none"); // "none" = null
  const [providerId, setProviderId] = React.useState("");
  const [planId, setPlanId] = React.useState<string>("none");
  const [serviceCode, setServiceCode] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [ispServiceId, setIspServiceId] = React.useState("");
  const [installationAddress, setInstallationAddress] = React.useState("");
  const [ipAddress, setIpAddress] = React.useState("");
  const [ipType, setIpType] = React.useState("DYNAMIC");
  const [username, setUsername] = React.useState("");
  const [status, setStatus] = React.useState("PENDING");
  const [installedAt, setInstalledAt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setBranchId(editing.branch?.id ?? "");
      setShopId(editing.shop?.id ?? "none");
      setProviderId(editing.provider?.id ?? "");
      setPlanId(editing.plan?.id ?? "none");
      setServiceCode(editing.serviceCode);
      setAccountId(editing.accountId ?? "");
      setCustomerId(editing.customerId ?? "");
      setIspServiceId(editing.ispServiceId ?? "");
      setInstallationAddress(editing.installationAddress ?? "");
      setIpAddress(editing.ipAddress ?? "");
      setIpType(editing.ipType);
      setUsername(""); // never prefill sensitive
      setStatus(editing.status);
      setInstalledAt(editing.installedAt ? editing.installedAt.slice(0, 10) : "");
    } else {
      setBranchId(""); setShopId("none"); setProviderId(""); setPlanId("none");
      setServiceCode(`SVC-${Math.floor(1000 + Math.random() * 9000)}`);
      setAccountId(""); setCustomerId(""); setIspServiceId(""); setInstallationAddress(""); setIpAddress("");
      setIpType("DYNAMIC"); setUsername(""); setStatus("PENDING"); setInstalledAt("");
    }
    setError(null);
  }, [open, editing]);

  const visibleShops = branchId ? shops.filter((s) => s.branchId === branchId) : shops;
  const visiblePlans = providerId ? plans.filter((p) => p.providerId === providerId) : plans;

  const isFormValid = Boolean(branchId?.trim() && providerId?.trim() && serviceCode?.trim());

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!branchId) return setError("Select a branch");
    if (!providerId) return setError("Select a provider");
    if (!serviceCode.trim()) return setError("Service code is required");
    await onSubmit({
      branchId, shopId: shopId === "none" ? null : shopId, providerId, planId: planId === "none" ? null : planId,
      serviceCode: serviceCode.trim(), accountId: accountId || null,
      customerId: customerId || null, ispServiceId: ispServiceId || null,
      installationAddress: installationAddress || null, ipAddress: ipAddress || null,
      ipType, username: username || null, status, installedAt: installedAt || null,
    });
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={isEdit ? `Edit service ${editing?.serviceCode}` : "New internet service"} description="Installed connection record. Credentials are stored server-side only." submitText={isEdit ? "Save changes" : "Create service"} submitDisabled={!isFormValid} onSubmit={submit} size="lg">
      <div className="space-y-4">
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Branch" required>
            <Select value={branchId} onValueChange={(v) => { setBranchId(v); setShopId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select branch..." /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} — {b.code}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Shop (optional)" hint="Leave empty for branch-level service">
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {visibleShops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Provider" required>
            <Select value={providerId} onValueChange={(v) => { setProviderId(v); setPlanId("none"); }}>
              <SelectTrigger><SelectValue placeholder="Select provider..." /></SelectTrigger>
              <SelectContent>{providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.code}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Plan (optional)" hint="Catalog plan, if applicable">
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {visiblePlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({formatBandwidth(p.bandwidthDownMbps)})</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Service code" required><Input isCode value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} /></Field>
          <Field label="ISP account ID"><Input isCode value={accountId} onChange={(e) => setAccountId(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer ID (CID)" hint="For ISP billing & payment checks">
            <Input isCode value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="e.g. CID-00129384" />
          </Field>
          <Field label="Service ID (SID)" hint="For ISP problem resolution & NOC checks">
            <Input isCode value={ispServiceId} onChange={(e) => setIspServiceId(e.target.value)} placeholder="e.g. SID-99381022" />
          </Field>
        </div>
        <Field label="Installation address"><Input value={installationAddress} onChange={(e) => setInstallationAddress(e.target.value)} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="IP address"><Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} /></Field>
          <Field label="IP type">
            <Select value={ipType} onValueChange={setIpType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="STATIC">Static</SelectItem><SelectItem value="DYNAMIC">Dynamic</SelectItem><SelectItem value="CGNAT">CGNAT</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Installed date"><DatePicker value={installedAt} onChange={setInstalledAt} placeholder="Select date" /></Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ISP username (sensitive)" hint="Stored server-side; never returned in lists"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={editing?.hasCredentials ? "•••• (enter new to replace)" : ""} /></Field>
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    </FormDialog>
  );
}
