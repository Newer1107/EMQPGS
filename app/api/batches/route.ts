import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { BatchService } from "@/modules/batches/service";
import { batchSchema } from "@/modules/batches/validation";

const service = new BatchService();

export const GET = withApiHandler(
  async (request) => {
    const departmentId = request.nextUrl.searchParams.get("departmentId");
    if (departmentId) return service.findByDepartment(departmentId);
    return service.list();
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);

export const POST = withApiHandler(
  async (request) => {
    const payload = batchSchema.parse(await request.json());
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "BATCH_CREATED", entityType: "BATCH", getEntityId: (r) => (r as { id?: string }).id } },
);
