import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { IdleTimeoutModal } from '@/components/shared/idle-timeout-modal';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';
import {
  IDLE_TIMEOUT_CONFIG,
  IDLE_STORAGE_KEY,
  resetIdleTimeoutStorage,
  clearIdleTimeoutStorage,
  formatDurationMs,
  formatTimerSeconds,
} from '@/lib/idle-timeout-config';
import { toast } from 'sonner';

// Mock next-auth/react signOut
const mockSignOut = vi.fn();
vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  useSession: () => ({ data: { user: { name: 'Test' } }, status: 'authenticated' }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Idle Timeout Configuration & Formatting Helpers', () => {
  it('formats milliseconds to human-readable duration strings', () => {
    expect(formatDurationMs(15 * 60 * 1000)).toBe('15 minutes');
    expect(formatDurationMs(2 * 60 * 1000)).toBe('2 minutes');
    expect(formatDurationMs(60 * 1000)).toBe('1 minute');
    expect(formatDurationMs(45 * 1000)).toBe('45 seconds');
    expect(formatDurationMs(1000)).toBe('1 second');
    expect(formatDurationMs(0)).toBe('0 seconds');
  });

  it('formats seconds to standard digital timer representation (M:SS)', () => {
    expect(formatTimerSeconds(60)).toBe('1:00');
    expect(formatTimerSeconds(59)).toBe('0:59');
    expect(formatTimerSeconds(9)).toBe('0:09');
    expect(formatTimerSeconds(125)).toBe('2:05');
    expect(formatTimerSeconds(0)).toBe('0:00');
  });

  it('exports valid centralized default configuration', () => {
    expect(IDLE_TIMEOUT_CONFIG.idleTimeMs).toBeGreaterThan(0);
    expect(IDLE_TIMEOUT_CONFIG.warningTimeMs).toBeGreaterThan(0);
    expect(IDLE_TIMEOUT_CONFIG.idleTimeMs).toBeGreaterThan(
      IDLE_TIMEOUT_CONFIG.warningTimeMs
    );
  });

  it('manages idle timeout storage timestamp correctly', () => {
    localStorage.clear();
    expect(localStorage.getItem(IDLE_STORAGE_KEY)).toBeNull();

    resetIdleTimeoutStorage();
    const stored = localStorage.getItem(IDLE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const ts = Number(stored);
    expect(ts).toBeGreaterThan(0);
    expect(ts).toBeLessThanOrEqual(Date.now());

    clearIdleTimeoutStorage();
    expect(localStorage.getItem(IDLE_STORAGE_KEY)).toBeNull();
  });
});

describe('IdleTimeoutModal Component', () => {
  it('renders modal content correctly when open is true with dynamic timer formatting', () => {
    render(
      <IdleTimeoutModal
        open={true}
        remainingSeconds={60}
        onStaySignedIn={vi.fn()}
        onLogoutNow={vi.fn()}
      />
    );

    expect(screen.getByText(/Session Expiring Soon/i)).toBeInTheDocument();
    expect(screen.getByText(/Inactivity detected/i)).toBeInTheDocument();
    // 60 seconds should render properly as 1:00, not 0:60
    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stay signed in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log out now/i })).toBeInTheDocument();
  });

  it('formats sub-minute remaining seconds as 0:SS', () => {
    render(
      <IdleTimeoutModal
        open={true}
        remainingSeconds={45}
        onStaySignedIn={vi.fn()}
        onLogoutNow={vi.fn()}
      />
    );

    expect(screen.getByText('0:45')).toBeInTheDocument();
  });

  it('does not display dialog when open is false', () => {
    render(
      <IdleTimeoutModal
        open={false}
        remainingSeconds={60}
        onStaySignedIn={vi.fn()}
        onLogoutNow={vi.fn()}
      />
    );

    expect(screen.queryByText(/Session Expiring Soon/i)).not.toBeInTheDocument();
  });

  it('calls onStaySignedIn when "Stay signed in" button is clicked', async () => {
    const handleStay = vi.fn();
    render(
      <IdleTimeoutModal
        open={true}
        remainingSeconds={30}
        onStaySignedIn={handleStay}
        onLogoutNow={vi.fn()}
      />
    );

    const stayBtn = screen.getByRole('button', { name: /Stay signed in/i });
    await userEvent.click(stayBtn);

    expect(handleStay).toHaveBeenCalledTimes(1);
  });

  it('calls onLogoutNow when "Log out now" button is clicked', async () => {
    const handleLogout = vi.fn();
    render(
      <IdleTimeoutModal
        open={true}
        remainingSeconds={30}
        onStaySignedIn={vi.fn()}
        onLogoutNow={handleLogout}
      />
    );

    const logoutBtn = screen.getByRole('button', { name: /Log out now/i });
    await userEvent.click(logoutBtn);

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});

describe('useIdleTimeout Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockSignOut.mockClear();
    vi.mocked(toast.info).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with values directly from centralized IDLE_TIMEOUT_CONFIG', () => {
    const { result } = renderHook(() => useIdleTimeout());

    expect(result.current.isWarningOpen).toBe(false);
    expect(result.current.idleTimeMs).toBe(IDLE_TIMEOUT_CONFIG.idleTimeMs);
    expect(result.current.warningTimeMs).toBe(IDLE_TIMEOUT_CONFIG.warningTimeMs);
    expect(result.current.remainingSeconds).toBe(
      Math.round(IDLE_TIMEOUT_CONFIG.warningTimeMs / 1000)
    );
    expect(result.current.formattedRemaining).toBe(
      formatTimerSeconds(Math.round(IDLE_TIMEOUT_CONFIG.warningTimeMs / 1000))
    );
  });

  it('opens warning when reaching the warning threshold', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 60 * 1000,
        onTimeout,
      })
    );

    // Advance 1 minute and 1 second (1m 1s elapsed into 2m total -> 59s left)
    act(() => {
      vi.advanceTimersByTime(1 * 60 * 1000 + 1000);
    });

    expect(result.current.isWarningOpen).toBe(true);
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(59);
    expect(result.current.formattedRemaining).toBe('0:59');
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('triggers onTimeout when full idle time elapses', () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 60 * 1000,
        onTimeout,
      })
    );

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000 + 1000);
    });

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('calls signOut and displays dynamic toast with configured duration on expiration', async () => {
    renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 30 * 1000,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000 + 1000);
    });

    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    expect(toast.info).toHaveBeenCalledWith(
      'Your session expired due to 2 minutes of inactivity.',
      expect.any(Object)
    );
  });

  it('resets timer when resetIdleTimer() is invoked', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 60 * 1000,
        onTimeout,
      })
    );

    // Advance into warning zone
    act(() => {
      vi.advanceTimersByTime(1 * 60 * 1000 + 30 * 1000);
    });
    expect(result.current.isWarningOpen).toBe(true);

    // User clicks "Stay signed in"
    act(() => {
      result.current.resetIdleTimer();
    });

    expect(result.current.isWarningOpen).toBe(false);

    // Advance 30 seconds - still well within reset 2-minute window (90s remaining > 60s warning threshold)
    act(() => {
      vi.advanceTimersByTime(30 * 1000);
    });
    expect(result.current.isWarningOpen).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('dismisses warning if another tab reports recent user activity', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 60 * 1000,
      })
    );

    // Enter warning zone
    act(() => {
      vi.advanceTimersByTime(1 * 60 * 1000 + 20 * 1000);
    });
    expect(result.current.isWarningOpen).toBe(true);

    // Simulate activity from Tab B via localStorage storage event
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: IDLE_STORAGE_KEY,
        newValue: Date.now().toString(),
      });
      window.dispatchEvent(storageEvent);
    });

    expect(result.current.isWarningOpen).toBe(false);
  });

  it('clears stored timestamp from localStorage when timeout occurs', async () => {
    localStorage.setItem(IDLE_STORAGE_KEY, Date.now().toString());

    renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 30 * 1000,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000 + 1000);
    });

    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    expect(localStorage.getItem(IDLE_STORAGE_KEY)).toBeNull();
  });

  it('ignores expired timestamp in localStorage on mount and does not immediately time out', () => {
    const onTimeout = vi.fn();
    // Simulate stale timestamp from 30 minutes ago (far exceeding 2-minute idle timeout)
    const expiredTs = Date.now() - 30 * 60 * 1000;
    localStorage.setItem(IDLE_STORAGE_KEY, expiredTs.toString());

    const { result } = renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 60 * 1000,
        onTimeout,
      })
    );

    // Advance 5 seconds - if the expired timestamp had been accepted, timeout would fire on 1st tick
    act(() => {
      vi.advanceTimersByTime(5 * 1000);
    });

    expect(result.current.isWarningOpen).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
    // Storage timestamp should have been refreshed to fresh active timestamp
    const updatedTs = Number(localStorage.getItem(IDLE_STORAGE_KEY));
    expect(updatedTs).toBeGreaterThan(expiredTs);
  });

  it('resets session timeout and does not immediately time out after re-authentication', async () => {
    const onTimeout = vi.fn();

    // 1. Initial session: times out
    const { unmount } = renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 60 * 1000,
        onTimeout,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000 + 1000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
    unmount();

    // 2. User re-authenticates (simulating login action)
    act(() => {
      resetIdleTimeoutStorage();
    });

    // 3. User enters app shell again
    const onSecondTimeout = vi.fn();
    const { result: secondSession } = renderHook(() =>
      useIdleTimeout({
        idleTimeMs: 2 * 60 * 1000,
        warningTimeMs: 60 * 1000,
        onTimeout: onSecondTimeout,
      })
    );

    // Advance 5 seconds into the new session
    act(() => {
      vi.advanceTimersByTime(5 * 1000);
    });

    // Must NOT immediately time out
    expect(secondSession.current.isWarningOpen).toBe(false);
    expect(onSecondTimeout).not.toHaveBeenCalled();
  });
});

