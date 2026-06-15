import { AiReportStatus, NotificationType, QuestionBankPhase, type Prisma, type User } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES } from "@/lib/constants";
import { OllamaService } from "@/modules/ai/ollama-service";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";
import { PdfService } from "@/modules/reports/pdf-service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

const analysisInclude = {
  subject: true,
  examCycle: { include: { academicYear: true, semester: true } },
  slots: {
    include: { assignedQuestion: true },
    where: { assignedQuestionId: { not: null } },
  },
} satisfies Prisma.QuestionBankInclude;

export class AiReportService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
    private readonly ollamaService = new OllamaService(),
    private readonly analysisEngine = new AnalysisEngine(),
    private readonly pdfService = new PdfService(),
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
    });

    const pdfBytes = await this.pdfService.createAiReportPdf({
      title: `${questionBank.subject.subjectCode} AI Analysis Report`,
      subtitle: `${questionBank.examCycle.semester.name} · ${questionBank.examCycle.academicYear.code} · ${questionBank.examCycle.examType}`,
      report,
    });
    const pdfAsset = await this.storageService.uploadServerFile({
      bucket: "exports",
      fileName: `${questionBank.subject.subjectCode}-${reportRecord.id}-analysis.pdf`,
      mimeType: "application/pdf",
      body: Buffer.from(pdfBytes),
      size: pdfBytes.byteLength,
      uploadedById: actor.id,
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
      data: { phase: QuestionBankPhase.APPROVAL },
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

  private getQuestionBankForAnalysis(questionBankId: string) {
    return prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: analysisInclude,
    });
  }

  private buildOllamaPrompt(
    questionBank: NonNullable<Awaited<ReturnType<AiReportService["getQuestionBankForAnalysis"]>>>,
    report: ReturnType<AnalysisEngine["buildDeterministicReport"]>,
  ) {
    return `
You are analyzing a university question bank. Return strict JSON only.
Context:
- Subject: ${questionBank.subject.subjectCode} ${questionBank.subject.subjectName}
- Academic Year: ${questionBank.examCycle.academicYear.code}
- Semester: ${questionBank.examCycle.semester.name}
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
}
