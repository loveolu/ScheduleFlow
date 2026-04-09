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
  const status = searchParams.get("status") as BookingStatus | null;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where = {
    userId: session.user.id,
    ...(status ? { status } : {}),
  };

  const [bookings, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        eventType: {
          select: { title: true, duration: true, color: true },
        },
      },
      orderBy: { startTime: "desc" },
      skip,
      take: limit,
    }),
    db.booking.count({ where }),
  ]);

  return successResponse({
    bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
