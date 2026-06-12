import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
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
    return service.createAiReport(questionBankId, context.user!);
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR, Role.COE], audit: { action: "AI_REPORT_REQUESTED", entityType: "AI_REPORT" } },
);
