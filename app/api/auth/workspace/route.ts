import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { WorkspaceCookieManager } from "@/lib/auth/workspace-cookie-manager";
import { WorkspaceDisplayResolver } from "@/lib/auth/workspace-display";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { ACTIVE_WS_COOKIE } from "@/lib/constants";
import { z } from "zod";

const schema = z.object({
  assignmentId: z.string().min(1),
});

async function validateAndSetCookie(userId: string, assignmentId: string) {
  const assignment = await prisma.responsibilityAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment || assignment.userId !== userId || assignment.deletedAt) {
    throw new ForbiddenError("Invalid assignment.");
  }

  const now = new Date();
  if (assignment.activeFrom > now) {
    throw new ForbiddenError("This assignment is not yet active.");
  }
  if (assignment.activeTo && assignment.activeTo < now) {
    throw new ForbiddenError("This assignment has expired.");
  }

  const displayResolver = new WorkspaceDisplayResolver();
  const display = await displayResolver.resolve(assignment.responsibility, assignment.scopeType, assignment.scopeId);

  await new WorkspaceCookieManager().set(assignmentId);

  return {
    assignmentId: assignment.id,
    responsibility: assignment.responsibility,
    scopeType: assignment.scopeType,
    scopeId: assignment.scopeId,
    display,
  };
}

function originUrl(request: NextRequest, path: string): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return new URL(path, `${proto}://${host}`);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    const assignmentId = request.nextUrl.searchParams.get("assignmentId");
    if (!assignmentId) throw new ForbiddenError("assignmentId is required");

    const workspace = await validateAndSetCookie(user.id, assignmentId);
    const type = workspace.responsibility.toLowerCase();

    // cookies.set() before NextResponse.redirect() loses the cookie
    // because redirect creates a new response object. Set it on the redirect response explicitly.
    const redirectUrl = originUrl(request, `/dashboard/${type}`);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(ACTIVE_WS_COOKIE, assignmentId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return NextResponse.redirect(originUrl(request, "/login"));
    }
    return NextResponse.redirect(originUrl(request, "/workspace-select"));
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    const payload = schema.parse(await request.json());

    const workspace = await validateAndSetCookie(user.id, payload.assignmentId);

    return NextResponse.json({ success: true, data: workspace });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "assignmentId is required" } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "WORKSPACE_ERROR", message: (error as Error).message } },
      { status: 403 },
    );
  }
}
