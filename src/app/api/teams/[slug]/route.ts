import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-helpers";

const updateTeamSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
});

async function getTeamAndMember(slug: string, userId: string) {
  const team = await db.team.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, image: true },
          },
        },
      },
      eventTypes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!team) return { error: errorResponse("Team not found", 404) };

  const member = team.members.find((m) => m.userId === userId);
  if (!member) return { error: errorResponse("You are not a member of this team", 403) };

  return { team, member };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { slug } = await context.params;
  const result = await getTeamAndMember(slug, session.user.id);
  if (result.error) return result.error;

  return successResponse({
    ...result.team,
    currentUserRole: result.member!.role,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { slug } = await context.params;
  const result = await getTeamAndMember(slug, session.user.id);
  if (result.error) return result.error;

  if (result.member!.role !== "OWNER" && result.member!.role !== "ADMIN") {
    return errorResponse("Only owners and admins can update team settings", 403);
  }

  const validation = await validateBody(request, updateTeamSchema);
  if (validation.error) return validation.error;

  const { data } = validation;

  try {
    if (data.slug && data.slug !== result.team!.slug) {
      const existing = await db.team.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        return errorResponse("A team with this slug already exists", 409);
      }
    }

    const updated = await db.team.update({
      where: { id: result.team!.id },
      data,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, image: true },
            },
          },
        },
        eventTypes: true,
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("Failed to update team:", error);
    return errorResponse("Failed to update team", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { slug } = await context.params;
  const result = await getTeamAndMember(slug, session.user.id);
  if (result.error) return result.error;

  if (result.member!.role !== "OWNER") {
    return errorResponse("Only team owners can delete a team", 403);
  }

  try {
    await db.team.delete({ where: { id: result.team!.id } });
    return successResponse({ success: true });
  } catch (error) {
    console.error("Failed to delete team:", error);
    return errorResponse("Failed to delete team", 500);
  }
}
