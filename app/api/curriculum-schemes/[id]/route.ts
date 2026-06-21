import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { CurriculumSchemeService } from "@/modules/curriculum-schemes/service";
import { curriculumSchemeSchema, curriculumSchemeUpdateSchema } from "@/modules/curriculum-schemes/validation";

const service = new CurriculumSchemeService();

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
    const payload = curriculumSchemeUpdateSchema.parse(await request.json());
    return service.update(id, payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "CURRICULUM_SCHEME_UPDATED", entityType: "CURRICULUM_SCHEME", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "CURRICULUM_SCHEME_DELETED", entityType: "CURRICULUM_SCHEME", getEntityId: (r) => (r as { id?: string }).id } },
);
