"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Phase 17 — Global error boundary for the root route.
 *
 * Next.js automatically renders the nearest `error.tsx` when a server or
 * client component throws. This gives the user a graceful recovery path
 * (reload or go to dashboard) instead of a raw stack trace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // In production this would go to an error-tracking service.
    console.error("[NetRent] unhandled route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-500/10">
          <AlertTriangle className="size-7 text-rose-500" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. Try
            reloading — your data is safe.
          </p>
        </div>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground/60">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <Button onClick={() => reset()} variant="outline">
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button onClick={() => { window.location.hash = "dashboard"; window.location.reload(); }}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
