import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const poll = await db.eventType.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, username: true, avatarUrl: true } },
    },
  });

  if (!poll) return errorResponse("Poll not found", 404);

  const questions = poll.questions as Record<string, unknown>;
  if (!questions?.isPoll) return errorResponse("Not a poll", 404);

  return successResponse({
    id: poll.id,
    title: poll.title,
    description: poll.description,
    options: questions.options || [],
    votes: questions.votes || [],
    finalized: questions.finalized || false,
    host: poll.user,
  });
}
