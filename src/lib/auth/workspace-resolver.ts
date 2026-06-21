import { prisma } from "@/lib/db";
import { WorkspaceDisplayResolver, type WorkspaceDisplay } from "@/lib/auth/workspace-display";
import { WorkspaceCookieManager } from "@/lib/auth/workspace-cookie-manager";
import type { ResponsibilityType, ScopeType } from "@prisma/client";

export type ActiveWorkspace = {
  assignmentId: string;
  responsibility: ResponsibilityType;
  scopeType: ScopeType;
  scopeId: string | null;
  display: WorkspaceDisplay;
};

/**
 * Read-only workspace resolver.
 *
 * Resolves the active workspace from the cookie — validates the assignment
 * against the database and returns the workspace or null.
 *
 * Never mutates cookies, HTTP state, or redirects.
 * Safe to call from Server Components, Route Handlers, Server Actions, Middleware, and Tests.
 */
export class ActiveWorkspaceResolver {
  constructor(
    private readonly cookieManager = new WorkspaceCookieManager(),
    private readonly displayResolver = new WorkspaceDisplayResolver(),
  ) {}

  async resolve(userId: string): Promise<ActiveWorkspace | null> {
    const assignmentId = await this.cookieManager.get();
    if (!assignmentId) return null;

    const assignment = await prisma.responsibilityAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.userId !== userId || assignment.deletedAt) {
      return null;
    }

    const now = new Date();
    if (assignment.activeFrom > now || (assignment.activeTo && assignment.activeTo < now)) {
      return null;
    }

    return {
      assignmentId: assignment.id,
      responsibility: assignment.responsibility,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      display: await this.displayResolver.resolve(assignment.responsibility, assignment.scopeType, assignment.scopeId),
    };
  }
}
