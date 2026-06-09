import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionBankService } from "@/modules/question-banks/service";
import { questionBankStatusSchema } from "@/modules/question-banks/validation";

const service = new QuestionBankService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = questionBankStatusSchema.parse(await parseJson(request));
    return service.updateStatus(id, payload.status);
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR], audit: { action: "QUESTION_BANK_STATUS_CHANGED", entityType: "QUESTION_BANK", getEntityId: (result) => (result as { id?: string }).id } },
);
