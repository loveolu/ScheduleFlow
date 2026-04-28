import crypto from "crypto";
import { db } from "@/lib/db";
import { assertSafeWebhookUrl } from "@/lib/ssrf-guard";

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

export async function deliverWebhooks(
  userId: string,
  event: string,
  data: Record<string, unknown>
) {
  const subscriptions = await db.webhookSubscription.findMany({
    where: {
      userId,
      isActive: true,
    },
  });

  const matchingSubscriptions = subscriptions.filter((sub) => {
    const events = sub.events as string[];
    return events.includes(event) || events.includes("*");
  });

  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);

  for (const sub of matchingSubscriptions) {
    deliverWithRetry(sub.url, payloadString, sub.signingSecret, sub.id).catch(
      console.error
    );
  }
}

async function deliverWithRetry(
  url: string,
  payload: string,
  secret: string,
  subscriptionId: string,
  attempt = 1
): Promise<void> {
  const maxAttempts = 3;
  const signature = signPayload(payload, secret);

  // SSRF guard: re-check the URL on every delivery attempt. Re-resolving DNS
  // each time defeats DNS rebinding (where an attacker's resolver returns a
  // public IP at registration and a private IP at delivery time). We resolve
  // via dns.lookup and reject loopback / private / link-local / metadata
  // ranges before issuing fetch().
  const safety = await assertSafeWebhookUrl(url);
  if (!safety.ok) {
    console.error(
      `Webhook delivery blocked for subscription ${subscriptionId}: ${safety.reason} (${url})`
    );
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ScheduleFlow-Signature": signature,
        "X-ScheduleFlow-Timestamp": new Date().toISOString(),
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
      // Disable redirect following — a permitted public URL could 30x to a
      // private host, which fetch() would follow by default.
      redirect: "manual",
    });

    if (!res.ok && attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      return deliverWithRetry(url, payload, secret, subscriptionId, attempt + 1);
    }
  } catch (error) {
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return deliverWithRetry(url, payload, secret, subscriptionId, attempt + 1);
    }
    console.error(`Webhook delivery failed after ${maxAttempts} attempts:`, url, error);
  }
}
