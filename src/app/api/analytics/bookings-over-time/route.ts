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
  const interval = searchParams.get("interval") || "day";

  if (!from || !to) {
    return errorResponse("Missing 'from' and 'to' query parameters", 400);
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  if (!["day", "week", "month"].includes(interval)) {
    return errorResponse("Invalid interval. Use 'day', 'week', or 'month'", 400);
  }

  const userId = session.user.id;

  let truncExpr: string;
  if (interval === "day") {
    truncExpr = `date_trunc('day', "startTime")`;
  } else if (interval === "week") {
    truncExpr = `date_trunc('week', "startTime")`;
  } else {
    truncExpr = `date_trunc('month', "startTime")`;
  }

  const results = await db.$queryRawUnsafe<
    Array<{ date: Date; count: bigint }>
  >(
    `SELECT ${truncExpr} as date, COUNT(*)::bigint as count
     FROM "bookings"
     WHERE "userId" = $1
       AND "startTime" >= $2
       AND "startTime" <= $3
     GROUP BY date
     ORDER BY date ASC`,
    userId,
    fromDate,
    toDate
  );

  const data = results.map((row) => ({
    date: row.date.toISOString().split("T")[0],
    count: Number(row.count),
  }));

  return successResponse(data);
}
