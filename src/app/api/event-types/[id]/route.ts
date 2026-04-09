import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { eventTypeSchema } from "@/lib/validations";
import { successResponse, errorResponse, validateBody } from "@/lib/api-helpers";

async function getEventTypeForUser(id: string, userId: string) {
  const eventType = await db.eventType.findUnique({
    where: { id },
  });

  if (!eventType) return { error: errorResponse("Event type not found", 404) };
  if (eventType.userId !== userId) return { error: errorResponse("Forbidden", 403) };

  return { eventType };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { id } = await context.params;
  const result = await getEventTypeForUser(id, session.user.id);
  if (result.error) return result.error;

  return successResponse(result.eventType);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { id } = await context.params;
  const ownerCheck = await getEventTypeForUser(id, session.user.id);
  if (ownerCheck.error) return ownerCheck.error;

  const validation = await validateBody(request, eventTypeSchema.partial());
  if (validation.error) return validation.error;

  const { data } = validation;

  try {
    if (data.slug && data.slug !== ownerCheck.eventType!.slug) {
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
    }

    const updated = await db.eventType.update({
      where: { id },
      data,
    });

    return successResponse(updated);
  } catch (error) {
    console.error("Failed to update event type:", error);
    return errorResponse("Failed to update event type", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { id } = await context.params;
  const ownerCheck = await getEventTypeForUser(id, session.user.id);
  if (ownerCheck.error) return ownerCheck.error;

  try {
    await db.eventType.delete({ where: { id } });
    return successResponse({ success: true });
  } catch (error) {
    console.error("Failed to delete event type:", error);
    return errorResponse("Failed to delete event type", 500);
  }
}
