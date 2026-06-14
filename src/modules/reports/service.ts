import {
  AiReportStatus,
  CoordinatorDecision,
  NotificationType,
  PaperGenerationStatus,
  PaperVariant,
  QuestionBankStatus,
  type Prisma,
  type User,
} from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES } from "@/lib/constants";
import { OllamaService } from "@/modules/ai/ollama-service";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";
import { PaperGenerator } from "@/modules/reports/paper-generator";
import { PdfService } from "@/modules/reports/pdf-service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class ReportService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
    private readonly ollamaService = new OllamaService(),
    private readonly analysisEngine = new AnalysisEngine(),
    private readonly pdfService = new PdfService(),
    private readonly paperGenerator = new PaperGenerator(),
  ) {}

  async createAiReport(questionBankId: string, actor: Actor) {
    const questionBank = await this.getQuestionBankForAnalysis(questionBankId);
    if (!questionBank) throw new NotFoundError("Question bank not found");

    const deterministicReport = this.analysisEngine.buildDeterministicReport(questionBank);
    const aiOverlay = await this.ollamaService.analyzeQuestionBank(this.buildOllamaPrompt(questionBank, deterministicReport));
    const report = {
      ...deterministicReport,
      ...aiOverlay,
      chartData: deterministicReport.chartData,
    };

    const reportRecord = await prisma.aiReport.create({
      data: {
        questionBankId,
        status: AiReportStatus.PROCESSING,
        modelName: process.env.OLLAMA_MODEL ?? "llama3.1",
        generatedById: actor.id,
      },
    });

    const jsonBuffer = Buffer.from(JSON.stringify(report, null, 2), "utf8");
    const jsonAsset = await this.storageService.uploadServerFile({
      bucket: "exports",
      fileName: `${questionBank.subject.subjectCode}-${reportRecord.id}-analysis.json`,
      mimeType: "application/json",
      body: jsonBuffer,
      size: jsonBuffer.byteLength,
      uploadedById: actor.id,
      linkedEntityType: ENTITY_TYPES.AI_REPORT,
      linkedEntityId: reportRecord.id,
    });

    const pdfBytes = await this.pdfService.createAiReportPdf({
      title: `${questionBank.subject.subjectCode} AI Analysis Report`,
      subtitle: `${questionBank.examCycle.academicYear} / Semester ${questionBank.examCycle.semester} / ${questionBank.examCycle.examType}`,
      report,
    });
    const pdfAsset = await this.storageService.uploadServerFile({
      bucket: "exports",
      fileName: `${questionBank.subject.subjectCode}-${reportRecord.id}-analysis.pdf`,
      mimeType: "application/pdf",
      body: Buffer.from(pdfBytes),
      size: pdfBytes.byteLength,
      uploadedById: actor.id,
      linkedEntityType: ENTITY_TYPES.AI_REPORT,
      linkedEntityId: reportRecord.id,
    });

    const completed = await prisma.aiReport.update({
      where: { id: reportRecord.id },
      data: {
        status: AiReportStatus.COMPLETED,
        summary: report.executiveSummary,
        reportJson: report as Prisma.InputJsonValue,
        chartData: report.chartData as Prisma.InputJsonValue,
        generatedAt: new Date(),
        jsonFileAssetId: jsonAsset.id,
        pdfFileAssetId: pdfAsset.id,
      },
      include: {
        jsonFileAsset: true,
        pdfFileAsset: true,
      },
    });

    await prisma.questionBank.update({
      where: { id: questionBankId },
      data: { status: QuestionBankStatus.REPORT_GENERATED },
    });

    const coordinators = await prisma.coordinatorDepartmentAssignment.findMany({
      where: { departmentId: questionBank.subject.departmentId },
      include: { coordinator: true },
    });
    await Promise.all(
      coordinators.map(({ coordinator }) =>
        this.notificationService.create(
          coordinator.id,
          "AI analysis ready",
          `AI analysis report is ready for ${questionBank.subject.subjectName}.`,
          `/dashboard/coordinator/question-banks?bank=${questionBankId}`,
          NotificationType.INFO,
        ),
      ),
    );

    await logAudit({
      actorId: actor.id,
      action: "AI_REPORT_GENERATED",
      entityType: ENTITY_TYPES.AI_REPORT,
      entityId: completed.id,
      metadata: { questionBankId },
    });

    return completed;
  }

  async listAiReports(questionBankId: string) {
    return prisma.aiReport.findMany({
      where: { questionBankId },
      orderBy: { createdAt: "desc" },
      include: {
        jsonFileAsset: true,
        pdfFileAsset: true,
      },
    });
  }

  async uploadSignedReport(questionBankId: string, fileAssetId: string, actor: Actor) {
    const questionBank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { assignments: true, subject: true },
    });
    if (!questionBank) throw new NotFoundError("Question bank not found");
    const isModerator = questionBank.assignments.some((assignment) => assignment.teacherId === actor.id && assignment.assignmentRole === "MODERATOR");
    if (!isModerator && actor.role !== "MODERATOR") throw new ForbiddenError("Only the assigned moderator can upload the signed report");

    const updated = await prisma.questionBank.update({
      where: { id: questionBankId },
      data: {
        signedReportAssetId: fileAssetId,
        signedReportUploadedAt: new Date(),
        status: QuestionBankStatus.SIGNED_REPORT_UPLOADED,
      },
      include: {
        signedReportAsset: true,
      },
    });

    const coordinators = await prisma.coordinatorDepartmentAssignment.findMany({
      where: { departmentId: questionBank.subject.departmentId },
      include: { coordinator: true },
    });
    await Promise.all(
      coordinators.map(({ coordinator }) =>
        this.notificationService.createAndEmail(
          coordinator,
          "Signed HOD report uploaded",
          `A signed report is ready for coordinator review for ${updated.id}.`,
          "/dashboard/coordinator/questions",
          NotificationType.ACTION_REQUIRED,
        ),
      ),
    );

    return updated;
  }

  async coordinatorDecision(questionBankId: string, decision: CoordinatorDecision, remark: string | undefined, actor: Actor) {
    if (actor.role !== "COORDINATOR") throw new ForbiddenError("Only coordinators can approve or reject reports");
    const questionBank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!questionBank) throw new NotFoundError("Question bank not found");

    const status =
      decision === CoordinatorDecision.APPROVED
        ? QuestionBankStatus.APPROVED
        : QuestionBankStatus.AWAITING_HOD_SIGN;

    const updated = await prisma.questionBank.update({
      where: { id: questionBankId },
      data: {
        coordinatorDecision: decision,
        coordinatorReviewedAt: new Date(),
        coordinatorReviewRemark: remark ?? null,
        status,
        lockedAt: null,
      },
    });

    await logAudit({
      actorId: actor.id,
      action: decision === CoordinatorDecision.APPROVED ? "QUESTION_BANK_APPROVED" : "QUESTION_BANK_REJECTED",
      entityType: ENTITY_TYPES.QUESTION_BANK,
      entityId: questionBankId,
      metadata: { remark },
    });

    return updated;
  }

  async generatePapers(questionBankId: string, actor: Actor, variants: PaperVariant[]) {
    const questionBank = await this.getQuestionBankForPaperGeneration(questionBankId);
    if (!questionBank) throw new NotFoundError("Question bank not found");
    if (questionBank.status !== QuestionBankStatus.LOCKED && questionBank.status !== QuestionBankStatus.REPORT_GENERATED) {
      throw new AppError("Question bank must have a completed AI report before generating papers", 409);
    }

    const generatedPayloads = this.paperGenerator.generate(questionBank, variants);
    const outputs = [];

    for (const payload of generatedPayloads) {
      const pdfBytes = await this.pdfService.createPaperPdf({
        title: `${questionBank.subject.subjectCode} ${payload.variant.replace("_", " ")}`,
        subtitle: `${questionBank.examCycle.academicYear} / Semester ${questionBank.examCycle.semester} / ${questionBank.examCycle.examType}`,
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
        linkedEntityType: ENTITY_TYPES.GENERATED_PAPER,
        linkedEntityId: questionBankId,
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
          prisma.question.update({
            where: { id: question.id },
            data: {
              usageCount: { increment: 1 },
              lastUsedExam: PaperGenerator.toLastUsedExam(questionBank.examCycle.examType),
              lastUsedYear: questionBank.examCycle.academicYear,
              lastUsedSemester: questionBank.examCycle.semester,
              lastUsedType: questionBank.examCycle.examType,
            },
          }),
        ),
      );

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

  async createSignedReportUploadUrl(questionBankId: string, actor: Actor, fileName: string, mimeType: string, size: number) {
    const questionBank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!questionBank) throw new NotFoundError("Question bank not found");

    return this.storageService.createUploadLink({
      bucket: "signed-reports",
      fileName,
      mimeType,
      size,
      uploadedById: actor.id,
      linkedEntityType: ENTITY_TYPES.QUESTION_BANK_SIGNED_REPORT,
      linkedEntityId: questionBankId,
    });
  }

  private getQuestionBankForAnalysis(questionBankId: string) {
    return prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: true,
        examCycle: true,
        questions: true,
      },
    });
  }

  private getQuestionBankForPaperGeneration(questionBankId: string) {
    return prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: true,
        examCycle: true,
        aiReports: {
          where: { status: AiReportStatus.COMPLETED },
        },
        questions: true,
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

  private buildOllamaPrompt(questionBank: NonNullable<Awaited<ReturnType<ReportService["getQuestionBankForAnalysis"]>>>, report: ReturnType<AnalysisEngine["buildDeterministicReport"]>) {
    return `
You are analyzing a university question bank. Return strict JSON only.
Context:
- Subject: ${questionBank.subject.subjectCode} ${questionBank.subject.subjectName}
- Academic Year: ${questionBank.examCycle.academicYear}
- Semester: ${questionBank.examCycle.semester}
- Exam Type: ${questionBank.examCycle.examType}
- Approved Questions: ${report.inventory.approvedQuestions}

Deterministic metrics:
${JSON.stringify(report, null, 2)}

Return JSON with optional improved fields:
{
  "executiveSummary": "string",
  "missingAreas": ["string"],
  "qualityFindings": ["string"],
  "bloomsBalance": "string"
}
`.trim();
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
