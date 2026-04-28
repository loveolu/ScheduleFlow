import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  // Auth gate: only the booking's host (event-type owner) or a team owner/admin
  // for team event types may read full booking details. Cuids are unguessable
  // in practice, but UIDs leak into emails / ICS files / URLs, so this endpoint
  // had no defense against PII enumeration.
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

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
          userId: true,
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

  const userId = session.user.id;
  const isHost = booking.userId === userId;
  const isEventTypeOwner = booking.eventType?.userId === userId;

  let isTeamAdmin = false;
  if (!isHost && !isEventTypeOwner) {
    // If this booking belongs to a team event type's host, allow team OWNER /
    // ADMIN members to read it as well. The current schema attaches bookings
    // to a User (not a TeamEventType), so this checks team membership via the
    // host's team affiliations.
    const adminMembership = await db.teamMember.findFirst({
      where: {
        userId,
        role: { in: ["OWNER", "ADMIN"] },
        team: {
          members: { some: { userId: booking.userId } },
        },
      },
      select: { id: true },
    });
    isTeamAdmin = adminMembership !== null;
  }

  if (!isHost && !isEventTypeOwner && !isTeamAdmin) {
    // Use 404 rather than 403 to avoid confirming the existence of a booking
    // to non-owners.
    return errorResponse("Booking not found", 404);
  }

  return successResponse(booking);
}
