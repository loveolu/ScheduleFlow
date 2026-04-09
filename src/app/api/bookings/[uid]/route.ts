import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      eventType: {
        select: {
          title: true,
          duration: true,
          color: true,
          description: true,
          locations: true,
          questions: true,
        },
      },
      user: {
        select: { name: true, email: true, username: true, avatarUrl: true, timezone: true },
      },
      attendees: true,
    },
  });

  if (!booking) {
    return errorResponse("Booking not found", 404);
  }

  return successResponse(booking);
}
