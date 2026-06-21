import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();

export const GET = withApiHandler(
  async (request, context) => {
    const bankId = request.nextUrl.searchParams.get("bankId");
    if (!bankId) throw new Error("bankId query parameter is required");
    return service.listQuestions({ bankId });
  },
  { responsibility: ["MODERATOR" as ResponsibilityType] },
);
