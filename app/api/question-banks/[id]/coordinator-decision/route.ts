import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ReportService } from "@/modules/reports/service";
import { coordinatorDecisionSchema } from "@/modules/reports/validation";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

const service = new ReportService();
const deptUtils = new DepartmentAccessUtils();

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = coordinatorDecisionSchema.parse(await parseJson(request));

    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: { select: { departmentId: true } } },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await deptUtils.assertDepartmentAccess(context.user!, bank.subject.departmentId);

    return service.coordinatorDecision(questionBankId, payload.decision, payload.remark, context.user!);
  },
  { roles: [Role.COORDINATOR], audit: { action: "COORDINATOR_DECISION_RECORDED", entityType: "QUESTION_BANK" } },
);
