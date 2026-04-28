import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { assertSafeWebhookUrl } from "@/lib/ssrf-guard";
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

  // Reject URLs that resolve to private / loopback / link-local / metadata
  // ranges. Note: we still re-check at delivery time (see lib/webhooks.ts) to
  // defeat DNS rebinding — this submission-time check is mostly UX feedback.
  const safety = await assertSafeWebhookUrl(parsed.data.url);
  if (!safety.ok) {
    return errorResponse(safety.reason ?? "URL is not allowed", 400);
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
