import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { ACTIVE_WS_COOKIE } from "@/lib/constants";
import { WorkspaceDisplayResolver, type WorkspaceDisplay } from "@/lib/auth/workspace-display";
import type { ResponsibilityType, ScopeType } from "@prisma/client";

export type ActiveWorkspace = {
  assignmentId: string;
  responsibility: ResponsibilityType;
  scopeType: ScopeType;
  scopeId: string | null;
  display: WorkspaceDisplay;
};

const SCOPES = ["INSTITUTION", "DEPARTMENT", "QUESTION_BANK"] as const;

// Priority order: highest wins when auto-selecting
export const WORKSPACE_PRIORITY: Record<string, number> = {
  COE: 5,
  DEAN: 4,
  COORDINATOR: 3,
  MODERATOR: 2,
  CONTRIBUTOR: 1,
};

export class ActiveWorkspaceService {
  constructor(private readonly displayResolver = new WorkspaceDisplayResolver()) {}

  async resolve(userId: string): Promise<ActiveWorkspace | null> {
    const assignmentId = await this.getCookie();
    if (!assignmentId) return null;

    const assignment = await prisma.responsibilityAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.userId !== userId || assignment.deletedAt) {
      await this.clear();
      return null;
    }

    const now = new Date();
    if (assignment.activeFrom > now || (assignment.activeTo && assignment.activeTo < now)) {
      await this.clear();
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

  async activate(userId: string, assignmentId: string): Promise<ActiveWorkspace> {
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

    await this.setCookie(assignmentId);

    return {
      assignmentId: assignment.id,
      responsibility: assignment.responsibility,
      scopeType: assignment.scopeType,
      scopeId: assignment.scopeId,
      display: await this.displayResolver.resolve(assignment.responsibility, assignment.scopeType, assignment.scopeId),
    };
  }

  async clear() {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WS_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  /** When no active workspace is set, pick the highest-priority one. */
  async resolveOrPickDefault(userId: string): Promise<ActiveWorkspace | null> {
    const existing = await this.resolve(userId);
    if (existing) return existing;

    const assignments = await prisma.responsibilityAssignment.findMany({
      where: { userId, deletedAt: null },
      orderBy: { activeFrom: "desc" },
    });

    const now = new Date();
    const active = assignments.filter(
      (a) => a.activeFrom <= now && (!a.activeTo || a.activeTo >= now),
    );

    if (active.length === 0) return null;

    // Sort by priority desc, then by scopeId asc for determinism
    active.sort((a, b) => {
      const pa = WORKSPACE_PRIORITY[a.responsibility] ?? 0;
      const pb = WORKSPACE_PRIORITY[b.responsibility] ?? 0;
      if (pa !== pb) return pb - pa;
      return (a.scopeId ?? "").localeCompare(b.scopeId ?? "");
    });

    const picked = active[0];
    await this.setCookie(picked.id);

    return {
      assignmentId: picked.id,
      responsibility: picked.responsibility,
      scopeType: picked.scopeType,
      scopeId: picked.scopeId,
      display: await this.displayResolver.resolve(picked.responsibility, picked.scopeType, picked.scopeId),
    };
  }

  // ─── cookie helpers ───

  private async getCookie(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_WS_COOKIE)?.value ?? null;
  }

  private async setCookie(assignmentId: string) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WS_COOKIE, assignmentId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
}
