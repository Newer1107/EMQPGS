import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { AcademicYearService } from "@/modules/academic-years/service";
import { academicYearSchema } from "@/modules/academic-years/validation";

const service = new AcademicYearService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = academicYearSchema.partial().parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "ACADEMIC_YEAR_UPDATED", entityType: "ACADEMIC_YEAR", getEntityId: (result) => (result as { id?: string }).id } },
);

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.findById(id);
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);
