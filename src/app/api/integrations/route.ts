import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const integrations = await db.integration.findMany({
      where: { userId: session.user.id },
      select: {
        type: true,
        expiresAt: true,
        metadata: true,
      },
    });

    // Return connected status for each integration without exposing tokens
    const result = integrations.map((integration) => ({
      type: integration.type,
      connected: true,
      connectedAt: integration.expiresAt?.toISOString(),
      metadata: integration.metadata as Record<string, unknown>,
    }));

    return successResponse(result);
  } catch (error) {
    console.error("Failed to list integrations:", error);
    return errorResponse("Failed to list integrations", 500);
  }
}
