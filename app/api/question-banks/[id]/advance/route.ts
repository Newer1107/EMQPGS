import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionBankService } from "@/modules/question-banks/service";
import { advancePhaseSchema } from "@/modules/question-banks/validation";

const service = new QuestionBankService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = advancePhaseSchema.parse(await parseJson(request));
    return service.advancePhase(id, payload.targetPhase);
  },
  { roles: [Role.COORDINATOR], audit: { action: "PHASE_ADVANCED", entityType: "QUESTION_BANK" } },
);
