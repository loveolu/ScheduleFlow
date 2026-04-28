import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import {
  sendBookingCancelledHost,
  sendBookingCancelledInvitee,
} from "@/lib/email";
import { deleteCalendarEvents } from "@/lib/integrations";
import { deliverWebhooks } from "@/lib/webhooks";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  // Auth gate: only the booking's host (event-type owner) or a team
  // OWNER/ADMIN may cancel. Previously anyone with the UID could trigger
  // cancellation emails, calendar deletes, and webhooks.
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await request.json().catch(() => ({}));
  const reason = body.reason || null;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      eventType: { select: { title: true, userId: true } },
      user: { select: { name: true, email: true, timezone: true } },
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
    // 404 rather than 403 to avoid confirming the existence of a booking.
    return errorResponse("Booking not found", 404);
  }

  if (booking.status === "CANCELLED") {
    return errorResponse("Booking is already cancelled", 400);
  }

  const updated = await db.booking.update({
    where: { uid },
    data: {
      status: "CANCELLED",
      cancellationReason: reason,
    },
  });

  const emailData = {
    hostName: booking.user.name || "Host",
    hostEmail: booking.user.email,
    inviteeName: booking.inviteeName,
    inviteeEmail: booking.inviteeEmail,
    eventTitle: booking.eventType.title,
    startTime: booking.startTime,
    endTime: booking.endTime,
    timezone: booking.inviteeTimezone,
    bookingUid: booking.uid,
    cancellationReason: reason || undefined,
  };

  sendBookingCancelledHost(emailData).catch(console.error);
  sendBookingCancelledInvitee(emailData).catch(console.error);

  // Delete calendar events from connected calendars
  const metadata = booking.metadata as Record<string, unknown> | null;
  const calendarEventIds = metadata?.calendarEventIds as
    | Record<string, string>
    | undefined;
  if (calendarEventIds) {
    deleteCalendarEvents(booking.userId, calendarEventIds).catch(console.error);
  }

  // Deliver webhooks
  deliverWebhooks(booking.userId, "booking.cancelled", {
    uid: booking.uid,
    inviteeName: booking.inviteeName,
    inviteeEmail: booking.inviteeEmail,
    eventType: booking.eventType.title,
    cancellationReason: reason,
  }).catch(console.error);

  return successResponse(updated);
}
