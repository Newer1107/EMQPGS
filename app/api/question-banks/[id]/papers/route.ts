import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ReportingCoordinatorService } from "@/modules/coordinator/reporting-coordinator.service";

const service = new ReportingCoordinatorService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listGeneratedPapers(context.user!, questionBankId);
  },
  { roles: [Role.COORDINATOR] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.triggerPaperGeneration(context.user!, questionBankId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "PAPER_GENERATION_REQUESTED", entityType: "GENERATED_PAPER" } },
);
