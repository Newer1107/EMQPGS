import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { CoordinatorService } from "@/modules/coordinator/service";
import { QuestionService } from "@/modules/questions/service";
import { questionUpdateSchema } from "@/modules/questions/validation";

const service = new QuestionService();
const coordinatorService = new CoordinatorService();

export const GET = withApiHandler(async (request, context) => {
  const id = request.nextUrl.pathname.split("/").pop()!;
  if (context.user!.role === Role.COORDINATOR) {
    return coordinatorService.getQuestionDetail(context.user!, id);
  }
  return service.getQuestion(id, context.user!);
}, { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.COE] });

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = questionUpdateSchema.parse(await parseJson(request));
    return service.updateQuestion(id, payload, context.user!);
  },
  { roles: [Role.MODERATOR, Role.CONTRIBUTOR], audit: { action: "QUESTION_EDITED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
