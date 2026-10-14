"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileText, History, Calculator, Network } from "lucide-react";
import { api } from "@/lib/api-client";
import { useSession } from "next-auth/react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, FilterSelect, type DataTableColumn } from "@/components/shared/data-table";
import { FormDialog, Field } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
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

export function ContractsView() {
  const { data: session } = useSession();
  const currency = (session?.user as any)?.companyCurrency ?? "THB";
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Contract | null>(null);
  const [detail, setDetail] = React.useState<Contract | null>(null);
  const [deleting, setDeleting] = React.useState<Contract | null>(null);

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
      [c.contractNumber, c.serviceCode, c.branch?.name, c.provider?.name].some(
        (v) => v?.toLowerCase().includes(s)
      )
    );
  }, [contracts, search]);

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

  const columns: DataTableColumn<Contract>[] = [
    {
      key: "contract",
      header: "Contract",
      cell: (c) => (
        <div>
          <div className="font-medium">{c.contractNumber}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.serviceCode}
          </div>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch / Shop",
      hideOnMobile: true,
      cell: (c) => (
        <div className="text-sm">
          <div>{c.branch?.name ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.shop?.name ?? "—"}
          </div>
        </div>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      hideOnMobile: true,
      cell: (c) => (
        <div className="text-sm">
          <div>{c.provider?.name ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.plan?.name ?? "—"}
          </div>
        </div>
      ),
    },
    {
      key: "period",
      header: "Period",
      hideOnMobile: true,
      cell: (c) => (
        <div className="text-sm">
          <div>{formatDate(c.startDate)} → {formatDate(c.endDate)}</div>
          <div className="text-[11px] text-muted-foreground">
            {c.durationMonths}m · {c.freeMonths} free
          </div>
        </div>
      ),
    },
    {
      key: "fee",
      header: "Monthly",
      cell: (c) => (
        <div className="text-sm font-medium tabular-nums">
          {formatMoney(c.monthlyFee, c.currency)}
        </div>
      ),
    },
    {
      key: "effective",
      header: "Effective/mo",
      hideOnMobile: true,
      cell: (c) => (
        <div className="text-sm tabular-nums text-muted-foreground">
          {formatMoney(c.effectiveMonthly, c.currency)}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <div className="flex flex-col gap-1">
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
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(c);
              setDialogOpen(true);
            }}
            aria-label="Edit"
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contracts"
        description="Commercial agreements and agreed monthly price terms. Historical terms are preserved per service."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={services.length === 0}
          >
            <Plus className="size-4" />
            New contract
          </Button>
        }
      />

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

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        loading={isLoading}
        onRowClick={(c) => setDetail(c)}
        emptyMessage="No contracts match your filters."
        search={{ value: search, onChange: setSearch, placeholder: "Search contracts..." }}
        toolbar={
          <FilterSelect
            value={statusFilter as any}
            onChange={(v) => setStatusFilter(v as string)}
            options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="Status"
          />
        }
      />

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
// Create / edit form
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
  const [duration, setDuration] = React.useState(12);
  const [freeMonths, setFreeMonths] = React.useState(0);
  const [monthlyFee, setMonthlyFee] = React.useState<number>(0);
  const [cur, setCur] = React.useState(currency);
  const [billingCycle, setBillingCycle] = React.useState("MONTHLY");
  const [status, setStatus] = React.useState("DRAFT");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setServiceId(editing.serviceId);
      setContractNumber(editing.contractNumber);
      setStartDate(editing.startDate.slice(0, 10));
      setDuration(editing.durationMonths);
      setFreeMonths(editing.freeMonths);
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
      setBillingCycle("MONTHLY");
      setStatus("DRAFT");
      setNotes("");
    }
    setError(null);
  }, [open, editing, currency]);

  // Auto-compute end date from start + duration.
  const endDate = React.useMemo(() => {
    if (!startDate) return "";
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + Number(duration || 0));
    return d.toISOString().slice(0, 10);
  }, [startDate, duration]);

  const paidMonths = Math.max(0, Number(duration || 0) - Number(freeMonths || 0));
  const scheduled = Number(monthlyFee || 0) * paidMonths;
  const effective = Number(duration || 0) > 0 ? scheduled / Number(duration) : 0;

  const submit = async () => {
    setError(null);
    if (!serviceId) return setError("Please select a service");
    if (!contractNumber.trim()) return setError("Contract number is required");
    if (freeMonths > duration) return setError("Free months cannot exceed duration");
    const payload: Record<string, unknown> = {
      serviceId,
      contractNumber: contractNumber.trim(),
      startDate,
      endDate,
      durationMonths: Number(duration),
      freeMonths: Number(freeMonths),
      monthlyFee: Number(monthlyFee),
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
      title={isEdit ? `Edit contract ${editing?.contractNumber}` : "New contract"}
      description="Define the commercial terms. Prices here are independent of catalog prices and won't change when the plan price changes."
      submitText={isEdit ? "Save changes" : "Create contract"}
      onSubmit={submit}
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
        <Field label="Service" required>
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Select installed service..." />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.serviceCode} — {s.branch?.name ?? "Branch"} · {s.provider?.name ?? "?"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contract number" required>
            <Input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
          </Field>
          <Field label="Status">
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

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Start date" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Duration (months)" required>
            <Input type="number" min={1} max={120} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </Field>
          <Field label="Free months">
            <Input type="number" min={0} max={120} value={freeMonths} onChange={(e) => setFreeMonths(Number(e.target.value))} />
          </Field>
          <Field label="End date" hint="Auto-computed">
            <Input type="date" value={endDate} disabled className="bg-muted/40" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Monthly fee" required>
            <Input type="number" min={0} step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(Number(e.target.value))} />
          </Field>
          <Field label="Currency">
            <Input value={cur} onChange={(e) => setCur(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
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

        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {/* Live cost preview */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Calculator className="size-4 text-primary" />
              Cost preview
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Preview label="Paid months" value={`${paidMonths}`} />
              <Preview label="Scheduled total" value={formatMoney(scheduled, cur)} />
              <Preview label="Effective / month" value={formatMoney(effective, cur)} />
              <Preview label="Saved vs catalog" value="—" muted />
            </div>
          </CardContent>
        </Card>
      </div>
    </FormDialog>
  );
}

function Preview({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", muted && "text-muted-foreground")}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet
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
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            {contract?.contractNumber}
          </SheetTitle>
          <SheetDescription>
            {contract?.serviceCode} · {contract?.provider?.name}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">Loading...</div>
        ) : detail ? (
          <div className="space-y-5 px-4 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <span className="text-[11px] text-muted-foreground capitalize">
                Derived: {detail.derivedStatus}
              </span>
            </div>

            <DetailGrid
              rows={[
                ["Branch", detail.branch?.name ?? "—"],
                ["Shop", detail.shop?.name ?? "—"],
                ["Provider", detail.provider?.name ?? "—"],
                ["Plan", detail.plan?.name ?? "—"],
                ["Start", formatDate(detail.startDate)],
                ["End", formatDate(detail.endDate)],
                ["Duration", `${detail.durationMonths} months`],
                ["Free months", `${detail.freeMonths}`],
                ["Monthly fee", formatMoney(detail.monthlyFee, detail.currency)],
                ["Billing cycle", detail.billingCycle],
                ["Created by", detail.createdBy?.name ?? detail.createdBy?.email ?? "—"],
              ]}
            />

            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Calculator className="size-4 text-primary" />
                  Cost breakdown
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Preview label="Paid months" value={`${detail.costs.paidMonths}`} />
                  <Preview label="Scheduled total" value={formatMoney(detail.costs.scheduledTotal, detail.currency)} />
                  <Preview label="Effective monthly" value={formatMoney(detail.costs.effectiveMonthly, detail.currency)} />
                </div>
              </CardContent>
            </Card>

            {detail.notes && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{detail.notes}</p>
              </div>
            )}

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <History className="size-4 text-muted-foreground" />
                Contract history for this service
              </p>
              <div className="space-y-2">
                {(detail.history ?? []).map((h: any) => (
                  <div
                    key={h.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      h.current && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{h.contractNumber}</span>
                      {h.current && <StatusBadge status="RENEWED" tone="violet" />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{formatDate(h.startDate)} → {formatDate(h.endDate)}</span>
                      <span>{h.durationMonths}m · {h.freeMonths} free</span>
                      <span>{formatMoney(h.monthlyFee, h.currency)}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attachments (Phase 11) */}
            {detail && (
              <div className="border-t pt-4">
                <AttachmentsPanel entityType="contract" entityId={detail.id} />
              </div>
            )}

            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => contract && onEdit(contract)} className="flex-1">
                <Pencil className="size-4" /> Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => contract && onDelete(contract)}
                className="text-rose-600 hover:text-rose-700"
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">No data.</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-sm">{value}</p>
        </div>
      ))}
    </div>
  );
}
