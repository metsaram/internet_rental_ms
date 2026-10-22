"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTimerSeconds, formatDurationMs } from "@/lib/idle-timeout-config";

export interface IdleTimeoutModalProps {
  open: boolean;
  remainingSeconds: number;
  idleTimeMs?: number;
  warningTimeMs?: number;
  onStaySignedIn: () => void;
  onLogoutNow: () => void;
}

/**
 * Warning Modal shown prior to automated session idle timeout.
 * Provides live countdown and option to extend session or sign out immediately.
 * Formats countdown dynamically based on actual configured warning time.
 */
export function IdleTimeoutModal({
  open,
  remainingSeconds,
  idleTimeMs,
  warningTimeMs,
  onStaySignedIn,
  onLogoutNow,
}: IdleTimeoutModalProps) {
  const formattedTime = formatTimerSeconds(remainingSeconds);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">
                Session Expiring Soon
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Inactivity detected
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-foreground">
            You have been inactive. For your security, your session will automatically end in:
          </p>
          <div className="flex items-center justify-center p-3 rounded-lg border bg-muted/40">
            <Badge
              variant="outline"
              className="text-lg font-mono font-semibold text-amber-600 dark:text-amber-400 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
            >
              {formattedTime}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Click <strong>Stay signed in</strong> to continue your current session.
          </p>
        </div>

        <AlertDialogFooter className="sm:justify-between gap-2">
          <AlertDialogCancel
            onClick={onLogoutNow}
            className="text-muted-foreground hover:text-foreground"
          >
            Log out now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onStaySignedIn}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Stay signed in
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
