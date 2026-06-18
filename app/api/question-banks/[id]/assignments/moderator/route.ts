import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ModeratorAssignmentService } from "@/modules/moderator-assignments/service";
import { assignmentSchema } from "@/modules/moderator-assignments/validation";

const service = new ModeratorAssignmentService();

export const POST = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const payload = assignmentSchema.parse(await request.json());
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

export const DELETE = withApiHandler(
  async (request) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const moderatorId = request.nextUrl.searchParams.get("moderatorId");
    if (!moderatorId) {
      throw new Error("moderatorId query parameter is required");
    }
    return service.unassignModerator(questionBankId, moderatorId);
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 200,
    audit: {
      action: "MODERATOR_UNASSIGNED",
      entityType: "QUESTION_BANK",
      getEntityId: () => null,
      getMetadata: (request) => ({ questionBankId: request.nextUrl.pathname.split("/").slice(-3)[0]!, moderatorId: request.nextUrl.searchParams.get("moderatorId") }),
    },
  },
);
