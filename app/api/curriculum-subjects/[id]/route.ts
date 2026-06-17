import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { CurriculumSubjectService } from "@/modules/curriculum-subjects/service";
import { curriculumSubjectUpdateSchema } from "@/modules/curriculum-subjects/validation";

const service = new CurriculumSubjectService();

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
    const payload = curriculumSubjectUpdateSchema.parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "CURRICULUM_SUBJECT_UPDATED", entityType: "CURRICULUM_SUBJECT", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { roles: [Role.COE], audit: { action: "CURRICULUM_SUBJECT_DELETED", entityType: "CURRICULUM_SUBJECT", getEntityId: (r) => (r as { id?: string }).id } },
);
