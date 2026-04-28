import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Read raw body for signature verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    console.error("Failed to read webhook request body");
    return new Response("Failed to read request body", { status: 400 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("Missing stripe-signature header");
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Verify the event signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  // Event-id de-dupe. Stripe will retry webhooks if our handler is slow or
  // returns 5xx, so the same event.id can arrive several times. The
  // resource-level guards below (paymentStatus === "PAID") catch the most
  // common case, but `charge.refunded` doesn't have a clean idempotency
  // anchor of its own and a buggy event handler that mutates state before
  // failing would still re-execute on retry. A short in-memory de-dupe
  // window covers the retry burst regardless of which event type. For
  // multi-instance prod this should graduate to a Postgres table keyed on
  // event.id (PK) — adding the row before processing makes dedup durable
  // and survives restarts.
  if (alreadyProcessed(event.id)) {
    console.log(
      `Stripe webhook event already processed (memory cache): ${event.id}`
    );
    return new Response("OK (replay)", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }
      case "charge.refunded": {
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      }
      default: {
        // Unhandled event type — acknowledge receipt without processing
        console.log(`Unhandled Stripe event type: ${event.type}`);
      }
    }
    markProcessed(event.id);
  } catch (error) {
    console.error(`Error processing Stripe event ${event.type}:`, error);
    // Return 200 to prevent Stripe from retrying — the error is on our side
    // and retrying won't fix it. Log for manual investigation.
    return new Response("Webhook processed with errors", { status: 200 });
  }

  return new Response("OK", { status: 200 });
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const bookingUid = session.metadata?.bookingUid;
  if (!bookingUid) {
    console.error(
      "checkout.session.completed: No bookingUid in session metadata",
      session.id
    );
    return;
  }

  // Retrieve the payment intent ID from the session
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const booking = await db.booking.findUnique({
    where: { uid: bookingUid },
    select: { id: true, paymentStatus: true },
  });

  if (!booking) {
    console.error(
      "checkout.session.completed: Booking not found for uid:",
      bookingUid
    );
    return;
  }

  // Guard against duplicate processing
  if (booking.paymentStatus === "PAID") {
    console.log(
      "checkout.session.completed: Booking already paid, skipping:",
      bookingUid
    );
    return;
  }

  await db.booking.update({
    where: { uid: bookingUid },
    data: {
      paymentStatus: "PAID",
      status: "CONFIRMED",
      ...(paymentIntentId
        ? { stripePaymentIntentId: paymentIntentId }
        : {}),
    },
  });

  console.log(
    "checkout.session.completed: Booking confirmed with payment:",
    bookingUid
  );
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  // The payment_intent on a charge can be a string ID or an expanded object
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    console.error(
      "charge.refunded: No payment_intent on charge",
      charge.id
    );
    return;
  }

  const booking = await db.booking.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, uid: true, paymentStatus: true },
  });

  if (!booking) {
    console.error(
      "charge.refunded: No booking found for paymentIntent:",
      paymentIntentId
    );
    return;
  }

  // Guard against duplicate processing
  if (booking.paymentStatus === "REFUNDED") {
    console.log(
      "charge.refunded: Booking already refunded, skipping:",
      booking.uid
    );
    return;
  }

  await db.booking.update({
    where: { id: booking.id },
    data: {
      paymentStatus: "REFUNDED",
    },
  });

  console.log("charge.refunded: Booking marked as refunded:", booking.uid);
}

// ---------------------------------------------------------------------------
// Event-id de-dupe (in-memory)
// ---------------------------------------------------------------------------
//
// Keep ~1 hour worth of recent event ids; Stripe retries follow exponential
// backoff and stop after 3 days, but the burst that matters for idempotency
// happens within minutes of the first attempt. Limit the cache size so a
// flood of distinct event-ids can't grow the map unbounded.

const STRIPE_EVENT_TTL_MS = 60 * 60 * 1000;
const STRIPE_EVENT_CACHE_MAX = 5_000;
const stripeEventCache = new Map<string, number>(); // id -> expiresAt

function alreadyProcessed(eventId: string): boolean {
  const now = Date.now();
  const expiresAt = stripeEventCache.get(eventId);
  if (expiresAt !== undefined && expiresAt > now) return true;
  return false;
}

function markProcessed(eventId: string): void {
  const now = Date.now();
  stripeEventCache.set(eventId, now + STRIPE_EVENT_TTL_MS);

  // Cheap O(n) prune when over capacity. Still O(1) amortized because we
  // only do this once per overflow.
  if (stripeEventCache.size > STRIPE_EVENT_CACHE_MAX) {
    for (const [id, exp] of stripeEventCache) {
      if (exp <= now) stripeEventCache.delete(id);
    }
    // If we're still over capacity after pruning expired ones, drop the
    // oldest entries (insertion order). Map iteration is insertion-ordered.
    while (stripeEventCache.size > STRIPE_EVENT_CACHE_MAX) {
      const oldestKey = stripeEventCache.keys().next().value;
      if (oldestKey === undefined) break;
      stripeEventCache.delete(oldestKey);
    }
  }
}
