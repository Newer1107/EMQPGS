import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { CoordinatorService } from "@/modules/coordinator/service";

const service = new CoordinatorService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listAiReports(context.user!, questionBankId);
  },
  { roles: [Role.COORDINATOR] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.triggerAiAnalysis(context.user!, questionBankId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "AI_REPORT_REQUESTED", entityType: "AI_REPORT" } },
);
