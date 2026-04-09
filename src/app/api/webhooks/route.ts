import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { z } from "zod";
import crypto from "crypto";

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const webhooks = await db.webhookSubscription.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
    },
  });

  return successResponse(webhooks);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const body = await request.json();
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid webhook data", 400);
  }

  const signingSecret = crypto.randomBytes(32).toString("hex");

  const webhook = await db.webhookSubscription.create({
    data: {
      userId: session.user.id,
      url: parsed.data.url,
      events: parsed.data.events,
      signingSecret,
      isActive: true,
    },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      signingSecret: true,
    },
  });

  return successResponse(webhook, 201);
}
