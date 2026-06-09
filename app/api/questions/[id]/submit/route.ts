import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionService } from "@/modules/questions/service";

const service = new QuestionService();

export const POST = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.submitQuestion(id, context.user!);
  },
  { roles: [Role.CONTRIBUTOR], audit: { action: "QUESTION_SUBMITTED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
