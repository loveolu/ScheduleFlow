import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-helpers";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

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
    return errorResponse("Only owners and admins can invite members", 403);
  }

  const validation = await validateBody(request, inviteSchema);
  if (validation.error) return validation.error;

  const { data } = validation;

  try {
    const invitedUser = await db.user.findUnique({
      where: { email: data.email },
      select: { id: true, name: true, email: true, avatarUrl: true, image: true },
    });

    if (!invitedUser) {
      return errorResponse("No user found with that email address", 404);
    }

    const existingMember = team.members.find(
      (m) => m.userId === invitedUser.id
    );
    if (existingMember) {
      return errorResponse("This user is already a member of this team", 409);
    }

    const member = await db.teamMember.create({
      data: {
        teamId: team.id,
        userId: invitedUser.id,
        role: data.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, image: true },
        },
      },
    });

    return successResponse(member, 201);
  } catch (error) {
    console.error("Failed to invite member:", error);
    return errorResponse("Failed to invite member", 500);
  }
}
