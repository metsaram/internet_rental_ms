"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  IDLE_TIMEOUT_CONFIG,
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

const STORAGE_KEY = "netrent_last_active_timestamp";

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
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {
      // Ignore storage access errors
    }
    setIsWarningOpen(false);
    setRemainingSeconds(Math.round(warningTimeMs / 1000));
  }, [warningTimeMs]);

  // Immediate logout trigger from warning modal
  const logoutNow = React.useCallback(async () => {
    setIsWarningOpen(false);
    await handleTimeout();
  }, [handleTimeout]);

  // Activity listeners with throttle (1000ms)
  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Initialize last active from localStorage if valid and fresh, otherwise now
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ts = Number(stored);
        if (!isNaN(ts) && ts > 0 && ts <= Date.now()) {
          lastActiveRef.current = ts;
        } else {
          lastActiveRef.current = Date.now();
          localStorage.setItem(STORAGE_KEY, lastActiveRef.current.toString());
        }
      } else {
        lastActiveRef.current = Date.now();
        localStorage.setItem(STORAGE_KEY, lastActiveRef.current.toString());
      }
    } catch {
      lastActiveRef.current = Date.now();
    }

    let lastThrottled = 0;
    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottled > 1000) {
        lastThrottled = now;
        // Only reset if warning modal is not currently holding user attention
        if (!isWarningOpenRef.current && !isTimedOutRef.current) {
          lastActiveRef.current = now;
          try {
            localStorage.setItem(STORAGE_KEY, now.toString());
          } catch {
            // Ignore
          }
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
      if (e.key === STORAGE_KEY && e.newValue) {
        const remoteTimestamp = Number(e.newValue);
        if (!isNaN(remoteTimestamp) && remoteTimestamp > lastActiveRef.current) {
          lastActiveRef.current = remoteTimestamp;
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
        const stored = localStorage.getItem(STORAGE_KEY);
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
