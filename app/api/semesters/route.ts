import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { SemesterService } from "@/modules/semesters/service";
import { semesterSchema } from "@/modules/semesters/validation";

const service = new SemesterService();

export const GET = withApiHandler(async (request) => {
  const academicYearId = request.nextUrl.searchParams.get("academicYearId");
  if (academicYearId) {
    return service.findByAcademicYear(academicYearId);
  }
  return service.list();
}, { roles: [Role.COE, Role.COORDINATOR, Role.CONTRIBUTOR] });

export const POST = withApiHandler(
  async (request) => {
    const payload = semesterSchema.parse(await parseJson(request));
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "SEMESTER_CREATED", entityType: "SEMESTER", getEntityId: (result) => (result as { id?: string }).id } },
);
