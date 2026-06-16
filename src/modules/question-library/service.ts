import { Prisma, QuestionStatus, RecordStatus, type User } from "@prisma/client";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { QuestionLibraryRepository } from "@/modules/question-library/repository";
import { prisma } from "@/lib/db";
import { withOptimisticLock } from "@/lib/optimistic-lock";
import { ensureQuestionBankMutable } from "@/modules/question-banks/mutable-guard";
import type { QuestionLibraryItemInput } from "@/modules/question-library/validation";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class QuestionUsageService {
  async recordUsage(questionId: string, examCycleId: string, sourceType: string, sourceId: string) {
    return prisma.questionUsageHistory.create({
      data: { questionId, examCycleId, sourceType, sourceId },
    });
  }
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

  async create(input: QuestionLibraryItemInput, actor: Actor) {
    const question = await this.repository.create({
      ...input,
      createdById: actor.id,
      ownerId: actor.id,
    });

    await prisma.questionRevision.create({
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
        changedById: actor.id,
        changeReason: "Initial creation",
      },
    });

    return question;
  }

  async createForBank(input: QuestionLibraryItemInput & { questionBankId: string }, actor: Actor) {
    const question = await this.create(input, actor);

    const emptySlot = await prisma.questionSlot.findFirst({
      where: {
        questionBankId: input.questionBankId,
        moduleNumber: question.moduleNumber,
        marks: question.marks,
        assignedQuestionId: null,
      },
      orderBy: { slotNumber: "asc" },
    });

    if (emptySlot) {
      await prisma.questionSlot.update({
        where: { id: emptySlot.id },
        data: { assignedQuestionId: question.id },
      });
    }

    return question;
  }

  async update(id: string, input: Partial<QuestionLibraryItemInput>, actor: Actor) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    if (question.ownerId !== actor.id && actor.role !== "COORDINATOR") {
      throw new ForbiddenError("You cannot edit this question");
    }

    const lockedBank = await prisma.questionSlot.findFirst({
      where: { assignedQuestionId: id, questionBank: { recordStatus: RecordStatus.LOCKED } },
      include: { questionBank: true },
    });
    if (lockedBank) ensureQuestionBankMutable(lockedBank.questionBank.recordStatus);

    const updated = await this.repository.update(id, input).catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new ConflictError(
          "This question was modified by another user. Please refresh and try again.",
        );
      }
      throw err;
    });

    if (input.questionText !== undefined || input.moduleNumber !== undefined || input.marks !== undefined || input.coMapping !== undefined || input.rbtLevel !== undefined || input.difficultyLevel !== undefined || input.teachingIndex !== undefined) {
      const lastNumber = await prisma.questionRevision.count({ where: { questionId: id } });
      await prisma.questionRevision.create({
        data: {
          questionId: id,
          revisionNumber: lastNumber + 1,
          snapshotQuestionText: updated.questionText,
          snapshotModule: updated.moduleNumber,
          snapshotMarks: updated.marks,
          snapshotCo: updated.coMapping,
          snapshotRbt: updated.rbtLevel,
          snapshotDifficulty: updated.difficultyLevel,
          snapshotTeachingIndex: updated.teachingIndex,
          changedById: actor.id,
        },
      });
    }

    return updated;
  }

  async submit(id: string, actor: Actor) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    if (question.ownerId !== actor.id) throw new ForbiddenError("Only the owner can submit this question");
    if (question.status !== QuestionStatus.DRAFT && question.status !== QuestionStatus.REVISION_REQUESTED) {
      throw new AppError("Question cannot be submitted in its current status.", 409);
    }

    const nextStatus = question.status === QuestionStatus.REVISION_REQUESTED ? QuestionStatus.REVISION_SUBMITTED : QuestionStatus.PENDING;
    return this.repository.updateStatus(id, nextStatus, new Date());
  }

  async transferOwnership(questionId: string, toUserId: string, reason: string | undefined, actor: Actor) {
    const question = await this.repository.findById(questionId);
    if (!question) throw new NotFoundError("Question not found");
    if (actor.role !== "COORDINATOR") throw new ForbiddenError("Only coordinators can transfer ownership");

    const targetUser = await prisma.user.findUnique({ where: { id: toUserId } });
    if (!targetUser) throw new NotFoundError("Target user not found");
    if (targetUser.status !== "ACTIVE") throw new AppError("Cannot transfer ownership to a disabled user.", 400);
    if (targetUser.role !== "CONTRIBUTOR") throw new AppError("Ownership can only be transferred to contributors.", 400);

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
          transferredById: actor.id,
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
