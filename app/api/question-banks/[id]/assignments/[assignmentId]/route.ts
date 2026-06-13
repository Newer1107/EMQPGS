import { Role } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { CoordinatorService } from "@/modules/coordinator/service";

const service = new CoordinatorService();

const assignmentUpdateSchema = z.object({
  contributorId: z.string().min(1),
});

export const PUT = withApiHandler(
  async (request, context) => {
    const segments = request.nextUrl.pathname.split("/");
    const questionBankId = segments[segments.length - 3]!;
    const assignmentId = segments[segments.length - 1]!;
    const payload = assignmentUpdateSchema.parse(await parseJson(request));
    return service.reassignContributor(context.user!, questionBankId, assignmentId, payload.contributorId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "CONTRIBUTOR_REASSIGNED", entityType: "TEACHER_ASSIGNMENT", getEntityId: (result) => (result as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request, context) => {
    const segments = request.nextUrl.pathname.split("/");
    const questionBankId = segments[segments.length - 3]!;
    const assignmentId = segments[segments.length - 1]!;
    return service.removeAssignment(context.user!, questionBankId, assignmentId);
  },
  { roles: [Role.COORDINATOR], audit: { action: "CONTRIBUTOR_ASSIGNMENT_REMOVED", entityType: "TEACHER_ASSIGNMENT", getEntityId: () => undefined } },
);
