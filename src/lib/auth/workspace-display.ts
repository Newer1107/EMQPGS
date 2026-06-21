import { prisma } from "@/lib/db";
import type { ResponsibilityType, ScopeType } from "@prisma/client";

export type WorkspaceDisplay = {
  title: string;
  subtitle?: string;
  tertiary?: string;
};

const LABELS: Record<string, string> = {
  COE: "COE",
  DEAN: "Dean",
  COORDINATOR: "Coordinator",
  MODERATOR: "Moderator",
  CONTRIBUTOR: "Contributor",
};

export class WorkspaceDisplayResolver {
  async resolve(
    responsibility: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<WorkspaceDisplay> {
    const title = LABELS[responsibility] ?? responsibility;

    if (scopeType === "INSTITUTION" || !scopeId) {
      return {
        title,
        subtitle: "Institution",
      };
    }

    if (scopeType === "DEPARTMENT") {
      const dept = await prisma.department.findUnique({
        where: { id: scopeId },
        select: { name: true },
      });
      return {
        title,
        subtitle: dept?.name ?? "Department",
      };
    }

    if (scopeType === "QUESTION_BANK") {
      const bank = await prisma.questionBank.findUnique({
        where: { id: scopeId },
        select: {
          subject: { select: { subjectName: true } },
          batchSemester: {
            select: {
              semesterNumber: true,
              batch: { select: { name: true } },
              academicYear: { select: { code: true } },
            },
          },
        },
      });
      if (bank) {
        return {
          title,
          subtitle: `${bank.subject.subjectName}`,
          tertiary: `Semester ${bank.batchSemester.semesterNumber} · ${bank.batchSemester.batch.name} · ${bank.batchSemester.academicYear.code}`,
        };
      }
      return { title, subtitle: "Question Bank" };
    }

    return { title };
  }
}
