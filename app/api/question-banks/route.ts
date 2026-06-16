import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionBankWorkflowService } from "@/modules/coordinator/question-bank.service";
import { z } from "zod";

const service = new QuestionBankWorkflowService();
const questionBankCreateSchema = z.object({
  subjectId: z.string().min(1),
  examCycleId: z.string().min(1),
});

export const GET = withApiHandler(async (request, context) => {
  const departmentId = request.nextUrl.searchParams.get("departmentId") ?? undefined;
  const examCycleId = request.nextUrl.searchParams.get("examCycleId") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") as "ACTIVE" | "LOCKED" | null;
  const take = parseInt(request.nextUrl.searchParams.get("take") ?? "50", 10);
  const skip = parseInt(request.nextUrl.searchParams.get("skip") ?? "0", 10);
  return service.listQuestionBanks(context.user!, {
    departmentId,
    examCycleId,
    status: status ?? undefined,
  }, take, skip);
}, { roles: [Role.COORDINATOR] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = questionBankCreateSchema.parse(await parseJson(request));
    return service.initializeQuestionBank(context.user!, payload.subjectId, payload.examCycleId);
  },
  { roles: [Role.COORDINATOR], successStatus: 201, audit: { action: "QUESTION_BANK_CREATED", entityType: "QUESTION_BANK", getEntityId: (result) => (result as { id?: string }).id } },
);
