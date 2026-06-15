import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { z } from "zod";

const service = new SubjectManagementService();
const linkCycleSchema = z.object({
  examCycleId: z.string().min(1),
});

export const POST = withApiHandler(
  async (request, context) => {
    const subjectId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = linkCycleSchema.parse(await parseJson(request));
    return service.linkSubjectToExamCycle(context.user!, subjectId, payload.examCycleId);
  },
  { roles: [Role.COORDINATOR], successStatus: 201, audit: { action: "SUBJECT_LINKED_TO_EXAM_CYCLE", entityType: "SUBJECT_EXAM_CYCLE_LINK" } },
);
