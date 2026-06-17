import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { BatchService } from "@/modules/batches/service";
import { batchUpdateSchema } from "@/modules/batches/validation";

const service = new BatchService();

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.findById(id);
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = batchUpdateSchema.parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "BATCH_UPDATED", entityType: "BATCH", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { roles: [Role.COE], audit: { action: "BATCH_DELETED", entityType: "BATCH", getEntityId: (r) => (r as { id?: string }).id } },
);
