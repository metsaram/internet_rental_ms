"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Network, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DEMO = [
  {
    role: "Admin",
    email: "admin@netrent.local",
    password: "admin12345",
    desc: "Full access: manage branches, shops, providers, plans, services, contracts, settings.",
  },
  {
    role: "Staff",
    email: "staff@netrent.local",
    password: "staff12345",
    desc: "Operational access: browse and update day-to-day records.",
  },
];

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("admin@netrent.local");
  const [password, setPassword] = React.useState("admin12345");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const callbackUrl = params.get("callbackUrl") ?? "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (!res || res.error) {
        setError("Invalid email or password.");
        return;
      }
      toast.success("Welcome back!");
      router.refresh();
      setTimeout(() => window.location.reload(), 200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-emerald-100/40 dark:from-emerald-950/30 dark:via-background dark:to-emerald-900/20">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 size-[28rem] rounded-full bg-emerald-300/15 blur-3xl" />

      <div className="relative grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border bg-card/80 shadow-xl backdrop-blur md:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/15">
              <Network className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">NetRent</p>
              <p className="text-xs text-primary-foreground/70">
                Internet Rental Management
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold leading-tight">
              Every connection, every contract, in one place.
            </h2>
            <p className="text-sm text-primary-foreground/80">
              Track branches and shops, ISP providers and plans, installed
              services and contracts — with clear cost reconciliation and
              renewal alerts.
            </p>
            <ul className="space-y-2 text-sm text-primary-foreground/90">
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0" />
                Role-based access, company-scoped data
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0" />
                Decimal-precise contract cost math
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0" />
                Renewal & expiry warnings
              </li>
            </ul>
          </div>
          <p className="text-xs text-primary-foreground/60">
            © {new Date().getFullYear()} NetRent · Demo build
          </p>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              Use a demo account below or your own credentials.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Demo accounts
            </p>
            <div className="grid gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="group rounded-lg border bg-muted/30 px-3 py-2 text-left transition hover:border-primary/40 hover:bg-muted/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.role}</span>
                    <span className="text-[11px] text-muted-foreground group-hover:text-primary">
                      click to fill
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {d.email} · {d.password}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {d.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
