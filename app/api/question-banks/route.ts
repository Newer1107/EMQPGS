import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";

const service = new QuestionBankWorkflowService();

export const GET = withApiHandler(async (request, context) => {
  const departmentId = request.nextUrl.searchParams.get("departmentId") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") as "ACTIVE" | "LOCKED" | null;
  const take = parseInt(request.nextUrl.searchParams.get("take") ?? "50", 10);
  const skip = parseInt(request.nextUrl.searchParams.get("skip") ?? "0", 10);
  return service.listQuestionBanks(context.user!, {
    departmentId,
    status: status ?? undefined,
  }, take, skip);
}, { roles: [Role.COORDINATOR] });
