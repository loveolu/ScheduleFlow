import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { z } from "zod";

const notesSchema = z.object({
  notes: z.string().max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { uid } = await params;
  const body = await request.json();
  const parsed = notesSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid notes", 400);
  }

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
    data: { notes: parsed.data.notes },
  });

  return successResponse(updated);
}
