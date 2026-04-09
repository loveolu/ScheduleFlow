import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scheduleOverrideSchema } from "@/lib/validations";
import { errorResponse, successResponse, validateBody } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const overrides = await db.scheduleOverride.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "asc" },
  });

  return successResponse(overrides);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { data, error } = await validateBody(request, scheduleOverrideSchema);
  if (error) return error;

  const override = await db.scheduleOverride.create({
    data: {
      userId: session.user.id,
      date: new Date(data.date),
      isBlocked: data.isBlocked,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      reason: data.reason || null,
    },
  });

  return successResponse(override, 201);
}
