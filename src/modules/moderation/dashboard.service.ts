import { QuestionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/modules/notifications/service";

export class ModeratorDashboardService {
  constructor(
    private readonly notifications = new NotificationService(),
  ) {}

  async getDashboard(ctx: { userId: string; bankId: string }) {
    const questionCounts = await prisma.questionLibraryItem.groupBy({
      by: ["status"],
      where: { slotAssignments: { some: { questionBankId: ctx.bankId } } },
      _count: { _all: true },
    });

    const pending = questionCounts.find((item) => item.status === QuestionStatus.PENDING)?._count._all ?? 0;
    const approved = questionCounts.find((item) => item.status === QuestionStatus.APPROVED)?._count._all ?? 0;
    const rejected = questionCounts.find((item) => item.status === QuestionStatus.REJECTED)?._count._all ?? 0;
    const revisionRequested = questionCounts.find((item) => item.status === QuestionStatus.REVISION_REQUESTED)?._count._all ?? 0;

    const [awaitingRevisionResubmission, recentModerationActivity, pendingQueue, notifications] = await Promise.all([
      this.getAwaitingRevisionResubmission(ctx.bankId),
      this.getRecentModerationActivity(ctx.userId),
      this.getPendingQueue(ctx.bankId),
      this.notifications.listForUser(ctx.userId, 50),
    ]);

    return {
      summary: { pending, approved, rejected, revisionRequested, awaitingRevisionResubmission: awaitingRevisionResubmission.length },
      awaitingRevisionResubmission,
      recentModerationActivity,
      pendingQueue,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        actionUrl: n.actionUrl,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadNotificationCount: notifications.filter((n) => !n.isRead).length,
    };
  }

  private async getAwaitingRevisionResubmission(bankId: string) {
    const questions = await prisma.questionLibraryItem.findMany({
      where: {
        status: QuestionStatus.REVISION_REQUESTED,
        slotAssignments: { some: { questionBankId: bankId } },
      },
      include: {
        creator: { select: { id: true, name: true } },
        subjectVersion: { include: { subject: { select: { subjectName: true } } } },
      },
      orderBy: { updatedAt: "asc" },
    });

    return questions.map((q) => ({
      id: q.id,
      subjectName: q.subjectVersion.subject.subjectName,
      moduleNumber: q.moduleNumber,
      markType: q.marks,
      contributorName: q.creator.name,
      revisionRequestedAt: q.updatedAt.toISOString(),
    }));
  }

  private async getRecentModerationActivity(userId: string) {
    const events = await prisma.moderationEvent.findMany({
      where: { moderatorId: userId },
      include: {
        question: {
          select: { id: true, subjectVersion: { include: { subject: { select: { subjectName: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return events.map((e) => ({
      id: e.id,
      questionId: e.questionId,
      subjectName: e.question.subjectVersion.subject.subjectName,
      action: e.action.replace(/_/g, " "),
      timestamp: e.createdAt.toISOString(),
    }));
  }

  private async getPendingQueue(bankId: string) {
    const slots = await prisma.questionSlot.findMany({
      where: {
        questionBankId: bankId,
        assignedQuestion: { status: QuestionStatus.PENDING },
      },
      include: {
        assignedQuestion: {
          select: { id: true, submittedAt: true, createdAt: true, creator: { select: { name: true } } },
        },
      },
      orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }],
    });

    return slots
      .filter((s) => s.assignedQuestion)
      .map((s) => {
        const q = s.assignedQuestion!;
        const submittedAt = q.submittedAt ?? q.createdAt;
        return {
          id: q.id,
          bankId,
          subjectName: "",
          subjectCode: "",
          moduleNumber: s.moduleNumber,
          marks: s.marks,
          submitterName: q.creator.name,
          submittedAt: submittedAt.toISOString(),
          priorityScore: Math.max(0, Math.floor((Date.now() - submittedAt.getTime()) / (1000 * 60 * 60 * 24))),
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }
}
