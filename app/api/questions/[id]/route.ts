import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionService } from "@/modules/questions/service";
import { questionUpdateSchema } from "@/modules/questions/validation";

const service = new QuestionService();

export const GET = withApiHandler(async (request, context) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  return service.getQuestion(id, context.user!);
}, { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.COE, Role.DEAN] });

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = questionUpdateSchema.parse(await parseJson(request));
    return service.updateQuestion(id, payload, context.user!);
  },
  { roles: [Role.MODERATOR, Role.CONTRIBUTOR], audit: { action: "QUESTION_EDITED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
