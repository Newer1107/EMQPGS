import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getCurrentUserFromCookies, getRequestMeta } from "@/lib/api-context";
import { logAudit } from "@/lib/audit";
import { assertCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";

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
      const meta = await getRequestMeta();
      await enforceRateLimit([request.method, request.nextUrl.pathname, meta.ipAddress ?? "unknown"]);
      await assertCsrfProtection(request.method);

      const user = options?.roles?.length ? await getCurrentUserFromCookies() : await getOptionalUser();

      if (options?.roles?.length && !user) {
        throw new UnauthorizedError();
      }

      if (options?.roles?.length && user && !options.roles.includes(user.role)) {
        throw new ForbiddenError();
      }

      const result = await handler(request, { user });
      if (options?.audit && user) {
        await logAudit({
          actorId: user.id,
          action: options.audit.action,
          entityType: options.audit.entityType,
          entityId: options.audit.getEntityId?.(result) ?? null,
          metadata: request.method === "GET" ? undefined : await safeReadBody(request),
          ...meta,
        });
      }
      logger.info("API request completed", {
        method: request.method,
        path: request.nextUrl.pathname,
        actorId: user?.id ?? null,
        statusCode: 200,
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      return handleApiError(error, request);
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

function handleApiError(error: unknown, request: NextRequest) {
  if (error instanceof AppError) {
    logger.warn("API request failed", {
      method: request.method,
      path: request.nextUrl.pathname,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.statusCode },
    );
  }

  logger.error("Unhandled API error", {
    method: request.method,
    path: request.nextUrl.pathname,
    error: error instanceof Error ? error.message : "Unknown error",
  });
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" } },
    { status: 500 },
  );
}
