import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { BatchService } from "@/modules/batches/service";
import { batchSchema } from "@/modules/batches/validation";

const service = new BatchService();

export const GET = withApiHandler(
  async (request) => {
    const programmeId = request.nextUrl.searchParams.get("programmeId");
    if (programmeId) return service.findByProgramme(programmeId);
    return service.list();
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);

export const POST = withApiHandler(
  async (request) => {
    const payload = batchSchema.parse(await parseJson(request));
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "BATCH_CREATED", entityType: "BATCH", getEntityId: (r) => (r as { id?: string }).id } },
);
