import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ReportService } from "@/modules/reports/service";
import { paperGenerationSchema } from "@/modules/reports/validation";

const service = new ReportService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listGeneratedPapers(questionBankId);
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR, Role.COE] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = paperGenerationSchema.parse(await parseJson(request));
    return service.generatePapers(questionBankId, context.user!, payload.variants);
  },
  { roles: [Role.COORDINATOR, Role.COE], audit: { action: "PAPER_GENERATION_REQUESTED", entityType: "GENERATED_PAPER" } },
);
