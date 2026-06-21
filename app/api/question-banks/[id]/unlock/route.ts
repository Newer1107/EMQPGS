import { ResponsibilityType, RecordStatus } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { withOptimisticLock, buildOptimisticUpdate, buildOptimisticWhere } from "@/lib/optimistic-lock";

export const POST = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const entity = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!entity) throw new NotFoundError("Question bank not found");
    return withOptimisticLock(
      () =>
        prisma.questionBank.update({
          where: buildOptimisticWhere(questionBankId, entity.version),
          data: buildOptimisticUpdate({ recordStatus: RecordStatus.ACTIVE, lockedAt: null }),
        }),
      "Question bank",
    );
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType], audit: { action: "QUESTION_BANK_UNLOCKED", entityType: "QUESTION_BANK" } },
);
