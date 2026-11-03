import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCappedDatabaseUrl, db } from "@/lib/db";

describe("Database Singleton Pool & Connection Cap", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns undefined when DATABASE_URL is not set or empty", () => {
    delete process.env.DATABASE_URL;
    expect(getCappedDatabaseUrl(undefined)).toBeUndefined();
    expect(getCappedDatabaseUrl("")).toBeUndefined();
  });

  it("injects default connection_limit=10 and pool_timeout=30 when absent", () => {
    const rawUrl = "postgresql://user:pass@localhost:5432/mydb?sslmode=require";
    const capped = getCappedDatabaseUrl(rawUrl);
    expect(capped).toBeDefined();

    const url = new URL(capped!);
    expect(url.searchParams.get("connection_limit")).toBe("10");
    expect(url.searchParams.get("pool_timeout")).toBe("30");
    expect(url.searchParams.get("sslmode")).toBe("require");
  });

  it("preserves custom connection_limit when already present in connection URL", () => {
    const rawUrl = "postgresql://user:pass@localhost:5432/mydb?connection_limit=5";
    const capped = getCappedDatabaseUrl(rawUrl);
    expect(capped).toBeDefined();

    const url = new URL(capped!);
    expect(url.searchParams.get("connection_limit")).toBe("5");
    expect(url.searchParams.get("pool_timeout")).toBe("30");
  });

  it("allows setting custom max connections via parameter or DB_MAX_CONNECTIONS env", () => {
    const rawUrl = "postgresql://user:pass@localhost:5432/mydb";
    const capped = getCappedDatabaseUrl(rawUrl, "7");
    expect(capped).toBeDefined();

    const url = new URL(capped!);
    expect(url.searchParams.get("connection_limit")).toBe("7");
  });

  it("handles malformed URLs without crashing", () => {
    const invalidUrl = "not-a-valid-url";
    expect(getCappedDatabaseUrl(invalidUrl)).toBe(invalidUrl);
  });

  it("attaches db instance to globalThis as a reusable singleton pool", () => {
    const globalAny = globalThis as unknown as {
      prismaExtendedClient?: unknown;
      prisma?: unknown;
    };

    expect(db).toBeDefined();
    expect(globalAny.prismaExtendedClient).toBe(db);
    expect(globalAny.prisma).toBe(db);
  });
});
