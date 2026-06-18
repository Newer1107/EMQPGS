import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { z } from "zod";

const service = new SubjectManagementService();
const subjectUpdateSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required.").optional(),
  code: z.string().trim().min(1, "Subject code is required.").max(20).transform((value) => value.toUpperCase()).optional(),
  semesterNumber: z.coerce.number().int().min(1).max(8).optional(),
  credits: z.coerce.number().positive().optional(),
});

export const PUT = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = subjectUpdateSchema.parse(await request.json());
    return service.updateSubject(context.user!, id, {
      ...(payload.name !== undefined ? { subjectName: payload.name } : {}),
      ...(payload.code !== undefined ? { subjectCode: payload.code } : {}),
      ...(payload.semesterNumber !== undefined ? { semesterNumber: payload.semesterNumber } : {}),
      ...(payload.credits !== undefined ? { creditLoad: Math.trunc(payload.credits) } : {}),
    });
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_UPDATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);

export const PATCH = PUT;
