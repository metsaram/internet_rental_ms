"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Store,
  Wifi,
  Package,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  Network,
  ShieldCheck,
  Receipt,
  Search,
  RefreshCw,
  Upload,
  Bell,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { CommandPalette } from "@/components/shared/command-palette";
import { ShortcutsHelp, useShortcutsHelp } from "@/components/shared/shortcuts-help";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { IdleTimeoutModal } from "@/components/shared/idle-timeout-modal";
import { clearIdleTimeoutStorage } from "@/lib/idle-timeout-config";

export type ViewKey =
  | "dashboard"
  | "branches"
  | "shops"
  | "providers"
  | "plans"
  | "services"
  | "contracts"
  | "invoices"
  | "renewals"
  | "import"
  | "notifications"
  | "outages"
  | "reports"
  | "settings";

const NAV: Array<{
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}> = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
    { key: "branches", label: "Branches", icon: Building2, group: "Organization" },
    { key: "shops", label: "Shops", icon: Store, group: "Organization" },
    { key: "providers", label: "Providers", icon: Wifi, group: "Catalog" },
    { key: "plans", label: "Plans", icon: Package, group: "Catalog" },
    { key: "services", label: "Internet Services", icon: Network, group: "Operations" },
    { key: "contracts", label: "Contracts", icon: FileText, group: "Operations" },
    { key: "invoices", label: "Invoices & Payments", icon: Receipt, group: "Operations" },
    { key: "renewals", label: "Renewals", icon: RefreshCw, group: "Operations" },
    { key: "import", label: "Excel Import", icon: Upload, group: "Operations" },
    { key: "notifications", label: "Notifications", icon: Bell, group: "Insights" },
    { key: "outages", label: "Outages", icon: Zap, group: "Insights" },
    { key: "reports", label: "Reports", icon: BarChart3, group: "Insights" },
    { key: "settings", label: "Settings", icon: Settings, group: "Insights" },
  ];

function useHashView(): [ViewKey, (v: ViewKey) => void] {
  const [view, setView] = React.useState<ViewKey>("dashboard");
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    const apply = () => {
      const raw = window.location.hash.replace("#", "");
      const h = raw.split("?")[0] as ViewKey;
      const valid = NAV.map((n) => n.key);
      if (h && valid.includes(h)) setView(h);
      else setView("dashboard");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const navigate = React.useCallback(
    (v: ViewKey) => {
      if (pathname !== "/") {
        router.push(`/#${v}`);
        return;
      }
      window.location.hash = v;
      setView(v);
    },
    [pathname, router]
  );

  return [view, navigate];
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [view, navigate] = useHashView();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useShortcutsHelp();
  const {
    isWarningOpen,
    remainingSeconds,
    idleTimeMs,
    warningTimeMs,
    resetIdleTimer,
    logoutNow,
  } = useIdleTimeout({
    enabled: status === "authenticated",
  });

  // Poll notifications unread count for the header bell badge.
  const { data: notifData } = useQuery<{ unreadCount: number }>({
    queryKey: ["notifications-unread-count"],
    queryFn: () => api<{ unreadCount: number }>("/api/notifications?unreadOnly=true"),
    refetchInterval: 30_000,
  });
  const unreadCount = notifData?.unreadCount ?? 0;
  React.useEffect(() => setMounted(true), []);

  // Global Cmd/Ctrl+K shortcut for the command palette.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const user = session?.user as
    | {
      name?: string | null;
      email?: string | null;
      role?: string;
      companyName?: string;
      companyCode?: string;
    }
    | undefined;

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof NAV>();
    for (const item of NAV) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <SidebarBrand />
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {grouped.map(([group, items]) => (
            <div key={group} className="space-y-1">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group}
              </p>
              {items.map((item) => {
                const active = view === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <SidebarFooter user={user} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full h-dvh w-72 max-w-[85%] bg-sidebar text-sidebar-foreground flex flex-col shadow-xl">
            <SidebarBrand onClose={() => setMobileOpen(false)} />
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              {grouped.map(([group, items]) => (
                <div key={group} className="space-y-1">
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {group}
                  </p>
                  {items.map((item) => {
                    const active = view === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          navigate(item.key);
                          setMobileOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-all",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <SidebarFooter user={user} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 backdrop-blur lg:px-6"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            minHeight: "calc(3.5rem + env(safe-area-inset-top, 0px))",
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">NetRent</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium text-foreground capitalize">
              {NAV.find((n) => n.key === view)?.label ?? "Dashboard"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-8 gap-2 px-2.5 text-xs text-muted-foreground sm:flex"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
            >
              <Search className="size-3.5" />
              <span className="hidden md:inline">Quick switch</span>
              <kbd className="ml-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 sm:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
            >
              <Search className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9"
              onClick={() => navigate("notifications")}
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )
              ) : (
                <div className="size-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border bg-card px-2 py-1 pr-3 text-sm hover:bg-accent transition">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                      {initials(user?.name ?? user?.email ?? "U")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-xs font-medium">
                      {user?.name ?? "User"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {user?.email}
                    </span>
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <span className="capitalize">{user?.role ?? "STAFF"}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {user?.companyCode}
                  </Badge>
                </DropdownMenuLabel>
                <div className="px-2 pb-1.5 text-[11px] text-muted-foreground">
                  {user?.companyName}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    navigate("settings");
                  }}
                >
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    navigate("reports");
                  }}
                >
                  <BarChart3 className="size-4" />
                  Reports
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    clearIdleTimeoutStorage();
                    await signOut({ redirect: false });
                    //toast.success("Signed out");
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>

        <footer className="hidden lg:block mt-auto border-t bg-background/80 px-4 py-4 text-center text-xs text-muted-foreground lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 sm:flex-row">
            <span>
              © {new Date().getFullYear()} NetRent · Internet Rental Management
              System
            </span>
            <span className="text-muted-foreground/70">
              Demo build · scoped to {user?.companyCode ?? "—"} · press{" "}
              <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>{" "}
              to navigate
            </span>
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav
        active={view}
        onNavigate={(v) => navigate(v)}
        onMore={() => setMobileOpen(true)}
      />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <IdleTimeoutModal
        open={isWarningOpen}
        remainingSeconds={remainingSeconds}
        idleTimeMs={idleTimeMs}
        warningTimeMs={warningTimeMs}
        onStaySignedIn={resetIdleTimer}
        onLogoutNow={logoutNow}
      />
    </div>
  );
}

function SidebarBrand({ onClose }: { onClose?: () => void }) {
  return (
    <div
      className="flex items-center gap-2 border-b px-5 py-4"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left, 0px))",
      }}
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Network className="size-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold leading-tight">NetRent</p>
        <p className="text-[11px] text-muted-foreground">Rental Manager</p>
      </div>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          ✕
        </Button>
      )}
    </div>
  );
}

function SidebarFooter({
  user,
}: {
  user?: { companyName?: string; companyCode?: string; role?: string };
}) {
  return (
    <div
      className="border-t px-3 py-3"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
      }}
    >
      <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/60 px-2.5 py-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary text-[10px] font-bold">
          {user?.companyCode?.slice(0, 2) ?? "AC"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium">
            {user?.companyName ?? "Company"}
          </p>
          <p className="text-[10px] text-muted-foreground capitalize">
            {user?.role ?? "staff"} access
          </p>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
