import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ForbiddenError } from "@/lib/errors";
import { CoordinatorService } from "@/modules/coordinator/service";
import { z } from "zod";

const service = new CoordinatorService();
const subjectCreateSchema = z.object({
  subjectCode: z.string().min(2).max(20).trim().toUpperCase(),
  subjectName: z.string().min(2).trim(),
  departmentId: z.string().min(1),
  semester: z.coerce.number().int().min(1).max(8),
  creditLoad: z.coerce.number().int().min(1).max(10),
});

export const GET = withApiHandler(async (request, context) => {
  const departmentId = request.nextUrl.searchParams.get("departmentId") ?? undefined;
  const semester = request.nextUrl.searchParams.get("semester");
  const status = request.nextUrl.searchParams.get("status") as "ACTIVE" | "INACTIVE" | null;

  return service.listSubjects(context.user!, {
    departmentId,
    semester: semester ? Number(semester) : undefined,
    status: status ?? undefined,
  });
}, { roles: [Role.COORDINATOR] });

export const POST = withApiHandler(
  async () => {
    throw new ForbiddenError("Coordinators are not authorized to create subjects.");
  },
  { roles: [Role.COORDINATOR] },
);
