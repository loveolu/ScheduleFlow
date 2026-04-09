import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-helpers";

const createTeamSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const teams = await db.team.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, image: true },
            },
          },
        },
        _count: {
          select: { eventTypes: true, members: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const teamsWithRole = teams.map((team) => {
      const currentMember = team.members.find(
        (m) => m.userId === session.user.id
      );
      return {
        ...team,
        currentUserRole: currentMember?.role ?? null,
      };
    });

    return successResponse(teamsWithRole);
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return errorResponse("Failed to fetch teams", 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const result = await validateBody(request, createTeamSchema);
  if (result.error) return result.error;

  const { data } = result;

  try {
    const existing = await db.team.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return errorResponse("A team with this slug already exists", 409);
    }

    const team = await db.team.create({
      data: {
        name: data.name,
        slug: data.slug,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, image: true },
            },
          },
        },
      },
    });

    return successResponse(team, 201);
  } catch (error) {
    console.error("Failed to create team:", error);
    return errorResponse("Failed to create team", 500);
  }
}
