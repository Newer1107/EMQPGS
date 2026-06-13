import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ModeratorService } from "@/modules/moderation/service";
import { moderationSchema } from "@/modules/questions/validation";

const service = new ModeratorService();

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = moderationSchema.parse(await parseJson(request));
    if (payload.action === "APPROVE") {
      return service.approveQuestion(context.user!, id);
    }
    if (payload.action === "REJECT") {
      return service.rejectQuestion(context.user!, id, payload.remark ?? "");
    }
    return service.requestRevision(context.user!, id, payload.remark ?? "");
  },
  { roles: [Role.MODERATOR], audit: { action: "QUESTION_MODERATED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
