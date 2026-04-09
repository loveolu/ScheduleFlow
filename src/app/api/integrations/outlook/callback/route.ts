import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-helpers";
import { OutlookCalendarService } from "@/lib/integrations/outlook-calendar";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error) {
    console.error("Outlook OAuth error:", error, searchParams.get("error_description"));
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=outlook_denied`
    );
  }

  if (!code || !state) {
    return errorResponse("Missing code or state parameter", 400);
  }

  const result = await OutlookCalendarService.handleCallback(code, state);

  if (!result) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=outlook_failed`
    );
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?success=outlook`
  );
}
