import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse, successResponse } from "@/lib/api-helpers";
import { IntegrationType } from "@/generated/prisma/client";

const VALID_TYPES: Set<string> = new Set(
  Object.values(IntegrationType) as string[]
);

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { type } = await params;
  const upperType = type.toUpperCase();

  if (!VALID_TYPES.has(upperType)) {
    return errorResponse("Invalid integration type", 400);
  }

  try {
    const integration = await db.integration.findUnique({
      where: {
        userId_type: {
          userId: session.user.id,
          type: upperType as IntegrationType,
        },
      },
    });

    if (!integration) {
      return errorResponse("Integration not found", 404);
    }

    await db.integration.delete({
      where: { id: integration.id },
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Failed to disconnect integration:", error);
    return errorResponse("Failed to disconnect integration", 500);
  }
}
