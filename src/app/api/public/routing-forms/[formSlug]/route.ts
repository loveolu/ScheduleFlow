import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formSlug: string }> }
) {
  const { formSlug } = await params;

  const eventType = await db.eventType.findFirst({
    where: {
      slug: formSlug,
      isActive: true,
    },
    include: {
      user: { select: { username: true, name: true } },
    },
  });

  if (!eventType) {
    return errorResponse("Form not found", 404);
  }

  const questions = eventType.questions as Record<string, unknown>;
  if (!questions || !("isRoutingForm" in questions)) {
    return errorResponse("Not a routing form", 404);
  }

  return successResponse({
    title: eventType.title,
    description: eventType.description,
    fields: questions.fields || [],
    user: {
      username: eventType.user.username,
      name: eventType.user.name,
    },
  });
}
