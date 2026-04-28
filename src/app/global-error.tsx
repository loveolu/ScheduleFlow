"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary. Catches errors thrown by `app/layout.tsx`
 * itself (where `error.tsx` cannot help, because that layout is the parent
 * of the route segment). global-error.tsx renders its own `<html>` and
 * `<body>`, which is why it duplicates layout.tsx's outer chrome.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          minHeight: "100vh",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: "28rem", width: "100%", textAlign: "center" }}>
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#dc2626",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Application error
          </p>
          <h1
            style={{
              marginTop: "0.5rem",
              fontSize: "2rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            We hit an unexpected error
          </h1>
          <p
            style={{
              marginTop: "0.75rem",
              color: "#64748b",
              fontSize: "1rem",
            }}
          >
            Try refreshing the page. If the problem keeps happening, contact
            support and include the reference below.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.5rem",
                color: "#94a3b8",
                fontSize: "0.75rem",
              }}
            >
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <div style={{ marginTop: "2rem" }}>
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                background: "#4f46e5",
                color: "white",
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
