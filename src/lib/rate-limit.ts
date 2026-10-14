/**
 * Phase 17 — Simple in-memory rate limiter (token bucket per key).
 *
 * For the sandbox demo this is sufficient. In production with multiple
 * serverless instances you'd use Redis or Upstash. The interface is stable
 * so the swap is trivial.
 *
 * Usage:
 *   const ok = rateLimit(`auth:${ip}`, { max: 10, windowMs: 60_000 });
 *   if (!ok) throw new HttpError(429, "Too many requests");
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

interface RateLimitOptions {
  max: number; // max tokens
  windowMs: number; // refill window
}

/** Returns true if allowed, false if rate-limited. */
export function rateLimit(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { tokens: opts.max - 1, lastRefill: now });
    return true;
  }

  // Refill tokens based on elapsed time.
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / opts.windowMs) * opts.max;
  if (refill > 0) {
    bucket.tokens = Math.min(opts.max, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

/** Get the client IP from a Next.js request (best-effort). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Periodic cleanup of stale buckets to prevent memory growth. */
export function cleanupBuckets(maxAgeMs = 10 * 60 * 1000) {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > maxAgeMs) {
      buckets.delete(key);
    }
  }
}

// Run cleanup every 5 minutes.
if (typeof setInterval !== "undefined") {
  setInterval(cleanupBuckets, 5 * 60 * 1000);
}
