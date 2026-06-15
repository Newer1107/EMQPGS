import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();

export const GET = withApiHandler(
  async (_request, context) => {
    return service.listQuestions(context.user!);
  },
  { roles: [Role.MODERATOR] },
);
