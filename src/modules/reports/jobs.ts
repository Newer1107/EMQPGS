import { AiReportStatus, PaperGenerationStatus, PaperVariant } from "@prisma/client";
import { Worker } from "bullmq";
import { prisma } from "@/lib/db";
import { queueConnection, queueNames } from "@/lib/queue";
import { ReportService } from "@/modules/reports/service";

const reportService = new ReportService();

export function createAiAnalysisWorker() {
  return new Worker(
    queueNames.aiAnalysis,
    async (job) => {
      const { questionBankId, actor } = job.data as { questionBankId: string; actor: { id: string; role: "COORDINATOR" | "MODERATOR" | "COE"; email: string; name: string } };
      return reportService.createAiReport(questionBankId, actor);
    },
    { connection: queueConnection },
  );
}

export function createPaperGenerationWorker() {
  return new Worker(
    queueNames.paperGeneration,
    async (job) => {
      const { questionBankId, actor, variants } = job.data as {
        questionBankId: string;
        actor: { id: string; role: "COORDINATOR" | "COE"; email: string; name: string };
        variants: PaperVariant[];
      };
      return reportService.generatePapers(questionBankId, actor, variants);
    },
    { connection: queueConnection },
  );
}

export function createPdfGenerationWorker() {
  return new Worker(
    queueNames.pdfGeneration,
    async (job) => {
      const { generatedPaperId } = job.data as { generatedPaperId: string };
      const paper = await prisma.generatedPaper.findUnique({ where: { id: generatedPaperId } });
      if (!paper) {
        await prisma.generatedPaper.update({
          where: { id: generatedPaperId },
          data: { status: PaperGenerationStatus.FAILED, failureReason: "Generated paper record not found" },
        });
      }
      return paper;
    },
    { connection: queueConnection },
  );
}

export async function markAiReportFailed(reportId: string, reason: string) {
  await prisma.aiReport.update({
    where: { id: reportId },
    data: { status: AiReportStatus.FAILED, failureReason: reason },
  });
}
