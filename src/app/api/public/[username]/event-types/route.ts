import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      eventTypes: {
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          duration: true,
          color: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    return errorResponse("User not found", 404);
  }

  return successResponse(user);
}
