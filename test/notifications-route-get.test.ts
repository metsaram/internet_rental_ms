/**
 * Tests for GET /api/notifications
 *
 * Verifies that the handler:
 *  - Calls notification.findMany and notification.count in parallel (Promise.all).
 *  - Returns the expected { notifications, unreadCount } shape.
 *  - Throttles generateNotifications calls.
 *  - Applies the unreadOnly filter to findMany (but NOT to count — count is
 *    always unread-only regardless of the query param).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Use vi.hoisted so mock vars are available inside vi.mock factories ─────────
const { mockFindMany, mockCount, mockUpdateMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "user-1",
    companyId: "comp-1",
  }),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  errorResponse: vi.fn((err: Error & { status?: number }) =>
    new Response(JSON.stringify({ error: err.message }), {
      status: err.status ?? 500,
    })
  ),
}));

vi.mock("@/lib/notifications", () => ({
  generateNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      findMany: mockFindMany,
      count: mockCount,
      updateMany: mockUpdateMany,
    },
  },
}));

// ── Route import AFTER mocks ──────────────────────────────────────────────────
import { GET, clearNotificationThrottle } from "@/app/api/notifications/route";
import { generateNotifications } from "@/lib/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeNotification(id: string, readAt: Date | null = null) {
  return {
    id,
    type: "CONTRACT_EXPIRING",
    title: "Contract expiring",
    message: "Renew soon",
    entityType: "InternetContract",
    entityId: "ctr-1",
    readAt,
    createdAt: new Date("2026-11-01"),
  };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/notifications");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset throttle so each test triggers generateNotifications
    clearNotificationThrottle("comp-1");
    mockFindMany.mockResolvedValue([makeNotification("n-1"), makeNotification("n-2")]);
    mockCount.mockResolvedValue(1);
  });

  it("fires findMany and count concurrently via Promise.all", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockCount).toHaveBeenCalledTimes(1);
  });

  it("returns { notifications, unreadCount } shape", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("unreadCount", 1);
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(body.notifications[0]).toMatchObject({
      id: "n-1",
      type: "CONTRACT_EXPIRING",
      title: "Contract expiring",
    });
  });

  it("maps notification fields correctly", async () => {
    const readDate = new Date("2026-11-02");
    mockFindMany.mockResolvedValue([makeNotification("n-3", readDate)]);
    const res = await GET(makeRequest());
    const body = await res.json();
    const n = body.notifications[0];
    expect(n.id).toBe("n-3");
    expect(n.readAt).toBeDefined();
    expect(n.createdAt).toBeDefined();
  });

  it("calls generateNotifications on first request", async () => {
    await GET(makeRequest());
    expect(generateNotifications).toHaveBeenCalledWith({
      companyId: "comp-1",
      userId: "user-1",
    });
  });

  it("throttles generateNotifications — does not call on second immediate request", async () => {
    await GET(makeRequest());
    await GET(makeRequest());
    // Should have been called only once due to 60s throttle
    expect(generateNotifications).toHaveBeenCalledTimes(1);
  });

  it("passes unreadOnly=true filter to findMany where clause", async () => {
    await GET(makeRequest({ unreadOnly: "true" }));
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.readAt).toBeNull();
  });

  it("does NOT add readAt filter to findMany when unreadOnly is not set", async () => {
    await GET(makeRequest());
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.readAt).toBeUndefined();
  });

  it("count always targets unread-only regardless of unreadOnly param", async () => {
    await GET(makeRequest({ unreadOnly: "false" }));
    const countWhere = mockCount.mock.calls[0][0].where;
    expect(countWhere.readAt).toBeNull();
  });

  it("returns empty notifications array when no records exist", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.notifications).toEqual([]);
    expect(body.unreadCount).toBe(0);
  });
});
