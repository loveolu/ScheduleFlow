import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { id } = await params;

  const webhook = await db.webhookSubscription.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!webhook) return errorResponse("Webhook not found", 404);

  await db.webhookSubscription.delete({ where: { id } });

  return successResponse({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const { id } = await params;
  const body = await request.json();

  const webhook = await db.webhookSubscription.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!webhook) return errorResponse("Webhook not found", 404);

  const updated = await db.webhookSubscription.update({
    where: { id },
    data: {
      isActive: body.isActive ?? webhook.isActive,
      url: body.url ?? webhook.url,
      events: body.events ?? webhook.events,
    },
    select: { id: true, url: true, events: true, isActive: true },
  });

  return successResponse(updated);
}
