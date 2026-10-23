"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  IDLE_TIMEOUT_CONFIG,
  IDLE_STORAGE_KEY,
  resetIdleTimeoutStorage,
  clearIdleTimeoutStorage,
  formatDurationMs,
  formatTimerSeconds,
} from "@/lib/idle-timeout-config";

export interface UseIdleTimeoutOptions {
  /** Total idle time in milliseconds before logout (defaults to IDLE_TIMEOUT_CONFIG.idleTimeMs) */
  idleTimeMs?: number;
  /** Warning threshold in milliseconds before logout (defaults to IDLE_TIMEOUT_CONFIG.warningTimeMs) */
  warningTimeMs?: number;
  /** Custom onTimeout handler (defaults to signOut with notification) */
  onTimeout?: () => void | Promise<void>;
  /** Whether the idle timer is enabled (e.g. only when authenticated) */
  enabled?: boolean;
}

/**
 * Custom hook tracking user inactivity across tabs.
 * Displays a warning when approaching timeout and automatically logs out upon expiration.
 * Reads defaults from centralized `IDLE_TIMEOUT_CONFIG`.
 */
export function useIdleTimeout({
  idleTimeMs = IDLE_TIMEOUT_CONFIG.idleTimeMs,
  warningTimeMs = IDLE_TIMEOUT_CONFIG.warningTimeMs,
  onTimeout,
  enabled = true,
}: UseIdleTimeoutOptions = {}) {
  const [isWarningOpen, setIsWarningOpen] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState(
    Math.round(warningTimeMs / 1000)
  );

  const lastActiveRef = React.useRef<number>(Date.now());
  const isTimedOutRef = React.useRef(false);
  const isWarningOpenRef = React.useRef(false);
  const onTimeoutRef = React.useRef(onTimeout);

  React.useEffect(() => {
    isWarningOpenRef.current = isWarningOpen;
  }, [isWarningOpen]);

  React.useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Default logout handler
  const handleTimeout = React.useCallback(async () => {
    if (isTimedOutRef.current) return;
    isTimedOutRef.current = true;
    setIsWarningOpen(false);

    // Clear stored timestamp so subsequent logins/sessions start clean
    clearIdleTimeoutStorage();

    if (onTimeoutRef.current) {
      await onTimeoutRef.current();
    } else {
      await signOut({ redirect: false });
      const idleLabel = formatDurationMs(idleTimeMs);
      toast.info(`Your session expired due to ${idleLabel} of inactivity.`, {
        duration: 8000,
      });
    }
  }, [idleTimeMs]);

  // Resets the activity timestamp and closes warning modal
  const resetIdleTimer = React.useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;
    isTimedOutRef.current = false;
    resetIdleTimeoutStorage();
    setIsWarningOpen(false);
    setRemainingSeconds(Math.round(warningTimeMs / 1000));
  }, [warningTimeMs]);

  // Immediate logout trigger from warning modal
  const logoutNow = React.useCallback(async () => {
    setIsWarningOpen(false);
    clearIdleTimeoutStorage();
    await handleTimeout();
  }, [handleTimeout]);

  // Activity listeners with throttle (1000ms)
  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Reset timeout and warning flags on fresh activation/mount
    isTimedOutRef.current = false;
    setIsWarningOpen(false);
    setRemainingSeconds(Math.round(warningTimeMs / 1000));

    // Initialize last active from localStorage if valid and fresh (< idleTimeMs), otherwise now
    const now = Date.now();
    try {
      const stored = localStorage.getItem(IDLE_STORAGE_KEY);
      if (stored) {
        const ts = Number(stored);
        if (!isNaN(ts) && ts > 0 && ts <= now && now - ts < idleTimeMs) {
          lastActiveRef.current = ts;
        } else {
          lastActiveRef.current = now;
          resetIdleTimeoutStorage();
        }
      } else {
        lastActiveRef.current = now;
        resetIdleTimeoutStorage();
      }
    } catch {
      lastActiveRef.current = now;
    }

    let lastThrottled = 0;
    const onUserActivity = () => {
      const currentTime = Date.now();
      if (currentTime - lastThrottled > 1000) {
        lastThrottled = currentTime;
        // Only reset if warning modal is not currently holding user attention
        if (!isWarningOpenRef.current && !isTimedOutRef.current) {
          lastActiveRef.current = currentTime;
          resetIdleTimeoutStorage();
        }
      }
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "pointerdown",
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Cross-tab synchronization
    const onStorage = (e: StorageEvent) => {
      if (e.key === IDLE_STORAGE_KEY && e.newValue) {
        const remoteTimestamp = Number(e.newValue);
        if (!isNaN(remoteTimestamp) && remoteTimestamp > lastActiveRef.current) {
          lastActiveRef.current = remoteTimestamp;
          isTimedOutRef.current = false;
          setIsWarningOpen(false);
        }
      }
    };
    window.addEventListener("storage", onStorage);

    // Ticking interval to evaluate elapsed idle time
    const interval = window.setInterval(() => {
      if (isTimedOutRef.current) return;

      // Check cross-tab latest active timestamp
      try {
        const stored = localStorage.getItem(IDLE_STORAGE_KEY);
        if (stored) {
          const ts = Number(stored);
          if (!isNaN(ts) && ts > lastActiveRef.current) {
            lastActiveRef.current = ts;
          }
        }
      } catch {
        // Ignore
      }

      const elapsed = Date.now() - lastActiveRef.current;
      const timeLeft = idleTimeMs - elapsed;

      if (timeLeft <= 0) {
        handleTimeout();
      } else if (timeLeft <= warningTimeMs) {
        setIsWarningOpen(true);
        setRemainingSeconds(Math.max(1, Math.ceil(timeLeft / 1000)));
      } else {
        setIsWarningOpen(false);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, onUserActivity);
      });
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [enabled, idleTimeMs, warningTimeMs, handleTimeout]);

  return {
    isWarningOpen,
    remainingSeconds,
    formattedRemaining: formatTimerSeconds(remainingSeconds),
    idleTimeMs,
    warningTimeMs,
    idleDurationText: formatDurationMs(idleTimeMs),
    warningDurationText: formatDurationMs(warningTimeMs),
    resetIdleTimer,
    logoutNow,
  };
}
