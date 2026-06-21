import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ActiveWorkspaceService } from "@/lib/auth/active-workspace";
import { UnauthorizedError } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
  assignmentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    const payload = schema.parse(await request.json());

    const service = new ActiveWorkspaceService();
    const workspace = await service.activate(user.id, payload.assignmentId);

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
