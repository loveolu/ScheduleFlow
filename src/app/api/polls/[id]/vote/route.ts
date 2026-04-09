import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { z } from "zod";

const voteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  selectedOptions: z.array(z.number()).min(1), // indices of selected options
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid vote data", 400);

  const poll = await db.eventType.findUnique({ where: { id } });
  if (!poll) return errorResponse("Poll not found", 404);

  const questions = poll.questions as Record<string, unknown>;
  if (!questions?.isPoll) return errorResponse("Not a poll", 404);
  if (questions.finalized) return errorResponse("Poll is already finalized", 400);

  const existingVotes = (questions.votes as Array<{
    name: string;
    email: string;
    selectedOptions: number[];
  }>) || [];

  // Check if this email already voted
  const alreadyVoted = existingVotes.some(
    (v) => v.email === parsed.data.email
  );
  if (alreadyVoted) {
    return errorResponse("You have already voted", 400);
  }

  const updatedVotes = [
    ...existingVotes,
    {
      name: parsed.data.name,
      email: parsed.data.email,
      selectedOptions: parsed.data.selectedOptions,
    },
  ];

  await db.eventType.update({
    where: { id },
    data: {
      questions: {
        ...questions,
        votes: updatedVotes,
      } as never,
    },
  });

  return successResponse({ success: true });
}
