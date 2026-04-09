import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-helpers";

const updateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { slug, userId: targetUserId } = await context.params;

  const team = await db.team.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!team) return errorResponse("Team not found", 404);

  const currentMember = team.members.find((m) => m.userId === session.user.id);
  if (!currentMember) return errorResponse("You are not a member of this team", 403);

  if (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN") {
    return errorResponse("Only owners and admins can change member roles", 403);
  }

  const targetMember = team.members.find((m) => m.userId === targetUserId);
  if (!targetMember) return errorResponse("Member not found", 404);

  // Admins cannot change the role of owners or other admins
  if (currentMember.role === "ADMIN" && targetMember.role !== "MEMBER") {
    return errorResponse("Admins can only change the role of regular members", 403);
  }

  const validation = await validateBody(request, updateRoleSchema);
  if (validation.error) return validation.error;

  const { data } = validation;

  // Only owners can promote someone to OWNER
  if (data.role === "OWNER" && currentMember.role !== "OWNER") {
    return errorResponse("Only owners can promote members to owner", 403);
  }

  try {
    const updated = await db.teamMember.update({
      where: { id: targetMember.id },
      data: { role: data.role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, image: true },
        },
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("Failed to update member role:", error);
    return errorResponse("Failed to update member role", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ slug: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { slug, userId: targetUserId } = await context.params;

  const team = await db.team.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!team) return errorResponse("Team not found", 404);

  const currentMember = team.members.find((m) => m.userId === session.user.id);
  if (!currentMember) return errorResponse("You are not a member of this team", 403);

  const targetMember = team.members.find((m) => m.userId === targetUserId);
  if (!targetMember) return errorResponse("Member not found", 404);

  // Members can remove themselves
  const isSelf = session.user.id === targetUserId;
  if (!isSelf && currentMember.role !== "OWNER" && currentMember.role !== "ADMIN") {
    return errorResponse("Only owners and admins can remove members", 403);
  }

  // Admins cannot remove owners or other admins
  if (!isSelf && currentMember.role === "ADMIN" && targetMember.role !== "MEMBER") {
    return errorResponse("Admins can only remove regular members", 403);
  }

  // Cannot remove the last owner
  if (targetMember.role === "OWNER") {
    const ownerCount = team.members.filter((m) => m.role === "OWNER").length;
    if (ownerCount <= 1) {
      return errorResponse(
        "Cannot remove the last owner. Transfer ownership first.",
        400
      );
    }
  }

  try {
    await db.teamMember.delete({ where: { id: targetMember.id } });
    return successResponse({ success: true });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return errorResponse("Failed to remove member", 500);
  }
}
