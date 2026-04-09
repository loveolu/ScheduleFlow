import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse } from "@/lib/api-helpers";
import { ZoomService } from "@/lib/integrations/zoom";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const url = ZoomService.getAuthUrl(session.user.id);
  return NextResponse.redirect(url);
}
