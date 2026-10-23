"use client";

import * as React from "react";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  RefreshCw,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewKey } from "@/components/app-shell";

/** The 5 primary views shown in the mobile bottom bar; the rest are accessible
 *  via the "More" button which opens the hamburger drawer. */
const PRIMARY: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "dashboard", label: "Home", icon: LayoutDashboard },
  { key: "contracts", label: "Contracts", icon: FileText },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "renewals", label: "Renewals", icon: RefreshCw },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

export function MobileBottomNav({
  active,
  onNavigate,
  onMore,
}: {
  active: ViewKey;
  onNavigate: (v: ViewKey) => void;
  onMore: () => void;
}) {
  // If the active view is one of the primary ones, highlight it; otherwise
  // highlight the "More" button.
  const isPrimary = PRIMARY.some((p) => p.key === active);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t bg-background/95 backdrop-blur lg:hidden"
      style={{
        paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      aria-label="Mobile navigation"
    >
      {PRIMARY.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors select-none touch-manipulation",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground active:text-foreground"
            )}
          >
            <Icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
            <span>{item.label}</span>
            {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
          </button>
        );
      })}
      {/* More button — opens the hamburger drawer for secondary views */}
      <button
        onClick={onMore}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors select-none touch-manipulation",
          !isPrimary ? "text-primary" : "text-muted-foreground hover:text-foreground active:text-foreground"
        )}
      >
        <MoreHorizontal className={cn("size-5", !isPrimary && "scale-110")} />
        <span>More</span>
      </button>
    </nav>
  );
}
