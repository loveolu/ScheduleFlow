import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations";
import { handleZodError } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ZodError } from "zod";

const DEFAULT_WEEKDAY_SCHEDULE = [1, 2, 3, 4, 5].map((day) => ({
  day,
  startTime: "09:00",
  endTime: "17:00",
  isActive: true,
}));

export async function POST(request: Request) {
  // Public endpoint — cap to 5 registrations / IP / minute. bcrypt.hash with
  // cost factor 12 takes ~250 ms, so without a limit a single attacker can
  // burn server CPU very cheaply. Also slows account-spam.
  const limited = enforceRateLimit(request, {
    key: "register",
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
      },
    });

    await db.availability.create({
      data: {
        userId: user.id,
        name: "Working Hours",
        isDefault: true,
        schedules: DEFAULT_WEEKDAY_SCHEDULE,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
