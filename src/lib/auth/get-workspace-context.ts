import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ActiveWorkspaceService, type ActiveWorkspace } from "@/lib/auth/active-workspace";
import { WorkspaceContextResolver, type WorkspaceContext } from "@/lib/auth/workspace-context";
import { ForbiddenError } from "@/lib/errors";
import type { ResponsibilityType } from "@prisma/client";

export type WorkspaceSession = {
  user: Awaited<ReturnType<typeof getCurrentUserFromCookies>>;
  active: ActiveWorkspace;
  context: WorkspaceContext;
};

/**
 * Single entry point for operational pages to resolve workspace context.
 *
 * Combines three steps that every page previously repeated:
 *   1. Resolve the active workspace from cookie
 *   2. Validate it (exists, correct responsibility type, has scopeId)
 *   3. Load the full WorkspaceContext (bank, subject, semester, etc.)
 *
 * Throws ForbiddenError on any validation failure.
 */
export async function getWorkspaceContext(
  expectedResponsibility: ResponsibilityType,
): Promise<WorkspaceSession> {
  const user = await getCurrentUserFromCookies();
  const aws = new ActiveWorkspaceService();
  const active = await aws.resolve(user.id);

  if (!active) {
    throw new ForbiddenError("No active workspace.");
  }

  if (active.responsibility !== expectedResponsibility) {
    throw new ForbiddenError(
      `Expected ${expectedResponsibility} workspace, got ${active.responsibility}.`,
    );
  }

  if (!active.scopeId) {
    throw new ForbiddenError("Active workspace has no scope.");
  }

  const context = await new WorkspaceContextResolver().resolve(active, user);

  if (process.env.NODE_ENV === "development") {
    assertWorkspaceInvariants(expectedResponsibility, active, context);
  }

  return { user, active, context };
}

function assertWorkspaceInvariants(
  expected: ResponsibilityType,
  active: ActiveWorkspace,
  context: WorkspaceContext,
): void {
  if (expected === "CONTRIBUTOR" || expected === "MODERATOR") {
    if (!context.questionBank) {
      throw new Error(`[INVARIANT] ${expected} workspace must resolve a QuestionBank`);
    }
  }
  if (expected === "COORDINATOR") {
    if (!context.department) {
      throw new Error(`[INVARIANT] COORDINATOR workspace must resolve a Department`);
    }
  }
  if (expected === "DEAN" || expected === "COE") {
    if (active.scopeType !== "INSTITUTION") {
      throw new Error(`[INVARIANT] ${expected} workspace must have INSTITUTION scope`);
    }
  }
  if (active.scopeType === "QUESTION_BANK" && !active.scopeId) {
    throw new Error(`[INVARIANT] QUESTION_BANK scoped workspace without scopeId`);
  }
}
