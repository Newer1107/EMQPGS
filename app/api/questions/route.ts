import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionService } from "@/modules/questions/service";
import { questionSchema } from "@/modules/questions/validation";

const service = new QuestionService();

export const GET = withApiHandler(async (request, context) => {
  const questionBankId = request.nextUrl.searchParams.get("questionBankId");
  if (!questionBankId) return [];
  return service.listQuestions(questionBankId, context.user!);
}, { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.COE, Role.DEAN] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = questionSchema.parse(await parseJson(request));
    return service.createQuestion(payload, context.user!);
  },
  { roles: [Role.CONTRIBUTOR, Role.MODERATOR], audit: { action: "QUESTION_CREATED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
