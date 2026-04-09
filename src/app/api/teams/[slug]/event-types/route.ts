import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-helpers";

const teamEventTypeSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  duration: z.number().int().min(5).max(480).default(30),
  color: z.string().default("#6366F1"),
  isActive: z.boolean().default(true),
  requiresConfirmation: z.boolean().default(false),
  maxInvitees: z.number().int().min(1).default(1),
  bufferTimeBefore: z.number().int().min(0).default(0),
  bufferTimeAfter: z.number().int().min(0).default(0),
  minimumNotice: z.number().int().min(0).default(60),
  locations: z
    .array(
      z.object({
        type: z.string(),
        value: z.string().optional(),
        label: z.string().optional(),
      })
    )
    .default([]),
  questions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["text", "textarea", "select", "checkbox", "phone", "email"]),
        label: z.string(),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional(),
        placeholder: z.string().optional(),
      })
    )
    .default([]),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { slug } = await context.params;

  const team = await db.team.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!team) return errorResponse("Team not found", 404);

  const isMember = team.members.some((m) => m.userId === session.user.id);
  if (!isMember) return errorResponse("You are not a member of this team", 403);

  try {
    const eventTypes = await db.teamEventType.findMany({
      where: { teamId: team.id },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(eventTypes);
  } catch (error) {
    console.error("Failed to fetch team event types:", error);
    return errorResponse("Failed to fetch team event types", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { slug } = await context.params;

  const team = await db.team.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!team) return errorResponse("Team not found", 404);

  const currentMember = team.members.find((m) => m.userId === session.user.id);
  if (!currentMember) return errorResponse("You are not a member of this team", 403);

  if (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN") {
    return errorResponse("Only owners and admins can create event types", 403);
  }

  const validation = await validateBody(request, teamEventTypeSchema);
  if (validation.error) return validation.error;

  const { data } = validation;

  try {
    const existing = await db.teamEventType.findUnique({
      where: {
        teamId_slug: {
          teamId: team.id,
          slug: data.slug,
        },
      },
    });

    if (existing) {
      return errorResponse("An event type with this slug already exists", 409);
    }

    const eventType = await db.teamEventType.create({
      data: {
        ...data,
        teamId: team.id,
        locations: data.locations ?? [],
        questions: data.questions ?? [],
      },
    });

    return successResponse(eventType, 201);
  } catch (error) {
    console.error("Failed to create team event type:", error);
    return errorResponse("Failed to create team event type", 500);
  }
}
