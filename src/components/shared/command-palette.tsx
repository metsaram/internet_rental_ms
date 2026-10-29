"use client";

import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Building2,
  Store,
  Wifi,
  Package,
  Network,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  Sun,
  Moon,
  LogOut,
  Plus,
  RefreshCw,
  Upload,
  Bell,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { clearIdleTimeoutStorage } from "@/lib/idle-timeout-config";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Navigate" },
  { key: "services", label: "Internet Services", icon: Network, group: "Navigate" },
  { key: "contracts", label: "Contracts", icon: FileText, group: "Navigate" },
  { key: "invoices", label: "Invoices & Payments", icon: Receipt, group: "Navigate" },
  { key: "renewals", label: "Contract Renewals", icon: RefreshCw, group: "Navigate" },
  { key: "import", label: "Excel Import", icon: Upload, group: "Navigate" },
  { key: "providers", label: "Providers", icon: Wifi, group: "Navigate" },
  { key: "plans", label: "Plans", icon: Package, group: "Navigate" },
  { key: "branches", label: "Branches", icon: Building2, group: "Navigate" },
  { key: "shops", label: "Shops", icon: Store, group: "Navigate" },
  { key: "notifications", label: "Notifications", icon: Bell, group: "Navigate" },
  // Temporarily disabled until MikroTik API integration is implemented
  // { key: "outages", label: "Outages", icon: Zap, group: "Navigate" },
  { key: "reports", label: "Reports", icon: BarChart3, group: "Navigate" },
  { key: "settings", label: "Settings", icon: Settings, group: "Navigate" },
];

const QUICK = [
  { key: "invoices", label: "Create a new invoice", icon: Plus, group: "Quick actions", hash: "invoices" },
  { key: "contracts", label: "Create a new contract", icon: Plus, group: "Quick actions", hash: "contracts" },
  { key: "services", label: "Add an internet service", icon: Plus, group: "Quick actions", hash: "services" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [recent, setRecent] = React.useState<string[]>([]);

  // Load recently-viewed from localStorage on mount + when the palette opens.
  React.useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem("netrent-recent-views") ?? "[]";
      const arr = JSON.parse(raw) as string[];
      setRecent(Array.isArray(arr) ? arr.slice(0, 5) : []);
    } catch {
      setRecent([]);
    }
  }, [open]);

  // Track the current view whenever the hash changes (user navigated via any
  // means — sidebar, bottom nav, command palette, or browser back/forward).
  React.useEffect(() => {
    const track = () => {
      const h = window.location.hash.replace("#", "");
      if (!h) return;
      try {
        const raw = localStorage.getItem("netrent-recent-views") ?? "[]";
        const arr = JSON.parse(raw) as string[];
        const next = [h, ...arr.filter((x) => x !== h)].slice(0, 5);
        localStorage.setItem("netrent-recent-views", JSON.stringify(next));
      } catch {
        // localStorage may be unavailable
      }
    };
    // Track the initial view on mount.
    track();
    window.addEventListener("hashchange", track);
    return () => window.removeEventListener("hashchange", track);
  }, []);

  const go = (hash: string) => {
    window.location.assign(`#${hash}`);
    onOpenChange(false);
  };

  const recentItems = recent
    .map((key) => NAV_ITEMS.find((n) => n.key === key))
    .filter(Boolean) as typeof NAV_ITEMS;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search views, jump to a section, or run an action..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {recentItems.length > 0 && (
          <>
            <CommandGroup heading="Recently viewed">
              {recentItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.key}
                    value={`recent ${item.label} ${item.key}`}
                    onSelect={() => go(item.key)}
                    className="gap-2"
                  >
                    <Icon className="size-4 text-primary" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.key}
                value={`${item.label} ${item.key}`}
                onSelect={() => go(item.key)}
                className="gap-2"
              >
                <Icon className="size-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          {QUICK.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.label}
                value={item.label}
                onSelect={() => go(item.hash!)}
                className="gap-2"
              >
                <Icon className="size-4 text-primary" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem
            value="toggle dark light theme"
            onSelect={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              onOpenChange(false);
            }}
            className="gap-2"
          >
            {theme === "dark" ? (
              <Sun className="size-4 text-amber-500" />
            ) : (
              <Moon className="size-4 text-indigo-400" />
            )}
            <span>Toggle {theme === "dark" ? "light" : "dark"} mode</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            value="sign out logout"
            onSelect={async () => {
              onOpenChange(false);
              clearIdleTimeoutStorage();
              await signOut({ redirect: false });
              //toast.success("Signed out");
            }}
            className="gap-2 text-rose-600"
          >
            <LogOut className="size-4" />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Hook that wires the global Cmd/Ctrl+K shortcut. Returns open state + setter. */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return [open, setOpen] as const;
}
