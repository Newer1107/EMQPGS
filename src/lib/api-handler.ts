import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getCurrentUserFromCookies, getRequestMeta } from "@/lib/api-context";
import { logAudit } from "@/lib/audit";

type RouteOptions = {
  roles?: Role[];
  audit?: {
    action: string;
    entityType: string;
    getEntityId?: (result: unknown) => string | null | undefined;
  };
};

export function withApiHandler<T>(
  handler: (request: NextRequest, context: { user: Awaited<ReturnType<typeof getCurrentUserFromCookies>> | null }) => Promise<T>,
  options?: RouteOptions,
) {
  return async (request: NextRequest) => {
    try {
      const user = options?.roles?.length ? await getCurrentUserFromCookies() : await getOptionalUser();

      if (options?.roles?.length && !user) {
        throw new UnauthorizedError();
      }

      if (options?.roles?.length && user && !options.roles.includes(user.role)) {
        throw new ForbiddenError();
      }

      const result = await handler(request, { user });
      if (options?.audit && user) {
        const meta = await getRequestMeta();
        await logAudit({
          actorId: user.id,
          action: options.audit.action,
          entityType: options.audit.entityType,
          entityId: options.audit.getEntityId?.(result) ?? null,
          metadata: request.method === "GET" ? undefined : await safeReadBody(request),
          ...meta,
        });
      }
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

async function getOptionalUser() {
  try {
    return await getCurrentUserFromCookies();
  } catch {
    return null;
  }
}

async function safeReadBody(request: NextRequest) {
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
}

function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.statusCode },
    );
  }

  console.error(error);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" } },
    { status: 500 },
  );
}
