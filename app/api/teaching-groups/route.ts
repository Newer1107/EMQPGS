import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { TeachingGroupService } from "@/modules/teaching-groups/service";
import { teachingGroupSchema, teachingGroupBulkSchema } from "@/modules/teaching-groups/validation";

const service = new TeachingGroupService();

export const GET = withApiHandler(
  async (request) => {
    const batchId = request.nextUrl.searchParams.get("batchId");
    if (!batchId) return [];
    return service.findByBatch(batchId);
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);

function isBulkPayload(p: unknown): p is { batchId: string; groups: Array<{ groupNumber: number; name: string; description?: string }> } {
  return typeof p === "object" && p !== null && "groups" in p;
}

export const POST = withApiHandler(
  async (request) => {
    const raw = await parseJson(request);
    const singleResult = teachingGroupSchema.safeParse(raw);
    if (singleResult.success) {
      return service.create(singleResult.data);
    }
    const bulkResult = teachingGroupBulkSchema.parse(raw);
    return service.bulkCreate(bulkResult);
  },
  { roles: [Role.COE], audit: { action: "TEACHING_GROUP_CREATED", entityType: "TEACHING_GROUP", getEntityId: (r) => (Array.isArray(r) ? r[0]?.id : (r as { id?: string }).id) } },
);
