import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { createCheckoutSession, getOrCreateCustomer } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json().catch(() => null);
    if (!body?.bookingUid || typeof body.bookingUid !== "string") {
      return errorResponse("Missing or invalid bookingUid", 400);
    }

    const { bookingUid } = body;

    const booking = await db.booking.findUnique({
      where: { uid: bookingUid },
      include: {
        eventType: {
          select: {
            id: true,
            collectPayment: true,
            price: true,
            currency: true,
            title: true,
          },
        },
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!booking) {
      return errorResponse("Booking not found", 404);
    }

    if (!booking.eventType.collectPayment) {
      return errorResponse(
        "This event type does not require payment",
        400
      );
    }

    if (!booking.eventType.price || booking.eventType.price <= 0) {
      return errorResponse("Event type has no valid price configured", 400);
    }

    if (booking.paymentStatus === "PAID") {
      return errorResponse("Booking is already paid", 400);
    }

    // Ensure the Stripe customer exists for the event host
    await getOrCreateCustomer(
      booking.user.id,
      booking.user.email
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${baseUrl}/bookings/${bookingUid}?payment=success`;
    const cancelUrl = `${baseUrl}/bookings/${bookingUid}?payment=cancelled`;

    const checkoutSession = await createCheckoutSession({
      bookingUid,
      eventTypeId: booking.eventType.id,
      amount: booking.eventType.price,
      currency: booking.eventType.currency,
      customerEmail: booking.inviteeEmail,
      successUrl,
      cancelUrl,
    });

    // Mark booking as pending payment
    await db.booking.update({
      where: { uid: bookingUid },
      data: {
        paymentStatus: "PENDING",
        status: "PENDING",
      },
    });

    return successResponse({ url: checkoutSession.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return errorResponse("Failed to create checkout session", 500);
  }
}
