"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";

type Branch = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  manager: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  shopsCount: number;
  servicesCount: number;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

const FORM_STATUS_OPTS = [...STATUS_OPTS] as const;

export function BranchesView() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Branch | null>(null);
  const [archiving, setArchiving] = React.useState<Branch | null>(null);
  const [deleting, setDeleting] = React.useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ["branches", search, statusFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      return api<Branch[]>(`/api/branches?${qs.toString()}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/api/branches", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Branch created");
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api(`/api/branches/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Branch updated");
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/branches/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
    onSuccess: () => {
      toast.success("Branch archived");
      setArchiving(null);
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/branches/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Branch deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: DataTableColumn<Branch>[] = [
    {
      key: "code",
      header: "Branch",
      width: 220,
      minWidth: 160,
      maxWidth: 320,
      cell: (b) => (
        <div>
          <div className="font-medium">{b.code}</div>
          <div className="text-[11px] text-muted-foreground">{b.name}</div>
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      width: 140,
      minWidth: 100,
      maxWidth: 200,
      cell: (b) => <span className="text-sm">{b.city ?? "—"}</span>,
    },
    {
      key: "manager",
      header: "Manager",
      width: 160,
      minWidth: 120,
      maxWidth: 240,
      cell: (b) => <span className="text-sm">{b.manager ?? "—"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      width: 140,
      minWidth: 110,
      maxWidth: 180,
      cell: (b) => (
        <span className="text-sm tabular-nums">{b.phone ?? "—"}</span>
      ),
    },
    {
      key: "shops",
      header: "Shops",
      width: 90,
      minWidth: 70,
      maxWidth: 120,
      cell: (b) => (
        <span className="text-sm tabular-nums">{b.shopsCount}</span>
      ),
    },
    {
      key: "services",
      header: "Services",
      width: 90,
      minWidth: 70,
      maxWidth: 120,
      cell: (b) => (
        <span className="text-sm tabular-nums">{b.servicesCount}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: 110,
      minWidth: 90,
      maxWidth: 140,
      cell: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      width: 100,
      minWidth: 80,
      maxWidth: 120,
      resizable: false,
      cell: (b) => (
        <ActionMenu
          actions={[
            {
              id: "edit",
              label: "Edit branch",
              icon: <Pencil className="size-4" />,
              isPrimary: true,
              priority: 1,
              onClick: () => {
                setEditing(b);
                setDialogOpen(true);
              },
            },
            ...(b.status === "ACTIVE"
              ? [
                  {
                    id: "archive",
                    label: "Archive branch",
                    icon: <Archive className="size-4" />,
                    priority: 2,
                    onClick: () => setArchiving(b),
                  },
                ]
              : []),
            {
              id: "delete",
              label: "Delete branch",
              icon: <Trash2 className="size-4" />,
              variant: "destructive" as const,
              priority: 3,
              onClick: () => setDeleting(b),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Branches"
        description="Company branches and locations. Each branch can host shops and internet services."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New branch
          </Button>
        }
      />

      <DataTable
        storageKey="branches"
        columns={columns}
        rows={branches}
        rowKey={(b) => b.id}
        loading={isLoading}
        emptyMessage="No branches match your filters."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search branches...",
        }}
        toolbar={
          <FilterSelect
            value={statusFilter as "ACTIVE" | "INACTIVE" | "ALL"}
            onChange={(v) => setStatusFilter(v as string)}
            options={STATUS_OPTS.map((s) => ({ value: s.value, label: s.label }))}
            placeholder="Status"
          />
        }
      />

      <BranchForm
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
        title="Archive branch"
        description={
          archiving
            ? `Archive "${archiving.code} — ${archiving.name}"? It will be marked inactive but kept in history.`
            : ""
        }
        confirmText="Archive"
        loading={archiveMutation.isPending}
        onConfirm={() => archiving && archiveMutation.mutateAsync(archiving.id)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete branch"
        description={
          deleting
            ? `Permanently delete "${deleting.code} — ${deleting.name}"? Only branches with no shops or services can be deleted; archive otherwise.`
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

function BranchForm({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Branch | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [manager, setManager] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setCode(editing.code);
      setName(editing.name);
      setAddress(editing.address ?? "");
      setCity(editing.city ?? "");
      setManager(editing.manager ?? "");
      setPhone(editing.phone ?? "");
      setEmail(editing.email ?? "");
      setStatus(editing.status);
    } else {
      setCode(`BR-${Math.floor(100 + Math.random() * 900)}`);
      setName("");
      setAddress("");
      setCity("");
      setManager("");
      setPhone("");
      setEmail("");
      setStatus("ACTIVE");
    }
    setError(null);
  }, [open, editing]);

  const isFormValid = Boolean(code?.trim() && name?.trim());

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!code.trim()) return setError("Branch code is required");
    if (!name.trim()) return setError("Branch name is required");
    const payload: Record<string, unknown> = {
      code: code.trim(),
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
      manager: manager.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      status,
    };
    await onSubmit(payload);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit branch ${editing?.code}` : "New branch"}
      description="A branch is a physical location. Branches host shops and internet services."
      submitText={isEdit ? "Save changes" : "Create branch"}
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
          <Field label="Code" htmlFor="branch-code" required>
            <Input id="branch-code" isCode value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Name" htmlFor="branch-name" required>
            <Input id="branch-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Field label="Address" htmlFor="branch-address">
          <Input id="branch-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="City" htmlFor="branch-city">
            <Input id="branch-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Manager" htmlFor="branch-manager">
            <Input
              id="branch-manager"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="branch-phone">
            <Input id="branch-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="branch-email">
            <Input
              id="branch-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
      </div>
    </FormDialog>
  );
}
