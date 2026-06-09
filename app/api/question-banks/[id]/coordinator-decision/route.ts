import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ReportService } from "@/modules/reports/service";
import { coordinatorDecisionSchema } from "@/modules/reports/validation";

const service = new ReportService();

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = coordinatorDecisionSchema.parse(await parseJson(request));
    return service.coordinatorDecision(questionBankId, payload.decision, payload.remark, context.user!);
  },
  { roles: [Role.COORDINATOR], audit: { action: "COORDINATOR_DECISION_RECORDED", entityType: "QUESTION_BANK" } },
);
