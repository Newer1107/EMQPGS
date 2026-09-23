import { withApiHandler } from "@/lib/api-handler";
import { UafReviewService } from "@/modules/uaf-review/service";

const service = new UafReviewService();
export const GET = withApiHandler(async (request, { auth }) => service.get(auth!, request.nextUrl.pathname.split("/")[3]), { responsibility: "COORDINATOR" });
export const POST = withApiHandler(async (request, { auth }) => service.save(auth!, request.nextUrl.pathname.split("/")[3], await request.json()), {
  responsibility: "COORDINATOR", successStatus: 201,
  audit: { action: "UAF_REVIEW_SAVED", entityType: "UAF_REVIEW", getEntityId: result => (result as { id: string }).id },
});
