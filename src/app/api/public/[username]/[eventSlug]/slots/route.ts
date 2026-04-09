import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { getAvailableSlots, type ScheduleRule } from "@/lib/slots";
import { getExternalBusyTimes } from "@/lib/integrations";
import { parseISO, startOfDay, endOfDay } from "date-fns";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string; eventSlug: string }> }
) {
  const { username, eventSlug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const dateStr = searchParams.get("date");
  const timezone = searchParams.get("timezone") || "America/New_York";

  if (!dateStr) {
    return errorResponse("date query parameter is required");
  }

  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, timezone: true },
  });

  if (!user) {
    return errorResponse("User not found", 404);
  }

  const eventType = await db.eventType.findFirst({
    where: { userId: user.id, slug: eventSlug, isActive: true },
  });

  if (!eventType) {
    return errorResponse("Event type not found", 404);
  }

  // Get availability (event-type specific or default)
  const availability = await db.availability.findFirst({
    where: {
      userId: user.id,
      OR: [{ eventTypeId: eventType.id }, { isDefault: true }],
    },
    orderBy: { eventTypeId: "desc" }, // prefer event-type specific
  });

  if (!availability) {
    return successResponse({ slots: [] });
  }

  const date = parseISO(dateStr);

  // Get existing bookings for the day
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const existingBookings = await db.booking.findMany({
    where: {
      userId: user.id,
      status: { in: ["CONFIRMED", "PENDING"] },
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
    },
    select: { startTime: true, endTime: true },
  });

  // Get schedule overrides
  const overrides = await db.scheduleOverride.findMany({
    where: { userId: user.id },
  });

  // Count bookings for the day (for max bookings per day)
  const dayBookingCount = await db.booking.count({
    where: {
      eventTypeId: eventType.id,
      status: { in: ["CONFIRMED", "PENDING"] },
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
    },
  });

  const slots = getAvailableSlots({
    date,
    hostTimezone: user.timezone,
    inviteeTimezone: timezone,
    schedules: availability.schedules as unknown as ScheduleRule[],
    overrides: overrides.map((o) => ({
      date: o.date,
      isBlocked: o.isBlocked,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
    existingBookings: existingBookings.map((b) => ({
      start: b.startTime,
      end: b.endTime,
    })),
    externalBusyTimes: await getExternalBusyTimes(user.id, dayStart, dayEnd),
    config: {
      duration: eventType.duration,
      bufferBefore: eventType.bufferTimeBefore,
      bufferAfter: eventType.bufferTimeAfter,
      minimumNotice: eventType.minimumNotice,
      maxAdvanceBooking: eventType.maxAdvanceBooking,
      maxBookingsPerDay: eventType.maxBookingsPerDay,
    },
  });

  return successResponse({ slots });
}
