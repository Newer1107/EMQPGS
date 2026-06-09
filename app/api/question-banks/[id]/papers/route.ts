import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { getPaperGenerationQueue } from "@/lib/queue";
import { ReportService } from "@/modules/reports/service";
import { paperGenerationSchema } from "@/modules/reports/validation";

const service = new ReportService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listGeneratedPapers(questionBankId);
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR, Role.COE, Role.DEAN] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = paperGenerationSchema.parse(await parseJson(request));
    const job = await getPaperGenerationQueue().add("generate-papers", {
      questionBankId,
      actor: context.user!,
      variants: payload.variants,
    });
    return { queued: true, jobId: job.id };
  },
  { roles: [Role.COORDINATOR, Role.COE], audit: { action: "PAPER_GENERATION_JOB_QUEUED", entityType: "GENERATED_PAPER" } },
);
