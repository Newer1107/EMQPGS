import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { CurriculumSubjectService } from "@/modules/curriculum-subjects/service";
import { curriculumSubjectUpdateSchema } from "@/modules/curriculum-subjects/validation";

const service = new CurriculumSubjectService();

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
    const payload = curriculumSubjectUpdateSchema.parse(await request.json());
    return service.update(id, payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "CURRICULUM_SUBJECT_UPDATED", entityType: "CURRICULUM_SUBJECT", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "CURRICULUM_SUBJECT_DELETED", entityType: "CURRICULUM_SUBJECT", getEntityId: (r) => (r as { id?: string }).id } },
);
