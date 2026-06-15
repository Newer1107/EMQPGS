import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionSlotService } from "@/modules/question-slots/service";

const service = new QuestionSlotService();

export const GET = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.list(questionBankId);
  },
  { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR] },
);
