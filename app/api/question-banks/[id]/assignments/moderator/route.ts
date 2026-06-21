import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";

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
    responsibility: ["COORDINATOR" as ResponsibilityType],
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
      throw new AppError("moderatorId query parameter is required", 400, "MISSING_PARAM");
    }
    return service.unassignModerator(questionBankId, moderatorId);
  },
  {
    responsibility: ["COORDINATOR" as ResponsibilityType],
    successStatus: 200,
    audit: {
      action: "MODERATOR_UNASSIGNED",
      entityType: "QUESTION_BANK",
      getEntityId: () => null,
      getMetadata: (request) => ({ questionBankId: request.nextUrl.pathname.split("/").slice(-3)[0]!, moderatorId: request.nextUrl.searchParams.get("moderatorId") }),
    },
  },
);
