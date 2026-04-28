import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validations";
import { errorResponse, successResponse, validateBody } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getIdempotencyKey, withIdempotency } from "@/lib/idempotency";
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

  // Idempotency key: lets the booking widget retry safely on network blips
  // and collapses panicked double-clicks to a single booking. Optional —
  // older clients without the header still work; they just lose the
  // double-submit safety. The transactional conflict re-check below is the
  // ultimate defense against duplicate bookings either way.
  const idempotencyKey = getIdempotencyKey(request);

  const compute = async () => {
    return await createBooking(data);
  };

  if (idempotencyKey) {
    const replay = await withIdempotency(
      `public-bookings:${data.eventTypeId}`,
      idempotencyKey,
      compute
    );
    return new NextResponse(replay.body, {
      status: replay.status,
      headers: {
        "Content-Type": "application/json",
        "Idempotent-Replayed": replay.replayed ? "true" : "false",
      },
    });
  }

  const result = await compute();
  return NextResponse.json(result.body, { status: result.status });
}

interface BookingInput {
  eventTypeId: string;
  startTime: string;
  name: string;
  email: string;
  timezone: string;
  notes?: string;
  guests?: { name: string; email: string }[];
  responses?: Record<string, unknown>;
}

async function createBooking(data: BookingInput) {
  const eventType = await db.eventType.findUnique({
    where: { id: data.eventTypeId },
    include: {
      user: {
        select: { id: true, name: true, email: true, timezone: true },
      },
    },
  });

  if (!eventType || !eventType.isActive) {
    return { status: 404, body: { error: "Event type not found or inactive" } };
  }

  const startTime = new Date(data.startTime);
  const endTime = addMinutes(startTime, eventType.duration);

  // Race-safe conflict detection: the previous code did a non-transactional
  // findFirst-then-create, so two concurrent requests for the same slot could
  // both pass the conflict check and both call .create(). Wrap the
  // re-check + create in a single Postgres transaction so the conflict
  // window collapses; serializable isolation makes the read consistent.
  // Without a unique constraint on (userId, startTime) at the schema level
  // (which we'd need a migration for), this is the strongest race protection
  // we can ship in a code-only pass.
  let booking;
  try {
    booking = await db.$transaction(
      async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            userId: eventType.userId,
            status: { in: ["CONFIRMED", "PENDING"] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        });

        if (conflict) {
          throw new BookingConflict();
        }

        const status = eventType.requiresConfirmation ? "PENDING" : "CONFIRMED";

        const created = await tx.booking.create({
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
            metadata: (data.responses
              ? { responses: data.responses }
              : {}) as never,
          },
          include: { eventType: true },
        });

        if (data.guests && data.guests.length > 0) {
          await tx.bookingAttendee.createMany({
            data: data.guests.map((guest) => ({
              bookingId: created.id,
              name: guest.name,
              email: guest.email,
              timezone: data.timezone,
            })),
          });
        }

        return created;
      },
      {
        isolationLevel: "Serializable",
      }
    );
  } catch (e) {
    if (e instanceof BookingConflict) {
      return {
        status: 409,
        body: { error: "This time slot is no longer available" },
      };
    }
    // Postgres serialization-failure surfaces as P2034 from Prisma; map it to
    // a 409 too, since the most likely cause is a concurrent booking.
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2034"
    ) {
      return {
        status: 409,
        body: { error: "This time slot is no longer available" },
      };
    }
    console.error("Booking creation error:", e);
    return {
      status: 500,
      body: { error: "Failed to create booking" },
    };
  }

  // Resolve location/meeting URL outside the transaction (calls external
  // integrations — mustn't hold a DB transaction open across that latency).
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

  if (location || meetingUrl) {
    await db.booking.update({
      where: { id: booking.id },
      data: { location, meetingUrl: meetingUrl || null },
    });
    booking.location = location;
    booking.meetingUrl = meetingUrl || null;
  }

  // Create calendar events on connected calendars (fire and forget)
  if (booking.status === "CONFIRMED") {
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
            where: { id: booking!.id },
            data: {
              metadata: {
                ...(typeof booking!.metadata === "object" && booking!.metadata
                  ? (booking!.metadata as Record<string, unknown>)
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

  if (booking.status === "CONFIRMED") {
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

  return {
    status: 201,
    body: {
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
  };
}

class BookingConflict extends Error {}

// Re-export of successResponse/errorResponse retained for type compatibility.
void successResponse;
void errorResponse;
