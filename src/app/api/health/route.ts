import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe.
 *
 * - Liveness: GET /api/health returns 200 as long as the Node process is
 *   alive. Suitable for Kubernetes / Render / Fly liveness probes.
 * - Readiness: a SELECT 1 round-trip to Postgres verifies the DB pool is
 *   serving queries. Returns 503 with `{ ok: false, db: false }` when the
 *   DB is unreachable so a load balancer knows to route around this
 *   instance.
 *
 * The endpoint is intentionally unauthenticated. It returns no
 * environment-sensitive information; uptime is in seconds (no PID, no
 * version string). Cache headers are set to no-store so a CDN / Vercel
 * Edge cache cannot serve a stale "200 OK" while the pod is failing.
 */
export async function GET() {
  const startedAt = process.uptime();

  let dbOk = false;
  let dbError: string | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : "unknown";
  }

  const ok = dbOk;
  const body = {
    ok,
    db: dbOk,
    ...(dbError ? { dbError } : {}),
    uptimeSeconds: Math.floor(startedAt),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
