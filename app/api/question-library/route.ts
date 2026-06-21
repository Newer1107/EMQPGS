import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AuthorizationService } from "@/lib/auth/authorization-service";
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
}, { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType, "MODERATOR" as ResponsibilityType, "CONTRIBUTOR" as ResponsibilityType] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = questionLibraryItemSchema.parse(await request.json());
    const questionBankId = request.nextUrl.searchParams.get("bankId");
    const authz = new AuthorizationService(context.auth!);

    if (questionBankId) {
      return service.createForBank({ ...payload, questionBankId }, { userId: context.auth!.user.id });
    }

    if (authz.has("CONTRIBUTOR" as ResponsibilityType)) {
      throw new AppError(
        "Questions submitted by contributors must belong to a Question Bank. Please use the 'bankId' query parameter.",
        400,
        "MISSING_BANK_ID",
      );
    }

    return service.create(payload, { userId: context.auth!.user.id });
  },
  { responsibility: ["CONTRIBUTOR" as ResponsibilityType, "COORDINATOR" as ResponsibilityType], successStatus: 201, audit: { action: "QUESTION_CREATED", entityType: "QUESTION_LIBRARY_ITEM", getEntityId: (result) => (result as { id?: string }).id } },
);
