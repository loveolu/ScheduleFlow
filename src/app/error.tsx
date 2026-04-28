"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-segment error boundary. Catches errors thrown during render of the
 * App Router subtree below `app/`. We intentionally do NOT echo the raw
 * error message to the user — only a digest the platform attaches to the
 * server log, so support can match a user report to a log entry without
 * leaking stack traces.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-rendered errors are already logged by Next.js. Logging on the
    // client too means a user-reported screen-shot can be cross-referenced
    // by digest in either log.
    console.error("App router error boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-sm font-semibold text-red-600 tracking-wide uppercase">
          Something went wrong
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Unexpected error
        </h1>
        <p className="mt-3 text-base text-slate-500">
          We hit an error rendering this page. The team has been notified.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
