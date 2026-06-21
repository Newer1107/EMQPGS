import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AuthorizationService } from "@/lib/auth/authorization-service";

import { ReportingCoordinatorService } from "@/modules/coordinator/reporting-coordinator.service";
import { DeanReviewService } from "@/modules/production/dean-review.service";
import { deanReviewSchema } from "@/modules/production/validation";

const service = new DeanReviewService();
const coordinatorService = new ReportingCoordinatorService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const authz = new AuthorizationService(context.auth!);
    if (authz.has("COORDINATOR" as ResponsibilityType)) {
      return coordinatorService.getDeanReviewStatus(context.auth!, questionBankId);
    }
    return service.getDeanReviewWorkspace(questionBankId, context.auth!);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType, "DEAN" as ResponsibilityType] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = deanReviewSchema.parse(await request.json());
    return service.submitDeanReview(questionBankId, payload, context.auth!);
  },
  { responsibility: ["DEAN" as ResponsibilityType], stepUp: "DEAN_APPROVE", successStatus: 201 },
);
