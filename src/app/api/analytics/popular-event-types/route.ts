import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const userId = session.user.id;

  const results = await db.booking.groupBy({
    by: ["eventTypeId"],
    where: { userId },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const eventTypeIds = results.map((r) => r.eventTypeId);

  const eventTypes = await db.eventType.findMany({
    where: { id: { in: eventTypeIds } },
    select: { id: true, title: true, color: true },
  });

  const eventTypeMap = new Map(eventTypes.map((et) => [et.id, et]));

  const data = results.map((r) => {
    const et = eventTypeMap.get(r.eventTypeId);
    return {
      eventTypeId: r.eventTypeId,
      title: et?.title ?? "Unknown",
      color: et?.color ?? "#6366F1",
      count: r._count.id,
    };
  });

  return successResponse(data);
}
