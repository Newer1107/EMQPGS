import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { z } from "zod";

const service = new SubjectManagementService();
const subjectUpdateSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required.").optional(),
  code: z.string().trim().min(1, "Subject code is required.").max(20).transform((value) => value.toUpperCase()).optional(),
  credits: z.coerce.number().positive().optional(),
});

export const PUT = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = subjectUpdateSchema.parse(await request.json());
    return service.updateSubject(context.auth!, id, {
      ...(payload.name !== undefined ? { subjectName: payload.name } : {}),
      ...(payload.code !== undefined ? { subjectCode: payload.code } : {}),
      ...(payload.credits !== undefined ? { creditLoad: Math.trunc(payload.credits) } : {}),
    });
  },
  { responsibility: ["COORDINATOR" as ResponsibilityType], audit: { action: "SUBJECT_UPDATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);

export const PATCH = PUT;
