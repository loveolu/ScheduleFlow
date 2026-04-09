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

  try {
    const booking = await db.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return errorResponse("Waitlist entry not found", 404);
    }

    if (booking.userId !== session.user.id) {
      return errorResponse("Unauthorized", 403);
    }

    const metadata = booking.metadata as Record<string, unknown>;
    if (booking.status !== "PENDING" || !metadata?.waitlist) {
      return errorResponse("Not a waitlist entry", 400);
    }

    await db.booking.delete({
      where: { id },
    });

    return successResponse({ message: "Waitlist entry removed" });
  } catch (error) {
    console.error("Waitlist DELETE error:", error);
    return errorResponse("Internal server error", 500);
  }
}
