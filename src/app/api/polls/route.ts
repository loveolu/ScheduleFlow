import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { z } from "zod";

// Polls are stored using a lightweight JSON approach on the Booking metadata
// In production you'd have a dedicated Poll table. For MVP, we store poll data
// as event types with special metadata.

const pollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  options: z.array(
    z.object({
      date: z.string(), // YYYY-MM-DD
      startTime: z.string(), // HH:mm
      endTime: z.string(),
    })
  ).min(2),
  inviteeEmails: z.array(z.string().email()).min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const polls = await db.eventType.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      questions: true,
      createdAt: true,
    },
  });

  const pollList = polls
    .filter((p) => {
      const q = p.questions as Record<string, unknown>;
      return q && typeof q === "object" && "isPoll" in q;
    })
    .map((p) => {
      const q = p.questions as Record<string, unknown>;
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        options: (q.options as unknown[]) || [],
        votes: (q.votes as unknown[]) || [],
        inviteeEmails: (q.inviteeEmails as string[]) || [],
        createdAt: p.createdAt,
      };
    });

  return successResponse(pollList);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const body = await request.json();
  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid poll data", 400);

  const slug = `poll-${Date.now().toString(36)}`;

  const poll = await db.eventType.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      slug,
      description: parsed.data.description || null,
      duration: 0,
      isActive: true,
      questions: {
        isPoll: true,
        options: parsed.data.options,
        inviteeEmails: parsed.data.inviteeEmails,
        votes: [],
        finalized: false,
      } as never,
    },
  });

  return successResponse({ id: poll.id, slug: poll.slug }, 201);
}
