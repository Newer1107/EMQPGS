import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionBankService } from "@/modules/question-banks/service";

const service = new QuestionBankService();

export const POST = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.unlock(questionBankId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "QUESTION_BANK_UNLOCKED", entityType: "QUESTION_BANK" } },
);
