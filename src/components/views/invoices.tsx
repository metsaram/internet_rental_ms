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
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  serviceCode: string;
  branch: { name: string; code: string } | null;
  provider: { id?: string; name: string; code: string } | null;
  monthlyFee: string;
  currency: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  contractId: string;
  contractNumber: string;
  branch: { name: string; code: string } | null;
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

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
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
  const { data: providers = [], isLoading: isProvidersLoading } = useQuery<ProviderMin[]>({
    queryKey: ["providers-min"],
    queryFn: () => api<ProviderMin[]>("/api/providers?min=true"),
  });

  const filtered = React.useMemo(() => {
    let list = invoices;
    if (providerFilter !== "ALL") {
      list = list.filter((i) => i.provider?.id === providerFilter);
    }
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((i) =>
      [
        i.invoiceNumber,
        i.contractNumber,
        i.serviceCode,
        i.branch?.name,
        i.provider?.name,
        i.provider?.code,
      ].some((v) => v?.toLowerCase().includes(s))
    );
  }, [invoices, providerFilter, search]);

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
          <div className="text-[11px] text-muted-foreground">{i.contractNumber}</div>
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
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={contracts.length === 0}>
            <Plus className="size-4" /> New invoice
          </Button>
        }
      />

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
        emptyMessage="No invoices match your filters."
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
        currency={currency}
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
  open, onOpenChange, editing, contracts, currency, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Invoice | null;
  contracts: ContractMin[];
  currency: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [contractId, setContractId] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceDate, setInvoiceDate] = React.useState("");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [subtotal, setSubtotal] = React.useState<number | string>(0);
  const [tax, setTax] = React.useState<number | string>(0);
  const [discount, setDiscount] = React.useState<number | string>(0);
  const [cur, setCur] = React.useState(currency);
  const [status, setStatus] = React.useState("DRAFT");
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      if (editing.status === "VOID") {
        toast.error("Voided invoices cannot be edited");
        onOpenChange(false);
        return;
      }
      setContractId(editing.contractId);
      setInvoiceNumber(editing.invoiceNumber);
      setInvoiceDate(editing.invoiceDate.slice(0, 10));
      setPeriodStart(editing.periodStart?.slice(0, 10) ?? "");
      setPeriodEnd(editing.periodEnd?.slice(0, 10) ?? "");
      setSubtotal(Number(editing.subtotal));
      setTax(Number(editing.tax));
      setDiscount(Number(editing.discount));
      setCur(editing.currency);
      setStatus(editing.status);
      setDueDate(editing.dueDate?.slice(0, 10) ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setContractId("");
      setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setPeriodStart(""); setPeriodEnd("");
      setSubtotal(0); setTax(0); setDiscount(0);
      setCur(currency); setStatus("DRAFT");
      setDueDate("");
      setNotes("");
    }
    setError(null);
  }, [open, editing, currency]);

  const total = Math.max(0, Number(subtotal || 0) + Number(tax || 0) - Number(discount || 0));

  // When a contract is selected, prefill subtotal from its monthlyFee.
  const onContractChange = (id: string) => {
    setContractId(id);
    if (!isEdit) {
      const c = contracts.find((x) => x.id === id);
      if (c) {
        setSubtotal(Number(c.monthlyFee));
        setCur(c.currency);
      }
    }
  };

  const isFormValid = Boolean(
    contractId?.trim() &&
    invoiceNumber?.trim() &&
    invoiceDate?.trim() &&
    subtotal !== "" &&
    subtotal !== null &&
    subtotal !== undefined &&
    !isNaN(Number(subtotal)) &&
    Number(subtotal) >= 0 &&
    (tax === "" || (!isNaN(Number(tax)) && Number(tax) >= 0)) &&
    (discount === "" || (!isNaN(Number(discount)) && Number(discount) >= 0))
  );

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!contractId) return setError("Please select a contract");
    if (!invoiceNumber.trim()) return setError("Invoice number is required");
    try {
      await onSubmit({
        contractId,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        subtotal: Number(subtotal || 0),
        tax: Number(tax || 0),
        discount: Number(discount || 0),
        total,
        currency: cur,
        status,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
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
      description="Bill a contract for a period. Total = subtotal + tax − discount. Catalog plan prices don't bind here — set the real billed amount."
      submitText={isEdit ? "Save changes" : "Create invoice"}
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
        <Field label="Contract" required>
          <Select value={contractId} onValueChange={onContractChange} disabled={isEdit}>
            <SelectTrigger><SelectValue placeholder="Select contract..." /></SelectTrigger>
            <SelectContent>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.contractNumber} — {c.serviceCode} · {c.branch?.name ?? "—"} ({formatMoney(c.monthlyFee, c.currency)}/mo)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

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

        {/* Invoice & Due Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Invoice date" htmlFor="inv-date" required>
            <DatePicker id="inv-date" value={invoiceDate} onChange={setInvoiceDate} placeholder="Select date" />
          </Field>
          <Field label="Due date" htmlFor="inv-due-date" hint="Payment deadline">
            <DatePicker id="inv-due-date" value={dueDate} onChange={setDueDate} placeholder="Select due date" />
          </Field>
        </div>

        {/* Service / Billing Period */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Period start" htmlFor="inv-period-start" hint="Billing coverage start">
            <DatePicker id="inv-period-start" value={periodStart} onChange={setPeriodStart} placeholder="Select start date" />
          </Field>
          <Field label="Period end" htmlFor="inv-period-end" hint="Billing coverage end">
            <DatePicker id="inv-period-end" value={periodEnd} onChange={setPeriodEnd} placeholder="Select end date" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Subtotal" htmlFor="inv-subtotal" required>
            <Input id="inv-subtotal" type="number" min={0} step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Tax / VAT" htmlFor="inv-tax">
            <Input id="inv-tax" type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Discount" htmlFor="inv-discount">
            <Input id="inv-discount" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field label="Currency" htmlFor="inv-currency">
            <Input id="inv-currency" value={cur} maxLength={3} onChange={(e) => setCur(e.target.value.toUpperCase())} />
          </Field>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="size-4 text-primary" />
              Total
            </div>
            <div className="text-xl font-semibold tabular-nums">{formatMoney(total, cur)}</div>
          </CardContent>
        </Card>

        <Field label="Notes">
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
            {invoice?.contractNumber} · {invoice?.provider?.name}
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

            <DetailGrid
              rows={[
                ["Contract", detail.contract.contractNumber],
                ["Branch", detail.contract.service.branch?.name ?? "—"],
                ["Provider", detail.contract.service.provider?.name ?? "—"],
                ["Invoice date", formatDate(detail.invoiceDate)],
                ["Due date", formatDate(detail.dueDate)],
                ["Period", detail.periodStart ? `${formatDate(detail.periodStart)} → ${formatDate(detail.periodEnd)}` : "—"],
                ["Created by", detail.createdBy?.name ?? detail.createdBy?.email ?? "—"],
              ]}
            />

            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Calculator className="size-4 text-primary" />
                  Amounts
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Preview label="Subtotal" value={formatMoney(detail.subtotal, detail.currency)} />
                  <Preview label="Tax" value={formatMoney(detail.tax, detail.currency)} />
                  <Preview label="Discount" value={formatMoney(detail.discount, detail.currency)} />
                  <Preview label="Total" value={formatMoney(detail.total, detail.currency)} />
                  <Preview label="Allocated" value={formatMoney(detail.allocated, detail.currency)} />
                  <Preview label="Outstanding" value={formatMoney(detail.outstanding, detail.currency)} />
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
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHOD_OPTS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
