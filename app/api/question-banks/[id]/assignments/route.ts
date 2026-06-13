import { Role } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { CoordinatorService } from "@/modules/coordinator/service";

const service = new CoordinatorService();

const assignmentCreateSchema = z.object({
  moduleNumber: z.coerce.number().int().min(1).max(6),
  contributorId: z.string().min(1),
});

export const GET = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    return service.listAssignments(context.user!, questionBankId);
  },
  { roles: [Role.COORDINATOR] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = assignmentCreateSchema.parse(await parseJson(request));
    return service.assignContributor(context.user!, questionBankId, payload.moduleNumber, payload.contributorId);
  },
  { roles: [Role.COORDINATOR], successStatus: 201, audit: { action: "CONTRIBUTOR_ASSIGNED", entityType: "TEACHER_ASSIGNMENT", getEntityId: (result) => (result as { id?: string }).id } },
);
