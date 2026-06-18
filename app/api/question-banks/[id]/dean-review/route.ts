import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ReportingCoordinatorService } from "@/modules/coordinator/reporting-coordinator.service";
import { DeanReviewService } from "@/modules/production/dean-review.service";
import { deanReviewSchema } from "@/modules/production/validation";

const service = new DeanReviewService();
const coordinatorService = new ReportingCoordinatorService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    if (context.user!.role === Role.COORDINATOR) {
      return coordinatorService.getDeanReviewStatus(context.user!, questionBankId);
    }
    return service.getDeanReviewWorkspace(questionBankId, context.user!);
  },
  { roles: [Role.COORDINATOR, Role.DEAN] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = deanReviewSchema.parse(await request.json());
    return service.submitDeanReview(questionBankId, payload, context.user!);
  },
  { roles: [Role.DEAN], successStatus: 201 },
);
