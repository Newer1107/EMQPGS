import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { AppError } from "@/lib/errors";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { z } from "zod";

const service = new SubjectManagementService();
const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required."),
  code: z.string().trim().min(1, "Subject code is required.").max(20).transform((value) => value.toUpperCase()),
  departmentId: z.string().min(1),
  credits: z.coerce.number().positive(),
});

export const GET = withApiHandler(async (request, context) => {
  const departmentId = request.nextUrl.searchParams.get("departmentId") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") as "ACTIVE" | "INACTIVE" | null;

  return service.listSubjects(context.auth!, {
    departmentId,
    status: status ?? undefined,
  });
}, { responsibility: ["COORDINATOR" as ResponsibilityType] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = subjectCreateSchema.parse(await request.json());

    try {
      return await service.createSubject(context.auth!, {
        subjectCode: payload.code,
        subjectName: payload.name,
        departmentId: payload.departmentId,
        creditLoad: Math.trunc(payload.credits),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError("Invalid subject payload.", 400, "VALIDATION_ERROR", error.flatten());
      }
      throw error;
    }
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType, "COE" as ResponsibilityType], successStatus: 201, audit: { action: "SUBJECT_CREATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);
