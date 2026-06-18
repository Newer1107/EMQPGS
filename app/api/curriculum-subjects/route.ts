import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { CurriculumSubjectService } from "@/modules/curriculum-subjects/service";
import { curriculumSubjectSchema, curriculumSubjectFilterSchema } from "@/modules/curriculum-subjects/validation";

const service = new CurriculumSubjectService();

export const GET = withApiHandler(
  async (request) => {
    const filters = curriculumSubjectFilterSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return service.list(filters);
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);

export const POST = withApiHandler(
  async (request) => {
    const payload = curriculumSubjectSchema.parse(await request.json());
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "CURRICULUM_SUBJECT_CREATED", entityType: "CURRICULUM_SUBJECT", getEntityId: (r) => (r as { id?: string }).id } },
);
