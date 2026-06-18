import { Role } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { DashboardService } from "@/modules/dashboard/service";
import { DeanReviewService } from "@/modules/production/dean-review.service";
import { ExportService } from "@/modules/production/export.service";
import { MonitoringService } from "@/modules/production/monitoring.service";
import { paginatedResponse, type CursorPaginationInput } from "@/lib/pagination";

export async function getDashboardSeed(role: Role) {
  const user = await getCurrentUserFromCookies();
  if (user.role !== role) return null;
  return new DashboardService().getRoleDashboard(role, user.id);
}

export async function getAdminData(input: CursorPaginationInput = {}) {
  const take = Math.min(Math.max(input.take ?? 25, 1), 200);
  const [departments, users, examCycles, subjects, questionBanks, auditLogs, departmentCount, userCount, questionBankCount] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { department: true } }),
    prisma.examCycle.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { batchSemester: { include: { academicYear: true } } } }),
    prisma.subject.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { department: true } }),
    prisma.questionBank.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { subject: true, examCycle: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, include: { actor: true }, take: 25 }),
    prisma.department.count(),
    prisma.user.count(),
    prisma.questionBank.count(),
  ]);
  return {
    departments,
    users: paginatedResponse(users, { take }).data,
    examCycles: paginatedResponse(examCycles, { take }).data,
    subjects: paginatedResponse(subjects, { take }).data,
    questionBanks: paginatedResponse(questionBanks, { take }).data,
    auditLogs,
    counts: { departments: departmentCount, users: userCount, questionBanks: questionBankCount },
  };
}

export async function getQuestionContributionWorkspace(role: Role) {
  const actor = await getCurrentUserFromCookies();
  if (actor.role !== role) {
    return null;
  }
  const coordinatorDepartmentIds =
    role === Role.COORDINATOR ? await new DepartmentAccessUtils().getAssignedDepartmentIds(actor) : null;
  const questionBank = await prisma.questionBank.findFirst({
    where: coordinatorDepartmentIds
      ? {
          subject: {
            departmentId: { in: coordinatorDepartmentIds },
          },
        }
      : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      subject: true,
      examCycle: { include: { batchSemester: { include: { academicYear: true } } } },
      slots: {
        include: {
          assignedQuestion: {
            include: {
              creator: { select: { id: true, name: true } },
              subjectVersion: { include: { subject: true } },
            },
          },
        },
      },
    },
  });

  if (!questionBank) {
    return null;
  }

  return { actor, questionBank: questionBank! };
}

export async function getDeanReviewData() {
  const actor = await getCurrentUserFromCookies();
  return new DeanReviewService().getDeanDashboardData(actor);
}

export async function getDeanReviewWorkspaceData(questionBankId: string) {
  const actor = await getCurrentUserFromCookies();
  return new DeanReviewService().getDeanReviewWorkspace(questionBankId, actor);
}

export async function getCoeProductionData() {
  return new ExportService().listCoeOverview();
}

export async function getMonitoringData() {
  return new MonitoringService().getObservabilityOverview();
}
