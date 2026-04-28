/**
 * Required-environment guard.
 *
 * Modules import { requireEnv } from "@/lib/env" and call it at module load
 * time. If the variable is missing or empty, we throw immediately — that
 * surfaces as a startup error in dev/prod and is loud enough to catch in
 * CI / first request, which is the whole point. (Quietly defaulting
 * NEXTAUTH_SECRET to "dev-secret-change-in-production" is what the audit
 * flagged.)
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file (see .env.example). ` +
        `For NEXTAUTH_SECRET, generate one with: openssl rand -base64 32`
    );
  }
  return value;
}
