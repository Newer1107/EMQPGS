import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionBankService } from "@/modules/question-banks/service";
import { questionBankStatusSchema } from "@/modules/question-banks/validation";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

const service = new QuestionBankService();
const deptUtils = new DepartmentAccessUtils();

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = questionBankStatusSchema.parse(await parseJson(request));

    if (context.user!.role === Role.COORDINATOR) {
      const bank = await prisma.questionBank.findUnique({
        where: { id },
        include: { subject: { select: { departmentId: true } } },
      });
      if (!bank) throw new NotFoundError("Question bank not found");
      await deptUtils.assertDepartmentAccess(context.user!, bank.subject.departmentId);
    }

    return service.updateStatus(id, payload.status);
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR], audit: { action: "QUESTION_BANK_STATUS_CHANGED", entityType: "QUESTION_BANK", getEntityId: (result) => (result as { id?: string }).id } },
);
