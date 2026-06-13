import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { CoordinatorService } from "@/modules/coordinator/service";

const service = new CoordinatorService();

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").pop()!;
    return service.getQuestionBankDetail(context.user!, questionBankId);
  },
  { roles: [Role.COORDINATOR] },
);
