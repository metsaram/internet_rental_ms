"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Receipt,
  CreditCard,
  Ban,
  Calculator,
  Trash2,
  Printer,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  CalendarRange,
  RefreshCw,
  Calendar,
  DollarSign,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import {
  DataTable,
  FilterSelect,
  SearchableSelect,
  ActionMenu,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { FormDialog, Field } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { VoidInvoiceDialog } from "@/components/shared/void-invoice-dialog";
import { AttachmentsPanel } from "@/components/shared/attachments-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ProviderMin = {
  id: string;
  code: string;
  name: string;
};

type ContractMin = {
  id: string;
  contractNumber: string;
  serviceId?: string;
  serviceCode: string;
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  freeMonths?: number;
  billingCycle?: string;
  branch: { name: string; code: string } | null;
  provider: { id?: string; name: string; code: string } | null;
  monthlyFee: string;
  currency: string;
};

type ServiceMin = {
  id: string;
  serviceCode: string;
  startDate?: string | null;
  endDate?: string | null;
  durationMonths?: number | null;
  freeMonths?: number | null;
  monthlyFee?: string | number | null;
  currency?: string | null;
  billingCycle?: string | null;
  branch: { id: string; name: string; code: string } | null;
  shop: { id: string; name: string; code: string } | null;
  provider: { id: string; name: string; code: string } | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  contractId: string | null;
  contractNumber: string;
  serviceId?: string | null;
  branch: { name: string; code: string } | null;
  shop?: { name: string; code: string } | null;
  provider: { id: string; name: string; code: string } | null;
  serviceCode: string;
  invoiceDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  currency: string;
  status: string;
  derivedStatus: string;
  dueDate: string | null;
  notes: string | null;
  voidReason?: string | null;
  createdBy: { name: string | null; email: string } | null;
  createdAt: string;
  allocated: string;
  outstanding: string;
};

const STATUS_OPTS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
] as const;

const METHOD_OPTS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "ONLINE", label: "Online" },
  { value: "OTHER", label: "Other" },
] as const;

export function InvoicesView() {
  const { data: session } = useSession();
  const currency = (session?.user as any)?.companyCurrency ?? "USD";
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [providerFilter, setProviderFilter] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Invoice | null>(null);
  const [detail, setDetail] = React.useState<Invoice | null>(null);
  const [payFor, setPayFor] = React.useState<Invoice | null>(null);
  const [voiding, setVoiding] = React.useState<Invoice | null>(null);
  const [deleting, setDeleting] = React.useState<Invoice | null>(null);

  const {
    data: invoices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Invoice[]>({
    queryKey: ["invoices", search, statusFilter, providerFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      if (providerFilter !== "ALL") qs.set("providerId", providerFilter);
      return api<Invoice[]>(`/api/invoices?${qs.toString()}`);
    },
  });
  const { data: contracts = [] } = useQuery<ContractMin[]>({
    queryKey: ["contracts"],
    queryFn: () => api<ContractMin[]>("/api/contracts"),
  });
  const { data: services = [] } = useQuery<ServiceMin[]>({
    queryKey: ["services-min"],
    queryFn: () => api<ServiceMin[]>("/api/services?min=true"),
  });
  const { data: providers = [], isLoading: isProvidersLoading } = useQuery<ProviderMin[]>({
    queryKey: ["providers-min"],
    queryFn: () => api<ProviderMin[]>("/api/providers?min=true"),
  });
  const { data: company } = useQuery<{ useContract: boolean }>({
    queryKey: ["company"],
    queryFn: () => api<{ useContract: boolean }>("/api/company"),
  });
  const useContract = company?.useContract ?? true;

  const filtered = React.useMemo(() => {
    if (!search) return invoices;
    const s = search.toLowerCase();
    return invoices.filter((i) =>
      [
        i.invoiceNumber,
        i.contractNumber,
        i.serviceCode,
        i.branch?.name,
        i.branch?.code,
        i.shop?.name,
        i.shop?.code,
        i.provider?.name,
        i.provider?.code,
      ].some((v) => v?.toLowerCase().includes(s))
    );
  }, [invoices, search]);

  const createMut = async (data: Record<string, unknown>) => {
    await api("/api/invoices", { method: "POST", body: JSON.stringify(data) });
    toast.success("Invoice created");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const updateMut = async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
    await api(`/api/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    toast.success("Invoice updated");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const voidMut = async (id: string, reason: string) => {
    try {
      await api(`/api/invoices/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      toast.success("Invoice voided");
      setVoiding(null);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };
  const deleteMut = async (id: string) => {
    try {
      await api(`/api/invoices/${id}`, { method: "DELETE" });
      toast.success("Invoice deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: "inv",
      header: "Invoice",
      width: 150,
      minWidth: 100,
      maxWidth: 200,
      cell: (i) => (
        <div>
          <div className="font-medium">{i.invoiceNumber}</div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {i.contractNumber && i.contractNumber !== "—" ? (
              <span>{i.contractNumber}{i.serviceCode && i.serviceCode !== "—" ? ` · ${i.serviceCode}` : ""}</span>
            ) : i.serviceCode && i.serviceCode !== "—" ? (
              <span>{i.serviceCode}</span>
            ) : (
              "—"
            )}
          </div>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch / Provider",
      width: 190,
      minWidth: 140,
      maxWidth: 270,
      cell: (i) => (
        <div className="text-sm">
          <div>{i.branch?.name ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">{i.provider?.name ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "period",
      header: "Date / Due",
      width: 160,
      minWidth: 120,
      maxWidth: 220,
      cell: (i) => (
        <div className="text-sm">
          <div>{formatDate(i.invoiceDate)}</div>
          <div className="text-[11px] text-muted-foreground">Due {formatDate(i.dueDate)}</div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      width: 130,
      minWidth: 100,
      maxWidth: 180,
      cell: (i) => (
        <div className="text-sm font-medium tabular-nums">{formatMoney(i.total, i.currency)}</div>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      width: 130,
      minWidth: 100,
      maxWidth: 180,
      cell: (i) => (
        <div
          className={cn(
            "text-sm font-medium tabular-nums",
            Number(i.outstanding) > 0 ? "text-rose-600" : "text-emerald-600"
          )}
        >
          {formatMoney(i.outstanding, i.currency)}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 120,
      minWidth: 90,
      maxWidth: 150,
      cell: (i) => (
        <div className="flex flex-col gap-1">
          <StatusBadge
            status={i.status !== "VOID" && (i.status === "PAID" || i.derivedStatus === "paid") ? "PAID" : i.status}
            tone={
              i.status === "VOID" || i.derivedStatus === "void"
                ? "red"
                : i.status === "PAID" || i.derivedStatus === "paid"
                  ? "green"
                  : i.status === "OVERDUE" || i.derivedStatus === "overdue"
                    ? "red"
                    : i.status === "PARTIAL" || i.derivedStatus === "partial"
                      ? "amber"
                      : i.status === "DRAFT" || i.derivedStatus === "draft"
                        ? "orange"
                        : "blue"
            }
          />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      width: 100,
      minWidth: 80,
      maxWidth: 130,
      resizable: false,
      cell: (i) => (
        <ActionMenu
          actions={[
            ...(Number(i.outstanding) > 0 && i.status !== "VOID"
              ? [
                {
                  id: "pay",
                  label: "Record payment",
                  icon: <CreditCard className="size-4" />,
                  isPrimary: true,
                  priority: 1,
                  onClick: () => setPayFor(i),
                },
              ]
              : []),
            {
              id: "edit",
              label: "Edit invoice",
              icon: <Pencil className="size-4" />,
              priority: 2,
              disabled: i.status === "VOID",
              disabledReason: i.status === "VOID" ? "Voided invoices cannot be edited" : undefined,
              onClick: () => {
                setEditing(i);
                setDialogOpen(true);
              },
            },
            {
              id: "void",
              label: "Void invoice",
              icon: <Ban className="size-4" />,
              priority: 3,
              disabled: i.status === "VOID",
              disabledReason: i.status === "VOID" ? "Invoice is already voided" : undefined,
              variant: "destructive" as const,
              onClick: () => setVoiding(i),
            },
            {
              id: "delete",
              label: "Delete invoice",
              icon: <Trash2 className="size-4" />,
              priority: 4,
              variant: "destructive" as const,
              disabled: i.status === "VOID" || Number(i.allocated) > 0,
              disabledReason:
                i.status === "VOID"
                  ? "Voided invoices cannot be deleted"
                  : Number(i.allocated) > 0
                    ? "Invoice has payments; void instead of delete"
                    : undefined,
              onClick: () => setDeleting(i),
            },
          ]}
        />
      ),
    },
  ];

  const outstandingTotal = filtered
    .filter((i) => i.status !== "VOID")
    .reduce((s, i) => s + Number(i.outstanding), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices & Payments"
        description="Bill contracts per period, record payments with allocations, and track outstanding balances. Voiding preserves financial history."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              title="Refresh invoices"
              onClick={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ["invoices"] });
              }}
              disabled={isLoading}
            >
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              disabled={useContract ? contracts.length === 0 : services.length === 0}
            >
              <Plus className="size-4" /> New invoice
            </Button>
          </div>
        }
      />

      {isError && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <span>Failed to load invoices: {(error as Error)?.message || "Session error. Please refresh."}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Outstanding balance summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Invoices"
          value={String(filtered.length)}
          tone="text-foreground"
        />
        <SummaryStat
          label="Outstanding"
          value={formatMoney(outstandingTotal, currency)}
          tone={outstandingTotal > 0 ? "text-rose-600" : "text-emerald-600"}
        />
        <SummaryStat
          label="Overdue"
          value={String(filtered.filter((i) => i.derivedStatus === "overdue").length)}
          tone="text-rose-600"
        />
        <SummaryStat
          label="Paid"
          value={String(filtered.filter((i) => i.derivedStatus === "paid").length)}
          tone="text-emerald-600"
        />
      </div>

      <DataTable
        storageKey="invoices"
        columns={columns}
        rows={filtered}
        rowKey={(i) => i.id}
        loading={isLoading}
        onRowClick={(i) => setDetail(i)}
        emptyMessage={
          invoices.length === 0
            ? "No invoices found in your company. Click 'New invoice' to create one."
            : "No invoices match your active filters or search."
        }
        search={{ value: search, onChange: setSearch, placeholder: "Search invoices..." }}
        toolbar={
          <>
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
              searchable={true}
              className="w-[11rem] sm:w-[13rem]"
              disabled={isLoading || isProvidersLoading}
            />
          </>
        }
      />

      <InvoiceForm
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        contracts={contracts}
        services={services}
        currency={currency}
        useContract={useContract}
        onSubmit={async (data) => {
          if (editing) await updateMut({ id: editing.id, data });
          else await createMut(data);
        }}
      />

      <InvoiceDetailSheet
        invoice={detail}
        onClose={() => setDetail(null)}
        onEdit={(i) => { setDetail(null); setEditing(i); setDialogOpen(true); }}
        onPay={(i) => { setDetail(null); setPayFor(i); }}
        onVoid={(i) => { setDetail(null); setVoiding(i); }}
        onDelete={(i) => { setDetail(null); setDeleting(i); }}
      />

      <RecordPaymentDialog
        invoice={payFor}
        onClose={() => setPayFor(null)}
        onSaved={() => {
          setPayFor(null);
          qc.invalidateQueries({ queryKey: ["invoices"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />

      <VoidInvoiceDialog
        invoice={voiding}
        onClose={() => setVoiding(null)}
        onVoid={(id, reason) => voidMut(id, reason)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete invoice"
        description={deleting ? `Delete invoice "${deleting.invoiceNumber}"? This action cannot be undone.` : ""}
        confirmText="Delete"
        destructive
        loading={false}
        onConfirm={() => { if (deleting) return deleteMut(deleting.id); }}
      />
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------

function InvoiceForm({
  open, onOpenChange, editing, contracts, services, currency, useContract, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Invoice | null;
  contracts: ContractMin[];
  services: ServiceMin[];
  currency: string;
  useContract: boolean;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [contractId, setContractId] = React.useState("");
  const [serviceId, setServiceId] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [duration, setDuration] = React.useState<number | string>(12);
  const [freeMonths, setFreeMonths] = React.useState<number | string>(0);
  const [feeBasis, setFeeBasis] = React.useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [feeInput, setFeeInput] = React.useState<number | string>(0);
  const [hasInstallationFee, setHasInstallationFee] = React.useState(false);
  const [installationFee, setInstallationFee] = React.useState<number | string>(0);
  const [cur, setCur] = React.useState(currency);
  const [taxRate, setTaxRate] = React.useState<number | string>(10);
  const [taxManual, setTaxManual] = React.useState<number | string | null>(null);
  const [discount, setDiscount] = React.useState<number | string>(0);
  const [status, setStatus] = React.useState("DRAFT");
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleFeeBasisChange = (newBasis: "MONTHLY" | "YEARLY") => {
    if (newBasis === feeBasis) return;
    setFeeBasis(newBasis);
    if (feeInput !== "" && !isNaN(Number(feeInput))) {
      const num = Number(feeInput);
      if (newBasis === "YEARLY") {
        setFeeInput(Number((num * 12).toFixed(2)));
      } else {
        setFeeInput(Number((num / 12).toFixed(2)));
      }
    }
  };

  // Derived agreed monthly fee based on feeBasis (MONTHLY vs YEARLY)
  const monthlyFee = React.useMemo(() => {
    if (feeInput === "" || isNaN(Number(feeInput))) return 0;
    const num = Number(feeInput);
    return feeBasis === "YEARLY" ? (num > 0 ? num / 12 : 0) : num;
  }, [feeInput, feeBasis]);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      if (editing.status === "VOID") {
        toast.error("Voided invoices cannot be edited");
        onOpenChange(false);
        return;
      }
      const resolvedContractId = editing.contractId ?? "";
      const linkedContract = contracts.find((c) => c.id === resolvedContractId);
      const resolvedServiceId = (editing as any).serviceId || linkedContract?.serviceId || "";
      setContractId(resolvedContractId);
      setServiceId(resolvedServiceId);
      setInvoiceNumber(editing.invoiceNumber);
      setInvoiceDate(editing.invoiceDate.slice(0, 10));
      setStartDate(editing.periodStart?.slice(0, 10) ?? "");
      setDueDate(editing.dueDate?.slice(0, 10) ?? "");
      const existingTax = Number(editing.tax);
      setTaxManual(existingTax);
      const existingSubtotal = Number(editing.subtotal);
      if (existingSubtotal > 0 && existingTax >= 0) {
        const calculatedRate = (existingTax / existingSubtotal) * 100;
        setTaxRate(Number(calculatedRate.toFixed(1)));
      } else {
        setTaxRate(10);
      }
      setDiscount(Number(editing.discount));
      setCur(editing.currency);
      setStatus(editing.status);
      setNotes(editing.notes ?? "");

      const linkedService = services.find((s) => s.id === resolvedServiceId);

      let initDuration: number | string = 12;
      let initFreeMonths: number | string = 0;
      let initMonthlyFee: number | string = Number(editing.subtotal);

      if (linkedContract) {
        initFreeMonths = linkedContract.freeMonths || 0;
        initDuration = Math.max(1, (linkedContract.durationMonths || 12) - Number(initFreeMonths));
        initMonthlyFee = Number(linkedContract.monthlyFee);
      } else if (linkedService) {
        initFreeMonths = linkedService.freeMonths || 0;
        initDuration = Math.max(1, (linkedService.durationMonths || 12) - Number(initFreeMonths));
        if (linkedService.monthlyFee && Number(linkedService.monthlyFee) > 0) {
          initMonthlyFee = Number(linkedService.monthlyFee);
        }
      } else if (editing.periodStart && editing.periodEnd) {
        const s = new Date(editing.periodStart);
        const e = new Date(editing.periodEnd);
        const mDiff = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
        initDuration = mDiff;
        initMonthlyFee = initDuration > 0 ? Number(editing.subtotal) / initDuration : Number(editing.subtotal);
      }

      // If the invoice's stored period exceeds paid duration, calculate promotional free months
      if (editing.periodStart && editing.periodEnd) {
        const s = new Date(editing.periodStart);
        const e = new Date(editing.periodEnd);
        const totalPeriodMonths = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
        if (totalPeriodMonths > Number(initDuration)) {
          initFreeMonths = totalPeriodMonths - Number(initDuration);
        }
      }

      // If installation fee exists, calculate scheduled monthly fee accurately
      const installMatch = editing.notes?.match(/\[Installation fee\]:\s*([0-9.]+)/);
      const existingInstallFee = installMatch
        ? Number(installMatch[1])
        : (editing as any).installationFee
          ? Number((editing as any).installationFee)
          : 0;

      const scheduledPortion = Math.max(0, Number(editing.subtotal) - existingInstallFee);
      if (Number(initDuration) > 0) {
        const calculatedMonthly = Number((scheduledPortion / Number(initDuration)).toFixed(2));
        if (Number(initMonthlyFee) * Number(initDuration) !== scheduledPortion && calculatedMonthly > 0) {
          initMonthlyFee = calculatedMonthly;
        }
      }

      setDuration(initDuration);
      setFreeMonths(initFreeMonths);
      setFeeBasis("MONTHLY");
      setFeeInput(initMonthlyFee);

      if (existingInstallFee > 0) {
        setHasInstallationFee(true);
        setInstallationFee(existingInstallFee);
      } else {
        setHasInstallationFee(false);
        setInstallationFee(0);
      }
    } else {
      setContractId("");
      setServiceId("");
      setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setStartDate(new Date().toISOString().slice(0, 10));
      setDuration(12);
      setFreeMonths(0);
      setFeeBasis("MONTHLY");
      setFeeInput(0);
      setHasInstallationFee(false);
      setInstallationFee(0);
      setCur(currency);
      setTaxRate(10);
      setTaxManual(null);
      setDiscount(0);
      setStatus("DRAFT");
      setDueDate("");
      setNotes("");
    }
    setError(null);
  }, [open, editing, currency, contracts, services]);

  // Total contract timeline = paid duration + free months
  const totalMonths = Math.max(0, Number(duration || 0) + Number(freeMonths || 0));

  // Auto-compute end date from start + duration + free months (free months extend the contract period)
  const endDate = React.useMemo(() => {
    if (!startDate) return "";
    const [y, m, d] = startDate.split("-").map(Number);
    if (!y || !m || !d) {
      const dt = new Date(startDate);
      dt.setMonth(dt.getMonth() + totalMonths);
      return dt.toISOString().slice(0, 10);
    }
    const dt = new Date(Date.UTC(y, m - 1 + totalMonths, d));
    return dt.toISOString().slice(0, 10);
  }, [startDate, totalMonths]);

  // Price is only calculated on the contracted paid duration (free months are zero price)
  const paidMonths = Math.max(0, Number(duration || 0));
  const scheduled = Number(monthlyFee || 0) * paidMonths;
  const installAmount = hasInstallationFee ? Math.max(0, Number(installationFee || 0)) : 0;
  const subtotal = scheduled + installAmount;
  const effective = totalMonths > 0 ? subtotal / totalMonths : 0;
  // Auto-calculate tax default 10% (price excluded: added on top of subtotal)
  const autoTax = Number(((subtotal * Number(taxRate || 0)) / 100).toFixed(2));
  const currentTax = taxManual !== null ? taxManual : autoTax;
  const total = Math.max(0, subtotal + Number(currentTax || 0) - Number(discount || 0));

  // When a contract is selected, prefill schedule & finance from contract
  const onContractChange = (id: string) => {
    const resolvedId = id === "none" ? "" : id;
    setContractId(resolvedId);
    if (!isEdit && resolvedId) {
      const c = contracts.find((x) => x.id === resolvedId);
      if (c) {
        if (c.startDate) setStartDate(c.startDate.slice(0, 10));
        const free = c.freeMonths || 0;
        const baseDuration = Math.max(1, (c.durationMonths || 12) - free);
        setDuration(baseDuration);
        setFreeMonths(free);
        const mFee = Number(c.monthlyFee);
        setFeeInput(feeBasis === "YEARLY" ? Number((mFee * 12).toFixed(2)) : mFee);
        setCur(c.currency);

        const cInstall = (c as any).notes?.match(/\[Installation fee\]:\s*([0-9.]+)/);
        if (cInstall && Number(cInstall[1]) > 0) {
          setHasInstallationFee(true);
          setInstallationFee(Number(cInstall[1]));
        }
      }
    }
  };

  // When an installed service is selected directly (no-contract mode), prefill schedule & finance from service
  const onServiceChange = (id: string) => {
    const resolvedId = id === "none" ? "" : id;
    setServiceId(resolvedId);
    if (!isEdit && resolvedId) {
      const s = services.find((x) => x.id === resolvedId);
      if (s) {
        if (s.startDate) setStartDate(s.startDate.slice(0, 10));
        const free = s.freeMonths || 0;
        const baseDuration = Math.max(1, (s.durationMonths || 12) - free);
        setDuration(baseDuration);
        setFreeMonths(free);
        if (s.monthlyFee !== null && s.monthlyFee !== undefined && Number(s.monthlyFee) > 0) {
          const mFee = Number(s.monthlyFee);
          setFeeInput(feeBasis === "YEARLY" ? Number((mFee * 12).toFixed(2)) : mFee);
        }
        if (s.currency) {
          setCur(s.currency);
        }

        const sInstall = (s as any).notes?.match(/\[Installation fee\]:\s*([0-9.]+)/);
        if (sInstall && Number(sInstall[1]) > 0) {
          setHasInstallationFee(true);
          setInstallationFee(Number(sInstall[1]));
        }
      }
    }
  };

  const hasTarget = useContract ? Boolean(contractId?.trim()) : Boolean(contractId?.trim() || serviceId?.trim());

  const isFormValid = Boolean(
    hasTarget &&
    invoiceNumber?.trim() &&
    invoiceDate?.trim() &&
    startDate?.trim() &&
    duration !== "" &&
    !isNaN(Number(duration)) &&
    Number(duration) > 0 &&
    feeInput !== "" &&
    feeInput !== null &&
    feeInput !== undefined &&
    !isNaN(Number(feeInput)) &&
    Number(feeInput) >= 0 &&
    (freeMonths === undefined || freeMonths === "" || (!isNaN(Number(freeMonths)) && Number(freeMonths) >= 0)) &&
    (!hasInstallationFee || (installationFee !== "" && !isNaN(Number(installationFee)) && Number(installationFee) >= 0)) &&
    (currentTax === "" || (!isNaN(Number(currentTax)) && Number(currentTax) >= 0)) &&
    (discount === "" || (!isNaN(Number(discount)) && Number(discount) >= 0))
  );

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (useContract && !contractId) return setError("Please select a contract");
    if (!useContract && !contractId && !serviceId) return setError("Please select an installed service");
    if (!invoiceNumber.trim()) return setError("Invoice number is required");
    if (Number(freeMonths || 0) < 0) return setError("Free months cannot be negative");
    if (hasInstallationFee && Number(installationFee || 0) < 0) return setError("Installation fee cannot be negative");
    try {
      let cleanNotes = notes.replace(/\n?\[Installation fee\]:\s*[0-9.]+/g, "").trim();
      if (hasInstallationFee && installAmount > 0) {
        cleanNotes = cleanNotes ? `${cleanNotes}\n[Installation fee]: ${installAmount}` : `[Installation fee]: ${installAmount}`;
      }
      await onSubmit({
        contractId: contractId || null,
        serviceId: serviceId || null,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        periodStart: startDate || null,
        periodEnd: endDate || null,
        subtotal,
        tax: Number(currentTax || 0),
        discount: Number(discount || 0),
        total,
        currency: cur,
        status,
        dueDate: dueDate || null,
        notes: cleanNotes || null,
        scheduledMonths: totalMonths,
        installationFee: installAmount,
      });
    } catch (e) {
      console.error("[InvoiceForm submit error]:", e);
      setError((e as Error).message);
      throw e;
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit invoice ${editing?.invoiceNumber}` : "New invoice"}
      description={useContract ? "Bill a contract for a period. Total = subtotal + tax − discount." : "Record provider invoice for an installed service. Track spend by branch and shop."}
      submitText={isEdit ? "Save changes" : "Create invoice"}
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

        {/* Contract Mode: Contract selector required */}
        {useContract && (
          <Field label="Contract" required>
            <SearchableSelect
              value={contractId}
              onValueChange={onContractChange}
              disabled={isEdit}
              placeholder="Select contract..."
              options={contracts.map((c) => ({
                value: c.id,
                label: `${c.contractNumber} — ${c.serviceCode} · ${c.branch?.name ?? "—"} (${formatMoney(c.monthlyFee, c.currency)}/mo)`,
              }))}
            />
          </Field>
        )}

        {/* Contract-Free Mode: Installed Service selector required, Contract optional */}
        {!useContract && (
          <div className="space-y-3 rounded-lg border bg-card/40 p-3.5">
            <Field label="Installed Service" required hint="Select which service/branch this invoice bills">
              <SearchableSelect
                value={serviceId || "none"}
                onValueChange={onServiceChange}
                disabled={isEdit}
                placeholder="Select installed service..."
                options={[
                  { value: "none", label: "— Select installed service —" },
                  ...services.map((s) => ({
                    value: s.id,
                    label: `${s.serviceCode} — ${s.branch?.name ?? "Branch"}${s.shop?.name ? ` / ${s.shop.name}` : ""} · ${s.provider?.name ?? "Provider"}${s.monthlyFee ? ` (${formatMoney(s.monthlyFee, s.currency ?? cur)}/mo)` : ""}`,
                  })),
                ]}
              />
            </Field>

            {contracts.length > 0 && (
              <Field label="Contract (optional)" hint="Commercial contract linking (optional)">
                <SearchableSelect
                  value={contractId || "none"}
                  onValueChange={onContractChange}
                  disabled={isEdit}
                  placeholder="— No contract —"
                  options={[
                    { value: "none", label: "— No contract —" },
                    ...contracts.map((c) => ({
                      value: c.id,
                      label: `${c.contractNumber} — ${c.serviceCode} · ${c.branch?.name ?? "—"}`,
                    })),
                  ]}
                />
              </Field>
            )}
          </div>
        )}

        {/* Section 1: Invoice Identification & Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Invoice number" htmlFor="inv-number" required>
            <Input id="inv-number" isCode value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={setStatus} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Invoice date" htmlFor="inv-date" required>
            <DatePicker id="inv-date" value={invoiceDate} onChange={setInvoiceDate} placeholder="Select date" />
          </Field>
          <Field label="Due date" htmlFor="inv-due-date" hint="Payment deadline">
            <DatePicker id="inv-due-date" value={dueDate} onChange={setDueDate} placeholder="Select due date" />
          </Field>
        </div>

        {/* Section 2: Schedule & Duration */}
        <div className="rounded-lg border bg-card/40 p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="size-3.5 text-primary" />
            2. Schedule &amp; Duration
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date" required>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Select date" />
            </Field>
            <Field label="Duration (months)" required>
              <Input
                type="number"
                min={1}
                max={120}
                value={duration}
                onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </Field>
            <Field label="Free months" hint="Zero-fee extension">
              <Input
                type="number"
                min={0}
                max={120}
                value={freeMonths}
                onChange={(e) => setFreeMonths(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </Field>
            <Field label="End date" hint="Auto-calculated (extended by free months)">
              <DatePicker value={endDate} disabled className="bg-muted/40 cursor-not-allowed opacity-90" />
            </Field>
          </div>
        </div>

        {/* Section 3: Financial Terms & Billing */}
        <div className="rounded-lg border bg-card/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <DollarSign className="size-3.5 text-primary" />
              3. Financial Terms &amp; Billing
            </div>
            {/* Quick pill switcher for Fee Basis */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleFeeBasisChange("MONTHLY")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  feeBasis === "MONTHLY"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Monthly fee
              </button>
              <button
                type="button"
                onClick={() => handleFeeBasisChange("YEARLY")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  feeBasis === "YEARLY"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Yearly fee
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Fee calculation" hint="Input basis">
              <Select value={feeBasis} onValueChange={(v) => handleFeeBasisChange(v as "MONTHLY" | "YEARLY")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly fee</SelectItem>
                  <SelectItem value="YEARLY">Yearly fee</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={feeBasis === "YEARLY" ? "Agreed Yearly fee" : "Agreed Monthly fee"}
              required
              hint={
                feeBasis === "YEARLY"
                  ? `≈ ${formatMoney(monthlyFee, cur)}/mo`
                  : `≈ ${formatMoney(monthlyFee * 12, cur)}/yr`
              }
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </Field>

            <Field label="Currency" hint="3-letter code">
              <Input
                value={cur}
                onChange={(e) => setCur(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
              />
            </Field>
          </div>

          {/* Service Installation Fee Option */}
          <div className="pt-3 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-background/60 p-3">
              <label
                htmlFor="inv-has-install-fee"
                className="flex items-center gap-2.5 text-sm font-medium cursor-pointer select-none"
              >
                <Checkbox
                  id="inv-has-install-fee"
                  checked={hasInstallationFee}
                  onCheckedChange={(v) => {
                    const checked = Boolean(v);
                    setHasInstallationFee(checked);
                    if (!checked) setInstallationFee(0);
                  }}
                />
                <span className="flex items-center gap-1.5 text-foreground">
                  <Wrench className="size-3.5 text-primary" />
                  Service installation fee
                </span>
              </label>

              <div className="flex items-center gap-2 sm:w-64">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Amount ({cur}):</span>
                <Input
                  id="inv-install-fee-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  disabled={!hasInstallationFee}
                  value={hasInstallationFee ? installationFee : ""}
                  onChange={(e) => setInstallationFee(e.target.value === "" ? "" : Number(e.target.value))}
                  className={cn(
                    "h-8 text-sm",
                    !hasInstallationFee && "bg-muted/40 cursor-not-allowed opacity-50"
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Live Cost Projection Card */}
        <Card className="border-primary/20 bg-primary/5 shadow-xs">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Calculator className="size-3.5" />
                Live Cost Projection
              </div>
              <Badge variant="outline" className="text-[10px] bg-background font-mono">
                {startDate && endDate ? `${startDate} → ${endDate}` : `${totalMonths} Months`}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Preview
                label="Billable Months"
                value={Number(freeMonths || 0) > 0 ? `${paidMonths} of ${totalMonths}m (${freeMonths}m free)` : `${paidMonths} of ${duration || 0}m`}
              />
              <Preview label="Scheduled Total" value={formatMoney(scheduled, cur)} />
              {installAmount > 0 ? (
                <Preview label="Installation Fee" value={formatMoney(installAmount, cur)} />
              ) : null}
              <Preview label="Effective Monthly" value={`${formatMoney(effective, cur)}/mo`} />
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Adjustments (Tax / VAT, Discount) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label="Tax Rate (%)"
            htmlFor="inv-tax-rate"
            hint="Price excluded (default 10%)"
          >
            <div className="relative">
              <Input
                id="inv-tax-rate"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={taxRate}
                onChange={(e) => {
                  setTaxRate(e.target.value);
                  setTaxManual(null);
                }}
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                %
              </span>
            </div>
          </Field>

          <Field
            label="Tax / VAT amount"
            htmlFor="inv-tax"
            hint={
              taxManual !== null ? (
                <span className="flex items-center justify-between text-[11px]">
                  <span>Custom amount</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTaxManual(null);
                      setTaxRate(10);
                    }}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Reset (10%)
                  </button>
                </span>
              ) : (
                `Auto: ${taxRate || 0}% of subtotal`
              )
            }
          >
            <Input
              id="inv-tax"
              type="number"
              min={0}
              step="0.01"
              value={currentTax}
              onChange={(e) => setTaxManual(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>

          <Field label="Discount" htmlFor="inv-discount" hint="Optional deduction">
            <Input
              id="inv-discount"
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
        </div>

        {/* Section 6: Grand Total Payable */}
        <Card className="bg-muted/30 border">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Scheduled Service ({paidMonths}m):</span>
              <span className="font-mono font-medium text-foreground">{formatMoney(scheduled, cur)}</span>
            </div>
            {installAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Service Installation Fee:</span>
                <span className="font-mono font-medium text-foreground">+{formatMoney(installAmount, cur)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtotal (Price Excluded):</span>
              <span className="font-mono font-medium text-foreground">{formatMoney(subtotal, cur)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Tax / VAT ({taxManual !== null ? "Custom" : `${taxRate}%`}):</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">+{formatMoney(currentTax, cur)}</span>
            </div>
            {Number(discount || 0) > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Discount:</span>
                <span className="font-mono font-medium text-rose-600 dark:text-rose-400">−{formatMoney(discount, cur)}</span>
              </div>
            )}
            <div className="border-t pt-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="size-4 text-primary" />
                Total Payable (Subtotal + Tax − Discount)
              </div>
              <div className="text-xl font-bold tabular-nums text-primary">{formatMoney(total, cur)}</div>
            </div>
          </CardContent>
        </Card>

        <Field label="Notes" hint="Optional invoice notes or payment instructions">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------------

function InvoiceDetailSheet({
  invoice, onClose, onEdit, onPay, onVoid, onDelete,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onEdit: (i: Invoice) => void;
  onPay: (i: Invoice) => void;
  onVoid: (i: Invoice) => void;
  onDelete: (i: Invoice) => void;
}) {
  const [detail, setDetail] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!invoice) { setDetail(null); return; }
    setLoading(true);
    api(`/api/invoices/${invoice.id}`)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [invoice]);

  const open = !!invoice;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            {invoice?.invoiceNumber}
          </SheetTitle>
          <SheetDescription>
            {invoice?.contractNumber && invoice.contractNumber !== "—" ? `${invoice.contractNumber} · ` : ""}{invoice?.provider?.name ?? "Provider"}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">Loading...</div>
        ) : detail ? (
          <div className="space-y-5 px-4 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={detail.status !== "VOID" && (detail.status === "PAID" || detail.derivedStatus === "paid") ? "PAID" : detail.status}
                tone={
                  detail.status === "VOID" || detail.derivedStatus === "void"
                    ? "red"
                    : detail.status === "PAID" || detail.derivedStatus === "paid"
                      ? "green"
                      : detail.status === "OVERDUE" || detail.derivedStatus === "overdue"
                        ? "red"
                        : detail.status === "PARTIAL" || detail.derivedStatus === "partial"
                          ? "amber"
                          : detail.status === "DRAFT" || detail.derivedStatus === "draft"
                            ? "orange"
                            : "blue"
                }
              />
              <span className="text-[11px] text-muted-foreground capitalize">
                Derived: {detail.derivedStatus}
              </span>
            </div>

            {detail.status === "VOID" && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
                <div className="flex items-center gap-1.5 font-medium">
                  <Ban className="size-4" />
                  Voided invoice
                </div>
                {detail.voidReason && (
                  <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-400">
                    <span className="font-semibold">Reason:</span> {detail.voidReason}
                  </p>
                )}
              </div>
            )}

            {(() => {
              const svc = detail.service ?? detail.contract?.service;
              const branch = svc?.branch ?? detail.branch;
              const shop = svc?.shop ?? detail.shop;
              const provider = svc?.provider ?? detail.provider;
              const serviceCode = svc?.serviceCode ?? detail.serviceCode ?? "—";
              return (
                <DetailGrid
                  rows={[
                    ["Contract", detail.contract?.contractNumber ?? "— (No contract)"],
                    ["Service", <span key="svc" className="font-mono font-medium">{serviceCode}</span>],
                    [
                      "Branch",
                      branch?.name ? (
                        <div key="br">
                          <span className="font-medium">{branch.name}</span>
                          {branch.code && (
                            <span className="ml-1.5 text-[11px] text-muted-foreground font-mono">
                              ({branch.code})
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "Shop",
                      shop?.name ? (
                        <div key="sh">
                          <span className="font-medium">{shop.name}</span>
                          {shop.code && (
                            <span className="ml-1.5 text-[11px] text-muted-foreground font-mono">
                              ({shop.code})
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "Provider",
                      provider?.name ? (
                        <div key="pr">
                          <span className="font-medium">{provider.name}</span>
                          {provider.code && (
                            <span className="ml-1.5 text-[11px] text-muted-foreground font-mono">
                              ({provider.code})
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      ),
                    ],
                    ["Invoice date", formatDate(detail.invoiceDate)],
                    ["Due date", formatDate(detail.dueDate)],
                    ["Period", detail.periodStart ? `${formatDate(detail.periodStart)} → ${formatDate(detail.periodEnd)}` : "—"],
                    ["Created by", detail.createdBy?.name ?? detail.createdBy?.email ?? "—"],
                  ]}
                />
              );
            })()}

            {(() => {
              const installMatch = detail.notes?.match(/\[Installation fee\]:\s*([0-9.]+)/);
              const installFee = installMatch
                ? Number(installMatch[1])
                : (detail as any).installationFee
                  ? Number((detail as any).installationFee)
                  : 0;
              return (
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-2">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Calculator className="size-4 text-primary" />
                      Amounts
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {installFee > 0 && (
                        <Preview label="Installation fee" value={formatMoney(installFee, detail.currency)} />
                      )}
                      <Preview label="Subtotal" value={formatMoney(detail.subtotal, detail.currency)} />
                      <Preview label="Tax" value={formatMoney(detail.tax, detail.currency)} />
                      <Preview label="Discount" value={formatMoney(detail.discount, detail.currency)} />
                      <Preview label="Total" value={formatMoney(detail.total, detail.currency)} />
                      <Preview label="Allocated" value={formatMoney(detail.allocated, detail.currency)} />
                      <Preview label="Outstanding" value={formatMoney(detail.outstanding, detail.currency)} />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {detail.notes && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{detail.notes}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-medium">Payment allocations</p>
              {(detail.allocations ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.allocations.map((a: any) => (
                    <div key={a.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{formatMoney(a.amount, detail.currency)}</span>
                        <Badge variant="outline" className="text-[10px]">{a.payment?.method}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{formatDate(a.payment?.paymentDate)}</span>
                        {a.payment?.reference && <span>Ref: {a.payment.reference}</span>}
                        {a.payment?.status === "VOID" && <span className="text-rose-600">void</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments (Phase 11) */}
            {detail && (
              <div className="border-t pt-4">
                <AttachmentsPanel entityType="invoice" entityId={detail.id} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {Number(detail.outstanding) > 0 && detail.status !== "VOID" && (
                <Button onClick={() => invoice && onPay(invoice)} className="flex-1">
                  <CreditCard className="size-4" /> Record payment
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => invoice && window.open(`/api/invoices/${invoice.id}/print`, "_blank")}
              >
                <Printer className="size-4" /> Print
              </Button>
              {detail.status !== "VOID" && (
                <Button variant="outline" onClick={() => invoice && onEdit(invoice)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
              {detail.status !== "VOID" && (
                <Button variant="outline" onClick={() => invoice && onVoid(invoice)} className="text-amber-600">
                  <Ban className="size-4" /> Void
                </Button>
              )}
              {detail.status !== "VOID" && (detail.allocations ?? []).length === 0 && (
                <Button variant="outline" onClick={() => invoice && onDelete(invoice)} className="text-rose-600">
                  <Trash2 className="size-4" /> Delete
                </Button>
              )}
            </div>
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

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record payment dialog
// ---------------------------------------------------------------------------

function RecordPaymentDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = !!invoice;
  const [paymentDate, setPaymentDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState<number | string>(0);
  const [method, setMethod] = React.useState("BANK_TRANSFER");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [slipFile, setSlipFile] = React.useState<File | null>(null);
  const [slipPreview, setSlipPreview] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (invoice) {
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setAmount(Number(invoice.outstanding));
      setMethod("BANK_TRANSFER");
      setReference("");
      setNotes("");
      setSlipFile(null);
      setSlipPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
    }
  }, [invoice]);

  const handleSlipSelect = (file: File) => {
    setError(null);
    const validMimes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!validMimes.includes(file.type)) {
      setError("Please select an image (PNG, JPG, WEBP, GIF) or PDF file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds maximum allowed size of 5MB");
      return;
    }

    setSlipPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
    setSlipFile(file);

    // If reference code is currently blank, suggest reference from file name
    if (!reference.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").slice(0, 40);
      setReference(`Slip-${cleanName}`);
    }
  };

  const removeSlip = () => {
    setSlipPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSlipFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isFormValid = Boolean(
    paymentDate?.trim() &&
    amount !== "" &&
    amount !== null &&
    amount !== undefined &&
    !isNaN(Number(amount)) &&
    Number(amount) > 0
  );

  const submit = async () => {
    if (!invoice || !isFormValid) return;
    setError(null);
    const numAmount = Number(amount);
    if (numAmount <= 0) return setError("Amount must be positive");
    if (numAmount > Number(invoice.outstanding)) {
      return setError(`Amount exceeds outstanding balance (${formatMoney(invoice.outstanding, invoice.currency)})`);
    }

    setSaving(true);
    try {
      const res = await api<{ id: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          paymentDate,
          amount: numAmount,
          currency: invoice.currency,
          method,
          reference: reference || null,
          notes: notes || null,
          allocations: [{ invoiceId: invoice.id, amount: numAmount }],
        }),
      });

      // Upload bank reference slip if selected
      if (slipFile && res?.id) {
        // Attach to payment
        const fdPayment = new FormData();
        fdPayment.append("file", slipFile);
        fdPayment.append("entityType", "payment");
        fdPayment.append("entityId", res.id);
        fdPayment.append("category", "RECEIPT");
        await fetch("/api/attachments", { method: "POST", body: fdPayment });

        // Also attach to invoice so it appears in the Invoice attachments panel
        const fdInvoice = new FormData();
        fdInvoice.append("file", slipFile);
        fdInvoice.append("entityType", "invoice");
        fdInvoice.append("entityId", invoice.id);
        fdInvoice.append("category", "RECEIPT");
        await fetch("/api/attachments", { method: "POST", body: fdInvoice });
      }

      toast.success(slipFile ? "Payment & bank slip recorded" : "Payment recorded");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={`Record payment — ${invoice?.invoiceNumber ?? ""}`}
      description={`Outstanding: ${invoice ? formatMoney(invoice.outstanding, invoice.currency) : ""}. The payment is allocated to this invoice; outstanding balances recalculate automatically.`}
      submitText="Record payment"
      submitDisabled={!isFormValid}
      onSubmit={submit}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment date" htmlFor="pay-date" required>
            <DatePicker id="pay-date" value={paymentDate} onChange={setPaymentDate} placeholder="Payment date" />
          </Field>
          <Field label="Amount" htmlFor="pay-amount" required>
            <Input id="pay-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Method">
            <SearchableSelect
              value={method}
              onValueChange={setMethod}
              options={METHOD_OPTS.map((m) => ({
                value: m.value,
                label: m.label,
              }))}
            />
          </Field>
          <Field label="Reference code" htmlFor="pay-reference">
            <Input id="pay-reference" isCode value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank slip / card last 4" />
          </Field>
        </div>

        {/* Bank Transaction Slip / Reference Image Upload */}
        <Field
          label="Bank reference slip image"
          hint="Upload bank transaction screenshot or receipt (PNG, JPG, WEBP, PDF up to 5MB)"
        >
          {slipFile ? (
            <div className="relative flex items-center gap-3 rounded-lg border bg-muted/20 p-2.5">
              {slipPreview ? (
                <img
                  src={slipPreview}
                  alt="Bank slip preview"
                  className="size-14 rounded-md border object-cover bg-background shrink-0"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-md border bg-background shrink-0">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{slipFile.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(slipFile.size / 1024).toFixed(1)} KB · Ready to save with payment
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeSlip}
                className="size-7 text-muted-foreground hover:text-destructive"
                title="Remove image"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                id="bank-slip-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleSlipSelect(e.target.files[0]);
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files?.[0]) handleSlipSelect(e.dataTransfer.files[0]);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-muted/10 p-3 text-center transition-colors hover:bg-muted/25 hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Upload bank transaction slip / receipt
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Drag & drop or browse image (PNG, JPG, WEBP, PDF up to 5MB)
                  </p>
                </div>
              </div>
            </div>
          )}
        </Field>

        <Field label="Notes" htmlFor="pay-notes">
          <Textarea id="pay-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {saving && <p className="text-xs text-muted-foreground">Saving payment & uploading slip...</p>}
      </div>
    </FormDialog>
  );
}
