import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionLibraryService } from "@/modules/question-library/service";

const service = new QuestionLibraryService();

export const GET = withApiHandler(async (request) => {
  const subjectVersionId = request.nextUrl.searchParams.get("subjectVersionId");
  if (!subjectVersionId) {
    return { totalQuestions: 0, approvedQuestions: 0, moduleCoverage: [], markCoverage: [], coCoverage: [], rbtCoverage: [], difficultyCoverage: [], warnings: [] };
  }
  return service.getCoverage(subjectVersionId);
}, { roles: [Role.COORDINATOR, Role.COE, Role.DEAN] });
