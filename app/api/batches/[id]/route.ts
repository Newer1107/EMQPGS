import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { BatchService } from "@/modules/batches/service";
import { batchUpdateSchema } from "@/modules/batches/validation";

const service = new BatchService();

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.findById(id);
  },
  { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] },
);

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = batchUpdateSchema.parse(await request.json());
    return service.update(id, payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "BATCH_UPDATED", entityType: "BATCH", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "BATCH_DELETED", entityType: "BATCH", getEntityId: (r) => (r as { id?: string }).id } },
);
