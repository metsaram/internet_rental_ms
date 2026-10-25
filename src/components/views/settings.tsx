"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Building2, ShieldCheck, UserCircle2, Save, Lock, Bell, Clock, Database, FileCheck, Activity, Plus, CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { FormDialog } from "@/components/shared/form-dialog";
import { toast } from "sonner";

type Company = {
  id: string;
  code: string;
  name: string;
  taxId: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  status: string;
};

export function SettingsView() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ["company"],
    queryFn: () => api<Company>("/api/company"),
  });

  const [form, setForm] = React.useState<Company | null>(null);
  React.useEffect(() => {
    if (company) setForm(company);
  }, [company]);

  const saving = React.useRef(false);
  const [savingState, setSavingState] = React.useState(false);

  const save = async () => {
    if (!form) return;
    setSavingState(true);
    saving.current = true;
    try {
      await api("/api/company", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          taxId: form.taxId,
          address: form.address,
          city: form.city,
          phone: form.phone,
          email: form.email,
          currency: form.currency,
        }),
      });
      toast.success("Company profile saved");
      qc.invalidateQueries({ queryKey: ["company"] });
      // The session token still holds the old currency/name; reload to refresh.
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingState(false);
      saving.current = false;
    }
  };

  const user = session?.user as
    | { name?: string | null; email?: string | null; role?: string }
    | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Company profile, currency, and your account."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-primary" />
                Company profile
              </CardTitle>
              <CardDescription className="text-xs">
                {isAdmin
                  ? "You can edit this profile as an admin."
                  : "Read-only — ask an admin to make changes."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading || !form ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Company code</Label>
                      <Input value={form.code} disabled className="bg-muted/40 font-mono" />
                      <p className="text-[11px] text-muted-foreground">
                        Codes are immutable and used to scope records.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Company name</Label>
                      <Input
                        value={form.name}
                        disabled={!isAdmin}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tax ID</Label>
                      <Input
                        value={form.taxId ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Currency</Label>
                      <Input
                        value={form.currency}
                        maxLength={3}
                        disabled={!isAdmin}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            currency: e.target.value.toUpperCase(),
                          })
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Default currency for new contracts &amp; invoices.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Address</Label>
                    <Textarea
                      rows={2}
                      value={form.address ?? ""}
                      disabled={!isAdmin}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">City</Label>
                      <Input
                        value={form.city ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone</Label>
                      <Input
                        value={form.phone ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={form.email ?? ""}
                        disabled={!isAdmin}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex justify-end">
                      <Button onClick={save} disabled={savingState}>
                        <Save className="size-4" />
                        {savingState ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCircle2 className="size-4 text-primary" />
                Your account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Name" value={user?.name ?? "—"} />
              <Row label="Email" value={user?.email ?? "—"} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Role</span>
                <Badge variant="outline" className="capitalize">
                  <ShieldCheck className="mr-1 size-3 text-primary" />
                  {user?.role ?? "STAFF"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-primary" />
                Security &amp; system
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <SecRow icon={Lock} label="Auth" value="NextAuth JWT · scrypt-hashed passwords" />
              <SecRow icon={ShieldCheck} label="Tenant isolation" value="Company-scoped queries" />
              <SecRow icon={Clock} label="Rate limiting" value="10 auth attempts / min per email" />
              <SecRow icon={FileCheck} label="Security headers" value="CSP · X-Frame-Options · HSTS" />
              <SecRow icon={Bell} label="Notifications" value="Renewal + invoice thresholds (30d/7d)" />
              {/* <SecRow icon={Database} label="Storage" value="Decimal money · opaque file keys" /> */}
              <SecRow icon={Activity} label="Audit log" value="All mutations logged + redacted" />
              {/* <div className="border-t pt-2 text-[11px] text-muted-foreground">
                <p>
                  Single-tenant architecture. Money uses <code>Decimal</code>
                  precision; ISP credentials are stored server-side and
                  redacted in lists, exports, and audit logs.
                </p>
              </div> */}
            </CardContent>
          </Card>

          {/* <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bell className="size-4 text-primary" />
                Toast Notifications (Sonner)
              </CardTitle>
              <CardDescription className="text-xs">
                Preview toasts with theme styling, action buttons, and responsive layout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="toast-success-btn"
                  className="text-xs justify-start gap-1.5 h-8"
                  onClick={() =>
                    toast.success("Contract renewed successfully", {
                      description: "CNT-2026-004 extended for 12 months.",
                    })
                  }
                >
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Success
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="toast-error-btn"
                  className="text-xs justify-start gap-1.5 h-8"
                  onClick={() =>
                    toast.error("Payment failed", {
                      description: "Transaction #TX-9021 declined.",
                    })
                  }
                >
                  <AlertCircle className="size-3.5 text-destructive" />
                  Error
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="toast-warning-btn"
                  className="text-xs justify-start gap-1.5 h-8"
                  onClick={() =>
                    toast.warning("Service outage warning", {
                      description: "4 shops in Sector 7 experiencing high latency.",
                    })
                  }
                >
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  Warning
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="toast-info-btn"
                  className="text-xs justify-start gap-1.5 h-8"
                  onClick={() =>
                    toast.info("Invoice generated", {
                      description: "INV-2026-088 ready for review.",
                    })
                  }
                >
                  <Info className="size-3.5 text-blue-500" />
                  Info
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                data-testid="toast-action-btn"
                className="w-full text-xs justify-start gap-1.5 h-8"
                onClick={() =>
                  toast("Contract archived", {
                    description: "You can restore this contract anytime.",
                    action: {
                      label: "Undo",
                      onClick: () => toast.success("Contract restored!"),
                    },
                  })
                }
              >
                <Sparkles className="size-3.5 text-primary" />
                Toast with Action
              </Button>
            </CardContent>
          </Card> */}
        </div>
      </div>

      {/* User management (admin only) */}
      {isAdmin && <UsersSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users management section (admin only)
// ---------------------------------------------------------------------------

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  activityCount: number;
};

function UsersSection() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [resetFor, setResetFor] = React.useState<UserRow | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => api<UserRow[]>("/api/users"),
  });

  const toggleStatus = async (u: UserRow) => {
    const next = u.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await api(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(`${u.email} ${next === "ACTIVE" ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setRole = async (u: UserRow, role: string) => {
    try {
      await api(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      toast.success(`${u.email} is now ${role}`);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="size-4 text-primary" />
            User management
          </CardTitle>
          <CardDescription className="text-xs">
            Create staff accounts, reset passwords, and manage roles. Users are scoped to your company.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Add user
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No users yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">User</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Activity</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Created</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{u.name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Select value={u.role} onValueChange={(v) => setRole(u, v)}>
                        <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN" className="text-xs">Admin</SelectItem>
                          <SelectItem value="STAFF" className="text-xs">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{u.activityCount}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={u.status === "ACTIVE" ? "border-emerald-500/30 text-emerald-600" : "text-muted-foreground"}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setResetFor(u)}>
                          Reset password
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleStatus(u)}
                        >
                          {u.status === "ACTIVE" ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <CreateUserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })}
      />
      <ResetPasswordDialog
        user={resetFor}
        onClose={() => setResetFor(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["users"] })}
      />
    </Card>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("STAFF");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) { setEmail(""); setName(""); setPassword(""); setRole("STAFF"); setError(null); }
  }, [open]);

  const isFormValid = Boolean(email.trim() && name.trim() && password && password.length >= 8);

  const submit = async () => {
    setError(null);
    if (!isFormValid) return;
    if (!email.trim() || !name.trim() || password.length < 8) {
      setError("Email, name, and an 8+ char password are required");
      return;
    }
    setSaving(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), name: name.trim(), password, role }),
      });
      toast.success("User created");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add user"
      description="Create a new account scoped to your company."
      submitText="Create user"
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
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </Field>
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Password" required hint="Minimum 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="STAFF">Staff — operational access</SelectItem>
              <SelectItem value="ADMIN">Admin — full access + user management</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {saving && <p className="text-xs text-muted-foreground">Creating…</p>}
      </div>
    </FormDialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: UserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { setPassword(""); setError(null); }, [user]);

  const isFormValid = Boolean(password && password.length >= 8);

  const submit = async () => {
    if (!user || !isFormValid) return;
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      toast.success(`Password reset for ${user.email}`);
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      open={!!user}
      onOpenChange={(v) => !v && onClose()}
      title={`Reset password — ${user?.email ?? ""}`}
      description="Set a new password for this account."
      submitText="Reset password"
      submitDisabled={!isFormValid}
      onSubmit={submit}
      size="sm"
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}
        <Field label="New password" required hint="Minimum 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {saving && <p className="text-xs text-muted-foreground">Resetting…</p>}
      </div>
    </FormDialog>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}{required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium truncate">{value}</span>
    </div>
  );
}

function SecRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <Icon className="size-3.5 shrink-0 text-primary" />
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
