import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Public endpoint — cap to 5 joins / IP / minute so bots can't flood
  // Booking rows with metadata.waitlist=true.
  const limited = enforceRateLimit(request, {
    key: "waitlist-join",
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const { eventTypeId, date, name, email, timezone } = body;

    if (!eventTypeId || !date || !name || !email || !timezone) {
      return errorResponse("Missing required fields: eventTypeId, date, name, email, timezone", 400);
    }

    const eventType = await db.eventType.findUnique({
      where: { id: eventTypeId },
      select: { id: true, userId: true, duration: true, title: true },
    });

    if (!eventType) {
      return errorResponse("Event type not found", 404);
    }

    const startTime = new Date(date);
    const endTime = new Date(startTime.getTime() + eventType.duration * 60 * 1000);

    const booking = await db.booking.create({
      data: {
        eventTypeId,
        userId: eventType.userId,
        inviteeName: name,
        inviteeEmail: email,
        inviteeTimezone: timezone,
        startTime,
        endTime,
        status: "PENDING",
        metadata: { waitlist: true } as never,
      },
    });

    return successResponse({ id: booking.id, uid: booking.uid }, 201);
  } catch (error) {
    console.error("Waitlist POST error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const waitlistEntries = await db.booking.findMany({
      where: {
        userId: session.user.id,
        status: "PENDING",
        metadata: {
          path: ["waitlist"],
          equals: true,
        },
      },
      include: {
        eventType: {
          select: { title: true, duration: true, color: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse({ waitlist: waitlistEntries });
  } catch (error) {
    console.error("Waitlist GET error:", error);
    return errorResponse("Internal server error", 500);
  }
}
