import { db } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";
import { generateICS } from "@/lib/ics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: {
      eventType: { select: { title: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    return errorResponse("Booking not found", 404);
  }

  const icsContent = generateICS({
    title: `${booking.eventType.title} with ${booking.user.name}`,
    startTime: booking.startTime,
    endTime: booking.endTime,
    location: booking.location || booking.meetingUrl || undefined,
    uid: booking.uid,
    organizer: {
      name: booking.user.name || "Host",
      email: booking.user.email,
    },
    attendees: [
      { name: booking.inviteeName, email: booking.inviteeEmail },
    ],
  });

  if (!icsContent) {
    return errorResponse("Failed to generate ICS file", 500);
  }

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.eventType.title}.ics"`,
    },
  });
}
