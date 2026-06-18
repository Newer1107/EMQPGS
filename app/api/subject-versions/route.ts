import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { SubjectVersionService } from "@/modules/subject-versions/service";
import { subjectVersionSchema } from "@/modules/subject-versions/validation";

const service = new SubjectVersionService();

export const GET = withApiHandler(async (request) => {
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return [];
  }
  return service.findBySubject(subjectId);
}, { roles: [Role.COORDINATOR, Role.CONTRIBUTOR, Role.COE] });

export const POST = withApiHandler(
  async (request) => {
    const payload = subjectVersionSchema.parse(await request.json());
    return service.create(payload);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_VERSION_CREATED", entityType: "SUBJECT_VERSION", getEntityId: (result) => (result as { id?: string }).id } },
);
