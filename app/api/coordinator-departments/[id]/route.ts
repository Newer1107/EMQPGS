import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { CoordinatorDepartmentAssignmentService } from "@/modules/coordinator-departments/service";

const service = new CoordinatorDepartmentAssignmentService();

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  {
    roles: [Role.COE],
    audit: {
      action: "COORDINATOR_DEPARTMENT_ASSIGNMENT_REMOVED",
      entityType: "COORDINATOR_DEPARTMENT_ASSIGNMENT",
    },
  },
);
