import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { auth } from "@/lib/auth";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ error, details }, { status });
}

export function handleZodError(error: ZodError) {
  const details = error.issues.map((e) => ({
    path: e.path.join("."),
    message: e.message,
  }));
  return errorResponse("Validation failed", 400, details);
}

export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data };
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: handleZodError(e) };
    }
    return { error: errorResponse("Invalid request body", 400) };
  }
}

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

export async function requireAuth() {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError();
  }
  return user;
}

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export function withAuth(
  handler: (
    request: Request,
    context: { user: { id: string; email: string } }
  ) => Promise<NextResponse>
) {
  return async (request: Request, routeContext?: unknown) => {
    try {
      const user = await requireAuth();
      return await handler(request, { user });
    } catch (e) {
      if (e instanceof AuthError) {
        return errorResponse("Unauthorized", 401);
      }
      console.error("API error:", e);
      return errorResponse("Internal server error", 500);
    }
  };
}
