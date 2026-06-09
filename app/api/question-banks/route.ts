import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionBankService } from "@/modules/question-banks/service";
import { questionBankSchema } from "@/modules/question-banks/validation";

const service = new QuestionBankService();

export const GET = withApiHandler(() => service.list(), { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.DEAN] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = questionBankSchema.parse(await parseJson(request));
    return service.create({ ...payload, createdById: context.user!.id });
  },
  { roles: [Role.COORDINATOR], audit: { action: "QUESTION_BANK_CREATED", entityType: "QUESTION_BANK", getEntityId: (result) => (result as { id?: string }).id } },
);
