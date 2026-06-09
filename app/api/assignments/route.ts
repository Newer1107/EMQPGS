import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { AssignmentService } from "@/modules/assignments/service";
import { assignmentSchema } from "@/modules/assignments/validation";

const service = new AssignmentService();

export const GET = withApiHandler(() => service.list(), { roles: [Role.COE, Role.COORDINATOR] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = assignmentSchema.parse(await parseJson(request));
    return service.assign(payload.questionBankId, context.user!.id, payload.moderatorId, payload.contributorIds);
  },
  { roles: [Role.COORDINATOR], audit: { action: "ASSIGNMENT_CHANGED", entityType: "TEACHER_ASSIGNMENT" } },
);
