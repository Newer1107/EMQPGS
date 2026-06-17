import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { AcademicUnitService } from "@/modules/academic-units/service";
import { academicUnitSchema, academicUnitUpdateSchema } from "@/modules/academic-units/validation";

const service = new AcademicUnitService();

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
    const payload = academicUnitUpdateSchema.parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "ACADEMIC_UNIT_UPDATED", entityType: "ACADEMIC_UNIT", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { roles: [Role.COE], audit: { action: "ACADEMIC_UNIT_DELETED", entityType: "ACADEMIC_UNIT", getEntityId: (r) => (r as { id?: string }).id } },
);
