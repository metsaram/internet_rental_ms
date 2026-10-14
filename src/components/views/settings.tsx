"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Building2, ShieldCheck, UserCircle2, Save, Lock, Bell, Clock, Database, FileCheck, Activity } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
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
              <SecRow icon={Database} label="Storage" value="Decimal money · opaque file keys" />
              <SecRow icon={Activity} label="Audit log" value="All mutations logged + redacted" />
              <div className="border-t pt-2 text-[11px] text-muted-foreground">
                <p>
                  Single-tenant demo covering Phases 00–17 of the
                  implementation plan. Money uses <code>Decimal</code>
                  precision; ISP credentials are stored server-side and
                  redacted in lists, exports, and audit logs.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
