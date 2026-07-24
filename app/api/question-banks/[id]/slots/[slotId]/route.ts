import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { QuestionSlotService } from "@/modules/question-slots/service";
import { assignToSlotSchema } from "@/modules/question-slots/validation";

const service = new QuestionSlotService();

export const PATCH = withApiHandler(
  async (request, context) => {
    const segments = request.nextUrl.pathname.split("/");
    const slotId = segments[segments.length - 1]!;
    const payload = assignToSlotSchema.parse(await request.json());
    return service.assignToSlot(slotId, payload.questionId, { userId: context.auth!.user.id });
  },
  {
    responsibility: ["CONTRIBUTOR" as ResponsibilityType, "COORDINATOR" as ResponsibilityType],
    successStatus: 200,
    audit: { action: "QUESTION_ASSIGNED_TO_SLOT", entityType: "QUESTION_SLOT" },
  },
);

export const DELETE = withApiHandler(
  async (request) => {
    const segments = request.nextUrl.pathname.split("/");
    const slotId = segments[segments.length - 1]!;
    return service.unassignFromSlot(slotId);
  },
  {
    responsibility: ["COORDINATOR" as ResponsibilityType],
    audit: { action: "QUESTION_UNASSIGNED_FROM_SLOT", entityType: "QUESTION_SLOT" },
  },
);
