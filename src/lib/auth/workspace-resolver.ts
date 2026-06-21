import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import type { AuthContext, ResponsibilityInfo } from "@/lib/types";

export type Workspace = {
  assignmentId: string;
  responsibility: ResponsibilityInfo;
};

/**
 * Validates that a given assignment ID belongs to the authenticated user,
 * is active, and returns the resolved workspace context.
 *
 * The client never sends role/scope info — only assignmentId.
 */
export class WorkspaceResolver {
  async resolve(auth: AuthContext, assignmentId: string): Promise<Workspace> {
    const assignment = await prisma.responsibilityAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new ForbiddenError("Assignment not found.");
    }
    if (assignment.userId !== auth.user.id) {
      throw new ForbiddenError("Assignment does not belong to this user.");
    }

    const now = new Date();
    if (assignment.activeFrom > now) {
      throw new ForbiddenError("Assignment is not yet active.");
    }
    if (assignment.activeTo && assignment.activeTo < now) {
      throw new ForbiddenError("Assignment has expired.");
    }

    const responsibility: ResponsibilityInfo = {
      id: assignment.id,
      type: assignment.responsibility,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      activeFrom: assignment.activeFrom,
      activeTo: assignment.activeTo,
    };

    return { assignmentId, responsibility };
  }

  getFirstWorkspace(auth: AuthContext): Workspace | null {
    if (auth.responsibilities.length === 0) return null;
    return {
      assignmentId: auth.responsibilities[0].id,
      responsibility: auth.responsibilities[0],
    };
  }
}
