import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-helpers";
import { ZoomService } from "@/lib/integrations/zoom";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId

  if (!code || !state) {
    return errorResponse("Missing code or state parameter", 400);
  }

  const result = await ZoomService.handleCallback(code, state);

  if (!result) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=zoom_failed`
    );
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?success=zoom`
  );
}
