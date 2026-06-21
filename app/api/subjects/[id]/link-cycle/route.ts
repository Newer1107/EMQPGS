import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { z } from "zod";

const service = new SubjectManagementService();
const linkCycleSchema = z.object({
  examCycleId: z.string().min(1),
});

export const POST = withApiHandler(
  async (request, context) => {
    const subjectId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = linkCycleSchema.parse(await request.json());
    return service.linkSubjectToExamCycle(context.auth!, subjectId, payload.examCycleId);
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType], successStatus: 201, audit: { action: "SUBJECT_LINKED_TO_EXAM_CYCLE", entityType: "SUBJECT_EXAM_CYCLE_LINK" } },
);
