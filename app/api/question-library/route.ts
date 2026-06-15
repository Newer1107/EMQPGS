import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
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
    const payload = questionLibraryItemSchema.parse(await parseJson(request));
    const questionBankId = request.nextUrl.searchParams.get("bankId");
    if (questionBankId) {
      return service.createForBank({ ...payload, questionBankId }, context.user!);
    }
    return service.create(payload, context.user!);
  },
  { roles: [Role.CONTRIBUTOR, Role.COORDINATOR], successStatus: 201, audit: { action: "QUESTION_CREATED", entityType: "QUESTION_LIBRARY_ITEM", getEntityId: (result) => (result as { id?: string }).id } },
);
