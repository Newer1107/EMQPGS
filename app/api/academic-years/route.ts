import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { AcademicYearService } from "@/modules/academic-years/service";
import { academicYearSchema } from "@/modules/academic-years/validation";

const service = new AcademicYearService();

export const GET = withApiHandler(() => service.list(), {
  responsibility: ["COE" as ResponsibilityType, "COORDINATOR" as ResponsibilityType],
});

export const POST = withApiHandler(
  async (request) => {
    const payload = academicYearSchema.parse(await request.json());
    return service.create(payload);
  },
  { responsibility: ["COE" as ResponsibilityType], audit: { action: "ACADEMIC_YEAR_CREATED", entityType: "ACADEMIC_YEAR", getEntityId: (result) => (result as { id?: string }).id } },
);
