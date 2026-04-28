/**
 * Idempotency key cache for POST endpoints (booking creation, in particular).
 *
 * Why we need this beyond rate limiting: rate limits punish fast retries but
 * still let two requests through if they're spaced out, and a panicked user
 * double-clicking "Confirm Booking" is the most common cause of duplicate
 * bookings. The booking flow can pass a client-generated nonce in the
 * `Idempotency-Key` header (Stripe convention); the second request with the
 * same key short-circuits with the first response.
 *
 * Trade-offs (mirrors src/lib/rate-limit.ts):
 *   - In-memory only. Fine for single-instance prod; on multi-instance
 *     deployment two replicas can both accept the same key. The race
 *     window narrows to milliseconds anyway because a transactional
 *     conflict-recheck guards the actual DB write (see public/bookings).
 *   - Replace with Redis / Upstash on horizontal scale-out.
 *
 * The cache stores a JSON-serialized response body keyed by
 * `<scope>:<key>`. Entries TTL after IDEMPOTENCY_TTL_MS so unbounded growth
 * isn't a concern.
 */

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough for retries

interface CachedResponse {
  status: number;
  body: string; // JSON-serialized
  expiresAt: number;
}

interface PendingEntry {
  promise: Promise<CachedResponse>;
  expiresAt: number;
}

const completed = new Map<string, CachedResponse>();
const inFlight = new Map<string, PendingEntry>();

if (typeof setInterval === "function" && process.env.NODE_ENV !== "test") {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of completed) if (v.expiresAt <= now) completed.delete(k);
    for (const [k, v] of inFlight) if (v.expiresAt <= now) inFlight.delete(k);
  }, 60_000);
  if (typeof interval.unref === "function") interval.unref();
}

/**
 * Read the Idempotency-Key header from a request.
 * Returns null when missing or empty.
 */
export function getIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key");
  if (!key) return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  // Cap length to avoid memory abuse — Stripe accepts up to 255.
  if (trimmed.length > 255) return null;
  return trimmed;
}

/**
 * Run `compute` exactly once per (scope, key) tuple within the TTL window.
 * Concurrent callers with the same key wait on the in-flight promise; later
 * callers within the TTL get the cached response.
 *
 * Callers should narrow `scope` to the route + relevant identifiers (e.g.
 * "public-bookings" or "create-checkout") so an Idempotency-Key issued for
 * one resource cannot collide with another.
 */
export async function withIdempotency(
  scope: string,
  key: string,
  compute: () => Promise<{ status: number; body: unknown }>
): Promise<{ status: number; body: string; replayed: boolean }> {
  const fullKey = `${scope}:${key}`;
  const now = Date.now();

  const cached = completed.get(fullKey);
  if (cached && cached.expiresAt > now) {
    return { status: cached.status, body: cached.body, replayed: true };
  }

  const pending = inFlight.get(fullKey);
  if (pending && pending.expiresAt > now) {
    const result = await pending.promise;
    return { status: result.status, body: result.body, replayed: true };
  }

  const promise = (async () => {
    const out = await compute();
    const body = JSON.stringify(out.body);
    const entry: CachedResponse = {
      status: out.status,
      body,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    };
    completed.set(fullKey, entry);
    return entry;
  })();

  inFlight.set(fullKey, {
    promise,
    expiresAt: now + IDEMPOTENCY_TTL_MS,
  });

  try {
    const result = await promise;
    return { status: result.status, body: result.body, replayed: false };
  } finally {
    // Promise resolution moves the entry from inFlight to completed.
    inFlight.delete(fullKey);
  }
}
