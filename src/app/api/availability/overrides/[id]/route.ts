import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { id } = await params;

  const override = await db.scheduleOverride.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!override) {
    return errorResponse("Override not found", 404);
  }

  await db.scheduleOverride.delete({ where: { id } });

  return successResponse({ success: true });
}
