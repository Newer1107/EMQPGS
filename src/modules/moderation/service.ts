import {
  NotificationType,
  QuestionBankStatus,
  QuestionStatus,
  Role,
  type Prisma,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";
import { StorageService } from "@/lib/storage/storage-service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

type QuestionFilters = {
  statuses?: QuestionStatus[];
  moduleNumber?: number;
  markType?: number;
  bankId?: string;
  contributorName?: string;
  sortBy?: "submittedAtAsc" | "submittedAtDesc" | "markType" | "moduleNumber";
};

const DEADLINE_REMINDER_DAYS = Number(process.env.MODERATOR_DEADLINE_REMINDER_DAYS ?? "3");

export class ModeratorService {
  constructor(
    private readonly notifications = new NotificationService(),
    private readonly storage = new StorageService(),
  ) {}

  async getAssignedBankIds(actor: Actor) {
    if (actor.role !== Role.MODERATOR) {
      throw new ForbiddenError("Only moderators can access this resource.");
    }

    const assignments = await prisma.moderatorBankAssignment.findMany({
      where: { moderatorId: actor.id },
      select: { questionBankId: true },
    });

    return assignments.map((assignment) => assignment.questionBankId);
  }

  async getDashboard(actor: Actor) {
    const bankIds = await this.getAssignedBankIds(actor);
    await this.ensureModeratorNotifications(actor, bankIds);

    const [questions, banks, events, notifications] = await Promise.all([
      prisma.question.findMany({
        where: { questionBankId: { in: bankIds } },
        include: {
          contributor: true,
          questionBank: {
            include: {
              subject: true,
              examCycle: true,
            },
          },
        },
      }),
      prisma.questionBank.findMany({
        where: { id: { in: bankIds } },
        include: {
          subject: true,
          examCycle: true,
          questions: true,
        },
      }),
      prisma.moderationEvent.findMany({
        where: { moderatorId: actor.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          question: {
            include: {
              questionBank: { include: { subject: true } },
            },
          },
        },
      }),
      this.notifications.listForUser(actor.id, 50),
    ]);

    const pending = questions.filter((question) => question.status === QuestionStatus.PENDING).length;
    const approved = questions.filter((question) => question.status === QuestionStatus.APPROVED).length;
    const rejected = questions.filter((question) => question.status === QuestionStatus.REJECTED).length;
    const revisionRequested = questions.filter((question) => question.status === QuestionStatus.REVISION_REQUESTED).length;
    const awaitingRevisionResubmission = questions.filter((question) => question.status === QuestionStatus.REVISION_REQUESTED).length;

    return {
      summary: {
        pending,
        approved,
        rejected,
        revisionRequested,
        awaitingRevisionResubmission,
      },
      awaitingRevisionResubmission: questions
        .filter((question) => question.status === QuestionStatus.REVISION_REQUESTED)
        .sort((left, right) => (left.reviewedAt ?? left.updatedAt).getTime() - (right.reviewedAt ?? right.updatedAt).getTime())
        .map((question) => ({
          id: question.id,
          subjectName: question.questionBank.subject.subjectName,
          moduleNumber: question.moduleNumber,
          markType: question.marks,
          contributorName: question.contributor.name,
          revisionRequestedAt: (question.reviewedAt ?? question.updatedAt).toISOString(),
        })),
      recentModerationActivity: events.map((event) => ({
        id: event.id,
        questionId: event.questionId,
        subjectName: event.question.questionBank.subject.subjectName,
        action: event.action,
        timestamp: event.createdAt.toISOString(),
      })),
      quickAccessBanks: banks
        .map((bank) => {
          const pendingCount = bank.questions.filter((question) => question.status === QuestionStatus.PENDING).length;
          const revisionSubmittedCount = bank.questions.filter((question) => question.status === QuestionStatus.REVISION_SUBMITTED).length;
          return {
            id: bank.id,
            subjectName: bank.subject.subjectName,
            examCycle: `${bank.examCycle.academicYear} / Sem ${bank.examCycle.semester} / ${bank.examCycle.examType}`,
            pendingCount,
            revisionSubmittedCount,
            urgency: pendingCount + revisionSubmittedCount,
          };
        })
        .filter((bank) => bank.urgency > 0)
        .sort((left, right) => right.urgency - left.urgency || left.subjectName.localeCompare(right.subjectName)),
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        actionUrl: notification.actionUrl,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      })),
      unreadNotificationCount: notifications.filter((notification) => !notification.isRead).length,
    };
  }

  async listQuestions(actor: Actor, filters: QuestionFilters = {}) {
    const bankIds = await this.getAssignedBankIds(actor);
    if (filters.bankId && !bankIds.includes(filters.bankId)) {
      throw new ForbiddenError("You do not have access to that question bank.");
    }

    const orderBy: Prisma.QuestionOrderByWithRelationInput[] =
      filters.sortBy === "submittedAtDesc"
        ? [{ submittedAt: "desc" }]
        : filters.sortBy === "markType"
          ? [{ marks: "asc" }, { submittedAt: "asc" }]
          : filters.sortBy === "moduleNumber"
            ? [{ moduleNumber: "asc" }, { submittedAt: "asc" }]
            : [{ submittedAt: "asc" }];

    return prisma.question.findMany({
      where: {
        questionBankId: { in: filters.bankId ? [filters.bankId] : bankIds },
        ...(filters.statuses?.length ? { status: { in: filters.statuses } } : {}),
        ...(filters.moduleNumber ? { moduleNumber: filters.moduleNumber } : {}),
        ...(filters.markType ? { marks: filters.markType } : {}),
        ...(filters.contributorName
          ? {
              contributor: {
                OR: [
                  { name: { contains: filters.contributorName } },
                  { email: { contains: filters.contributorName } },
                ],
              },
            }
          : {}),
      },
      orderBy,
      include: {
        contributor: true,
        questionBank: {
          include: {
            subject: true,
            examCycle: true,
          },
        },
      },
    });
  }

  async getQuestionDetail(actor: Actor, questionId: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        contributor: true,
        questionBank: {
          include: {
            subject: true,
            examCycle: true,
          },
        },
        attachments: {
          include: {
            fileAsset: true,
          },
        },
        revisions: {
          orderBy: { versionNumber: "asc" },
          include: {
            submittedBy: true,
          },
        },
        moderationEvents: {
          orderBy: { createdAt: "asc" },
          include: {
            moderator: true,
          },
        },
      },
    });
    if (!question) throw new NotFoundError("Question not found");
    await this.assertBankAccess(actor, question.questionBankId);

    return {
      id: question.id,
      questionText: question.questionText,
      markType: question.marks,
      moduleNumber: question.moduleNumber,
      co: question.coMapping,
      rbtLevel: question.rbtLevel,
      difficultyLevel: question.difficultyLevel,
      status: question.status,
      submittedAt: question.submittedAt?.toISOString() ?? null,
      contributor: {
        id: question.contributor.id,
        name: question.contributor.name,
        email: question.contributor.email,
      },
      bank: {
        id: question.questionBank.id,
        subjectName: question.questionBank.subject.subjectName,
        subjectCode: question.questionBank.subject.subjectCode,
        examCycle: `${question.questionBank.examCycle.academicYear} / Sem ${question.questionBank.examCycle.semester} / ${question.questionBank.examCycle.examType}`,
        status: question.questionBank.status,
      },
      attachments: await Promise.all(
        question.attachments.map(async (attachment) => ({
          id: attachment.id,
          fileName: attachment.fileAsset.fileName,
          mimeType: attachment.fileAsset.mimeType,
          downloadUrl: (await this.storage.createDownloadLinkForAsset(attachment.fileAsset)).downloadUrl,
          expiresInSeconds: env.SIGNED_URL_EXPIRY_SECONDS,
        })),
      ),
      revisionHistory: [
        ...question.revisions.map((revision) => ({
          id: revision.id,
          versionNumber: revision.versionNumber,
          questionText: revision.questionText,
          actor: revision.submittedBy.name,
          actorEmail: revision.submittedBy.email,
          moderatorComment: revision.moderatorComment,
          submittedAt: revision.submittedAt.toISOString(),
        })),
        ...question.moderationEvents.map((event) => ({
          id: event.id,
          versionNumber: null,
          questionText: null,
          actor: event.moderator.name,
          actorEmail: event.moderator.email,
          moderatorComment: event.note,
          submittedAt: event.createdAt.toISOString(),
          action: event.action,
        })),
      ],
      moderatorComments: question.moderationEvents
        .filter((event) => Boolean(event.note))
        .map((event) => ({
          id: event.id,
          action: event.action,
          note: event.note,
          moderatorName: event.moderator.name,
          createdAt: event.createdAt.toISOString(),
        })),
    };
  }

  async approveQuestion(actor: Actor, questionId: string) {
    return this.runModerationAction(actor, questionId, "QUESTION_APPROVED", QuestionStatus.APPROVED);
  }

  async rejectQuestion(actor: Actor, questionId: string, reason: string) {
    if (!reason.trim()) {
      throw new AppError("Rejection reason is required.", 400);
    }
    return this.runModerationAction(actor, questionId, "QUESTION_REJECTED", QuestionStatus.REJECTED, reason.trim(), true);
  }

  async requestRevision(actor: Actor, questionId: string, instructions: string) {
    if (!instructions.trim()) {
      throw new AppError("Revision instructions are required.", 400);
    }
    return this.runModerationAction(actor, questionId, "REVISION_REQUESTED", QuestionStatus.REVISION_REQUESTED, instructions.trim());
  }

  async overrideQuestion(actor: Actor, questionId: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        questionBank: {
          include: { subject: true },
        },
      },
    });
    if (!question) throw new NotFoundError("Question not found");
    await this.assertBankAccess(actor, question.questionBankId);
    if (question.status !== QuestionStatus.APPROVED) {
      throw new AppError("Question must be in APPROVED status to override.", 409);
    }
    if (question.questionBank.status === QuestionBankStatus.LOCKED) {
      throw new AppError("Cannot override - question bank is locked.", 409);
    }

    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        status: QuestionStatus.PENDING,
        reviewedAt: new Date(),
      },
      include: {
        contributor: true,
        questionBank: { include: { subject: true } },
      },
    });

    await prisma.moderationEvent.create({
      data: {
        questionId,
        moderatorId: actor.id,
        action: "MODERATION_OVERRIDE",
      },
    });

    return updated;
  }

  private async assertBankAccess(actor: Actor, questionBankId: string) {
    const bankIds = await this.getAssignedBankIds(actor);
    if (!bankIds.includes(questionBankId)) {
      throw new ForbiddenError("You do not have access to that question bank.");
    }
  }

  private async runModerationAction(
    actor: Actor,
    questionId: string,
    action: "QUESTION_APPROVED" | "QUESTION_REJECTED" | "REVISION_REQUESTED",
    status: QuestionStatus,
    note?: string,
    releaseSlot = false,
  ) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        contributor: true,
        questionBank: {
          include: { subject: true },
        },
      },
    });
    if (!question) throw new NotFoundError("Question not found");
    await this.assertBankAccess(actor, question.questionBankId);

    if (question.status !== QuestionStatus.PENDING && question.status !== QuestionStatus.REVISION_SUBMITTED) {
      throw new AppError("Question is not in an actionable moderation status.", 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.question.update({
        where: { id: questionId },
        data: {
          status,
          reviewedAt: new Date(),
          moderatorRemark: note ?? null,
          ...(releaseSlot ? { slotId: null } : {}),
        },
        include: {
          contributor: true,
          questionBank: { include: { subject: true } },
        },
      });

      if (releaseSlot && question.slotId) {
        await tx.questionSlot.update({
          where: { id: question.slotId },
          data: {
            reservedById: null,
            reservedAt: null,
            isLocked: false,
          },
        });
      }

      await tx.moderationEvent.create({
        data: {
          questionId,
          moderatorId: actor.id,
          action,
          note: note ?? null,
        },
      });

      return result;
    });

    const message =
      action === "QUESTION_APPROVED"
        ? `Your question in ${updated.questionBank.subject.subjectName} - Module ${updated.moduleNumber} has been approved.`
        : action === "QUESTION_REJECTED"
          ? `Your question in ${updated.questionBank.subject.subjectName} - Module ${updated.moduleNumber} has been rejected. Reason: ${note}`
          : `Revision requested for your question in ${updated.questionBank.subject.subjectName} - Module ${updated.moduleNumber}. Instructions: ${note}`;

    await this.notifications.create(
      updated.contributor.id,
      action === "QUESTION_APPROVED" ? "Question approved" : action === "QUESTION_REJECTED" ? "Question rejected" : "Revision requested",
      message,
      "/dashboard/contributor/questions",
      action === "QUESTION_APPROVED" ? NotificationType.SUCCESS : NotificationType.ACTION_REQUIRED,
    );

    return updated;
  }

  private async ensureModeratorNotifications(actor: Actor, bankIds: string[]) {
    const banks = await prisma.questionBank.findMany({
      where: { id: { in: bankIds } },
      include: {
        subject: true,
        questions: true,
      },
    });

    const writes: Array<Promise<unknown>> = [];

    for (const bank of banks) {
      const dueDate = bank.subject.questionBankDueDate;
      const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= DEADLINE_REMINDER_DAYS) {
        writes.push(
          prisma.notification.upsert({
            where: { id: `moderator-deadline-${actor.id}-${bank.id}-${diffDays}` },
            update: {},
            create: {
              id: `moderator-deadline-${actor.id}-${bank.id}-${diffDays}`,
              recipientId: actor.id,
              title: "Bank approaching deadline",
              message: `Reminder: ${bank.subject.subjectName} question bank moderation is due in ${diffDays} days.`,
              actionUrl: `/dashboard/moderator/questions?bankId=${bank.id}`,
              type: NotificationType.WARNING,
            },
          }),
        );
      }
    }

    await Promise.all(writes);
  }
}
