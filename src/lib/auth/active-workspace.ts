import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { ACTIVE_WS_COOKIE } from "@/lib/constants";
import type { ResponsibilityType, ScopeType } from "@prisma/client";

export type ActiveWorkspace = {
  assignmentId: string;
  responsibility: ResponsibilityType;
  scopeType: ScopeType;
  scopeId: string | null;
  displayName: string;
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
      displayName: await this.buildDisplayName(assignment),
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
      displayName: await this.buildDisplayName(assignment),
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
      displayName: await this.buildDisplayName(picked),
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

  private async buildDisplayName(assignment: {
    responsibility: string;
    scopeType: string;
    scopeId: string | null;
  }): Promise<string> {
    if (assignment.scopeType === "INSTITUTION" || !assignment.scopeId) {
      return this.label(assignment.responsibility);
    }
    if (assignment.scopeType === "DEPARTMENT") {
      const dept = await prisma.department.findUnique({
        where: { id: assignment.scopeId },
        select: { name: true },
      });
      return dept ? `${this.label(assignment.responsibility)} · ${dept.name}` : this.label(assignment.responsibility);
    }
    if (assignment.scopeType === "QUESTION_BANK") {
      const bank = await prisma.questionBank.findUnique({
        where: { id: assignment.scopeId },
        select: { subject: { select: { subjectName: true } }, batchSemester: { select: { semesterNumber: true } } },
      });
      if (bank) {
        return `${this.label(assignment.responsibility)} · ${bank.subject.subjectName} (Sem ${bank.batchSemester.semesterNumber})`;
      }
      return this.label(assignment.responsibility);
    }
    return this.label(assignment.responsibility);
  }

  private label(resp: string): string {
    const labels: Record<string, string> = {
      COE: "Controller of Examination",
      DEAN: "Dean",
      COORDINATOR: "Coordinator",
      MODERATOR: "Moderator",
      CONTRIBUTOR: "Contributor",
    };
    return labels[resp] ?? resp;
  }
}
