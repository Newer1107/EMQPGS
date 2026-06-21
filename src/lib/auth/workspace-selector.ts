import { prisma } from "@/lib/db";
import { WORKSPACE_PRIORITY } from "@/lib/workspace-priority";
import type { ResponsibilityType } from "@prisma/client";

export type PickedWorkspace = {
  assignmentId: string;
  responsibility: ResponsibilityType;
};

/**
 * Pure workspace decision engine.
 *
 * Picks the best workspace from a list of active assignments using
 * priority ordering. No HTTP state access, no cookie mutations.
 * Safe to call from any execution context.
 */
export class WorkspaceSelector {
  /**
   * Pick the best assignment from a pre-fetched, pre-filtered list.
   * Pure function — no side effects, no I/O.
   */
  pickDefault(activeAssignments: Array<{
    id: string;
    responsibility: ResponsibilityType;
    scopeId: string | null;
  }>): PickedWorkspace | null {
    if (activeAssignments.length === 0) return null;

    const sorted = [...activeAssignments].sort((a, b) => {
      const pa = WORKSPACE_PRIORITY[a.responsibility] ?? 0;
      const pb = WORKSPACE_PRIORITY[b.responsibility] ?? 0;
      if (pa !== pb) return pb - pa;
      return (a.scopeId ?? "").localeCompare(b.scopeId ?? "");
    });

    const picked = sorted[0];
    return { assignmentId: picked.id, responsibility: picked.responsibility };
  }

  /**
   * Query active assignments for a user and pick the default.
   * No cookie or HTTP state access.
   */
  async pickDefaultForUser(userId: string): Promise<PickedWorkspace | null> {
    const assignments = await prisma.responsibilityAssignment.findMany({
      where: { userId, deletedAt: null },
      orderBy: { activeFrom: "desc" },
    });

    const now = new Date();
    const active = assignments.filter(
      (a) => a.activeFrom <= now && (!a.activeTo || a.activeTo >= now),
    );

    return this.pickDefault(active);
  }
}
