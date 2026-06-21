import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.approveQuestion({ userId: context.auth!.user.id }, id);
  },
  { responsibility: ["MODERATOR" as ResponsibilityType], audit: { action: "QUESTION_APPROVED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
