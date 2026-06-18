import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { AcademicYearService } from "@/modules/academic-years/service";
import { academicYearSchema } from "@/modules/academic-years/validation";

const service = new AcademicYearService();

export const GET = withApiHandler(() => service.list(), {
  roles: [Role.COE, Role.COORDINATOR],
});

export const POST = withApiHandler(
  async (request) => {
    const payload = academicYearSchema.parse(await request.json());
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "ACADEMIC_YEAR_CREATED", entityType: "ACADEMIC_YEAR", getEntityId: (result) => (result as { id?: string }).id } },
);
