import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { BookingStatus } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const searchParams = request.nextUrl.searchParams;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return errorResponse("Missing 'from' and 'to' query parameters", 400);
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  const userId = session.user.id;

  const where = {
    userId,
    startTime: { gte: fromDate, lte: toDate },
  };

  const [
    totalBookings,
    confirmedCount,
    cancelledCount,
    noShowCount,
    pendingCount,
    uniqueInvitees,
  ] = await Promise.all([
    db.booking.count({ where }),
    db.booking.count({ where: { ...where, status: BookingStatus.CONFIRMED } }),
    db.booking.count({ where: { ...where, status: BookingStatus.CANCELLED } }),
    db.booking.count({ where: { ...where, status: BookingStatus.NO_SHOW } }),
    db.booking.count({ where: { ...where, status: BookingStatus.PENDING } }),
    db.booking
      .findMany({
        where,
        select: { inviteeEmail: true },
        distinct: ["inviteeEmail"],
      })
      .then((results) => results.length),
  ]);

  const cancellationRate =
    totalBookings > 0
      ? Math.round((cancelledCount / totalBookings) * 1000) / 10
      : 0;
  const noShowRate =
    totalBookings > 0
      ? Math.round((noShowCount / totalBookings) * 1000) / 10
      : 0;

  return successResponse({
    totalBookings,
    confirmedCount,
    cancelledCount,
    noShowCount,
    pendingCount,
    cancellationRate,
    noShowRate,
    uniqueInvitees,
  });
}
