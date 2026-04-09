import Stripe from "stripe";
import { db } from "@/lib/db";

let stripeClient: Stripe | null = null;

/**
 * Returns a singleton Stripe client initialized with the secret key.
 */
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeClient;
}

/**
 * Finds an existing Stripe customer for the user or creates one.
 * Persists the stripeCustomerId back to the User record.
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, name: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
    ...(user?.name ? { name: user.name } : {}),
  });

  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

interface CreateCheckoutSessionParams {
  bookingUid: string;
  eventTypeId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Creates a Stripe Checkout session for a booking payment.
 * The booking UID is stored in the session metadata for webhook reconciliation.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: "Booking Payment",
          },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingUid: params.bookingUid,
      eventTypeId: params.eventTypeId,
    },
    payment_intent_data: {
      metadata: {
        bookingUid: params.bookingUid,
        eventTypeId: params.eventTypeId,
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
}

/**
 * Issues a full or partial refund for a payment intent.
 * @param paymentIntentId - The Stripe PaymentIntent ID to refund
 * @param amount - Optional amount in cents for a partial refund. Omit for full refund.
 */
export async function handleRefund(
  paymentIntentId: string,
  amount?: number
): Promise<Stripe.Refund> {
  const stripe = getStripeClient();

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amount !== undefined ? { amount } : {}),
  });

  return refund;
}

/**
 * Creates a Stripe Billing Portal session so the customer can manage
 * their subscription, payment methods, and invoices.
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
