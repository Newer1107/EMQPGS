import { Role } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { CoordinatorService } from "@/modules/coordinator/service";
import { DashboardService } from "@/modules/dashboard/service";
import { ProductionService } from "@/modules/production/service";
import { paginatedResponse, type CursorPaginationInput } from "@/lib/pagination";

export async function getDashboardSeed(role: Role) {
  const user = await getCurrentUserFromCookies();
  if (user.role !== role) return null;
  return new DashboardService().getRoleDashboard(role, user.id);
}

export async function getAdminData(input: CursorPaginationInput = {}) {
  const take = Math.min(Math.max(input.take ?? 25, 1), 200);
  const [departments, users, examCycles, subjects, questionBanks, assignments, auditLogs, departmentCount, userCount, questionBankCount] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { department: true } }),
    prisma.examCycle.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { department: true } }),
    prisma.subject.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { department: true } }),
    prisma.questionBank.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { subject: true, examCycle: true } }),
    prisma.teacherAssignment.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { teacher: true, questionBank: { include: { subject: true } } } }),
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
    assignments: paginatedResponse(assignments, { take }).data,
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
    role === Role.COORDINATOR ? await new CoordinatorService().getAssignedDepartmentIds(actor) : null;
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
      examCycle: true,
      assignments: { include: { teacher: true } },
      questionSlots: {
        orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
        include: {
          reservedBy: true,
          question: {
            include: {
              contributor: true,
              attachments: { include: { fileAsset: true } },
            },
          },
        },
      },
      questions: {
        orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
        include: {
          contributor: true,
          attachments: { include: { fileAsset: true } },
        },
      },
    },
  });

  if (!questionBank) {
    return null;
  }

  return { actor, questionBank };
}

export async function getDeanReviewData() {
  const actor = await getCurrentUserFromCookies();
  return new ProductionService().getDeanDashboardData(actor);
}

export async function getDeanReviewWorkspaceData(questionBankId: string) {
  const actor = await getCurrentUserFromCookies();
  return new ProductionService().getDeanReviewWorkspace(questionBankId, actor);
}

export async function getCoeProductionData() {
  return new ProductionService().listCoeOverview();
}

export async function getMonitoringData() {
  return new ProductionService().getObservabilityOverview();
}
