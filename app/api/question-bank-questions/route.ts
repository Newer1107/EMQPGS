import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionBankQuestionService } from "@/modules/question-bank-questions/service";
import { questionBankQuestionSchema } from "@/modules/question-bank-questions/validation";

const service = new QuestionBankQuestionService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.searchParams.get("questionBankId") ?? "";
    return service.list(questionBankId);
  },
  { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR] },
);

export const POST = withApiHandler(
  async (request) => {
    const payload = questionBankQuestionSchema.parse(await parseJson(request));
    return service.create(payload);
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 201,
    audit: {
      action: "QUESTION_LINKED_TO_BANK",
      entityType: "QUESTION_BANK_QUESTION",
      getEntityId: (result) => (result as { id?: string }).id,
    },
  },
);
