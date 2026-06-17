import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { CurriculumSchemeService } from "@/modules/curriculum-schemes/service";
import { curriculumSchemeSchema, curriculumSchemeUpdateSchema } from "@/modules/curriculum-schemes/validation";

const service = new CurriculumSchemeService();

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
    const payload = curriculumSchemeUpdateSchema.parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "CURRICULUM_SCHEME_UPDATED", entityType: "CURRICULUM_SCHEME", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { roles: [Role.COE], audit: { action: "CURRICULUM_SCHEME_DELETED", entityType: "CURRICULUM_SCHEME", getEntityId: (r) => (r as { id?: string }).id } },
);
