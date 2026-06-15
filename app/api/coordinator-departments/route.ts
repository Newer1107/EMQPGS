import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { CoordinatorDepartmentAssignmentService } from "@/modules/coordinator-departments/service";
import { coordinatorDepartmentAssignmentSchema } from "@/modules/coordinator-departments/validation";

const service = new CoordinatorDepartmentAssignmentService();

export const GET = withApiHandler(
  async () => service.list(),
  { roles: [Role.COE] },
);

export const POST = withApiHandler(
  async (request) => {
    const payload = coordinatorDepartmentAssignmentSchema.parse(await parseJson(request));
    return service.create(payload);
  },
  {
    roles: [Role.COE],
    successStatus: 201,
    audit: {
      action: "COORDINATOR_DEPARTMENT_ASSIGNED",
      entityType: "COORDINATOR_DEPARTMENT_ASSIGNMENT",
      getEntityId: (result) => (result as { id?: string }).id,
    },
  },
);
