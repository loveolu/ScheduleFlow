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
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || null;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      eventType: { select: { title: true } },
      user: { select: { name: true, email: true, timezone: true } },
    },
  });

  if (!booking) {
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
