import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validations";
import { errorResponse, successResponse, validateBody } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";
import { addMinutes } from "date-fns";
import {
  sendBookingConfirmedHost,
  sendBookingConfirmedInvitee,
  sendBookingPendingApprovalHost,
  sendBookingRequestReceivedInvitee,
} from "@/lib/email";
import {
  resolveBookingLocation,
  createCalendarEvents,
} from "@/lib/integrations";
import { deliverWebhooks } from "@/lib/webhooks";

export async function POST(request: Request) {
  // Public endpoint — anyone can hit it. Cap to 10 bookings / IP / minute so
  // bots can't spray Calendly-themed spam to arbitrary inviteeEmails through
  // our SMTP / calendar integrations.
  const limited = enforceRateLimit(request, {
    key: "public-bookings",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { data, error } = await validateBody(request, bookingSchema);
  if (error) return error;

  const eventType = await db.eventType.findUnique({
    where: { id: data.eventTypeId },
    include: {
      user: {
        select: { id: true, name: true, email: true, timezone: true },
      },
    },
  });

  if (!eventType || !eventType.isActive) {
    return errorResponse("Event type not found or inactive", 404);
  }

  const startTime = new Date(data.startTime);
  const endTime = addMinutes(startTime, eventType.duration);

  // Check for conflicts
  const conflict = await db.booking.findFirst({
    where: {
      userId: eventType.userId,
      status: { in: ["CONFIRMED", "PENDING"] },
      OR: [
        {
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      ],
    },
  });

  if (conflict) {
    return errorResponse("This time slot is no longer available", 409);
  }

  const status = eventType.requiresConfirmation ? "PENDING" : "CONFIRMED";

  // Resolve location and meeting URL from integrations
  const locations = eventType.locations as Array<{
    type: string;
    value?: string;
  }>;
  const { location, meetingUrl } = await resolveBookingLocation(
    eventType.userId,
    locations,
    {
      title: eventType.title,
      startTime,
      duration: eventType.duration,
    }
  );

  const booking = await db.booking.create({
    data: {
      eventTypeId: eventType.id,
      userId: eventType.userId,
      inviteeName: data.name,
      inviteeEmail: data.email,
      inviteeTimezone: data.timezone,
      startTime,
      endTime,
      status,
      notes: data.notes || null,
      metadata: (data.responses ? { responses: data.responses } : {}) as never,
      location,
      meetingUrl: meetingUrl || null,
    },
    include: { eventType: true },
  });

  // Create attendees for group bookings
  if (data.guests && data.guests.length > 0) {
    await db.bookingAttendee.createMany({
      data: data.guests.map((guest) => ({
        bookingId: booking.id,
        name: guest.name,
        email: guest.email,
        timezone: data.timezone,
      })),
    });
  }

  // Create calendar events on connected calendars (fire and forget)
  if (status === "CONFIRMED") {
    createCalendarEvents(eventType.userId, {
      title: `${eventType.title} with ${data.name}`,
      description: `Booking via ScheduleFlow`,
      startTime,
      endTime,
      attendees: [{ name: data.name, email: data.email }],
      location: meetingUrl || location,
    })
      .then(async ({ calendarEventIds }) => {
        if (Object.keys(calendarEventIds).length > 0) {
          await db.booking.update({
            where: { id: booking.id },
            data: {
              metadata: {
                ...(typeof booking.metadata === "object" && booking.metadata
                  ? (booking.metadata as Record<string, unknown>)
                  : {}),
                calendarEventIds,
              } as never,
            },
          });
        }
      })
      .catch(console.error);
  }

  // Send emails (fire and forget)
  const emailData = {
    hostName: eventType.user.name || "Host",
    hostEmail: eventType.user.email,
    inviteeName: data.name,
    inviteeEmail: data.email,
    eventTitle: eventType.title,
    startTime,
    endTime,
    timezone: data.timezone,
    location,
    meetingUrl,
    bookingUid: booking.uid,
    notes: data.notes,
  };

  if (status === "CONFIRMED") {
    sendBookingConfirmedHost(emailData).catch(console.error);
    sendBookingConfirmedInvitee(emailData).catch(console.error);
  } else {
    sendBookingPendingApprovalHost(emailData).catch(console.error);
    sendBookingRequestReceivedInvitee(emailData).catch(console.error);
  }

  // Deliver webhooks (fire and forget)
  deliverWebhooks(eventType.userId, "booking.created", {
    uid: booking.uid,
    status: booking.status,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    inviteeName: data.name,
    inviteeEmail: data.email,
    eventType: eventType.title,
    meetingUrl: booking.meetingUrl,
  }).catch(console.error);

  return successResponse(
    {
      uid: booking.uid,
      status: booking.status,
      startTime: booking.startTime,
      endTime: booking.endTime,
      meetingUrl: booking.meetingUrl,
      eventType: {
        title: eventType.title,
        duration: eventType.duration,
      },
    },
    201
  );
}
