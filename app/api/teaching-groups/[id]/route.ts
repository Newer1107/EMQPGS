import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { TeachingGroupService } from "@/modules/teaching-groups/service";
import { teachingGroupUpdateSchema } from "@/modules/teaching-groups/validation";

const service = new TeachingGroupService();

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
    const payload = teachingGroupUpdateSchema.parse(await request.json());
    return service.update(id, payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "TEACHING_GROUP_UPDATED", entityType: "TEACHING_GROUP", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "TEACHING_GROUP_DELETED", entityType: "TEACHING_GROUP", getEntityId: (r) => (r as { id?: string }).id } },
);
