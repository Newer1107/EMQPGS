import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DashboardService } from "@/modules/dashboard/service";
import { ProductionService } from "@/modules/production/service";

export async function getDashboardSeed(role: Role) {
  const user = await prisma.user.findFirst({ where: { role } });
  if (!user) return null;
  return new DashboardService().getRoleDashboard(role, user.id);
}

export async function getAdminData() {
  const [departments, users, examCycles, subjects, questionBanks, assignments, auditLogs] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, include: { department: true } }),
    prisma.examCycle.findMany({ orderBy: { createdAt: "desc" }, include: { department: true } }),
    prisma.subject.findMany({ orderBy: { createdAt: "desc" }, include: { department: true } }),
    prisma.questionBank.findMany({ orderBy: { createdAt: "desc" }, include: { subject: true, examCycle: true } }),
    prisma.teacherAssignment.findMany({ orderBy: { createdAt: "desc" }, include: { teacher: true, questionBank: { include: { subject: true } } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, include: { actor: true }, take: 25 }),
  ]);
  return { departments, users, examCycles, subjects, questionBanks, assignments, auditLogs };
}

export async function getQuestionContributionWorkspace(role: Role) {
  const actor = await prisma.user.findFirst({ where: { role } });
  const questionBank = await prisma.questionBank.findFirst({
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

  if (!actor || !questionBank) {
    return null;
  }

  return { actor, questionBank };
}

export async function getDeanReviewData() {
  return new ProductionService().listDeanReviewQueue();
}

export async function getCoeProductionData() {
  return new ProductionService().listCoeOverview();
}

export async function getMonitoringData() {
  return new ProductionService().getObservabilityOverview();
}
