import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { SemesterService } from "@/modules/semesters/service";
import { semesterSchema } from "@/modules/semesters/validation";

const service = new SemesterService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = semesterSchema.partial().parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "SEMESTER_UPDATED", entityType: "SEMESTER", getEntityId: (result) => (result as { id?: string }).id } },
);

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.findById(id);
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);
