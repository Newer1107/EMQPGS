import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ReportingCoordinatorService } from "@/modules/coordinator/reporting-coordinator.service";

const service = new ReportingCoordinatorService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listAiReports(context.auth!, questionBankId);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.triggerAiAnalysis(context.auth!, questionBankId);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType], audit: { action: "AI_REPORT_REQUESTED", entityType: "AI_REPORT" } },
);
