import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionService } from "@/modules/questions/service";
import { moderationSchema } from "@/modules/questions/validation";

const service = new QuestionService();

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = moderationSchema.parse(await parseJson(request));
    return service.moderateQuestion(id, context.user!, payload.action, payload.remark);
  },
  { roles: [Role.MODERATOR], audit: { action: "QUESTION_MODERATED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
