import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();

export const GET = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.getQuestionDetail(context.user!, id);
  },
  { roles: [Role.MODERATOR] },
);
