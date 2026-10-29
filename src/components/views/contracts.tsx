"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  History,
  Calculator,
  Network,
  Calendar,
  DollarSign,
  AlertTriangle,
  Building2,
  Clock,
  ShieldCheck,
  Eye,
  Paperclip,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ServiceMin = {
  id: string;
  serviceCode: string;
  branch: { id: string; name: string; code: string } | null;
  shop: { id: string; name: string; code: string } | null;
  provider: { id: string; name: string; code: string } | null;
};

type Contract = {
  id: string;
  contractNumber: string;
  serviceId: string;
  serviceCode: string;
  branch: { name: string; code: string } | null;
  shop: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
  plan: { name: string } | null;
  startDate: string;
  endDate: string;
  durationMonths: number;
  freeMonths: number;
  monthlyFee: string;
  currency: string;
  billingCycle: string;
  status: string;
  derivedStatus: string;
  notes: string | null;
  createdBy: { name: string | null; email: string } | null;
  createdAt: string;
  paidMonths: number;
  scheduledTotal: string;
  effectiveMonthly: string;
};

const STATUS_OPTS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "RENEWED", label: "Renewed" },
] as const;

function formatBillingCycle(cycle?: string) {
  if (cycle === "ANNUAL" || cycle === "YEARLY") return "Yearly";
  if (cycle === "SEMI_ANNUAL") return "Semi-annual";
  if (cycle === "QUARTERLY") return "Quarterly";
  if (cycle === "MONTHLY") return "Monthly";
  return cycle ?? "Yearly";
}

export function ContractsView() {
  const { data: session } = useSession();
  const currency = (session?.user as any)?.companyCurrency ?? "USD";
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Contract | null>(null);
  const [detail, setDetail] = React.useState<Contract | null>(null);
  const [deleting, setDeleting] = React.useState<Contract | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = React.useState<string>("ACTIVE");

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ["contracts", search, statusFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      return api<Contract[]>(`/api/contracts?${qs.toString()}`);
    },
  });

  const { data: services = [] } = useQuery<ServiceMin[]>({
    queryKey: ["services-min"],
    queryFn: () => api<ServiceMin[]>("/api/services?min=true"),
  });

  const filtered = React.useMemo(() => {
    if (!search) return contracts;
    const s = search.toLowerCase();
    return contracts.filter((c) =>
      [c.contractNumber, c.serviceCode, c.branch?.name, c.provider?.name, c.billingCycle].some(
        (v) => v?.toLowerCase().includes(s)
      )
    );
  }, [contracts, search]);

  // Executive KPI summary calculations
  const activeCount = React.useMemo(
    () => contracts.filter((c) => c.status === "ACTIVE").length,
    [contracts]
  );
  const expiringCount = React.useMemo(
    () =>
      contracts.filter(
        (c) =>
          c.derivedStatus === "expiring" ||
          c.derivedStatus === "expired" ||
          c.status === "EXPIRED"
      ).length,
    [contracts]
  );
  const totalMonthlyCommitment = React.useMemo(
    () =>
      contracts
        .filter((c) => c.status === "ACTIVE")
        .reduce((sum, c) => sum + Number(c.monthlyFee || 0), 0),
    [contracts]
  );

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/api/contracts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Contract created");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api(`/api/contracts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Contract updated");
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Contract deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkStatusMut = async (ids: string[], status: string) => {
    await api("/api/contracts/bulk-status", {
      method: "POST",
      body: JSON.stringify({ ids, status }),
    });
    toast.success(`${ids.length} contract(s) set to ${status}`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["contracts"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const columns: DataTableColumn<Contract>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          disabled={isLoading}
          aria-label="Select all"
          className="size-4"
        />
      ),
      cell: (c) => (
        <Checkbox
          checked={selected.has(c.id)}
          onCheckedChange={() => toggleSelect(c.id)}
          disabled={isLoading}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${c.contractNumber}`}
          className="size-4"
        />
      ),
      width: 48,
      minWidth: 40,
      maxWidth: 50,
      resizable: false,
      className: "w-10",
    },
    {
      key: "contract",
      header: "Contract & Service",
      width: 220,
      minWidth: 160,
      maxWidth: 320,
      cell: (c) => (
        <div>
          <div className="font-semibold text-foreground tracking-tight">{c.contractNumber}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
            <Network className="size-3 text-primary/70 shrink-0" />
            <span className="font-medium">{c.serviceCode}</span>
          </div>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch / Shop",
      width: 180,
      minWidth: 130,
      maxWidth: 260,
      cell: (c) => (
        <div className="text-sm">
          <div className="font-medium text-foreground">{c.branch?.name ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.shop?.name ?? "—"}
          </div>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider & Plan",
      width: 180,
      minWidth: 130,
      maxWidth: 260,
      cell: (c) => (
        <div className="text-sm">
          <div className="font-medium text-foreground">{c.provider?.name ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.plan?.name ?? "Standard Plan"}
          </div>
        </div>
      ),
    },
    {
      key: "period",
      header: "Contract Period",
      width: 210,
      minWidth: 170,
      maxWidth: 290,
      cell: (c) => (
        <div className="text-sm">
          <div className="font-medium">{formatDate(c.startDate)} → {formatDate(c.endDate)}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span>{c.durationMonths}m duration</span>
            {c.freeMonths > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                {c.freeMonths}m free
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "fee",
      header: "Fee & Cycle",
      width: 140,
      minWidth: 110,
      maxWidth: 190,
      cell: (c) => (
        <div>
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {formatMoney(c.monthlyFee, c.currency)}
            <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
          </div>
          <div className="mt-0.5">
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 h-4 font-normal",
                c.billingCycle === "ANNUAL" || c.billingCycle === "YEARLY"
                  ? "bg-primary/5 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {formatBillingCycle(c.billingCycle)}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: "effective",
      header: "Effective / mo",
      width: 130,
      minWidth: 100,
      maxWidth: 170,
      cell: (c) => (
        <div className="text-sm tabular-nums text-muted-foreground">
          {formatMoney(c.effectiveMonthly, c.currency)}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      minWidth: 95,
      maxWidth: 160,
      cell: (c) => (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={c.status} />
          <span className="text-[10px] text-muted-foreground capitalize">
            {c.derivedStatus}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      width: 100,
      minWidth: 80,
      maxWidth: 120,
      resizable: false,
      cell: (c) => (
        <ActionMenu
          actions={[
            {
              id: "view",
              label: "View details",
              icon: <Eye className="size-4" />,
              isPrimary: true,
              priority: 1,
              onClick: () => setDetail(c),
            },
            {
              id: "edit",
              label: "Edit contract",
              icon: <Pencil className="size-4" />,
              priority: 2,
              onClick: () => {
                setEditing(c);
                setDialogOpen(true);
              },
            },
            {
              id: "delete",
              label: "Delete contract",
              icon: <Trash2 className="size-4" />,
              variant: "destructive" as const,
              priority: 3,
              onClick: () => setDeleting(c),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Contracts"
        description="Commercial agreements and negotiated terms. Historical terms are preserved per service."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={services.length === 0}
            className="shadow-sm"
          >
            <Plus className="size-4" />
            New contract
          </Button>
        }
      />

      {/* Overview Analytics KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Contracts</span>
            <FileText className="size-4 text-primary/70" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{contracts.length}</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{activeCount} active in system</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Contracts</span>
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Currently operational</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Needs Attention</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {expiringCount}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Expiring soon or expired</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Monthly Spend</span>
            <DollarSign className="size-4 text-primary/70" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {formatMoney(totalMonthlyCommitment, currency)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Committed fee per month</p>
        </Card>
      </div>

      {services.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          You need at least one Internet service before you can create a contract.{" "}
          <button
            className="font-medium underline"
            onClick={() => (window.location.hash = "services")}
          >
            Go to services →
          </button>
        </div>
      )}

      {/* Bulk-action toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-primary">{selected.size}</span>
            <span className="text-muted-foreground">contract(s) selected</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => bulkStatusMut(Array.from(selected), bulkStatus)}>
              Set {bulkStatus.toLowerCase()}
            </Button>
          </div>
        </div>
      )}

      {/* Main Contracts Table */}
      <DataTable
        storageKey="contracts"
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        loading={isLoading}
        onRowClick={(c) => setDetail(c)}
        emptyMessage="No contracts match your filters."
        search={{ value: search, onChange: setSearch, placeholder: "Search contracts, branch, provider..." }}
        toolbar={
          <FilterSelect
            value={statusFilter as any}
            onChange={(v) => setStatusFilter(v as string)}
            options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="Select Status"
            showPlaceholderOnAll
            allLabel="All statuses"
            disabled={isLoading}
          />
        }
      />

      {/* Reorganized Form Modal */}
      <ContractForm
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        services={services}
        currency={currency}
        onSubmit={async (data) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
      />

      {/* Reorganized Detail Sheet */}
      <ContractDetailSheet
        contract={detail}
        onClose={() => setDetail(null)}
        onEdit={(c) => {
          setDetail(null);
          setEditing(c);
          setDialogOpen(true);
        }}
        onDelete={(c) => {
          setDetail(null);
          setDeleting(c);
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete contract"
        description={
          deleting
            ? `Delete "${deleting.contractNumber}"? Only draft contracts can be deleted; active contracts should be archived instead.`
            : ""
        }
        confirmText="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutateAsync(deleting.id)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reorganized Create / Edit Form Modal
// ---------------------------------------------------------------------------

function ContractForm({
  open,
  onOpenChange,
  editing,
  services,
  currency,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Contract | null;
  services: ServiceMin[];
  currency: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [serviceId, setServiceId] = React.useState("");
  const [contractNumber, setContractNumber] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [duration, setDuration] = React.useState<number | string>(12);
  const [freeMonths, setFreeMonths] = React.useState<number | string>(0);
  const [monthlyFee, setMonthlyFee] = React.useState<number | string>(0);
  const [cur, setCur] = React.useState(currency);
  const [billingCycle, setBillingCycle] = React.useState("ANNUAL");
  const [status, setStatus] = React.useState("DRAFT");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setServiceId(editing.serviceId);
      setContractNumber(editing.contractNumber);
      setStartDate(editing.startDate.slice(0, 10));
      const baseDuration = Math.max(1, editing.durationMonths - (editing.freeMonths || 0));
      setDuration(baseDuration);
      setFreeMonths(editing.freeMonths || 0);
      setMonthlyFee(Number(editing.monthlyFee));
      setCur(editing.currency);
      setBillingCycle(editing.billingCycle);
      setStatus(editing.status);
      setNotes(editing.notes ?? "");
    } else {
      setServiceId("");
      setContractNumber(`CT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setStartDate(new Date().toISOString().slice(0, 10));
      setDuration(12);
      setFreeMonths(0);
      setMonthlyFee(0);
      setCur(currency);
      setBillingCycle("ANNUAL");
      setStatus("DRAFT");
      setNotes("");
    }
    setError(null);
  }, [open, editing, currency]);

  // Total contract timeline = paid duration + free months
  const totalMonths = Math.max(0, Number(duration || 0) + Number(freeMonths || 0));

  // Auto-compute end date from start + duration + free months (free months extend the contract period)
  const endDate = React.useMemo(() => {
    if (!startDate) return "";
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + totalMonths);
    return d.toISOString().slice(0, 10);
  }, [startDate, totalMonths]);

  // Price is only calculated on the contracted paid duration (free months are zero price)
  const paidMonths = Math.max(0, Number(duration || 0));
  const scheduled = Number(monthlyFee || 0) * paidMonths;
  const effective = totalMonths > 0 ? scheduled / totalMonths : 0;

  const isFormValid = Boolean(
    serviceId?.trim() &&
    contractNumber?.trim() &&
    startDate?.trim() &&
    duration !== "" &&
    !isNaN(Number(duration)) &&
    Number(duration) > 0 &&
    monthlyFee !== "" &&
    monthlyFee !== null &&
    monthlyFee !== undefined &&
    !isNaN(Number(monthlyFee)) &&
    Number(monthlyFee) >= 0 &&
    (freeMonths === undefined || freeMonths === "" || (!isNaN(Number(freeMonths)) && Number(freeMonths) >= 0))
  );

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!serviceId) return setError("Please select an installed service");
    if (!contractNumber.trim()) return setError("Contract number is required");
    if (Number(freeMonths || 0) < 0) return setError("Free months cannot be negative");
    const payload: Record<string, unknown> = {
      serviceId,
      contractNumber: contractNumber.trim(),
      startDate,
      endDate,
      durationMonths: totalMonths,
      freeMonths: Number(freeMonths || 0),
      monthlyFee: Number(monthlyFee || 0),
      currency: cur,
      billingCycle,
      status,
      notes: notes.trim() || null,
    };
    await onSubmit(payload);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit contract — ${editing?.contractNumber}` : "Create New Contract"}
      description="Configure commercial agreement terms, scheduled period, and billing cycle. Pricing remains locked to this contract."
      submitText={isEdit ? "Save changes" : "Create contract"}
      submitDisabled={!isFormValid}
      onSubmit={submit}
      size="lg"
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Section 1: Service Identification & Contract No */}
        <div className="rounded-lg border bg-card/40 p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Network className="size-3.5 text-primary" />
            1. Service & Identification
          </div>

          <Field label="Installed Service" required hint="Select which service this commercial contract covers">
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select installed service..." />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.serviceCode} — {s.branch?.name ?? "Branch"} · {s.provider?.name ?? "Provider"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contract Number" required hint="Unique commercial identifier">
              <Input isCode value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
            </Field>
            <Field label="Contract Status" hint="Current lifecycle status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Section 2: Contract Schedule & Timeline */}
        <div className="rounded-lg border bg-card/40 p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="size-3.5 text-primary" />
            2. Schedule & Duration
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date" required>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Select date" />
            </Field>
            <Field label="Duration (months)" required>
              <Input type="number" min={1} max={120} value={duration} onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <Field label="Free months" hint="Zero-fee extension">
              <Input type="number" min={0} max={120} value={freeMonths} onChange={(e) => setFreeMonths(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <Field label="End date" hint="Auto-calculated (extended by free months)">
              <DatePicker value={endDate} disabled className="bg-muted/40 cursor-not-allowed opacity-90" />
            </Field>
          </div>
        </div>

        {/* Section 3: Financial Terms & Billing Cycle */}
        <div className="rounded-lg border bg-card/40 p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <DollarSign className="size-3.5 text-primary" />
            3. Financial Terms & Billing
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Agreed Monthly fee" required hint="Recurring cost">
              <Input type="number" min={0} step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <Field label="Currency" hint="3-letter code">
              <Input value={cur} onChange={(e) => setCur(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
            </Field>
            <Field label="Billing cycle" hint="Defaults to Yearly">
              <Select value={billingCycle} onValueChange={setBillingCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNUAL">Yearly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="SEMI_ANNUAL">Semi-annual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Section 4: Live Cost Calculation Card */}
        <Card className="border-primary/20 bg-primary/5 shadow-xs">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Calculator className="size-3.5" />
                Live Cost Projection
              </div>
              <Badge variant="outline" className="text-[10px] bg-background">
                Cycle: {formatBillingCycle(billingCycle)}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Preview
                label="Billable Months"
                value={freeMonths > 0 ? `${paidMonths} of ${totalMonths}m (${freeMonths}m free)` : `${paidMonths} of ${duration}m`}
              />
              <Preview label="Scheduled Total" value={formatMoney(scheduled, cur)} />
              <Preview label="Effective Monthly" value={`${formatMoney(effective, cur)}/mo`} />
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Notes & Documentation */}
        <Field label="Contract Notes / Reference" hint="Optional reference terms, SLA notes, or conditions">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter any specific contract terms or references..." />
        </Field>
      </div>
    </FormDialog>
  );
}

function Preview({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums mt-0.5", muted && "text-muted-foreground")}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reorganized Detail Sheet
// ---------------------------------------------------------------------------

function ContractDetailSheet({
  contract,
  onClose,
  onEdit,
  onDelete,
}: {
  contract: Contract | null;
  onClose: () => void;
  onEdit: (c: Contract) => void;
  onDelete: (c: Contract) => void;
}) {
  const [detail, setDetail] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<"overview" | "history" | "attachments">("overview");

  React.useEffect(() => {
    if (!contract) {
      setDetail(null);
      return;
    }
    setLoading(true);
    api(`/api/contracts/${contract.id}`)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [contract]);

  const open = !!contract;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="pb-3 border-b pr-10">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="flex items-center gap-2 text-lg min-w-0">
              <FileText className="size-5 text-primary shrink-0" />
              <span className="truncate">{contract?.contractNumber}</span>
            </SheetTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {contract && <StatusBadge status={contract.status} />}
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                {formatBillingCycle(contract?.billingCycle)}
              </Badge>
            </div>
          </div>
          <SheetDescription className="flex items-center gap-1.5 mt-1">
            <Network className="size-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">{contract?.serviceCode}</span>
            <span>·</span>
            <span>{contract?.provider?.name ?? "Provider"}</span>
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading contract details...</div>
        ) : detail ? (
          <div className="space-y-5 py-4">
            {/* Tabs for Clean Separation */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  History {(detail.history ?? []).length > 0 && `(${detail.history.length})`}
                </TabsTrigger>
                <TabsTrigger value="attachments" className="text-xs">Attachments</TabsTrigger>
              </TabsList>

              {/* Tab 1: Overview */}
              <TabsContent value="overview" className="space-y-4 pt-2">
                {/* Service & Location Card */}
                <div className="rounded-lg border bg-card/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Building2 className="size-3.5 text-primary" />
                    Service & Location
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Branch</p>
                      <p className="font-medium mt-0.5">{detail.branch?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Shop</p>
                      <p className="font-medium mt-0.5">{detail.shop?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">ISP Provider</p>
                      <p className="font-medium mt-0.5">{detail.provider?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Plan</p>
                      <p className="font-medium mt-0.5">{detail.plan?.name ?? "Standard"}</p>
                    </div>
                  </div>
                </div>

                {/* Schedule & Terms Card */}
                <div className="rounded-lg border bg-card/50 p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Calendar className="size-3.5 text-primary" />
                    Agreement Period & Terms
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Start Date</p>
                      <p className="font-medium mt-0.5">{formatDate(detail.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">End Date</p>
                      <p className="font-medium mt-0.5">{formatDate(detail.endDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Duration</p>
                      <p className="font-medium mt-0.5">{detail.durationMonths} months</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Free Months</p>
                      <p className="font-medium mt-0.5">{detail.freeMonths} months</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Billing Cycle</p>
                      <p className="font-medium mt-0.5 text-primary">{formatBillingCycle(detail.billingCycle)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Created By</p>
                      <p className="font-medium mt-0.5 truncate">{detail.createdBy?.name ?? detail.createdBy?.email ?? "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Financial Summary Card */}
                <Card className="border-primary/20 bg-primary/5 shadow-xs">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                      <Calculator className="size-3.5" />
                      Financial Projection
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm pt-1">
                      <Preview label="Monthly Fee" value={formatMoney(detail.monthlyFee, detail.currency)} />
                      <Preview label="Effective / Mo" value={formatMoney(detail.costs.effectiveMonthly, detail.currency)} />
                      <Preview label="Scheduled Total" value={formatMoney(detail.costs.scheduledTotal, detail.currency)} />
                    </div>
                  </CardContent>
                </Card>

                {/* Notes if available */}
                {detail.notes && (
                  <div className="rounded-lg border bg-card/50 p-3.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Contract Notes</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">{detail.notes}</p>
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Service History */}
              <TabsContent value="history" className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  Complete historical chain of contract agreements recorded for service <span className="font-medium text-foreground">{detail.serviceCode}</span>.
                </p>
                <div className="space-y-2">
                  {(detail.history ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                      No prior contract history for this service.
                    </div>
                  ) : (
                    (detail.history ?? []).map((h: any) => (
                      <div
                        key={h.id}
                        className={cn(
                          "rounded-lg border p-3 text-sm transition",
                          h.current ? "border-primary bg-primary/5 shadow-xs" : "bg-card/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{h.contractNumber}</span>
                          {h.current ? (
                            <Badge variant="default" className="text-[10px]">Current Contract</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Archived</Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{formatDate(h.startDate)} → {formatDate(h.endDate)}</span>
                          <span>{h.durationMonths}m ({h.freeMonths} free)</span>
                          <span className="font-medium text-foreground">{formatMoney(h.monthlyFee, h.currency)}/mo</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Tab 3: Cloud Attachments */}
              <TabsContent value="attachments" className="pt-2">
                <div className="rounded-lg border bg-card/40 p-4">
                  <AttachmentsPanel entityType="contract" entityId={detail.id} />
                </div>
              </TabsContent>
            </Tabs>

            {/* Sheet Actions */}
            <SheetFooter className="flex-row gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => contract && onEdit(contract)} className="flex-1">
                <Pencil className="size-4 mr-1.5" /> Edit Contract
              </Button>
              <Button
                variant="outline"
                onClick={() => contract && onDelete(contract)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="size-4 mr-1.5" /> Delete
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Contract not found.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
