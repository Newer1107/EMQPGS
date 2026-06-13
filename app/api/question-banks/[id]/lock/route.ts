import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { CoordinatorService } from "@/modules/coordinator/service";

const service = new CoordinatorService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.lockQuestionBank(context.user!, questionBankId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "QUESTION_BANK_LOCKED", entityType: "QUESTION_BANK", getEntityId: (result) => (result as { id?: string }).id } },
);
