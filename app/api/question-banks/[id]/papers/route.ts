import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ReportingCoordinatorService } from "@/modules/coordinator/reporting-coordinator.service";

const service = new ReportingCoordinatorService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listGeneratedPapers(context.auth!, questionBankId);
  },
  { responsibility: ["DEAN" as ResponsibilityType] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.triggerPaperGeneration(context.auth!, questionBankId);
  },
  { responsibility: ["DEAN" as ResponsibilityType], audit: { action: "PAPER_GENERATION_REQUESTED", entityType: "GENERATED_PAPER" } },
);
