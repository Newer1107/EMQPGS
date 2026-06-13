import { QuestionStatus, Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { CoordinatorService } from "@/modules/coordinator/service";
import { QuestionService } from "@/modules/questions/service";
import { questionSchema } from "@/modules/questions/validation";

const service = new QuestionService();
const coordinatorService = new CoordinatorService();

export const GET = withApiHandler(async (request, context) => {
  if (context.user!.role === Role.COORDINATOR) {
    return coordinatorService.listQuestions(context.user!, {
      subjectId: request.nextUrl.searchParams.get("subjectId") ?? undefined,
      moduleNumber: request.nextUrl.searchParams.get("moduleNumber") ? Number(request.nextUrl.searchParams.get("moduleNumber")) : undefined,
      markType: request.nextUrl.searchParams.get("markType") ? Number(request.nextUrl.searchParams.get("markType")) : undefined,
      status: (request.nextUrl.searchParams.get("status") as QuestionStatus | null) ?? undefined,
      contributorId: request.nextUrl.searchParams.get("contributorId") ?? undefined,
    });
  }

  const questionBankId = request.nextUrl.searchParams.get("questionBankId");
  if (!questionBankId) return [];
  return service.listQuestions(questionBankId, context.user!);
}, { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.COE] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = questionSchema.parse(await parseJson(request));
    return service.createQuestion(payload, context.user!);
  },
  { roles: [Role.CONTRIBUTOR, Role.MODERATOR], audit: { action: "QUESTION_CREATED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
