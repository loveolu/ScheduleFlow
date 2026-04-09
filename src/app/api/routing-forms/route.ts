import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { z } from "zod";

// Routing forms use metadata stored in the EventType questions field
// This is a lightweight approach — routing forms are stored as a special
// JSON structure that maps answers to event type IDs

const routingFormSchema = z.object({
  title: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  fields: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(["select", "radio"]),
      options: z.array(
        z.object({
          label: z.string(),
          value: z.string(),
          routeToEventTypeId: z.string().optional(),
          routeToUrl: z.string().optional(),
        })
      ),
    })
  ),
});

// Store routing forms as JSON files in a simple key-value approach
// For MVP, we use the user's metadata. In production, this would be its own table.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!user) return errorResponse("User not found", 404);

  // For now, routing forms are stored in a simple approach
  // We'll use event types with a special flag
  const eventTypes = await db.eventType.findMany({
    where: { userId: session.user.id },
    select: { id: true, title: true, slug: true, questions: true },
  });

  // Filter to those that have routing form data
  const routingForms = eventTypes
    .filter((et) => {
      const q = et.questions as Record<string, unknown>;
      return q && typeof q === "object" && "isRoutingForm" in q;
    })
    .map((et) => ({
      id: et.id,
      title: et.title,
      slug: et.slug,
      fields: (et.questions as Record<string, unknown>).fields || [],
    }));

  return successResponse(routingForms);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Unauthorized", 401);

  const body = await request.json();
  const parsed = routingFormSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid routing form data", 400);
  }

  // Create as a special event type with routing form metadata
  const routingForm = await db.eventType.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      slug: `route-${parsed.data.slug}`,
      description: parsed.data.description || null,
      duration: 0, // routing forms don't have duration
      isActive: true,
      questions: {
        isRoutingForm: true,
        fields: parsed.data.fields,
      } as never,
    },
  });

  return successResponse(routingForm, 201);
}
