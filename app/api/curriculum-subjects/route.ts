import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { CurriculumSubjectService } from "@/modules/curriculum-subjects/service";
import { curriculumSubjectSchema, curriculumSubjectFilterSchema } from "@/modules/curriculum-subjects/validation";

const service = new CurriculumSubjectService();

export const GET = withApiHandler(
  async (request) => {
    const filters = curriculumSubjectFilterSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return service.list(filters);
  },
  { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] },
);

export const POST = withApiHandler(
  async (request, context) => {
    const payload = curriculumSubjectSchema.parse(await request.json());
    return service.createWithDepartmentCheck(payload, context.auth!);
  },
  { responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType], audit: { action: "CURRICULUM_SUBJECT_CREATED", entityType: "CURRICULUM_SUBJECT", getEntityId: (r) => (r as { id?: string }).id } },
);
