import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { advancePhaseSchema } from "@/modules/question-banks/validation";

const service = new QuestionBankWorkflowService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = advancePhaseSchema.parse(await request.json());
    return service.advancePhase(context.user!, id, payload.targetPhase);
  },
  { roles: [Role.COORDINATOR], audit: { action: "PHASE_ADVANCED", entityType: "QUESTION_BANK" } },
);
