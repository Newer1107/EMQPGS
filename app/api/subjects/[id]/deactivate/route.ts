import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { CoordinatorService } from "@/modules/coordinator/service";

const service = new CoordinatorService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const subjectId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.deactivateSubject(context.user!, subjectId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_DEACTIVATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);
