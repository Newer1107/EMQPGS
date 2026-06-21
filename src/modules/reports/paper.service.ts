import {
  AiReportStatus,
  ExamType,
  NotificationType,
  PaperGenerationStatus,
  PaperVariant,
  QuestionBankPhase,
  QuestionStatus,
  RecordStatus,
  type Prisma,
} from "@prisma/client";
import type { QuestionLibraryItem } from "@prisma/client";
import { type Actor } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES, EXAM_MODULE_RANGES } from "@/lib/constants";
import { PdfService } from "@/modules/reports/pdf-service";
import { recordUsage } from "@/modules/question-library/service";
import { PaperGenerationEngine } from "@/modules/paper-generation-engine/paper-generation-engine";
import { ConstraintAwareGreedyStrategy } from "@/modules/paper-generation-engine/strategies/constraint-aware-greedy";
import { slotKey } from "@/modules/paper-generation-engine/constraint-engine";
import { formatReport } from "@/modules/paper-generation-engine/score-report";
import type { GenerationTrace, GenerationStats, SlotDecision, CandidateEvaluation } from "@/modules/paper-generation-engine/types";

export class PaperGenerationService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
    private readonly pdfService = new PdfService(),
  ) {}

  async generatePapers(questionBankId: string, examType: ExamType, actor: Actor, variants: PaperVariant[]) {
    const questionBank = await this.getQuestionBankForPaperGeneration(questionBankId);
    if (!questionBank) throw new NotFoundError("Question bank not found");
    if (questionBank.phase !== QuestionBankPhase.APPROVAL && questionBank.phase !== QuestionBankPhase.COMPLETE) {
      throw new AppError("Question bank must be in APPROVAL or COMPLETE phase before generating papers", 409);
    }

    const moduleRange = EXAM_MODULE_RANGES[examType];

    // Build inventory from approved question slots
    const inventory = new Map<string, QuestionLibraryItem[]>();
    for (const slot of questionBank.slots) {
      if (!slot.assignedQuestion) continue;
      const q = slot.assignedQuestion;
      if (q.status !== QuestionStatus.APPROVED) continue;
      const key = slotKey(q.moduleNumber, q.marks);
      if (!inventory.has(key)) inventory.set(key, []);
      inventory.get(key)!.push(q);
    }

    if (inventory.size === 0) {
      throw new AppError("No approved inventory available for paper generation", 409);
    }

    // Get usage history for freshness scoring
    const allQIds = [...inventory.values()].flat().map((q) => q.id);
    const usageHistory = await prisma.questionUsageHistory.findMany({
      where: { questionId: { in: allQIds } },
    });

    const outputs = [];
    const overallConsumed = new Set<string>();

    for (const variant of variants) {
      // Build variant-specific inventory excluding questions used by earlier variants
      const variantInventory = new Map<string, QuestionLibraryItem[]>();
      for (const [key, questions] of inventory) {
        const available = questions.filter((q) => !overallConsumed.has(q.id));
        if (available.length > 0) variantInventory.set(key, available);
      }

      const engine = new PaperGenerationEngine(
        { moduleRange, enforceUsageHistory: true, enforceConceptDiversity: true },
        new ConstraintAwareGreedyStrategy(),
      );
      const { solution, trace } = engine.generate(variantInventory, usageHistory, variant);
      const selectedQuestions = solution.assignments.map((a) => a.question);

      for (const q of selectedQuestions) overallConsumed.add(q.id);

      const pdfBytes = await this.pdfService.createPaperPdf({
        title: `${questionBank.subject.subjectCode} ${variant.replace("_", " ")}`,
        subtitle: `Semester ${questionBank.batchSemester.semesterNumber} · ${questionBank.batchSemester.academicYear.code} · ${examType}`,
        questions: selectedQuestions.map((question) => ({
          moduleNumber: question.moduleNumber,
          marks: question.marks,
          questionText: question.questionText,
          coMapping: question.coMapping,
          rbtLevel: question.rbtLevel,
        })),
      });

      const pdfAsset = await this.storageService.uploadServerFile({
        bucket: "generated-papers",
        fileName: `${questionBank.subject.subjectCode}-${variant}.pdf`,
        mimeType: "application/pdf",
        body: Buffer.from(pdfBytes),
        size: pdfBytes.byteLength,
        uploadedById: actor.id,
      });

      // Capture existing paperJson for regeneration history
      const existingPaper = await prisma.generatedPaper.findUnique({
        where: { questionBankId_variant: { questionBankId, variant } },
        select: { paperJson: true },
      });
      const prevGenerations = existingPaper?.paperJson
        ? [existingPaper.paperJson as Record<string, unknown>]
        : [];

      const diffCat = solution.report.categories.find((c) => c.label === "Difficulty Balance");
      const overallScore = Math.round(solution.report.overall);

      const record = await prisma.generatedPaper.upsert({
        where: { questionBankId_variant: { questionBankId, variant } },
        update: {
          status: PaperGenerationStatus.COMPLETED,
          generatedById: actor.id,
          generatedAt: new Date(),
          coverageScore: this.calculateCoverageScore(selectedQuestions, moduleRange),
          difficultyScore: Math.round(diffCat?.earned ?? 0),
          qualityScore: overallScore,
          duplicateRisk: 0,
          recommendation: overallScore >= 70
            ? "Recommended for dean review; paper shows reasonable balance."
            : "Review before publishing; quality score below threshold.",
          paperJson: {
            questionIds: selectedQuestions.map((question) => question.id),
            evaluationReport: solution.report,
            scoreBreakdown: formatReport(solution.report),
            generationTrace: trace,
            ...(prevGenerations.length > 0 ? { previousGenerations: prevGenerations } : {}),
          } as Prisma.InputJsonValue,
          paperFileAssetId: pdfAsset.id,
          failureReason: null,
          items: {
            deleteMany: {},
            create: selectedQuestions.map((question) => ({ questionId: question.id })),
          },
        },
        create: {
          questionBankId,
          variant,
          status: PaperGenerationStatus.COMPLETED,
          generatedById: actor.id,
          generatedAt: new Date(),
          coverageScore: this.calculateCoverageScore(selectedQuestions, moduleRange),
          difficultyScore: Math.round(diffCat?.earned ?? 0),
          qualityScore: overallScore,
          duplicateRisk: 0,
          recommendation: overallScore >= 70
            ? "Recommended for dean review; paper shows reasonable balance."
            : "Review before publishing; quality score below threshold.",
          paperJson: {
            questionIds: selectedQuestions.map((question) => question.id),
            evaluationReport: solution.report,
            scoreBreakdown: formatReport(solution.report),
            generationTrace: trace,
          } as Prisma.InputJsonValue,
          paperFileAssetId: pdfAsset.id,
          items: {
            create: selectedQuestions.map((question) => ({ questionId: question.id })),
          },
        },
        include: {
          items: true,
          paperFileAsset: true,
        },
      });

      await Promise.all(
        selectedQuestions.map((question) =>
          recordUsage(question.id, "GENERATED_PAPER", record.id),
        ),
      );

      await prisma.paperSnapshot.upsert({
        where: { questionBankId_variant: { questionBankId, variant } },
        update: {
          paperJson: record.paperJson as Prisma.InputJsonValue,
          coverageScore: record.coverageScore,
          difficultyScore: record.difficultyScore,
          qualityScore: record.qualityScore,
        },
        create: {
          questionBankId,
          variant,
          paperJson: (record.paperJson ?? {}) as Prisma.InputJsonValue,
          coverageScore: record.coverageScore,
          difficultyScore: record.difficultyScore,
          qualityScore: record.qualityScore,
        },
      });

      outputs.push(record);
    }

    await logAudit({
      actorId: actor.id,
      action: "QUESTION_PAPERS_GENERATED",
      entityType: ENTITY_TYPES.GENERATED_PAPER,
      entityId: questionBankId,
      metadata: { variants },
    });

    const coordinatorAssignments = await prisma.responsibilityAssignment.findMany({
      where: { responsibility: "COORDINATOR", scopeType: "DEPARTMENT", scopeId: questionBank.subject.departmentId },
      include: { user: true },
    });
    await Promise.all(
      coordinatorAssignments.map(({ user }) =>
        this.notificationService.create(
          user.id,
          "Paper generation complete",
          `Papers A, B, C have been generated for ${questionBank.subject.subjectName}.`,
          `/dashboard/coordinator/question-banks?bank=${questionBankId}`,
          NotificationType.SUCCESS,
        ),
      ),
    );

    return outputs;
  }

  async listGeneratedPapers(questionBankId: string) {
    return prisma.generatedPaper.findMany({
      where: { questionBankId },
      orderBy: { createdAt: "asc" },
      include: {
        items: {
          include: { question: true },
        },
        paperFileAsset: true,
      },
    });
  }

  private getQuestionBankForPaperGeneration(questionBankId: string) {
    return prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: true,
        batchSemester: { include: { academicYear: true } },
        aiReports: {
          where: { status: AiReportStatus.COMPLETED },
        },
        slots: {
          include: { assignedQuestion: true },
          where: { assignedQuestionId: { not: null } },
        },
        generatedPapers: {
          include: {
            items: {
              include: { question: true },
            },
          },
        },
      },
    });
  }

  private calculateCoverageScore(questions: Array<{ moduleNumber: number }>, moduleRange: number[]) {
    const coveredModules = new Set(questions.map((question) => question.moduleNumber)).size;
    return Number(((coveredModules / moduleRange.length) * 100).toFixed(2));
  }

  private calculateDifficultyScore(questions: Array<{ difficultyLevel: string | null }>) {
    const buckets = { EASY: 0, MEDIUM: 0, HARD: 0 };
    questions.forEach((question) => {
      if (question.difficultyLevel && question.difficultyLevel in buckets) {
        buckets[question.difficultyLevel as keyof typeof buckets] += 1;
      }
    });
    const values = Object.values(buckets);
    const spread = Math.max(...values) - Math.min(...values);
    return Number(Math.max(0, 100 - spread * 10).toFixed(2));
  }

  private calculateQualityScore(questions: Array<{ questionText: string; teachingIndex: string | null }>) {
    const averageLength =
      questions.reduce((sum, question) => sum + question.questionText.trim().length, 0) / Math.max(questions.length, 1);
    const teachingIndexCoverage =
      questions.filter((question) => Boolean(question.teachingIndex)).length / Math.max(questions.length, 1);
    return Number(Math.min(100, averageLength + teachingIndexCoverage * 30).toFixed(2));
  }

  private calculateDuplicateRisk(questions: Array<{ questionText: string }>) {
    let duplicates = 0;
    for (let index = 0; index < questions.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < questions.length; compareIndex += 1) {
        const first = normalizeText(questions[index].questionText);
        const second = normalizeText(questions[compareIndex].questionText);
        const overlap = similarityScore(first, second);
        if (overlap >= 0.84) duplicates += 1;
      }
    }
    return Number(Math.min(100, duplicates * 25).toFixed(2));
  }

  private buildRecommendation(questions: Array<{ difficultyLevel: string | null }>) {
    const hasDifficultyMix = new Set(questions.map((question) => question.difficultyLevel).filter(Boolean)).size >= 2;
    return hasDifficultyMix
      ? "Recommended for dean review; paper shows reasonable balance."
      : "Recommended with caution; improve difficulty spread before final publication.";
  }
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function similarityScore(first: string, second: string) {
  if (!first || !second) return 0;
  if (first === second) return 1;
  const firstTokens = new Set(first.split(" "));
  const secondTokens = new Set(second.split(" "));
  const intersection = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const union = new Set([...firstTokens, ...secondTokens]).size;
  return intersection / union;
}
