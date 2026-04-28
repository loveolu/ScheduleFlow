/**
 * Simple in-memory token-bucket / fixed-window rate limiter.
 *
 * NOTE: This is intentionally in-memory. Trade-offs:
 *   - Pros: zero infra, no extra deps, works in dev and single-instance prod.
 *   - Cons: state is per-process, so behind multiple Next.js instances /
 *     serverless functions / lambda containers each replica has its own
 *     counter. For multi-instance deployments swap this for `@upstash/ratelimit`
 *     (Redis-backed) or Vercel KV. The Redis service in `docker-compose.yml`
 *     is currently unused — plumb it in here when scaling out.
 *
 * Why not @upstash/ratelimit now: not in package.json (and the audit
 * specifically asked us to keep deps minimal).  When we bring Redis back
 * online we should replace `hits` below with an Upstash pipeline.
 */
import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

// keyed by "<route>:<identifier>"; identifier is usually IP
const hits = new Map<string, Bucket>();

// Periodically prune expired buckets so the map doesn't grow unbounded.
// Avoid scheduling this in test or edge environments where setInterval is
// either unavailable or pollutes the loop.
if (typeof setInterval === "function" && process.env.NODE_ENV !== "test") {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(key);
    }
  }, 60_000);
  // Don't keep the Node process alive solely for the cleaner.
  if (typeof interval.unref === "function") interval.unref();
}

export interface RateLimitOptions {
  /** Unique tag for the route (e.g. "public-bookings"). */
  key: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Pull a best-effort client IP from request headers. Falls back to "unknown".
 * Trusts standard proxy headers — fine because we only use this for rate
 * limiting (not authn).
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // first IP is the originating client
    return forwarded.split(",")[0]!.trim();
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-client-ip") ||
    "unknown"
  );
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const fullKey = `${options.key}:${identifier}`;
  const existing = hits.get(fullKey);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    hits.set(fullKey, { count: 1, resetAt });
    return { success: true, remaining: options.limit - 1, resetAt };
  }

  if (existing.count >= options.limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: options.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Convenience helper: rate-limits the request by client IP and returns a 429
 * response if the limit is exceeded, otherwise returns null so the caller can
 * continue.
 */
export function enforceRateLimit(
  request: Request,
  options: RateLimitOptions
): NextResponse | null {
  const ip = getClientIp(request);
  const result = rateLimit(ip, options);
  if (!result.success) {
    const retryAfter = Math.max(
      1,
      Math.ceil((result.resetAt - Date.now()) / 1000)
    );
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(options.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }
  return null;
}
