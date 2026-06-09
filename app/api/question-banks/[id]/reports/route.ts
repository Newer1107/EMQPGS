import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { getAiAnalysisQueue } from "@/lib/queue";
import { ReportService } from "@/modules/reports/service";

const service = new ReportService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listAiReports(questionBankId);
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR, Role.COE, Role.DEAN] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const job = await getAiAnalysisQueue().add("analyze-question-bank", {
      questionBankId,
      actor: context.user!,
    });
    return { queued: true, jobId: job.id };
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR, Role.COE], audit: { action: "AI_REPORT_JOB_QUEUED", entityType: "AI_REPORT" } },
);
