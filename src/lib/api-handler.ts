import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ResponsibilityType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getCurrentUserFromCookies, getRequestMeta } from "@/lib/api-context";
import { logAudit } from "@/lib/audit";
import { assertCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { SecurityConfig } from "@/lib/auth/security-config";
import { StepUpService } from "@/lib/auth/step-up-service";
import type { AuthContext } from "@/lib/types";

type RouteOptions = {
  /** Require one or more responsibility types. User must have at least one. */
  responsibility?: ResponsibilityType | ResponsibilityType[];
  successStatus?: number;
  /** Optional step-up action required before this endpoint responds. */
  stepUp?: string;
  /** Optional step-up resource ID (paper/question bank) to scope the check. */
  stepUpResourceId?: string;
  audit?: {
    action: string;
    entityType: string;
    getEntityId?: (result: unknown) => string | null | undefined;
    getMetadata?: (request: NextRequest, result: unknown) => Record<string, unknown> | undefined;
  };
  /** Set to false to opt out of automatic Cache-Control: no-store. */
  cacheControl?: boolean;
  /**
   * Response type. Set to "raw" for endpoints that return non-JSON (e.g. binary DOCX download).
   * When "raw", the handler returns a NextResponse directly instead of wrapping in JSON.
   */
  responseType?: "json" | "raw";
};

export function withApiHandler<T>(
  handler: (
    request: NextRequest,
    context: { user: Awaited<ReturnType<typeof getCurrentUserFromCookies>> | null; auth?: AuthContext },
  ) => Promise<T>,
  options?: RouteOptions,
) {
  return async (request: NextRequest) => {
    const correlationId = crypto.randomUUID();
    try {
      const meta = await getRequestMeta();
      await enforceRateLimit([request.method, request.nextUrl.pathname, meta.ipAddress ?? "unknown"]);
      await assertCsrfProtection(request.method);

      let user: Awaited<ReturnType<typeof getCurrentUserFromCookies>> | null = null;
      let auth: AuthContext | undefined;

      if (options?.responsibility) {
        user = await getCurrentUserFromCookies();
        const resolver = new ResponsibilityResolver();
        auth = await resolver.resolveAsContext(user.id, user);
        const required = Array.isArray(options.responsibility) ? options.responsibility : [options.responsibility];
        new AuthorizationService(auth).requireAny(required);
      } else {
        // No responsibility required — user is optional (e.g., public endpoints)
        try {
          user = await getCurrentUserFromCookies();
          const resolver = new ResponsibilityResolver();
          auth = await resolver.resolveAsContext(user.id, user);
        } catch {
          // Not authenticated — that's OK for public endpoints
        }
      }

      // ── Session idle timeout check ──────────────────────────────────────
      if (user?.lastLoginAt) {
        const idleMs = Date.now() - user.lastLoginAt.getTime();
        const timeoutMs = parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? "30", 10) * 60 * 1000;
        if (idleMs > timeoutMs) {
          // Update lastLoginAt to avoid repeated checks on every request
          const { prisma } = await import("@/lib/db");
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        }
      }

      // ── Step-Up Guard ───────────────────────────────────────────────────
      if (options?.stepUp && user) {
        const stepUpService = new StepUpService();
        const cfg = SecurityConfig.getInstance();

        // Only check step-up in production mode (dev mode auto-approves)
        if (cfg.isStepUpRequired()) {
          stepUpService.requireVerified(user.id, options.stepUp, options.stepUpResourceId);
        }
      }

      // ── Lockdown guard ──────────────────────────────────────────────────
      if (options?.stepUp) {
        const cfg = SecurityConfig.getInstance();
        const features = cfg.getFeatures();

        // Lockdown mode restrictions
        if (options.stepUp === "COE_DOWNLOAD" || options.stepUp === "DEAN_DOWNLOAD") {
          if (!features.downloadsEnabled) {
            throw new AppError("Downloads are disabled in the current security mode.", 403, "DOWNLOADS_DISABLED");
          }
        }
        if (options.stepUp === "DEAN_REVEAL" && !features.paperRevealEnabled) {
          throw new AppError("Paper reveal is disabled in the current security mode.", 403, "REVEAL_DISABLED");
        }
      }

      // ── Execute handler ─────────────────────────────────────────────────
      const result = await handler(request, { user, auth });

      // ── Audit logging ───────────────────────────────────────────────────
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

      // ── Build response ──────────────────────────────────────────────────

      if (options?.responseType === "raw") {
        // For binary responses (DOCX download, etc.) — handler returns NextResponse
        const rawResponse = result as unknown as NextResponse;
        addCacheControlHeaders(rawResponse, options);
        return rawResponse;
      }

      const response = NextResponse.json(
        { success: true, data: result, correlationId },
        { status: options?.successStatus ?? 200 },
      );
      addCacheControlHeaders(response, options);
      return response;
    } catch (error) {
      return handleApiError(error, request, correlationId);
    }
  };
}

// ─── Cache-Control helper ──────────────────────────────────────────────────

function addCacheControlHeaders(response: NextResponse, options?: RouteOptions): void {
  // Opt out of default no-store via cacheControl: false
  if (options?.cacheControl === false) {
    return;
  }

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
}

// ─── Error handling (unchanged, based on existing) ─────────────────────────

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
