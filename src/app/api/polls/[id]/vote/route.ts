import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const voteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  selectedOptions: z.array(z.number()).min(1), // indices of selected options
});

interface PollVote {
  name: string;
  email: string;
  selectedOptions: number[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Public endpoint — cap to 10 vote attempts / IP / minute. Doesn't replace
  // a CAPTCHA / email-verification (the dedup is still by self-supplied email
  // string), but it stops single-IP ballot stuffing.
  const limited = enforceRateLimit(request, {
    key: "polls-vote",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { id } = await params;
  const body = await request.json();
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid vote data", 400);

  // Polls live as JSON on EventType.questions (per the schema's "MVP shortcut"
  // comment). The previous code did a non-transactional read-modify-write on
  // that JSON column, so two simultaneous voters could both see N votes,
  // both append, and one write overwrites the other (lost-update).
  //
  // Fix: wrap in a Postgres transaction with `SELECT ... FOR UPDATE` to take
  // a row-level lock for the duration. Postgres-only is fine here — the app
  // runs against pg via @prisma/adapter-pg, and docker-compose stands up
  // postgres only. If we ever introduce a different backend the SELECT FOR
  // UPDATE will simply not apply locking and the race returns; revisit then.
  try {
    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; questions: unknown }>
      >(Prisma.sql`
        SELECT id, questions
        FROM event_types
        WHERE id = ${id}
        FOR UPDATE
      `);

      if (rows.length === 0) {
        return { kind: "not_found" as const };
      }

      const questions = (rows[0]!.questions || {}) as Record<string, unknown>;
      if (!questions.isPoll) {
        return { kind: "not_a_poll" as const };
      }
      if (questions.finalized) {
        return { kind: "finalized" as const };
      }

      const existingVotes = (questions.votes as PollVote[]) || [];
      const alreadyVoted = existingVotes.some(
        (v) => v.email === parsed.data.email
      );
      if (alreadyVoted) {
        return { kind: "already_voted" as const };
      }

      const updatedVotes: PollVote[] = [
        ...existingVotes,
        {
          name: parsed.data.name,
          email: parsed.data.email,
          selectedOptions: parsed.data.selectedOptions,
        },
      ];

      await tx.eventType.update({
        where: { id },
        data: {
          questions: {
            ...questions,
            votes: updatedVotes,
          } as never,
        },
      });

      return { kind: "ok" as const };
    });

    switch (result.kind) {
      case "not_found":
        return errorResponse("Poll not found", 404);
      case "not_a_poll":
        return errorResponse("Not a poll", 404);
      case "finalized":
        return errorResponse("Poll is already finalized", 400);
      case "already_voted":
        return errorResponse("You have already voted", 400);
      case "ok":
        return successResponse({ success: true });
    }
  } catch (e) {
    console.error("Poll vote error:", e);
    return errorResponse("Internal server error", 500);
  }
}
