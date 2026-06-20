import { AiReportStatus, NotificationType, type Prisma } from "@prisma/client";
import { type Actor } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES } from "@/lib/constants";
import { OllamaService } from "@/modules/ai/ollama-service";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";


const analysisInclude = {
  subject: true,
  batchSemester: { include: { academicYear: true } },
  slots: {
    include: { assignedQuestion: true },
    where: { assignedQuestionId: { not: null } },
  },
} satisfies Prisma.QuestionBankInclude;

export class AiReportService {
  constructor(
    private readonly notificationService = new NotificationService(),
    private readonly ollamaService = new OllamaService(),
    private readonly analysisEngine = new AnalysisEngine(),
  ) {}

  async createAiReport(questionBankId: string, actor: Actor) {
    const questionBank = await this.getQuestionBankForAnalysis(questionBankId);
    if (!questionBank) throw new NotFoundError("Question bank not found");

    const deterministicReport = this.analysisEngine.buildDeterministicReport(questionBank);

    let report: Record<string, unknown>;
    try {
      const aiOverlay = await this.ollamaService.analyzeQuestionBank(this.buildOllamaPrompt(questionBank, deterministicReport));
      report = {
        ...deterministicReport,
        ...aiOverlay,
        chartData: deterministicReport.chartData,
      };
    } catch {
      report = {
        ...deterministicReport,
        executiveSummary: "AI analysis unavailable. Deterministic report only.",
        missingAreas: [],
        qualityFindings: [],
        bloomsBalance: "Not analyzed (Ollama unavailable).",
        chartData: deterministicReport.chartData,
      };
    }

    const reportRecord = await prisma.aiReport.create({
      data: {
        questionBankId,
        status: AiReportStatus.COMPLETED,
        modelName: process.env.OLLAMA_MODEL ?? "llama3.1",
        generatedById: actor.id,
        summary: (report.executiveSummary as string) ?? "",
        reportJson: report as Prisma.InputJsonValue,
        chartData: (report.chartData ?? deterministicReport.chartData) as Prisma.InputJsonValue,
        generatedAt: new Date(),
      },
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
      entityId: reportRecord.id,
      metadata: { questionBankId },
    });

    return reportRecord;
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
      - Academic Year: ${questionBank.batchSemester.academicYear.code}
      - Semester: ${questionBank.batchSemester.semesterNumber}
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
