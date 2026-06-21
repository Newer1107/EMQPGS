import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";

const service = new QuestionBankWorkflowService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").pop()!;
    return service.getQuestionBankDetail(context.auth!, questionBankId);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType] },
);
