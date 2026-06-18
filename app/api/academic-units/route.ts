import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { AcademicUnitService } from "@/modules/academic-units/service";
import { academicUnitSchema } from "@/modules/academic-units/validation";

const service = new AcademicUnitService();

export const GET = withApiHandler(() => service.list(), { roles: [Role.COE, Role.COORDINATOR] });

export const POST = withApiHandler(
  async (request) => {
    const payload = academicUnitSchema.parse(await request.json());
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "ACADEMIC_UNIT_CREATED", entityType: "ACADEMIC_UNIT", getEntityId: (r) => (r as { id?: string }).id } },
);
