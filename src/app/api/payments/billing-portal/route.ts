import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { createBillingPortalSession } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse("Unauthorized", 401);
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return errorResponse("No billing account found", 400);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portalSession = await createBillingPortalSession(
      user.stripeCustomerId,
      `${baseUrl}/dashboard/settings/billing`
    );

    return successResponse({ url: portalSession.url });
  } catch (error) {
    console.error("Error creating billing portal session:", error);
    return errorResponse("Failed to create billing portal session", 500);
  }
}
