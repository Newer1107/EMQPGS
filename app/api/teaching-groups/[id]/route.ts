import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { TeachingGroupService } from "@/modules/teaching-groups/service";
import { teachingGroupUpdateSchema } from "@/modules/teaching-groups/validation";

const service = new TeachingGroupService();

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
    const payload = teachingGroupUpdateSchema.parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "TEACHING_GROUP_UPDATED", entityType: "TEACHING_GROUP", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { roles: [Role.COE], audit: { action: "TEACHING_GROUP_DELETED", entityType: "TEACHING_GROUP", getEntityId: (r) => (r as { id?: string }).id } },
);
