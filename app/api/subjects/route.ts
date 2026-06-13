import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { AppError, ForbiddenError } from "@/lib/errors";
import { CoordinatorService } from "@/modules/coordinator/service";
import { z } from "zod";

const service = new CoordinatorService();
const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required."),
  code: z.string().trim().min(1, "Subject code is required.").max(20).transform((value) => value.toUpperCase()),
  departmentId: z.string().min(1),
  semester: z.coerce.number().int().positive(),
  credits: z.coerce.number().positive(),
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
  async (request, context) => {
    const payload = subjectCreateSchema.parse(await parseJson(request));
    if (!context.user || (context.user.role !== Role.COORDINATOR && context.user.role !== Role.COE)) {
      throw new ForbiddenError();
    }

    try {
      return await service.createSubject(context.user, {
        subjectCode: payload.code,
        subjectName: payload.name,
        departmentId: payload.departmentId,
        semester: payload.semester,
        creditLoad: Math.trunc(payload.credits),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("Invalid subject payload.", 400, "VALIDATION_ERROR", error.flatten());
      }
      throw error;
    }
  },
  { roles: [Role.COORDINATOR, Role.COE], successStatus: 201, audit: { action: "SUBJECT_CREATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);
