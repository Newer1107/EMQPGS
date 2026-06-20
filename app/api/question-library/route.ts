import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";

import { QuestionLibraryService } from "@/modules/question-library/service";
import { questionLibraryItemSchema } from "@/modules/question-library/validation";

const service = new QuestionLibraryService();

export const GET = withApiHandler(async (request) => {
  const subjectVersionId = request.nextUrl.searchParams.get("subjectVersionId");
  const bankId = request.nextUrl.searchParams.get("bankId");
  const query = request.nextUrl.searchParams.get("q");

  if (query) {
    return service.search(query, subjectVersionId ?? undefined);
  }
  if (bankId) {
    return service.findByBank(bankId);
  }
  if (subjectVersionId) {
    return service.findBySubjectVersion(subjectVersionId);
  }
  return [];
}, { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = questionLibraryItemSchema.parse(await request.json());
    const questionBankId = request.nextUrl.searchParams.get("bankId");
    const actor = context.user!;

    if (questionBankId) {
      return service.createForBank({ ...payload, questionBankId }, actor);
    }

    if (actor.role === "CONTRIBUTOR") {
      throw new AppError(
        "Questions submitted by contributors must belong to a Question Bank. Please use the 'bankId' query parameter.",
        400,
        "MISSING_BANK_ID",
      );
    }

    return service.create(payload, actor);
  },
  { roles: [Role.CONTRIBUTOR, Role.COORDINATOR], successStatus: 201, audit: { action: "QUESTION_CREATED", entityType: "QUESTION_LIBRARY_ITEM", getEntityId: (result) => (result as { id?: string }).id } },
);
