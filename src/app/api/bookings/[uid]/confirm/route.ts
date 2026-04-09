import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { sendBookingConfirmedHost, sendBookingConfirmedInvitee } from "@/lib/email";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { uid } = await params;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      eventType: { select: { title: true } },
      user: { select: { id: true, name: true, email: true, timezone: true } },
    },
  });

  if (!booking) {
    return errorResponse("Booking not found", 404);
  }

  if (booking.user.id !== session.user.id) {
    return errorResponse("Unauthorized", 403);
  }

  if (booking.status !== "PENDING") {
    return errorResponse("Only pending bookings can be confirmed", 400);
  }

  const updated = await db.booking.update({
    where: { uid },
    data: { status: "CONFIRMED" },
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
  };

  sendBookingConfirmedHost(emailData).catch(console.error);
  sendBookingConfirmedInvitee(emailData).catch(console.error);

  return successResponse(updated);
}
