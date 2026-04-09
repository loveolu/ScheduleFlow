import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api-helpers";
import { handleCallback } from "@/lib/integrations/google-calendar";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Google redirects with ?error=... when the user denies consent.
  if (error) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
    return NextResponse.redirect(
      `${base}/dashboard/integrations?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return errorResponse("Missing authorization code", 400);
  }

  // Verify the state (userId) matches the authenticated user to prevent CSRF.
  if (state !== session.user.id) {
    return errorResponse("State mismatch — possible CSRF", 403);
  }

  const success = await handleCallback(code, session.user.id);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";

  if (success) {
    return NextResponse.redirect(
      `${base}/dashboard/integrations?success=google_connected`
    );
  }

  return NextResponse.redirect(
    `${base}/dashboard/integrations?error=google_token_exchange_failed`
  );
}
