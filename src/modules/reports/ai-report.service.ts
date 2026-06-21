import { AiReportStatus, NotificationType, type Prisma } from "@prisma/client";
import { type Actor } from "@/lib/types";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES } from "@/lib/constants";
import { OllamaService } from "@/modules/ai/ollama-service";
import { AnalysisEngine } from "@/modules/reports/analysis-engine";
import { aiOverlaySchema, type AiOverlay } from "@/modules/ai/types";
import type { AiProviderResult } from "@/modules/ai/ai-provider";
import { logger } from "@/lib/logger";

const analysisInclude = {
  subject: true,
  batchSemester: { include: { academicYear: true } },
  pattern: true,
  slots: {
    include: { assignedQuestion: true },
    where: { assignedQuestionId: { not: null } },
  },
} satisfies Prisma.QuestionBankInclude;

const AI_UNAVAILABLE_SUMMARY = "AI analysis unavailable. Showing deterministic analysis only.";
const MAX_SUMMARY_LENGTH = 5000;

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

    const aiResult = await this.ollamaService.analyze(this.buildOllamaPrompt(questionBank, deterministicReport));

    const overlay = this.parseAiOverlay(aiResult);

    const executiveSummary = this.sanitizeSummary(overlay?.executiveSummary ?? AI_UNAVAILABLE_SUMMARY);

    const report: Record<string, unknown> = {
      ...deterministicReport,
      executiveSummary,
      missingAreas: overlay?.missingAreas ?? deterministicReport.missingAreas,
      qualityFindings: overlay?.qualityFindings ?? deterministicReport.qualityFindings,
      bloomsBalance: overlay?.bloomsBalance ?? deterministicReport.bloomsBalance,
      chartData: deterministicReport.chartData,
    };

    logger.info("Persisting AI report", {
      questionBankId,
      summaryLength: executiveSummary.length,
      aiAvailable: aiResult.success,
    });

    let reportRecord;
    try {
      reportRecord = await prisma.aiReport.create({
        data: {
          questionBankId,
          status: AiReportStatus.COMPLETED,
          modelName: process.env.OLLAMA_MODEL ?? "llama3.1",
          generatedById: actor.id,
          summary: executiveSummary,
          reportJson: report as Prisma.InputJsonValue,
          chartData: deterministicReport.chartData as Prisma.InputJsonValue,
          generatedAt: new Date(),
        },
      });
    } catch (err) {
      logger.error("AI report persistence failed", {
        column: "summary",
        generatedLength: executiveSummary.length,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AppError("Failed to save AI report. Please try again.", 500);
    }

    const coordinatorAssignments = await prisma.responsibilityAssignment.findMany({
      where: { responsibility: "COORDINATOR", scopeType: "DEPARTMENT", scopeId: questionBank.subject.departmentId },
      include: { user: true },
    });
    await Promise.all(
      coordinatorAssignments.map(({ user }) =>
        this.notificationService.create(
          user.id,
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

  private sanitizeSummary(summary: string): string {
    if (summary.length > MAX_SUMMARY_LENGTH) {
      logger.warn("AI executive summary truncated", {
        originalLength: summary.length,
        maxLength: MAX_SUMMARY_LENGTH,
      });
      return summary.slice(0, MAX_SUMMARY_LENGTH);
    }
    return summary;
  }

  private parseAiOverlay(result: AiProviderResult<string>): AiOverlay | null {
    if (!result.success) {
      logger.warn("AI analysis failed, using deterministic fallback", { error: result.error });
      return null;
    }
    try {
      const parsed = JSON.parse(result.data);
      return aiOverlaySchema.parse(parsed);
    } catch {
      logger.warn("AI response failed validation, using deterministic fallback");
      return null;
    }
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
You are an academic quality auditor reviewing a university question bank.

Role and principles:
- You are a domain expert in curriculum design and assessment.
- Use ONLY the supplied metrics below. Do not invent statistics.
- Do not recalculate, modify, or estimate numerical values.
- Do not change any counts, percentages, or coverage figures.
- Only provide qualitative commentary on the supplied data.
- Return valid JSON only — no preamble, no markdown.

Summary constraints:
- Keep the executiveSummary to 2-4 short paragraphs (200-250 words maximum).
- Highlight only the most important strengths, weaknesses, and recommendations.
- Be concise — the summary is displayed on a dashboard page.

Context:
- Subject: ${questionBank.subject.subjectCode} ${questionBank.subject.subjectName}
- Academic Year: ${questionBank.batchSemester.academicYear.code}
- Semester: ${questionBank.batchSemester.semesterNumber}
- Approved Questions: ${report.inventory.approvedQuestions}

Deterministic metrics:
${JSON.stringify(report, null, 2)}

Return ONLY this JSON structure with your narrative assessment:
{
  "executiveSummary": "2-4 paragraph summary covering overall quality, coverage strengths, key gaps, and recommendations (200-250 words max)",
  "missingAreas": ["list specific modules, COs, RBT levels, or difficulty tiers with no or very few approved questions"],
  "qualityFindings": ["list specific quality concerns such as imbalance, over-representation, or structural issues"],
  "bloomsBalance": "one-sentence assessment of lower-order vs higher-order thinking distribution"
}
`.trim();
  }
}
