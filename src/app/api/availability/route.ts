import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { availabilityScheduleSchema } from "@/lib/validations";
import { errorResponse, successResponse, validateBody } from "@/lib/api-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const availabilities = await db.availability.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  });

  return successResponse(availabilities);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const { data, error } = await validateBody(request, availabilityScheduleSchema);
  if (error) return error;

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await db.availability.updateMany({
      where: { userId: session.user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const availability = await db.availability.create({
    data: {
      userId: session.user.id,
      name: data.name,
      isDefault: data.isDefault,
      eventTypeId: data.eventTypeId || null,
      schedules: data.schedules,
    },
  });

  return successResponse(availability, 201);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await request.json();
  const { id, ...updateData } = body;

  if (!id) {
    return errorResponse("Availability ID is required");
  }

  const existing = await db.availability.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return errorResponse("Availability not found", 404);
  }

  if (updateData.isDefault) {
    await db.availability.updateMany({
      where: { userId: session.user.id, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updated = await db.availability.update({
    where: { id },
    data: updateData,
  });

  return successResponse(updated);
}
