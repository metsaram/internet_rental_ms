import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Phase 17 — Health check endpoint for smoke testing.
 * Returns 200 if the app + database are reachable.
 * Does NOT require auth (safe — reveals only connectivity).
 */
export async function GET() {
  try {
    // Lightweight DB connectivity check.
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      time: new Date().toISOString(),
      db: "connected",
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        time: new Date().toISOString(),
        db: "disconnected",
        error: "Database unreachable",
      },
      { status: 503 }
    );
  }
}
