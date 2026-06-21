import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";

const service = new QuestionBankWorkflowService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.lockQuestionBank(context.auth!, questionBankId);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType], audit: { action: "QUESTION_BANK_LOCKED", entityType: "QUESTION_BANK", getEntityId: (result) => (result as { id?: string }).id } },
);
