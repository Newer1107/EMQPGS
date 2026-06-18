import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { DepartmentService } from "@/modules/departments/service";
import { departmentSchema } from "@/modules/departments/validation";

const service = new DepartmentService();

export const GET = withApiHandler(() => service.list(), { roles: [Role.COE, Role.COORDINATOR] });

export const POST = withApiHandler(
  async (request) => {
    const payload = departmentSchema.parse(await request.json());
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "DEPARTMENT_CREATED", entityType: "DEPARTMENT", getEntityId: (result) => (result as { id?: string }).id } },
);
