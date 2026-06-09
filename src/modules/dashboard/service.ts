import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/modules/notifications/service";

export class DashboardService {
  constructor(private readonly notifications = new NotificationService()) {}

  async getRoleDashboard(role: Role, userId: string) {
    const [userCount, departmentCount, activeCycles, questionBanks, pendingAssignments, notifications] = await Promise.all([
      prisma.user.count(),
      prisma.department.count(),
      prisma.examCycle.count({ where: { status: "ACTIVE" } }),
      prisma.questionBank.count(),
      prisma.teacherAssignment.count({ where: { teacherId: userId } }),
      this.notifications.listForUser(userId),
    ]);

    const pendingTasksByRole: Record<Role, string[]> = {
      COE: ["Review user provisioning", "Monitor audit events", "Approve cycle readiness"],
      COORDINATOR: ["Assign moderators", "Track due dates", "Advance question banks"],
      MODERATOR: ["Review submissions", "Confirm moderation remarks", "Update status"],
      CONTRIBUTOR: ["Draft questions", "Upload attachments", "Respond to moderation"],
      DEAN: ["Track approvals", "Review final reports", "Observe exam readiness"],
    };

    return {
      stats: [
        { label: "Users", value: userCount },
        { label: "Departments", value: departmentCount },
        { label: "Active Cycles", value: activeCycles },
        { label: "Question Banks", value: questionBanks },
        { label: "My Assignments", value: pendingAssignments },
      ],
      pendingTasks: pendingTasksByRole[role],
      notifications,
    };
  }
}
