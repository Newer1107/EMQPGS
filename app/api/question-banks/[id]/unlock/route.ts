import { Role, QuestionBankStatus } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionBankService } from "@/modules/question-banks/service";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

const service = new QuestionBankService();
const deptUtils = new DepartmentAccessUtils();
const unlockSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to unlock a question bank."),
});

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = unlockSchema.parse(await parseJson(request));

    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: { select: { departmentId: true } } },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await deptUtils.assertDepartmentAccess(context.user!, bank.subject.departmentId);

    return service.updateStatus(questionBankId, QuestionBankStatus.IN_PROGRESS);
  },
  {
    roles: [Role.COORDINATOR],
    audit: {
      action: "QUESTION_BANK_UNLOCKED",
      entityType: "QUESTION_BANK",
      getEntityId: (result) => (result as { id?: string }).id,
      getMetadata: (request) => {
        const url = request.nextUrl.pathname;
        return { questionBankId: url.split("/").slice(-2)[0], reason: "Unlocked by coordinator" };
      },
    },
  },
);
