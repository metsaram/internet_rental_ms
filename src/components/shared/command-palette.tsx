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
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Navigate" },
  { key: "branches", label: "Branches", icon: Building2, group: "Navigate" },
  { key: "shops", label: "Shops", icon: Store, group: "Navigate" },
  { key: "providers", label: "Providers", icon: Wifi, group: "Navigate" },
  { key: "plans", label: "Plans", icon: Package, group: "Navigate" },
  { key: "services", label: "Internet Services", icon: Network, group: "Navigate" },
  { key: "contracts", label: "Contracts", icon: FileText, group: "Navigate" },
  { key: "invoices", label: "Invoices & Payments", icon: Receipt, group: "Navigate" },
  { key: "renewals", label: "Contract Renewals", icon: RefreshCw, group: "Navigate" },
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

  const go = (hash: string) => {
    // Use assign() rather than direct hash assignment (lint-friendly) and
    // keep the existing view if we're already on `/`.
    window.location.assign(`#${hash}`);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search views, jump to a section, or run an action..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
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
              await signOut({ redirect: false });
              toast.success("Signed out");
              setTimeout(() => window.location.reload(), 400);
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
