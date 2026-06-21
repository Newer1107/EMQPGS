import {
  NotificationType,
  Prisma,
  QuestionBankPhase,
  QuestionStatus,
  RecordStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";
import { NotificationService } from "@/modules/notifications/service";

export class ModeratorService {
  constructor(
    private readonly notifications = new NotificationService(),
  ) {}

  async listQuestions(ctx: { bankId: string }) {
    return prisma.questionLibraryItem.findMany({
      where: {
        slotAssignments: { some: { questionBankId: ctx.bankId } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        subjectVersion: { include: { subject: true } },
        creator: { select: { id: true, name: true, email: true } },
        slotAssignments: {
          include: {
            questionBank: {
              select: {
                id: true,
                subject: { select: { subjectCode: true, subjectName: true } },
                batchSemester: {
                  select: {
                    semesterNumber: true,
                    academicYear: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async approveQuestion(ctx: { userId: string }, questionId: string) {
    return this.moderate(ctx.userId, questionId, QuestionStatus.APPROVED, "QUESTION_APPROVED");
  }

  async rejectQuestion(ctx: { userId: string }, questionId: string, reason: string) {
    if (!reason.trim()) throw new AppError("Rejection reason is required.", 400);
    return this.moderate(ctx.userId, questionId, QuestionStatus.REJECTED, "QUESTION_REJECTED", reason);
  }

  async requestRevision(ctx: { userId: string }, questionId: string, instructions: string) {
    if (!instructions.trim()) throw new AppError("Revision instructions are required.", 400);
    return this.moderate(ctx.userId, questionId, QuestionStatus.REVISION_REQUESTED, "REVISION_REQUESTED", instructions);
  }

  private async moderate(actorId: string, questionId: string, status: QuestionStatus, action: string, note?: string) {
    const question = await prisma.questionLibraryItem.findUnique({
      where: { id: questionId },
      include: { creator: true, subjectVersion: { include: { subject: true } } },
    });
    if (!question) throw new NotFoundError("Question not found");
    const slotWithBank = await prisma.questionSlot.findFirst({
      where: { assignedQuestionId: questionId },
      include: { questionBank: { select: { phase: true } } },
    });
    if (slotWithBank && slotWithBank.questionBank.phase !== QuestionBankPhase.MODERATION) {
      throw new AppError("Questions can only be moderated when the bank is in MODERATION phase.", 409);
    }
    if (question.status !== QuestionStatus.PENDING && question.status !== QuestionStatus.REVISION_SUBMITTED) {
      throw new AppError("Question is not in an actionable moderation status.", 409);
    }

    const lockedBank = await prisma.questionSlot.findFirst({
      where: { assignedQuestionId: questionId, questionBank: { recordStatus: RecordStatus.LOCKED } },
      include: { questionBank: true },
    });
    if (lockedBank) ensureQuestionBankMutable(lockedBank.questionBank.recordStatus);

    const originalStatus = question.status;

    const updated = await prisma.questionLibraryItem.update({
      where: { id: questionId, status: originalStatus },
      data: { status, reviewedAt: new Date(), moderatorRemark: note ?? null },
      include: { creator: true },
    }).catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ConflictError(
          "This question was modified by another moderator. Please refresh and try again.",
        );
      }
      throw err;
    });

    await prisma.moderationEvent.create({
      data: {
        questionId,
        moderatorId: actorId,
        action,
        note: note ?? null,
      },
    });

    await this.notifications.create(
      updated.ownerId,
      action === "QUESTION_APPROVED" ? "Question approved" : action === "QUESTION_REJECTED" ? "Question rejected" : "Revision requested",
      `Your question in ${question.subjectVersion.subject.subjectName} has been ${action.toLowerCase().replace(/_/g, " ")}.`,
      "/dashboard/contributor/questions",
      action === "QUESTION_APPROVED" ? NotificationType.SUCCESS : NotificationType.ACTION_REQUIRED,
    );

    return updated;
  }
}
