import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { coordinatorDecisionSchema } from "@/modules/reports/validation";

const service = new QuestionBankWorkflowService();

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = coordinatorDecisionSchema.parse(await request.json());
    return service.coordinatorDecision(questionBankId, payload.decision, payload.remark, context.user!);
  },
  {
    roles: [Role.COORDINATOR],
    audit: {
      action: "COORDINATOR_DECISION_RECORDED",
      entityType: "QUESTION_BANK",
    },
  },
);
