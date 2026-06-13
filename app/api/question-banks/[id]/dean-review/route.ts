import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ProductionService } from "@/modules/production/service";
import { deanReviewSchema } from "@/modules/production/validation";

const service = new ProductionService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.getDeanReviewWorkspace(questionBankId, context.user!);
  },
  { roles: [Role.DEAN] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = deanReviewSchema.parse(await parseJson(request));
    return service.submitDeanReview(questionBankId, payload, context.user!);
  },
  { roles: [Role.DEAN], successStatus: 201 },
);
