import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api-helpers";
import { getAuthUrl } from "@/lib/integrations/google-calendar";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const url = getAuthUrl(session.user.id);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("Failed to generate Google OAuth URL:", err);
    return errorResponse("Google Calendar integration is not configured", 500);
  }
}
