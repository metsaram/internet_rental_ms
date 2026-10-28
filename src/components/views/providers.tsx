"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, Trash2 } from "lucide-react";
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
  type DataTableColumn,
} from "@/components/shared/data-table";
import { FormDialog, Field } from "@/components/shared/form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";

type Provider = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: string;
  notes: string | null;
  plansCount: number;
  servicesCount: number;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

const FORM_STATUS_OPTS = [...STATUS_OPTS] as const;

export function ProvidersView() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Provider | null>(null);
  const [archiving, setArchiving] = React.useState<Provider | null>(null);
  const [deleting, setDeleting] = React.useState<Provider | null>(null);

  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ["providers", search, statusFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      return api<Provider[]>(`/api/providers?${qs.toString()}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/api/providers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Provider created");
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["providers-min"] });
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
      api(`/api/providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Provider updated");
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["providers-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
    onSuccess: () => {
      toast.success("Provider archived");
      setArchiving(null);
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["providers-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Provider deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["providers-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: DataTableColumn<Provider>[] = [
    {
      key: "code",
      header: "Provider",
      width: 220,
      minWidth: 150,
      maxWidth: 320,
      cell: (p) => (
        <div>
          <div className="font-medium">{p.code}</div>
          <div className="text-[11px] text-muted-foreground">{p.name}</div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      width: 160,
      minWidth: 120,
      maxWidth: 230,
      cell: (p) => (
        <span className="text-sm">{p.contactPerson ?? "—"}</span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      width: 140,
      minWidth: 110,
      maxWidth: 180,
      cell: (p) => (
        <span className="text-sm tabular-nums">{p.phone ?? "—"}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      width: 190,
      minWidth: 140,
      maxWidth: 270,
      cell: (p) => (
        <span className="text-sm">{p.email ?? "—"}</span>
      ),
    },
    {
      key: "plans",
      header: "Plans",
      width: 90,
      minWidth: 70,
      maxWidth: 120,
      cell: (p) => (
        <span className="text-sm tabular-nums">{p.plansCount}</span>
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
      width: 90,
      minWidth: 80,
      maxWidth: 110,
      resizable: false,
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(p);
              setDialogOpen(true);
            }}
            aria-label="Edit provider"
          >
            <Pencil className="size-4" />
          </Button>
          {p.status === "ACTIVE" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => {
                e.stopPropagation();
                setArchiving(p);
              }}
              aria-label="Archive provider"
              title="Archive"
            >
              <Archive className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-rose-600 hover:text-rose-700"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(p);
            }}
            aria-label="Delete provider"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Providers"
        description="Internet service providers. Each provider offers catalog plans and is referenced by installed services."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New provider
          </Button>
        }
      />

      <DataTable
        storageKey="providers"
        columns={columns}
        rows={providers}
        rowKey={(p) => p.id}
        loading={isLoading}
        emptyMessage="No providers match your filters."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search providers...",
        }}
        toolbar={
          <FilterSelect
            value={statusFilter as "ACTIVE" | "INACTIVE" | "ALL"}
            onChange={(v) => setStatusFilter(v as string)}
            options={STATUS_OPTS.map((s) => ({
              value: s.value,
              label: s.label,
            }))}
            placeholder="Status"
          />
        }
      />

      <ProviderForm
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        onSubmit={async (data) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
      />

      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(v) => !v && setArchiving(null)}
        title="Archive provider"
        description={
          archiving
            ? `Archive "${archiving.code} — ${archiving.name}"? It will be marked inactive but kept in history.`
            : ""
        }
        confirmText="Archive"
        loading={archiveMutation.isPending}
        onConfirm={() =>
          archiving && archiveMutation.mutateAsync(archiving.id)
        }
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete provider"
        description={
          deleting
            ? `Permanently delete "${deleting.code} — ${deleting.name}"? Only providers with no plans or services can be deleted; archive otherwise.`
            : ""
        }
        confirmText="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleting && deleteMutation.mutateAsync(deleting.id)
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------

function ProviderForm({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Provider | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setCode(editing.code);
      setName(editing.name);
      setContactPerson(editing.contactPerson ?? "");
      setPhone(editing.phone ?? "");
      setEmail(editing.email ?? "");
      setWebsite(editing.website ?? "");
      setStatus(editing.status);
      setNotes(editing.notes ?? "");
    } else {
      setCode(`ISP-${Math.floor(100 + Math.random() * 900)}`);
      setName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setWebsite("");
      setStatus("ACTIVE");
      setNotes("");
    }
    setError(null);
  }, [open, editing]);

  const isFormValid = Boolean(code?.trim() && name?.trim());

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!code.trim()) return setError("Provider code is required");
    if (!name.trim()) return setError("Provider name is required");
    const payload: Record<string, unknown> = {
      code: code.trim(),
      name: name.trim(),
      contactPerson: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      website: website.trim() || null,
      status,
      notes: notes.trim() || null,
    };
    await onSubmit(payload);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit provider ${editing?.code}` : "New provider"}
      description="An Internet service provider. Catalog plans are defined per provider; installed services reference the provider."
      submitText={isEdit ? "Save changes" : "Create provider"}
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
          <Field label="Code" required>
            <Input isCode value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Contact person">
            <Input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Website">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
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
        <Field label="Notes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
    </FormDialog>
  );
}
