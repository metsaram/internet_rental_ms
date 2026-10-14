"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

/** Decorative SVG illustration for empty states — a softer, more polished
 *  look than a plain icon. Each illustration is a simple line-art scene
 *  themed with the primary color. */
function EmptyIllustration({ kind }: { kind?: string }) {
  // A generic "empty box" illustration with a subtle floating animation.
  return (
    <svg
      width="120"
      height="80"
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-primary/60"
    >
      {/* ground line */}
      <line x1="20" y1="68" x2="100" y2="68" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
      {/* box body */}
      <rect x="38" y="38" width="44" height="30" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* box lid */}
      <path d="M34 38 L86 38 L82 30 L38 30 Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      {/* tape line */}
      <line x1="60" y1="30" x2="60" y2="68" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {/* sparkles */}
      <circle cx="92" cy="22" r="1.5" fill="currentColor" opacity="0.6" />
      <circle cx="28" cy="26" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="100" cy="40" r="1" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  illustration,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** If true, shows a decorative SVG illustration instead of the icon circle. */
  illustration?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-14 text-center",
        className
      )}
    >
      {illustration ? (
        <EmptyIllustration />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon ?? <Inbox className="size-5" />}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
