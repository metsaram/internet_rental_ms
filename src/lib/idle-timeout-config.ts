/**
 * Centralized Idle Timeout Configuration & Helpers
 * 
 * Set `idleTimeMs` and `warningTimeMs` in this single place.
 * All hooks, modals, countdown timers, and notifications dynamically read
 * from this configuration to ensure display consistency across the application.
 */

export interface IdleTimeoutConfiguration {
  /**
   * Total idle inactivity duration in milliseconds before automated logout.
   * Default: 2 minutes (2 * 60 * 1000) for testing / active verification,
   * or can be set to 15 minutes (15 * 60 * 1000) for production.
   */
  idleTimeMs: number;

  /**
   * Warning countdown window in milliseconds displayed prior to logout.
   * Default: 1 minute (60 * 1000 = 60,000ms).
   */
  warningTimeMs: number;
}

export const IDLE_TIMEOUT_CONFIG: IdleTimeoutConfiguration = {
  idleTimeMs: 2 * 60 * 1000, // 2 minutes (or 15 * 60 * 1000 for 15 minutes)
  warningTimeMs: 60 * 1000,    // 1 minute warning
};

/**
 * Formats a millisecond duration into a human-readable string.
 * Examples:
 * - 900,000 -> "15 minutes"
 * - 120,000 -> "2 minutes"
 * - 60,000  -> "1 minute"
 * - 30,000  -> "30 seconds"
 * - 1,000   -> "1 second"
 */
export function formatDurationMs(ms: number): string {
  if (ms <= 0) return "0 seconds";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * Formats seconds into a standard timer digital display "M:SS".
 * Examples:
 * - 60  -> "1:00"
 * - 59  -> "0:59"
 * - 9   -> "0:09"
 * - 120 -> "2:00"
 * - 125 -> "2:05"
 */
export function formatTimerSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Key in localStorage used for tracking the latest active user timestamp across tabs.
 */
export const IDLE_STORAGE_KEY = "netrent_last_active_timestamp";

/**
 * Resets the idle timeout activity timestamp in localStorage to Date.now().
 * Should be called upon successful re-authentication or login to ensure a fresh session.
 */
export function resetIdleTimeoutStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(IDLE_STORAGE_KEY, Date.now().toString());
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Clears the idle timeout activity timestamp from localStorage.
 * Should be called on session expiration, timeout, or user sign out.
 */
export function clearIdleTimeoutStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(IDLE_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

