import { QuestionStatus } from "@prisma/client";
import { type Actor } from "@/lib/types";
import { prisma } from "@/lib/db";
import { NotificationService } from "@/modules/notifications/service";
import { ModeratorService } from "@/modules/moderation/service";


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

    const [awaitingRevisionResubmission, recentModerationActivity, quickAccessBanks, pendingQuestionsByBank, perBankStats, pendingQueue, notifications] = await Promise.all([
      this.getAwaitingRevisionResubmission(bankIds),
      this.getRecentModerationActivity(actor),
      this.getQuickAccessBanks(bankIds),
      this.getPendingQuestionsByBank(bankIds),
      this.getPerBankStats(bankIds),
      this.getPendingQueue(bankIds),
      this.notifications.listForUser(actor.id, 50),
    ]);

    return {
      summary: { pending, approved, rejected, revisionRequested, awaitingRevisionResubmission: awaitingRevisionResubmission.length },
      awaitingRevisionResubmission,
      recentModerationActivity,
      quickAccessBanks,
      pendingQuestionsByBank,
      pendingQueue,
      perBankStats,
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

  private async getPendingQuestionsByBank(bankIds: string[]) {
    const banks = await prisma.questionBank.findMany({
      where: { id: { in: bankIds } },
      include: {
        subject: { select: { subjectName: true } },
        slots: {
          where: { assignedQuestion: { status: QuestionStatus.PENDING } },
          include: {
            assignedQuestion: {
              select: { id: true, submittedAt: true, creator: { select: { name: true } } },
            },
          },
          orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }],
        },
      },
    });

    return banks
      .filter((b) => b.slots.length > 0)
      .map((b) => ({
        bankId: b.id,
        subjectName: b.subject.subjectName,
        questions: b.slots.map((s) => ({
          id: s.assignedQuestion!.id,
          moduleNumber: s.moduleNumber,
          marks: s.marks,
          submitterName: s.assignedQuestion!.creator.name,
          submittedAt: s.assignedQuestion!.submittedAt?.toISOString() ?? null,
        })),
        count: b.slots.length,
      }));
  }

  private async getPendingQueue(bankIds: string[]) {
    const banks = await prisma.questionBank.findMany({
      where: { id: { in: bankIds } },
      include: {
        subject: { select: { subjectName: true, subjectCode: true } },
        slots: {
          where: { assignedQuestion: { status: QuestionStatus.PENDING } },
          include: {
            assignedQuestion: {
              select: { id: true, submittedAt: true, createdAt: true, creator: { select: { name: true } } },
            },
          },
          orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }],
        },
      },
    });

    return banks
      .filter((b) => b.slots.length > 0)
      .flatMap((b) =>
        b.slots.map((s) => {
          const submittedAt = s.assignedQuestion!.submittedAt ?? s.assignedQuestion!.createdAt;
          return {
            id: s.assignedQuestion!.id,
            bankId: b.id,
            subjectName: b.subject.subjectName,
            subjectCode: b.subject.subjectCode,
            moduleNumber: s.moduleNumber,
            marks: s.marks,
            submitterName: s.assignedQuestion!.creator.name,
            submittedAt: submittedAt.toISOString(),
            // ponytail: oldest pending = highest priority
            priorityScore: Math.max(0, Math.floor((Date.now() - submittedAt.getTime()) / (1000 * 60 * 60 * 24))),
          };
        }),
      )
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  private async getPerBankStats(bankIds: string[]) {
    const banks = await prisma.questionBank.findMany({
      where: { id: { in: bankIds } },
      include: {
        subject: { select: { subjectName: true } },
        slots: {
          include: { assignedQuestion: { select: { status: true } } },
          where: { assignedQuestionId: { not: null } },
        },
      },
    });

    return banks.map((b) => {
      const pending = b.slots.filter((s) => s.assignedQuestion?.status === QuestionStatus.PENDING).length;
      const approved = b.slots.filter((s) => s.assignedQuestion?.status === QuestionStatus.APPROVED).length;
      const rejected = b.slots.filter((s) => s.assignedQuestion?.status === QuestionStatus.REJECTED).length;
      return {
        bankId: b.id,
        subjectName: b.subject.subjectName,
        pending,
        approved,
        rejected,
      };
    });
  }
}
