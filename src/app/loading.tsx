import { Loader2 } from "lucide-react";

/**
 * Phase 17 — Root loading state.
 * Shown by Next.js while the root route's server components are loading.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading NetRent…</p>
      </div>
    </div>
  );
}
