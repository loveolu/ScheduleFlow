import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { eventTypeSchema } from "@/lib/validations";
import { successResponse, errorResponse, validateBody } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const eventTypes = await db.eventType.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    return successResponse(eventTypes);
  } catch (error) {
    console.error("Failed to fetch event types:", error);
    return errorResponse("Failed to fetch event types", 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const result = await validateBody(request, eventTypeSchema);
  if (result.error) return result.error;

  const { data } = result;

  try {
    const existing = await db.eventType.findUnique({
      where: {
        userId_slug: {
          userId: session.user.id,
          slug: data.slug,
        },
      },
    });

    if (existing) {
      return errorResponse("An event type with this slug already exists", 409);
    }

    const eventType = await db.eventType.create({
      data: {
        ...data,
        userId: session.user.id,
        locations: data.locations ?? [],
        questions: data.questions ?? [],
      },
    });

    return successResponse(eventType, 201);
  } catch (error) {
    console.error("Failed to create event type:", error);
    return errorResponse("Failed to create event type", 500);
  }
}
