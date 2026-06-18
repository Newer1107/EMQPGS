import {
  AiReportStatus,
  NotificationType,
  PaperGenerationStatus,
  PaperVariant,
  QuestionBankPhase,
  RecordStatus,
  type Prisma,
} from "@prisma/client";
import { type Actor } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES } from "@/lib/constants";
import { PaperGenerator } from "@/modules/reports/paper-generator";
import { PdfService } from "@/modules/reports/pdf-service";
import { recordUsage } from "@/modules/question-library/service";


export class PaperGenerationService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
    private readonly paperGenerator = new PaperGenerator(),
    private readonly pdfService = new PdfService(),
  ) {}

  async generatePapers(questionBankId: string, actor: Actor, variants: PaperVariant[]) {
    const questionBank = await this.getQuestionBankForPaperGeneration(questionBankId);
    if (!questionBank) throw new NotFoundError("Question bank not found");
    if (questionBank.phase !== QuestionBankPhase.APPROVAL && questionBank.phase !== QuestionBankPhase.COMPLETE) {
      throw new AppError("Question bank must be in APPROVAL or COMPLETE phase before generating papers", 409);
    }

    const generatedPayloads = this.paperGenerator.generate(questionBank, variants);
    const outputs = [];

    for (const payload of generatedPayloads) {
      const pdfBytes = await this.pdfService.createPaperPdf({
        title: `${questionBank.subject.subjectCode} ${payload.variant.replace("_", " ")}`,
        subtitle: `Semester ${questionBank.examCycle.batchSemester.semesterNumber} · ${questionBank.examCycle.batchSemester.academicYear.code} · ${questionBank.examCycle.examType}`,
        questions: payload.selectedQuestions.map((question) => ({
          moduleNumber: question.moduleNumber,
          marks: question.marks,
          questionText: question.questionText,
          coMapping: question.coMapping,
          rbtLevel: question.rbtLevel,
        })),
      });

      const pdfAsset = await this.storageService.uploadServerFile({
        bucket: "generated-papers",
        fileName: `${questionBank.subject.subjectCode}-${payload.variant}.pdf`,
        mimeType: "application/pdf",
        body: Buffer.from(pdfBytes),
        size: pdfBytes.byteLength,
        uploadedById: actor.id,
      });

      const record = await prisma.generatedPaper.upsert({
        where: { questionBankId_variant: { questionBankId, variant: payload.variant } },
        update: {
          status: PaperGenerationStatus.COMPLETED,
          generatedById: actor.id,
          generatedAt: new Date(),
          coverageScore: this.calculateCoverageScore(payload.selectedQuestions),
          difficultyScore: this.calculateDifficultyScore(payload.selectedQuestions),
          qualityScore: this.calculateQualityScore(payload.selectedQuestions),
          duplicateRisk: this.calculateDuplicateRisk(payload.selectedQuestions),
          recommendation: this.buildRecommendation(payload.selectedQuestions),
          paperJson: {
            inventoryWarnings: payload.inventoryWarnings,
            questionIds: payload.selectedQuestions.map((question) => question.id),
          } as Prisma.InputJsonValue,
          paperFileAssetId: pdfAsset.id,
          failureReason: null,
          items: {
            deleteMany: {},
            create: payload.selectedQuestions.map((question) => ({ questionId: question.id })),
          },
        },
        create: {
          questionBankId,
          variant: payload.variant,
          status: PaperGenerationStatus.COMPLETED,
          generatedById: actor.id,
          generatedAt: new Date(),
          coverageScore: this.calculateCoverageScore(payload.selectedQuestions),
          difficultyScore: this.calculateDifficultyScore(payload.selectedQuestions),
          qualityScore: this.calculateQualityScore(payload.selectedQuestions),
          duplicateRisk: this.calculateDuplicateRisk(payload.selectedQuestions),
          recommendation: this.buildRecommendation(payload.selectedQuestions),
          paperJson: {
            inventoryWarnings: payload.inventoryWarnings,
            questionIds: payload.selectedQuestions.map((question) => question.id),
          } as Prisma.InputJsonValue,
          paperFileAssetId: pdfAsset.id,
          items: {
            create: payload.selectedQuestions.map((question) => ({ questionId: question.id })),
          },
        },
        include: {
          items: true,
          paperFileAsset: true,
        },
      });

      await Promise.all(
        payload.selectedQuestions.map((question) =>
          recordUsage(question.id, questionBank.examCycle.id, "GENERATED_PAPER", record.id),
        ),
      );

      await prisma.paperSnapshot.upsert({
        where: { questionBankId_variant: { questionBankId, variant: payload.variant } },
        update: {
          paperJson: record.paperJson as Prisma.InputJsonValue,
          coverageScore: record.coverageScore,
          difficultyScore: record.difficultyScore,
          qualityScore: record.qualityScore,
        },
        create: {
          questionBankId,
          variant: payload.variant,
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

    const coordinators = await prisma.coordinatorDepartmentAssignment.findMany({
      where: { departmentId: questionBank.subject.departmentId },
      include: { coordinator: true },
    });
    await Promise.all(
      coordinators.map(({ coordinator }) =>
        this.notificationService.create(
          coordinator.id,
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
        examCycle: { include: { batchSemester: { include: { academicYear: true } } } },
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

  private calculateCoverageScore(questions: Array<{ moduleNumber: number }>) {
    const coveredModules = new Set(questions.map((question) => question.moduleNumber)).size;
    return Number(((coveredModules / 6) * 100).toFixed(2));
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
