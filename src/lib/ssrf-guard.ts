/**
 * SSRF guard for outbound webhook URLs (and any other user-supplied URLs).
 *
 * Two layers of defense:
 *   1. URL-shape allowlist: scheme must be http(s); no embedded credentials;
 *      hostname must not be a hard-coded metadata-service literal.
 *   2. DNS resolution check: resolve the hostname with `dns.lookup` and
 *      reject the *resolved* IP if it's loopback / private / link-local /
 *      reserved. Resolving and re-checking defeats DNS rebinding (where the
 *      attacker's resolver returns a public IP first and a private IP on
 *      subsequent lookups) — we resolve immediately before connecting.
 *
 * The blocklist matches the explicit ranges from the audit:
 *   - 127.0.0.0/8     (loopback)
 *   - 10.0.0.0/8      (RFC 1918)
 *   - 172.16.0.0/12   (RFC 1918)
 *   - 192.168.0.0/16  (RFC 1918)
 *   - 169.254.0.0/16  (link-local incl. cloud metadata 169.254.169.254)
 *   - 0.0.0.0/8       (this network)
 *   - ::1/128         (IPv6 loopback)
 *   - fc00::/7        (IPv6 unique local)
 *   - fe80::/10       (IPv6 link-local)
 *   - fec0::/10       (IPv6 site-local, deprecated but still blocked)
 *   - ::ffff:0:0/96   (IPv4-mapped IPv6 — re-check the embedded v4)
 */
import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal", // GCE metadata
  "metadata", // alias
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const x = Number(part);
    if (!Number.isInteger(x) || x < 0 || x > 255) return null;
    n = (n << 8) | x;
  }
  // force unsigned
  return n >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  // 0.0.0.0/8
  if ((n & 0xff000000) === 0x00000000) return true;
  // 10.0.0.0/8
  if ((n & 0xff000000) === 0x0a000000) return true;
  // 127.0.0.0/8
  if ((n & 0xff000000) === 0x7f000000) return true;
  // 169.254.0.0/16 (includes 169.254.169.254 metadata)
  if ((n & 0xffff0000) === 0xa9fe0000) return true;
  // 172.16.0.0/12
  if ((n & 0xfff00000) === 0xac100000) return true;
  // 192.168.0.0/16
  if ((n & 0xffff0000) === 0xc0a80000) return true;
  // 100.64.0.0/10 (CGNAT — also worth blocking)
  if ((n & 0xffc00000) === 0x64400000) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower === "::") return true;

  // Split off any zone id (e.g. "fe80::1%eth0")
  const cleaned = lower.split("%")[0]!;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — recurse on the v4 part
  const v4Mapped = cleaned.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]!);

  // fc00::/7 — first byte top 7 bits are 1111110x  => starts with fc or fd
  if (/^f[cd][0-9a-f]{2}:/.test(cleaned)) return true;
  // fe80::/10 — link-local. fe80–febf
  if (/^fe[89ab][0-9a-f]:/.test(cleaned)) return true;
  // fec0::/10 — site-local (deprecated, still blocked)
  if (/^fe[cdef][0-9a-f]:/.test(cleaned)) return true;
  // ff00::/8 — multicast (don't deliver webhooks to multicast)
  if (/^ff[0-9a-f]{2}:/.test(cleaned)) return true;
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return false;
}

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
}

export async function assertSafeWebhookUrl(
  rawUrl: string
): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }

  // Reject embedded credentials (foo:bar@host)
  if (url.username || url.password) {
    return { ok: false, reason: "URL must not contain credentials" };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: "Hostname is not allowed" };
  }

  // If the hostname is itself a literal IP, validate it directly without DNS.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { ok: false, reason: "URL resolves to a private/reserved address" };
    }
    return { ok: true };
  }

  // Resolve and check. dns.lookup honors the OS resolver and `hosts` file
  // (matching what fetch() will actually do), which is what we want.
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return { ok: false, reason: "DNS lookup failed" };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: "DNS lookup returned no addresses" };
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      return {
        ok: false,
        reason: "URL resolves to a private/reserved address",
      };
    }
  }

  return { ok: true };
}
