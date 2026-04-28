import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api-helpers";
import { ZoomService } from "@/lib/integrations/zoom";

export async function GET(request: NextRequest) {
  // Require an authenticated session and verify the OAuth `state` matches the
  // session user. Otherwise an attacker could forge a callback that binds
  // their Zoom account to the victim's Integration row (CSRF -> the victim's
  // future "create Zoom meeting" calls would mint meetings on the attacker's
  // account). Mirrors the Google callback's CSRF guard.
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId issued at /connect

  if (!code || !state) {
    return errorResponse("Missing code or state parameter", 400);
  }

  if (state !== session.user.id) {
    return errorResponse("State mismatch — possible CSRF", 403);
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";

  const result = await ZoomService.handleCallback(code, session.user.id);

  if (!result) {
    return NextResponse.redirect(
      `${base}/dashboard/integrations?error=zoom_failed`
    );
  }

  return NextResponse.redirect(
    `${base}/dashboard/integrations?success=zoom`
  );
}
