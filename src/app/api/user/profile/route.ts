import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileSchema } from "@/lib/validations";
import { errorResponse, successResponse, validateBody } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      timezone: true,
      bio: true,
      avatarUrl: true,
      plan: true,
      stripeCustomerId: true,
    },
  });

  return successResponse(user);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { data, error } = await validateBody(request, profileSchema);
  if (error) return error;

  // Check username uniqueness
  if (data.username) {
    const existing = await db.user.findFirst({
      where: {
        username: data.username,
        id: { not: session.user.id },
      },
    });

    if (existing) {
      return errorResponse("Username is already taken", 409);
    }
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      username: data.username,
      timezone: data.timezone,
      bio: data.bio || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      timezone: true,
      bio: true,
    },
  });

  return successResponse(user);
}
