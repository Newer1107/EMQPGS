import {
  NotificationType,
  QuestionStatus,
  Role,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class ModeratorService {
  constructor(
    private readonly notifications = new NotificationService(),
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

  async listQuestions(actor: Actor) {
    const bankIds = await this.getAssignedBankIds(actor);
    return prisma.questionLibraryItem.findMany({
      where: {
        bankLinks: { some: { questionBankId: { in: bankIds } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        subjectVersion: { include: { subject: true } },
        creator: { select: { id: true, name: true, email: true } },
        bankLinks: { include: { questionBank: { select: { id: true } } } },
      },
    });
  }

  async approveQuestion(actor: Actor, questionId: string) {
    return this.moderate(actor, questionId, QuestionStatus.APPROVED, "QUESTION_APPROVED");
  }

  async rejectQuestion(actor: Actor, questionId: string, reason: string) {
    if (!reason.trim()) throw new AppError("Rejection reason is required.", 400);
    return this.moderate(actor, questionId, QuestionStatus.REJECTED, "QUESTION_REJECTED", reason);
  }

  async requestRevision(actor: Actor, questionId: string, instructions: string) {
    if (!instructions.trim()) throw new AppError("Revision instructions are required.", 400);
    return this.moderate(actor, questionId, QuestionStatus.REVISION_REQUESTED, "REVISION_REQUESTED", instructions);
  }

  private async moderate(actor: Actor, questionId: string, status: QuestionStatus, action: string, note?: string) {
    const question = await prisma.questionLibraryItem.findUnique({
      where: { id: questionId },
      include: { creator: true, subjectVersion: { include: { subject: true } } },
    });
    if (!question) throw new NotFoundError("Question not found");
    if (question.status !== QuestionStatus.PENDING && question.status !== QuestionStatus.REVISION_SUBMITTED) {
      throw new AppError("Question is not in an actionable moderation status.", 409);
    }

    const updated = await prisma.questionLibraryItem.update({
      where: { id: questionId },
      data: { status, reviewedAt: new Date(), moderatorRemark: note ?? null },
      include: { creator: true },
    });

    await prisma.moderationEvent.create({
      data: {
        questionId,
        moderatorId: actor.id,
        action,
        note: note ?? null,
      },
    });

    await this.notifications.create(
      updated.ownerId,
      action === "QUESTION_APPROVED" ? "Question approved" : action === "QUESTION_REJECTED" ? "Question rejected" : "Revision requested",
      `Your question in ${question.subjectVersion.subject.subjectName} has been ${action.toLowerCase().replace("_", " ")}.`,
      "/dashboard/contributor/questions",
      action === "QUESTION_APPROVED" ? NotificationType.SUCCESS : NotificationType.ACTION_REQUIRED,
    );

    return updated;
  }
}
