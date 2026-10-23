"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 sm:gap-4 border-b pb-4",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <h1
          className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate"
          title={typeof title === "string" ? title : undefined}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="text-xs sm:text-sm text-muted-foreground truncate"
            title={typeof description === "string" ? description : undefined}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
