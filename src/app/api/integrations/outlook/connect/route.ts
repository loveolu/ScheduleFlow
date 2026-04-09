import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api-helpers";
import { OutlookCalendarService } from "@/lib/integrations/outlook-calendar";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const url = OutlookCalendarService.getAuthUrl(session.user.id);
  return NextResponse.redirect(url);
}
