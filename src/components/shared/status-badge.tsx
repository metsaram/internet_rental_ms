"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tone = "green" | "amber" | "red" | "slate" | "violet" | "blue";

const toneMap: Record<Tone, string> = {
  green:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20",
  amber:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20",
  red: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20",
  slate:
    "bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/20",
  violet:
    "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 ring-1 ring-fuchsia-500/20",
  blue: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/20",
};

const labelMap: Record<string, Tone> = {
  ACTIVE: "green",
  INACTIVE: "slate",
  PENDING: "amber",
  SUSPENDED: "amber",
  TERMINATED: "red",
  DRAFT: "slate",
  EXPIRED: "red",
  RENEWED: "violet",
  COMPLETED: "green",
  FAILED: "red",
  PREVIEW: "amber",
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone?: Tone;
  className?: string;
}) {
  const t = tone ?? labelMap[status] ?? "slate";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize tracking-wide",
        toneMap[t],
        className
      )}
    >
      {status.toLowerCase()}
    </Badge>
  );
}
