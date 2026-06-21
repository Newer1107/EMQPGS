import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { QuestionLibraryService } from "@/modules/question-library/service";

const service = new QuestionLibraryService();

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const type = request.nextUrl.searchParams.get("type");
    if (type === "ownership") return service.getOwnershipHistory(id);
    if (type === "revision") return service.getRevisionHistory(id);
    if (type === "usage") return service.getUsageHistory(id);
    return service.getFullDetail(id);
  },
  { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType, "MODERATOR" as ResponsibilityType, "CONTRIBUTOR" as ResponsibilityType, "DEAN" as ResponsibilityType] },
);
