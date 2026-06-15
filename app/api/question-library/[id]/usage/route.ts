import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionLibraryService } from "@/modules/question-library/service";

const service = new QuestionLibraryService();

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.getUsageStats(id);
  },
  { roles: [Role.COE, Role.COORDINATOR, Role.DEAN] },
);
