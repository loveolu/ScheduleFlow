import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

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

  const results = await db.$queryRawUnsafe<
    Array<{ day_of_week: number; hour: number; count: bigint }>
  >(
    `SELECT
       EXTRACT(DOW FROM "startTime")::int as day_of_week,
       EXTRACT(HOUR FROM "startTime")::int as hour,
       COUNT(*)::bigint as count
     FROM "bookings"
     WHERE "userId" = $1
       AND "startTime" >= $2
       AND "startTime" <= $3
     GROUP BY day_of_week, hour
     ORDER BY day_of_week, hour`,
    userId,
    fromDate,
    toDate
  );

  const data = results.map((row) => ({
    dayOfWeek: row.day_of_week,
    hour: row.hour,
    count: Number(row.count),
  }));

  return successResponse(data);
}
