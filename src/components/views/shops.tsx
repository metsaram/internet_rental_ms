"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  Archive,
  MessageSquare,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Branch = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type Shop = {
  id: string;
  code: string;
  name: string;
  type: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  branchId: string;
  branch: { id: string; code: string; name: string };
  servicesCount: number;
  createdAt: string;
  updatedAt: string;
};

type ShopNote = {
  id: string;
  body: string;
  authorId: string;
  author: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
};

type ShopDetail = Shop & {
  notes: ShopNote[];
};

const STATUS_OPTS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

const TYPE_OPTS = [
  { value: "UNIT", label: "Unit" },
  { value: "KIOSK", label: "Kiosk" },
  { value: "OFFICE", label: "Office" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "OTHER", label: "Other" },
] as const;

export function ShopsView() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const currentUserRole = (session?.user as any)?.role as
    | "ADMIN"
    | "STAFF"
    | undefined;
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Shop | null>(null);
  const [detailShop, setDetailShop] = React.useState<Shop | null>(null);
  const [archiving, setArchiving] = React.useState<Shop | null>(null);
  const [deleting, setDeleting] = React.useState<Shop | null>(null);

  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["shops", search, statusFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      return api<Shop[]>(`/api/shops?${qs.toString()}`);
    },
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches-min"],
    queryFn: () => api<Branch[]>("/api/branches?min=true"),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/api/shops", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Shop created");
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["shops-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api(`/api/shops/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success("Shop updated");
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["shops-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/shops/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "INACTIVE" }),
      }),
    onSuccess: () => {
      toast.success("Shop archived");
      setArchiving(null);
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["shops-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/shops/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Shop deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["shops-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: DataTableColumn<Shop>[] = [
    {
      key: "code",
      header: "Shop",
      cell: (s) => (
        <div>
          <div className="font-medium">{s.code}</div>
          <div className="text-[11px] text-muted-foreground">{s.name}</div>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Branch",
      hideOnMobile: true,
      cell: (s) => (
        <div className="text-sm">
          <div>{s.branch?.name ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {s.branch?.code ?? "—"}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (s) => (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {s.type}
        </Badge>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      hideOnMobile: true,
      cell: (s) => (
        <span className="text-sm">{s.contactPerson ?? "—"}</span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      hideOnMobile: true,
      cell: (s) => (
        <span className="text-sm tabular-nums">{s.phone ?? "—"}</span>
      ),
    },
    {
      key: "services",
      header: "Services",
      hideOnMobile: true,
      cell: (s) => (
        <span className="text-sm tabular-nums">{s.servicesCount}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(s);
              setDialogOpen(true);
            }}
            aria-label="Edit shop"
          >
            <Pencil className="size-4" />
          </Button>
          {s.status === "ACTIVE" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => {
                e.stopPropagation();
                setArchiving(s);
              }}
              aria-label="Archive shop"
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
              setDeleting(s);
            }}
            aria-label="Delete shop"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  const canCreate = branches.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shops"
        description="Shops and units within your branches. Shops host installed services and operational notes."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={!canCreate}
          >
            <Plus className="size-4" />
            New shop
          </Button>
        }
      />

      {branches.length === 0 && !isLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          You need at least one branch before adding shops.{" "}
          <button
            className="font-medium underline"
            onClick={() => (window.location.hash = "branches")}
          >
            Go to branches →
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={shops}
        rowKey={(s) => s.id}
        loading={isLoading}
        onRowClick={(s) => setDetailShop(s)}
        emptyMessage="No shops match your filters."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search shops...",
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

      <ShopForm
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        branches={branches}
        onSubmit={async (data) => {
          if (editing) {
            await updateMutation.mutateAsync({ id: editing.id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
      />

      <ShopDetailSheet
        shop={detailShop}
        onClose={() => setDetailShop(null)}
        onEdit={(s) => {
          setDetailShop(null);
          setEditing(s);
          setDialogOpen(true);
        }}
        onDelete={(s) => {
          setDetailShop(null);
          setDeleting(s);
        }}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />

      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(v) => !v && setArchiving(null)}
        title="Archive shop"
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
        title="Delete shop"
        description={
          deleting
            ? `Permanently delete "${deleting.code} — ${deleting.name}"? Shops with services cannot be deleted; archive instead.`
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

function ShopForm({
  open,
  onOpenChange,
  editing,
  branches,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Shop | null;
  branches: Branch[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const isEdit = !!editing;
  const [branchId, setBranchId] = React.useState("");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("UNIT");
  const [contactPerson, setContactPerson] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setBranchId(editing.branchId);
      setCode(editing.code);
      setName(editing.name);
      setType(editing.type);
      setContactPerson(editing.contactPerson ?? "");
      setPhone(editing.phone ?? "");
      setEmail(editing.email ?? "");
      setAddress(editing.address ?? "");
      setStatus(editing.status);
    } else {
      setBranchId("");
      setCode(`SHOP-${Math.floor(100 + Math.random() * 900)}`);
      setName("");
      setType("UNIT");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setAddress("");
      setStatus("ACTIVE");
    }
    setError(null);
  }, [open, editing]);

  const submit = async () => {
    setError(null);
    if (!branchId) return setError("Select a branch");
    if (!code.trim()) return setError("Shop code is required");
    if (!name.trim()) return setError("Shop name is required");
    const payload: Record<string, unknown> = {
      branchId,
      code: code.trim(),
      name: name.trim(),
      type,
      contactPerson: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      status,
    };
    await onSubmit(payload);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit shop ${editing?.code}` : "New shop"}
      description="A shop is a unit located within a branch (e.g. tenant space, kiosk, office)."
      submitText={isEdit ? "Save changes" : "Create shop"}
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
          <Field label="Branch" required>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch..." />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
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
        <Field label="Address">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet with notes panel
// ---------------------------------------------------------------------------

function ShopDetailSheet({
  shop,
  onClose,
  onEdit,
  onDelete,
  currentUserId,
  currentUserRole,
}: {
  shop: Shop | null;
  onClose: () => void;
  onEdit: (s: Shop) => void;
  onDelete: (s: Shop) => void;
  currentUserId?: string;
  currentUserRole?: "ADMIN" | "STAFF";
}) {
  const qc = useQueryClient();
  const open = !!shop;
  const shopId = shop?.id;

  const { data: detail, isLoading } = useQuery<ShopDetail>({
    queryKey: shopId ? ["shop", shopId] : ["shop", "none"],
    queryFn: () => api<ShopDetail>(`/api/shops/${shopId}`),
    enabled: !!shopId,
  });

  const [noteBody, setNoteBody] = React.useState("");

  const addNoteMutation = useMutation({
    mutationFn: (body: string) =>
      api("/api/notes", {
        method: "POST",
        body: JSON.stringify({ shopId, body }),
      }),
    onSuccess: () => {
      setNoteBody("");
      toast.success("Note added");
      if (shopId) qc.invalidateQueries({ queryKey: ["shop", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Note deleted");
      if (shopId) qc.invalidateQueries({ queryKey: ["shop", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAddNote = () => {
    if (!shopId) return;
    if (!noteBody.trim()) return;
    addNoteMutation.mutate(noteBody.trim());
  };

  const notes = detail?.notes ?? [];
  const canDeleteNote = (n: ShopNote) =>
    currentUserRole === "ADMIN" || n.authorId === currentUserId;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Store className="size-4 text-primary" />
            {shop ? `${shop.code} — ${shop.name}` : ""}
          </SheetTitle>
          <SheetDescription>
            {shop ? `${shop.branch?.name ?? "—"} · ${shop.type}` : ""}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : detail ? (
          <div className="space-y-5 px-4 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <span className="text-[11px] text-muted-foreground">
                {detail.servicesCount} service(s) installed
              </span>
            </div>

            <DetailGrid
              rows={[
                ["Branch", detail.branch?.name ?? "—"],
                ["Type", detail.type],
                ["Contact", detail.contactPerson ?? "—"],
                ["Phone", detail.phone ?? "—"],
                ["Email", detail.email ?? "—"],
                ["Address", detail.address ?? "—"],
                ["Created", formatDate(detail.createdAt)],
              ]}
            />

            {/* Notes panel */}
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="size-4 text-primary" />
                Notes ({notes.length})
              </p>
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Add a note about this shop..."
                  disabled={addNoteMutation.isPending}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={
                      addNoteMutation.isPending || !noteBody.trim()
                    }
                  >
                    {addNoteMutation.isPending ? "Adding..." : "Add note"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No notes yet.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-md border bg-card p-2.5 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap break-words flex-1">
                          {n.body}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-rose-600 hover:text-rose-700"
                          disabled={!canDeleteNote(n) || deleteNoteMutation.isPending}
                          onClick={() => deleteNoteMutation.mutate(n.id)}
                          aria-label="Delete note"
                          title={
                            canDeleteNote(n)
                              ? "Delete note"
                              : "Only the author or an admin can delete this note"
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {n.author?.name ?? n.author?.email ?? "—"}
                        </span>
                        <span>{formatRelative(n.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <SheetFooter className="flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => shop && onEdit(shop)}
                className="flex-1"
              >
                <Pencil className="size-4" /> Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => shop && onDelete(shop)}
                className="text-rose-600 hover:text-rose-700"
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No data.
          </div>
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
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("text-sm")}>{value}</p>
        </div>
      ))}
    </div>
  );
}
