"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/views/login";
import { DashboardView } from "@/components/views/dashboard";
import { BranchesView } from "@/components/views/branches";
import { ShopsView } from "@/components/views/shops";
import { ProvidersView } from "@/components/views/providers";
import { PlansView } from "@/components/views/plans";
import { ServicesView } from "@/components/views/services";
import { ContractsView } from "@/components/views/contracts";
import { ReportsView } from "@/components/views/reports";
import { SettingsView } from "@/components/views/settings";
import type { ViewKey } from "@/components/app-shell";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const [view, setView] = React.useState<ViewKey>("dashboard");

  // Sync the active view with the URL hash so deep links / back button work.
  React.useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "") as ViewKey;
      const valid: ViewKey[] = [
        "dashboard",
        "branches",
        "shops",
        "providers",
        "plans",
        "services",
        "contracts",
        "reports",
        "settings",
      ];
      setView(valid.includes(h) ? h : "dashboard");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      {view === "dashboard" && <DashboardView />}
      {view === "branches" && <BranchesView />}
      {view === "shops" && <ShopsView />}
      {view === "providers" && <ProvidersView />}
      {view === "plans" && <PlansView />}
      {view === "services" && <ServicesView />}
      {view === "contracts" && <ContractsView />}
      {view === "reports" && <ReportsView />}
      {view === "settings" && <SettingsView />}
    </AppShell>
  );
}
