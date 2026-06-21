import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { CurriculumSchemeService } from "@/modules/curriculum-schemes/service";
import { curriculumSchemeSchema } from "@/modules/curriculum-schemes/validation";

const service = new CurriculumSchemeService();

export const GET = withApiHandler(
  async (request) => {
    const departmentId = request.nextUrl.searchParams.get("departmentId");
    if (departmentId) return service.findByDepartment(departmentId);
    return service.list();
  },
  { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] },
);

export const POST = withApiHandler(
  async (request) => {
    const payload = curriculumSchemeSchema.parse(await request.json());
    return service.create(payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "CURRICULUM_SCHEME_CREATED", entityType: "CURRICULUM_SCHEME", getEntityId: (r) => (r as { id?: string }).id } },
);
