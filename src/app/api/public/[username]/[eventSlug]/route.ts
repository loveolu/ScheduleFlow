import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string; eventSlug: string }> }
) {
  const { username, eventSlug } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, avatarUrl: true, timezone: true },
  });

  if (!user) {
    return errorResponse("User not found", 404);
  }

  const eventType = await db.eventType.findFirst({
    where: { userId: user.id, slug: eventSlug, isActive: true },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      duration: true,
      color: true,
      locations: true,
      questions: true,
      hideEventTypeDetails: true,
      requiresConfirmation: true,
    },
  });

  if (!eventType) {
    return errorResponse("Event type not found", 404);
  }

  return successResponse({ user, eventType });
}
