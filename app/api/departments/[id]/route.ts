import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { DepartmentService } from "@/modules/departments/service";
import { departmentSchema } from "@/modules/departments/validation";

const service = new DepartmentService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = departmentSchema.partial().parse(await request.json());
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "DEPARTMENT_UPDATED", entityType: "DEPARTMENT", getEntityId: (result) => (result as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { roles: [Role.COE], audit: { action: "DEPARTMENT_DELETED", entityType: "DEPARTMENT", getEntityId: (result) => (result as { id?: string }).id } },
);
