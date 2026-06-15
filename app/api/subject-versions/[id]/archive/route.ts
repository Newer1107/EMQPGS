import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { SubjectVersionService } from "@/modules/subject-versions/service";

const service = new SubjectVersionService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.archive(id);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_VERSION_ARCHIVED", entityType: "SUBJECT_VERSION" } },
);
