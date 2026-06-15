import { QuestionStatus, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/modules/notifications/service";
import { ModeratorService } from "@/modules/moderation/service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class ModeratorDashboardService {
  constructor(
    private readonly notifications = new NotificationService(),
    private readonly moderatorService = new ModeratorService(),
  ) {}

  async getDashboard(actor: Actor) {
    const bankIds = await this.moderatorService.getAssignedBankIds(actor);

    const questionCounts = await prisma.questionLibraryItem.groupBy({
      by: ["status"],
      where: { slotAssignments: { some: { questionBankId: { in: bankIds } } } },
      _count: { _all: true },
    });

    const pending = questionCounts.find((item) => item.status === QuestionStatus.PENDING)?._count._all ?? 0;
    const approved = questionCounts.find((item) => item.status === QuestionStatus.APPROVED)?._count._all ?? 0;
    const rejected = questionCounts.find((item) => item.status === QuestionStatus.REJECTED)?._count._all ?? 0;
    const revisionRequested = questionCounts.find((item) => item.status === QuestionStatus.REVISION_REQUESTED)?._count._all ?? 0;

    const [awaitingRevisionResubmission, recentModerationActivity, quickAccessBanks, notifications] = await Promise.all([
      this.getAwaitingRevisionResubmission(bankIds),
      this.getRecentModerationActivity(actor),
      this.getQuickAccessBanks(bankIds),
      this.notifications.listForUser(actor.id, 50),
    ]);

    return {
      summary: { pending, approved, rejected, revisionRequested, awaitingRevisionResubmission: awaitingRevisionResubmission.length },
      awaitingRevisionResubmission,
      recentModerationActivity,
      quickAccessBanks,
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

  private async getAwaitingRevisionResubmission(bankIds: string[]) {
    const questions = await prisma.questionLibraryItem.findMany({
      where: {
        status: QuestionStatus.REVISION_REQUESTED,
        slotAssignments: { some: { questionBankId: { in: bankIds } } },
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

  private async getRecentModerationActivity(actor: Actor) {
    const events = await prisma.moderationEvent.findMany({
      where: { moderatorId: actor.id },
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

  private async getQuickAccessBanks(bankIds: string[]) {
    const banks = await prisma.questionBank.findMany({
      where: { id: { in: bankIds } },
      include: {
        subject: { select: { subjectName: true } },
        examCycle: { select: { examType: true } },
        slots: {
          include: {
            assignedQuestion: { select: { status: true } },
          },
          where: { assignedQuestionId: { not: null } },
        },
      },
    });

    return banks.map((b) => {
      const pendingCount = b.slots.filter((s) => s.assignedQuestion?.status === QuestionStatus.PENDING).length;
      const revisionSubmittedCount = b.slots.filter((s) => s.assignedQuestion?.status === QuestionStatus.REVISION_SUBMITTED).length;
      return {
        id: b.id,
        subjectName: b.subject.subjectName,
        examCycle: b.examCycle.examType,
        pendingCount,
        revisionSubmittedCount,
        urgency: pendingCount + revisionSubmittedCount,
      };
    });
  }
}
