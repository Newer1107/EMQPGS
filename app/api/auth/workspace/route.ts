import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { WorkspaceResolver } from "@/lib/auth/workspace-resolver";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    const resolver = new ResponsibilityResolver();
    const auth = await resolver.resolveAsContext(user.id, user);
    const workspaceResolver = new WorkspaceResolver();

    const assignmentId = request.nextUrl.searchParams.get("assignmentId");
    if (!assignmentId) {
      throw new ForbiddenError("assignmentId is required");
    }

    await workspaceResolver.resolve(auth, assignmentId);

    const redirect = request.nextUrl.searchParams.get("redirect") ?? "/dashboard";
    const redirectUrl = new URL(redirect, request.url);
    redirectUrl.searchParams.set("ws", assignmentId);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return NextResponse.json(
        { success: false, error: { code: "AUTH_ERROR", message: (error as Error).message } },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to set workspace" } },
      { status: 500 },
    );
  }
}
