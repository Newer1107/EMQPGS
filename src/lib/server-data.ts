import { getCurrentUserFromCookies } from "@/lib/api-context";
import { prisma } from "@/lib/db";
import { DeanReviewService } from "@/modules/production/dean-review.service";
import { ExportService } from "@/modules/production/export.service";
import { MonitoringService } from "@/modules/production/monitoring.service";
import { paginatedResponse, type CursorPaginationInput } from "@/lib/pagination";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";

export async function getAdminData(input: CursorPaginationInput = {}) {
  const take = Math.min(Math.max(input.take ?? 25, 1), 200);
  const [departments, users, examCycles, subjects, questionBanks, auditLogs, departmentCount, userCount, questionBankCount] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { homeDepartment: true } }),
    prisma.examCycle.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { batchSemester: { include: { academicYear: true } } } }),
    prisma.subject.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { department: true } }),
    prisma.questionBank.findMany({ orderBy: { createdAt: "desc" }, take: take + 1, include: { subject: true, batchSemester: { include: { academicYear: true } } } }),
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

export async function getContributorAssignedBanks(contributorId: string) {
  return prisma.questionBank.findMany({
    where: {
      slots: {
        some: {
          assignedQuestion: { ownerId: contributorId },
        },
      },
    },
    include: {
      subject: { include: { versions: { where: { status: "ACTIVE" }, take: 1 } } },
      batchSemester: { include: { academicYear: true } },
      pattern: true,
      slots: {
        include: {
          assignedQuestion: { select: { id: true, status: true, ownerId: true, moduleNumber: true, marks: true } },
        },
        orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDeanReviewData() {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  return new DeanReviewService().getDeanDashboardData(auth);
}

export async function getDeanReviewWorkspaceData(questionBankId: string) {
  const actor = await getCurrentUserFromCookies();
  const resolver = new ResponsibilityResolver();
  const auth = await resolver.resolveAsContext(actor.id, actor);
  return new DeanReviewService().getDeanReviewWorkspace(questionBankId, auth);
}

export async function getCoeProductionData() {
  return new ExportService().listCoeOverview();
}

export async function getMonitoringData() {
  return new MonitoringService().getObservabilityOverview();
}
