import { QuestionStatus, type User } from "@prisma/client";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { QuestionLibraryRepository } from "@/modules/question-library/repository";
import { prisma } from "@/lib/db";
import type { QuestionLibraryItemInput } from "@/modules/question-library/validation";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

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

    return {
      totalQuestions: questions.length, approvedQuestions: approved.length,
      moduleCoverage, markCoverage: [], coCoverage, rbtCoverage, difficultyCoverage: diffCoverage,
      warnings: [
        ...moduleCoverage.filter((m) => m.status === "missing").map((m) => `Module ${m.moduleNumber}: no approved questions`),
        ...coCoverage.filter((c) => c.status === "missing").map((c) => `${c.co}: no questions`),
        ...diffCoverage.filter((d) => d.status === "missing").map((d) => `${d.difficulty}: no questions`),
      ],
    };
  }

  async create(input: QuestionLibraryItemInput, actor: Actor) {
    const subjectVersion = await prisma.subjectVersion.findUnique({ where: { id: input.subjectVersionId } });
    if (!subjectVersion) throw new NotFoundError("Subject version not found");

    const question = await this.repository.create({
      ...input,
      createdById: actor.id,
      ownerId: actor.id,
    });

    const lastNumber = await prisma.questionRevision.count({ where: { questionId: question.id } });
    await prisma.questionRevision.create({
      data: {
        questionId: question.id,
        revisionNumber: lastNumber + 1,
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
    await prisma.questionBankQuestion.create({ data: { questionBankId: input.questionBankId, questionId: question.id } });
    return question;
  }

  async update(id: string, input: Partial<QuestionLibraryItemInput>, actor: Actor) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError("Question not found");
    if (question.ownerId !== actor.id && actor.role !== "COORDINATOR") {
      throw new ForbiddenError("You cannot edit this question");
    }

    const updated = await this.repository.update(id, input);

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

    const updated = await this.repository.updateOwner(questionId, toUserId);

    await prisma.questionOwnershipHistory.create({
      data: {
        questionId,
        fromUserId: question.ownerId,
        toUserId,
        transferredById: actor.id,
        reason: reason ?? null,
      },
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
    });
  }

  async getUsageStats(questionId: string) {
    const records = await prisma.questionUsageHistory.findMany({
      where: { questionId },
      orderBy: { usedAt: "desc" },
    });
    return {
      usageCount: records.length,
      lastUsed: records[0] ?? null,
      yearsUsed: [...new Set(records.map((r) => r.academicYearId).filter(Boolean))],
      timeline: records,
    };
  }

  async getFullDetail(questionId: string) {
    const [question, ownership, revisions, usage, moderation] = await Promise.all([
      this.repository.findById(questionId),
      this.getOwnershipHistory(questionId),
      this.getRevisionHistory(questionId),
      this.getUsageHistory(questionId),
      prisma.moderationEvent.findMany({ where: { questionId }, orderBy: { createdAt: "asc" }, include: { moderator: { select: { id: true, name: true } } } }),
    ]);
    if (!question) throw new NotFoundError("Question not found");

    return {
      question,
      ownershipHistory: ownership,
      revisionHistory: revisions,
      usageHistory: usage,
      moderationHistory: moderation,
      bankLinks: question.bankLinks,
      generatedPapers: question.generatedPaperItems,
    };
  }
}

export class QuestionUsageService {
  async recordUsage(questionId: string, examCycleId: string, generatedPaperId: string, generatedPaperItemId: string) {
    const examCycle = await prisma.examCycle.findUnique({
      where: { id: examCycleId },
      include: { academicYear: true, semester: true },
    });
    return prisma.questionUsageHistory.create({
      data: {
        questionId,
        examCycleId,
        generatedPaperId,
        generatedPaperItemId,
        academicYearId: examCycle?.academicYearId,
        semesterId: examCycle?.semesterId,
        examType: examCycle?.examType,
      },
    });
  }
}
