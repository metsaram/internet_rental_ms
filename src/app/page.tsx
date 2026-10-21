"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/views/login";
import { ViewTransition } from "@/components/shared/view-transition";
import type { ViewKey } from "@/components/app-shell";
import { Loader2 } from "lucide-react";

// Phase 19 polish — Lazy-load views for code-splitting.
// Each view is loaded on-demand only when the user navigates to it, reducing
// the initial bundle size. The Dashboard is eagerly loaded (default view).
const DashboardView = React.lazy(() =>
  import("@/components/views/dashboard").then((m) => ({ default: m.DashboardView }))
);
const BranchesView = React.lazy(() =>
  import("@/components/views/branches").then((m) => ({ default: m.BranchesView }))
);
const ShopsView = React.lazy(() =>
  import("@/components/views/shops").then((m) => ({ default: m.ShopsView }))
);
const ProvidersView = React.lazy(() =>
  import("@/components/views/providers").then((m) => ({ default: m.ProvidersView }))
);
const PlansView = React.lazy(() =>
  import("@/components/views/plans").then((m) => ({ default: m.PlansView }))
);
const ServicesView = React.lazy(() =>
  import("@/components/views/services").then((m) => ({ default: m.ServicesView }))
);
const ContractsView = React.lazy(() =>
  import("@/components/views/contracts").then((m) => ({ default: m.ContractsView }))
);
const InvoicesView = React.lazy(() =>
  import("@/components/views/invoices").then((m) => ({ default: m.InvoicesView }))
);
const RenewalsView = React.lazy(() =>
  import("@/components/views/renewals").then((m) => ({ default: m.RenewalsView }))
);
const ImportView = React.lazy(() =>
  import("@/components/views/import").then((m) => ({ default: m.ImportView }))
);
const NotificationsView = React.lazy(() =>
  import("@/components/views/notifications").then((m) => ({ default: m.NotificationsView }))
);
const OutagesView = React.lazy(() =>
  import("@/components/views/outages").then((m) => ({ default: m.OutagesView }))
);
const ReportsView = React.lazy(() =>
  import("@/components/views/reports").then((m) => ({ default: m.ReportsView }))
);
const SettingsView = React.lazy(() =>
  import("@/components/views/settings").then((m) => ({ default: m.SettingsView }))
);

const VALID_VIEWS: ViewKey[] = [
  "dashboard",
  "branches",
  "shops",
  "providers",
  "plans",
  "services",
  "contracts",
  "invoices",
  "renewals",
  "import",
  "notifications",
  "outages",
  "reports",
  "settings",
];

const VIEW_COMPONENTS: Record<ViewKey, React.LazyExoticComponent<React.ComponentType>> = {
  dashboard: DashboardView,
  branches: BranchesView,
  shops: ShopsView,
  providers: ProvidersView,
  plans: PlansView,
  services: ServicesView,
  contracts: ContractsView,
  invoices: InvoicesView,
  renewals: RenewalsView,
  import: ImportView,
  notifications: NotificationsView,
  outages: OutagesView,
  reports: ReportsView,
  settings: SettingsView,
};

function ViewLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [view, setView] = React.useState<ViewKey>("dashboard");

  // Sync the active view with the URL hash so deep links / back button work.
  React.useEffect(() => {
    const apply = () => {
      const raw = window.location.hash.replace("#", "");
      const h = raw.split("?")[0] as ViewKey;
      setView(VALID_VIEWS.includes(h) ? h : "dashboard");
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

  const ActiveView = VIEW_COMPONENTS[view] ?? DashboardView;

  return (
    <AppShell>
      <ViewTransition viewKey={view}>
        <React.Suspense fallback={<ViewLoader />}>
          <ActiveView />
        </React.Suspense>
      </ViewTransition>
    </AppShell>
  );
}
