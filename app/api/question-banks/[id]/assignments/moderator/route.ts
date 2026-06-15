import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ModeratorAssignmentService } from "@/modules/moderator-assignments/service";
import { assignmentSchema } from "@/modules/moderator-assignments/validation";

const service = new ModeratorAssignmentService();

export const POST = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const payload = assignmentSchema.parse(await parseJson(request));
    return service.assignModerator(questionBankId, payload);
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 201,
    audit: {
      action: "MODERATOR_ASSIGNED",
      entityType: "QUESTION_BANK",
      getEntityId: () => null,
      getMetadata: (request) => ({ questionBankId: request.nextUrl.pathname.split("/").slice(-3)[0]! }),
    },
  },
);
