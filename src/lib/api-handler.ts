import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getCurrentUserFromCookies, getRequestMeta } from "@/lib/api-context";
import { logAudit } from "@/lib/audit";
import { assertCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";

type RouteOptions = {
  roles?: Role[];
  successStatus?: number;
  audit?: {
    action: string;
    entityType: string;
    getEntityId?: (result: unknown) => string | null | undefined;
    getMetadata?: (request: NextRequest, result: unknown) => Record<string, unknown> | undefined;
  };
};

export function withApiHandler<T>(
  handler: (request: NextRequest, context: { user: Awaited<ReturnType<typeof getCurrentUserFromCookies>> | null }) => Promise<T>,
  options?: RouteOptions,
) {
  return async (request: NextRequest) => {
    const correlationId = crypto.randomUUID();
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
          metadata: { ...options.audit.getMetadata?.(request, result), correlationId },
          ...meta,
        });
      }
      logger.info("API request completed", {
        correlationId,
        method: request.method,
        path: request.nextUrl.pathname,
        actorId: user?.id ?? null,
        statusCode: options?.successStatus ?? 200,
      });
      return NextResponse.json(
        { success: true, data: result, correlationId },
        { status: options?.successStatus ?? 200 },
      );
    } catch (error) {
      return handleApiError(error, request, correlationId);
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

function translatePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case "P2002":
      return new AppError(
        `A record with this value already exists.`,
        409,
        "DUPLICATE_RECORD",
        { fields: error.meta?.target },
      );
    case "P2025":
      return new AppError(
        "Record not found. It may have been deleted by another user.",
        404,
        "RECORD_NOT_FOUND",
      );
    case "P2003":
      return new AppError(
        "Referenced record does not exist.",
        400,
        "FK_VIOLATION",
        { field: error.meta?.field_name },
      );
    case "P2016":
      return new AppError(
        "Query interpretation error. The data may be inconsistent.",
        400,
        "QUERY_ERROR",
      );
    default:
      return new AppError(
        "A database error occurred. Please try again.",
        500,
        "DATABASE_ERROR",
        { code: error.code },
      );
  }
}

function handleApiError(error: unknown, request: NextRequest, correlationId: string) {
  if (error instanceof ZodError) {
    logger.warn("Validation error", {
      correlationId,
      method: request.method,
      path: request.nextUrl.pathname,
      issues: error.issues.length,
    });
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: `${error.issues.length} field${error.issues.length === 1 ? "" : "s"} need attention`, details: error.issues }, correlationId },
      { status: 400 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const translated = translatePrismaError(error);
    logger.warn("Database error translated", {
      correlationId,
      method: request.method,
      path: request.nextUrl.pathname,
      prismaCode: error.code,
      translatedCode: translated.code,
      message: translated.message,
    });
    return NextResponse.json(
      { success: false, error: { code: translated.code, message: translated.message, details: translated.details }, correlationId },
      { status: translated.statusCode },
    );
  }

  if (error instanceof AppError) {
    logger.warn("API request failed", {
      correlationId,
      method: request.method,
      path: request.nextUrl.pathname,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details }, correlationId },
      { status: error.statusCode },
    );
  }

  logger.error("Unhandled API error", {
    correlationId,
    method: request.method,
    path: request.nextUrl.pathname,
    error: error instanceof Error ? error.message : "Unknown error",
  });
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" }, correlationId },
    { status: 500 },
  );
}
