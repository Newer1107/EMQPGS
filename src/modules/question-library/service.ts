import { NotificationType, Prisma, QuestionStatus, RecordStatus } from "@prisma/client";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { QuestionLibraryRepository } from "@/modules/question-library/repository";
import { prisma } from "@/lib/db";
import { withOptimisticLock } from "@/lib/optimistic-lock";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";
import { NotificationService } from "@/modules/notifications/service";
import type { QuestionLibraryItemInput } from "@/modules/question-library/validation";

export async function recordUsage(questionId: string, sourceType: string, sourceId: string, examCycleId?: string | null) {
  return prisma.questionUsageHistory.create({
    data: { questionId, examCycleId: examCycleId ?? null, sourceType, sourceId },
  });
}

export class QuestionLibraryService {
  constructor(private readonly repository = new QuestionLibraryRepository()) {}

  async findByBank(questionBankId: string) {
    return this.repository.findByBank(questionBankId);
  }

  async findBySubjectVersion(subjectVersionId: string) {
    return this.repository.findBySubjectVersion(subjectVersionId);
  }

  async search(query: string, subjectVersionId?: string) {
    if (!query.trim()) return [];
    return this.repository.search(query, subjectVersionId);
  }

  async getCoverage(subjectVersionId: string) {
    const questions = await this.repository.findBySubjectVersion(subjectVersionId);
    const approved = questions.filter((q) => q.status === QuestionStatus.APPROVED);

    const modules = [1, 2, 3, 4, 5, 6];
    const cos = ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"] as const;
    const rbtLevels = ["L1", "L2", "L3", "L4", "L5", "L6"] as const;
    const difficulties = ["EASY", "MEDIUM", "HARD"] as const;

    const moduleCoverage = modules.map((mn) => {
      const count = approved.filter((q) => q.moduleNumber === mn).length;
      return { moduleNumber: mn, count, status: count >= 3 ? "adequate" as const : count > 0 ? "partial" : "missing" };
    });

    const coCoverage = cos.map((co) => ({
      co, count: approved.filter((q) => q.coMapping === co).length,
      status: approved.filter((q) => q.coMapping === co).length >= 1 ? "covered" as const : "missing" as const,
    }));

    const rbtCoverage = rbtLevels.map((rbt) => ({
      rbt, count: approved.filter((q) => q.rbtLevel === rbt).length,
      status: approved.filter((q) => q.rbtLevel === rbt).length >= 1 ? "covered" as const : "missing" as const,
    }));

    const diffCoverage = difficulties.map((d) => ({
      difficulty: d, count: approved.filter((q) => q.difficultyLevel === d).length,
      status: approved.filter((q) => q.difficultyLevel === d).length >= 1 ? "covered" as const : "missing" as const,
    }));

    return { moduleCoverage, coCoverage, rbtCoverage, diffCoverage, approvedCount: approved.length, totalCount: questions.length };
  }

  async create(input: QuestionLibraryItemInput, ctx: { userId: string }) {
    return prisma.$transaction(async (tx) => {
      const question = await tx.questionLibraryItem.create({
        data: {
          ...input,
          createdById: ctx.userId,
          ownerId: ctx.userId,
        },
      });

      await tx.questionRevision.create({
        data: {
          questionId: question.id,
          revisionNumber: 1,
          snapshotQuestionText: question.questionText,
          snapshotModule: question.moduleNumber,
          snapshotMarks: question.marks,
          snapshotCo: question.coMapping,
          snapshotRbt: question.rbtLevel,
          snapshotDifficulty: question.difficultyLevel,
          snapshotTeachingIndex: question.teachingIndex,
          changedById: ctx.userId,
          changeReason: "Initial creation",
        },
      });

      return question;
    });
  }

  async createForBank(input: QuestionLibraryItemInput & { questionBankId: string }, ctx: { userId: string }) {
    const { questionBankId: slotBankId, ...createData } = input;
    return prisma.$transaction(async (tx) => {
      const question = await tx.questionLibraryItem.create({
        data: {
          ...createData,
          createdById: ctx.userId,
          ownerId: ctx.userId,
        },
      });

      await tx.questionRevision.create({
        data: {
          questionId: question.id,
          revisionNumber: 1,
          snapshotQuestionText: question.questionText,
          snapshotModule: question.moduleNumber,
          snapshotMarks: question.marks,
          snapshotCo: question.coMapping,
          snapshotRbt: question.rbtLevel,
          snapshotDifficulty: question.difficultyLevel,
          snapshotTeachingIndex: question.teachingIndex,
          changedById: ctx.userId,
          changeReason: "Initial creation",
        },
      });

      const emptySlot = await tx.questionSlot.findFirst({
        where: {
          questionBankId: slotBankId,
          moduleNumber: question.moduleNumber,
          marks: question.marks,
          assignedQuestionId: null,
        },
        orderBy: { slotNumber: "asc" },
      });

      if (emptySlot) {
        try {
          await tx.questionSlot.update({
            where: { id: emptySlot.id, assignedQuestionId: null },
            data: { assignedQuestionId: question.id },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
            throw new ConflictError("This slot was already assigned by another user.");
          }
          throw err;
        }
      }

      return question;
    });
  }

  async update(id: string, input: Partial<QuestionLibraryItemInput>, ctx: { userId: string; isCoordinator?: boolean }) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    const isCoordinator = ctx.isCoordinator ?? false;
    if (question.ownerId !== ctx.userId && !isCoordinator) {
      throw new ForbiddenError("You cannot edit this question");
    }

    const lockedBank = await prisma.questionSlot.findFirst({
      where: { assignedQuestionId: id, questionBank: { recordStatus: RecordStatus.LOCKED } },
      include: { questionBank: true },
    });
    if (lockedBank) ensureQuestionBankMutable(lockedBank.questionBank.recordStatus);

    if (question.status !== QuestionStatus.DRAFT && question.status !== QuestionStatus.REVISION_REQUESTED) {
      if (question.status === QuestionStatus.APPROVED && isCoordinator) {
        input.status = QuestionStatus.REVISION_REQUESTED;
      } else {
        throw new AppError("Question cannot be edited in its current status.", 409);
      }
    }

    const contentChanged = input.questionText !== undefined || input.moduleNumber !== undefined || input.marks !== undefined || input.coMapping !== undefined || input.rbtLevel !== undefined || input.difficultyLevel !== undefined || input.teachingIndex !== undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.questionLibraryItem.update({
        where: { id },
        data: input,
      });

      if (contentChanged) {
        const lastNumber = await tx.questionRevision.count({ where: { questionId: id } });
        await tx.questionRevision.create({
          data: {
            questionId: id,
            revisionNumber: lastNumber + 1,
            snapshotQuestionText: u.questionText,
            snapshotModule: u.moduleNumber,
            snapshotMarks: u.marks,
            snapshotCo: u.coMapping,
            snapshotRbt: u.rbtLevel,
            snapshotDifficulty: u.difficultyLevel,
            snapshotTeachingIndex: u.teachingIndex,
            changedById: ctx.userId,
          },
        });
      }

      return u;
    }).catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ConflictError(
          "This question was modified by another user. Please refresh and try again.",
        );
      }
      throw err;
    });

    return updated;
  }

  async submit(id: string, ctx: { userId: string }) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    if (question.ownerId !== ctx.userId) throw new ForbiddenError("Only the owner can submit this question");
    if (question.status !== QuestionStatus.DRAFT && question.status !== QuestionStatus.REVISION_REQUESTED) {
      throw new AppError("Question cannot be submitted in its current status.", 409);
    }

    const hasSlot = question.slotAssignments && question.slotAssignments.length > 0;
    if (!hasSlot) {
      throw new AppError(
        "Question must be assigned to a Question Bank slot before it can be submitted.",
        400,
        "QUESTION_NOT_IN_BANK",
      );
    }

    const nextStatus = question.status === QuestionStatus.REVISION_REQUESTED ? QuestionStatus.REVISION_SUBMITTED : QuestionStatus.PENDING;
    const result = await this.repository.updateStatus(id, nextStatus, new Date());

    const bankIds = [...new Set(question.slotAssignments.map((s) => s.questionBankId))];
    if (bankIds.length > 0) {
      const moderators = await prisma.responsibilityAssignment.findMany({
        where: { scopeId: { in: bankIds }, scopeType: "QUESTION_BANK", responsibility: "MODERATOR" },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      const title = "New question submitted for moderation";
      const msg = `A question in your assigned bank requires review.`;
      const url = "/dashboard/moderator/questions";
      const notif = new NotificationService();
      for (const m of moderators) {
        await notif.create(m.user.id, title, msg, url, NotificationType.INFO);
      }
    }

    return result;
  }

  async delete(id: string, ctx: { userId: string }) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    if (question.ownerId !== ctx.userId) throw new ForbiddenError("Only the owner can delete this question");
    if (question.status !== QuestionStatus.DRAFT) {
      throw new AppError("Only draft questions can be deleted.", 409);
    }

    return prisma.$transaction(async (tx) => {
      await tx.questionSlot.updateMany({
        where: { assignedQuestionId: id },
        data: { assignedQuestionId: null },
      });
      await tx.questionLibraryItem.delete({ where: { id } });
      return { deleted: true };
    });
  }

  async transferOwnership(questionId: string, toUserId: string, reason: string | undefined, ctx: { userId: string }) {
    const question = await this.repository.findById(questionId);
    if (!question) throw new NotFoundError("Question not found");

    const targetUser = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, status: true } });
    if (!targetUser) throw new NotFoundError("Target user not found");
    if (targetUser.status !== "ACTIVE") throw new AppError("Cannot transfer ownership to a disabled user.", 400);

    const [updated] = await prisma.$transaction(async (tx) => {
      const updatedQuestion = await tx.questionLibraryItem.update({
        where: { id: questionId },
        data: { ownerId: toUserId },
      });

      await tx.questionOwnershipHistory.create({
        data: {
          questionId,
          fromUserId: question.ownerId,
          toUserId,
          transferredById: ctx.userId,
          reason: reason ?? null,
        },
      });

      return [updatedQuestion];
    });

    return updated;
  }

  async getOwnershipHistory(questionId: string) {
    return prisma.questionOwnershipHistory.findMany({
      where: { questionId },
      orderBy: { transferredAt: "desc" },
      include: { fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } }, transferredBy: { select: { id: true, name: true } } },
    });
  }

  async getRevisionHistory(questionId: string) {
    return prisma.questionRevision.findMany({
      where: { questionId },
      orderBy: { revisionNumber: "asc" },
      include: { changedBy: { select: { id: true, name: true } } },
    });
  }

  async getUsageHistory(questionId: string) {
    return prisma.questionUsageHistory.findMany({
      where: { questionId },
      orderBy: { usedAt: "desc" },
      take: 100,
    });
  }

  async getUsageStats(questionId: string) {
    const [totalUsage, firstUsed, latestUsed, sourceTypes] = await Promise.all([
      prisma.questionUsageHistory.count({ where: { questionId } }),
      prisma.questionUsageHistory.findFirst({ where: { questionId }, orderBy: { usedAt: "asc" }, select: { usedAt: true } }),
      prisma.questionUsageHistory.findFirst({ where: { questionId }, orderBy: { usedAt: "desc" }, select: { usedAt: true } }),
      prisma.questionUsageHistory.findMany({ where: { questionId }, distinct: ["sourceType"], select: { sourceType: true } }),
    ]);

    return {
      totalUsage,
      firstUsed: firstUsed?.usedAt ?? null,
      latestUsed: latestUsed?.usedAt ?? null,
      sourceTypes: sourceTypes.map((e) => e.sourceType).filter(Boolean),
    };
  }

  async getFullDetail(questionId: string) {
    return this.repository.findById(questionId);
  }
}
