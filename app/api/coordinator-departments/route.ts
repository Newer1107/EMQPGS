import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { CoordinatorDepartmentAssignmentService } from "@/modules/coordinator-departments/service";
import { coordinatorDepartmentAssignmentSchema } from "@/modules/coordinator-departments/validation";

const service = new CoordinatorDepartmentAssignmentService();

export const GET = withApiHandler(
  async () => service.list(),
  { responsibility: ["COE" as ResponsibilityType] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const payload = coordinatorDepartmentAssignmentSchema.parse(await request.json());
    return service.create({ ...payload, assignedById: context.user!.id });
  },
  {
    responsibility: ["COE" as ResponsibilityType],
    successStatus: 201,
    audit: {
      action: "COORDINATOR_DEPARTMENT_ASSIGNED",
      entityType: "COORDINATOR_DEPARTMENT_ASSIGNMENT",
      getEntityId: (result) => (result as { id?: string }).id,
    },
  },
);
