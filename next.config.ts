import type { NextConfig } from "next";

/**
 * Security headers applied to every response. Documented inline because
 * each one trades safety for some functional risk:
 *
 * - X-Frame-Options: SAMEORIGIN. Prevents clickjacking via a third-party
 *   <iframe>. We *do* ship an embed widget at /embed/[username]/[eventSlug]
 *   that customers paste onto their own site; the embed page sets its own
 *   relaxed policy via a route-level override (or by being served with a
 *   different Content-Security-Policy frame-ancestors directive). For
 *   anything else, only same-origin framing is allowed.
 *
 * - X-Content-Type-Options: nosniff. Stops MIME sniffing attacks where
 *   user-uploaded content is interpreted as a script.
 *
 * - Referrer-Policy: strict-origin-when-cross-origin. Default for modern
 *   browsers, but some older proxies still need the explicit header to
 *   avoid leaking full URLs (with booking UIDs in the path) to third-party
 *   resources.
 *
 * - Permissions-Policy: disable mic/cam/geo by default. The booking flow
 *   has no need for them; if a future feature does, override per-route.
 *
 * - Strict-Transport-Security: 1 year, includeSubDomains. Production HTTPS
 *   enforcement. Browsers ignore the header on plain HTTP, so it's a no-op
 *   in dev.
 *
 * No CSP yet. Adding `script-src 'self'` would break Next.js's inline
 * hydration scripts unless we generate a per-request nonce, which Next 16
 * supports via middleware (`headers().set('x-nonce', …)`) but adds enough
 * surface area that it warrants its own commit. For now we ship the
 * cheaper headers and leave CSP as a documented gap (see prod report).
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to everything except the embed page, which needs to render
        // inside customer iframes. The embed surface itself is at
        // /embed/[username]/[eventSlug]; relax X-Frame-Options for it.
        source: "/((?!embed).*)",
        headers: securityHeaders,
      },
      {
        // Embed pages: drop X-Frame-Options so customers can iframe the
        // booking widget on their own sites. Keep the rest.
        source: "/embed/:path*",
        headers: securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
      },
    ];
  },
};

export default nextConfig;
