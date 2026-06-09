import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DashboardService } from "@/modules/dashboard/service";

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
