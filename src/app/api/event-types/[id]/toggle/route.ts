import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-helpers";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { id } = await context.params;

  const eventType = await db.eventType.findUnique({
    where: { id },
  });

  if (!eventType) return errorResponse("Event type not found", 404);
  if (eventType.userId !== session.user.id) return errorResponse("Forbidden", 403);

  try {
    const updated = await db.eventType.update({
      where: { id },
      data: { isActive: !eventType.isActive },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("Failed to toggle event type:", error);
    return errorResponse("Failed to toggle event type", 500);
  }
}
