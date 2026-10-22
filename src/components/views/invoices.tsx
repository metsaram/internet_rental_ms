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
} from "lucide-react";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type ContractMin = {
  id: string;
  contractNumber: string;
  serviceCode: string;
  branch: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
  monthlyFee: string;
  currency: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  contractId: string;
  contractNumber: string;
  branch: { name: string; code: string } | null;
  provider: { name: string; code: string } | null;
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
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Invoice | null>(null);
  const [detail, setDetail] = React.useState<Invoice | null>(null);
  const [payFor, setPayFor] = React.useState<Invoice | null>(null);
  const [voiding, setVoiding] = React.useState<Invoice | null>(null);
  const [deleting, setDeleting] = React.useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", search, statusFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      return api<Invoice[]>(`/api/invoices?${qs.toString()}`);
    },
  });
  const { data: contracts = [] } = useQuery<ContractMin[]>({
    queryKey: ["contracts"],
    queryFn: () => api<ContractMin[]>("/api/contracts"),
  });

  const filtered = React.useMemo(() => {
    if (!search) return invoices;
    const s = search.toLowerCase();
    return invoices.filter((i) =>
      [i.invoiceNumber, i.contractNumber, i.branch?.name].some((v) => v?.toLowerCase().includes(s))
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
  const voidMut = async (id: string) => {
    await api(`/api/invoices/${id}/void`, { method: "POST" });
    toast.success("Invoice voided");
    setVoiding(null);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const deleteMut = async (id: string) => {
    await api(`/api/invoices/${id}`, { method: "DELETE" });
    toast.success("Invoice deleted");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: "inv",
      header: "Invoice",
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
      hideOnMobile: true,
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
      hideOnMobile: true,
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
      cell: (i) => (
        <div className="text-sm font-medium tabular-nums">{formatMoney(i.total, i.currency)}</div>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
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
      cell: (i) => (
        <div className="flex flex-col gap-1">
          <StatusBadge
            status={i.status}
            tone={
              i.derivedStatus === "paid"
                ? "green"
                : i.derivedStatus === "overdue"
                  ? "red"
                  : i.derivedStatus === "partial"
                    ? "amber"
                    : i.derivedStatus === "void"
                      ? "slate"
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
      cell: (i) => (
        <div className="flex justify-end gap-1">
          {Number(i.outstanding) > 0 && i.status !== "VOID" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-emerald-600"
              onClick={(e) => {
                e.stopPropagation();
                setPayFor(i);
              }}
              aria-label="Record payment"
              title="Record payment"
            >
              <CreditCard className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(i);
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
        columns={columns}
        rows={filtered}
        rowKey={(i) => i.id}
        loading={isLoading}
        onRowClick={(i) => setDetail(i)}
        emptyMessage="No invoices match your filters."
        search={{ value: search, onChange: setSearch, placeholder: "Search invoices..." }}
        toolbar={
          <FilterSelect
            value={statusFilter as any}
            onChange={(v) => setStatusFilter(v as string)}
            options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="Status"
          />
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

      <ConfirmDialog
        open={!!voiding}
        onOpenChange={(v) => !v && setVoiding(null)}
        title="Void invoice"
        description={voiding ? `Void "${voiding.invoiceNumber}"? The record stays for audit history but is excluded from balances.` : ""}
        confirmText="Void invoice"
        destructive
        loading={false}
        onConfirm={() => voiding && voidMut(voiding.id)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete invoice"
        description={deleting ? `Delete "${deleting.invoiceNumber}"? Only draft invoices with no payments can be deleted.` : ""}
        confirmText="Delete"
        destructive
        loading={false}
        onConfirm={() => deleting && deleteMut(deleting.id)}
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
  const [subtotal, setSubtotal] = React.useState(0);
  const [tax, setTax] = React.useState(0);
  const [discount, setDiscount] = React.useState(0);
  const [cur, setCur] = React.useState(currency);
  const [status, setStatus] = React.useState("DRAFT");
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
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

  const submit = async () => {
    setError(null);
    if (!contractId) return setError("Please select a contract");
    if (!invoiceNumber.trim()) return setError("Invoice number is required");
    await onSubmit({
      contractId,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      subtotal: Number(subtotal),
      tax: Number(tax),
      discount: Number(discount),
      total,
      currency: cur,
      status,
      dueDate: dueDate || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit invoice ${editing?.invoiceNumber}` : "New invoice"}
      description="Bill a contract for a period. Total = subtotal + tax − discount. Catalog plan prices don't bind here — set the real billed amount."
      submitText={isEdit ? "Save changes" : "Create invoice"}
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
          <Field label="Invoice number" required>
            <Input isCode value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Invoice date" required>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Period start">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </Field>
          <Field label="Period end">
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Subtotal" required>
            <Input type="number" min={0} step="0.01" value={subtotal} onChange={(e) => setSubtotal(Number(e.target.value))} />
          </Field>
          <Field label="Tax / VAT">
            <Input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(Number(e.target.value))} />
          </Field>
          <Field label="Discount">
            <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </Field>
          <Field label="Currency">
            <Input value={cur} maxLength={3} onChange={(e) => setCur(e.target.value.toUpperCase())} />
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
                status={detail.status}
                tone={
                  detail.derivedStatus === "paid" ? "green"
                  : detail.derivedStatus === "overdue" ? "red"
                  : detail.derivedStatus === "partial" ? "amber"
                  : detail.derivedStatus === "void" ? "slate" : "blue"
                }
              />
              <span className="text-[11px] text-muted-foreground capitalize">
                Derived: {detail.derivedStatus}
              </span>
            </div>

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
              <Button variant="outline" onClick={() => invoice && onEdit(invoice)}>
                <Pencil className="size-4" /> Edit
              </Button>
              {detail.status !== "VOID" && (
                <Button variant="outline" onClick={() => invoice && onVoid(invoice)} className="text-amber-600">
                  <Ban className="size-4" /> Void
                </Button>
              )}
              {detail.status === "DRAFT" && (detail.allocations ?? []).length === 0 && (
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
  invoice, onClose, onSaved,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = !!invoice;
  const [paymentDate, setPaymentDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState(0);
  const [method, setMethod] = React.useState("BANK_TRANSFER");
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (invoice) {
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setAmount(Number(invoice.outstanding));
      setMethod("BANK_TRANSFER");
      setReference("");
      setNotes("");
      setError(null);
    }
  }, [invoice]);

  const submit = async () => {
    if (!invoice) return;
    setError(null);
    if (amount <= 0) return setError("Amount must be positive");
    if (amount > Number(invoice.outstanding)) {
      return setError(`Amount exceeds outstanding balance (${formatMoney(invoice.outstanding, invoice.currency)})`);
    }
    setSaving(true);
    try {
      await api("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          paymentDate,
          amount,
          currency: invoice.currency,
          method,
          reference: reference || null,
          notes: notes || null,
          allocations: [{ invoiceId: invoice.id, amount }],
        }),
      });
      toast.success("Payment recorded");
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
          <Field label="Payment date" required>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </Field>
          <Field label="Amount" required>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
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
          <Field label="Reference">
            <Input isCode value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank slip / card last 4" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
      </div>
    </FormDialog>
  );
}
