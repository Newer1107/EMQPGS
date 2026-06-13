import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { CoordinatorService } from "@/modules/coordinator/service";

const service = new CoordinatorService();

export const POST = withApiHandler(
  async (request, context) => {
    const segments = request.nextUrl.pathname.split("/");
    const questionBankId = segments[segments.length - 4]!;
    const assignmentId = segments[segments.length - 2]!;
    return service.notifyAssignment(context.user!, questionBankId, assignmentId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "CONTRIBUTOR_NOTIFIED", entityType: "NOTIFICATION" } },
);
