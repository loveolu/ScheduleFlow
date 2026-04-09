import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { uid } = await params;

  const booking = await db.booking.findUnique({
    where: { uid },
    include: { user: { select: { id: true } } },
  });

  if (!booking) {
    return errorResponse("Booking not found", 404);
  }

  if (booking.user.id !== session.user.id) {
    return errorResponse("Unauthorized", 403);
  }

  const updated = await db.booking.update({
    where: { uid },
    data: { status: "NO_SHOW" },
  });

  return successResponse(updated);
}
