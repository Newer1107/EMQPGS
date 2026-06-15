import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";

const service = new SubjectManagementService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const subjectId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.deactivateSubject(context.user!, subjectId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_DEACTIVATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);
