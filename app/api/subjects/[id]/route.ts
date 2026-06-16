import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { z } from "zod";

const service = new SubjectManagementService();
const subjectUpdateSchema = z.object({
  subjectCode: z.string().min(2).max(20).trim().toUpperCase().optional(),
  subjectName: z.string().min(2).trim().optional(),
  semesterNumber: z.coerce.number().int().min(1).max(8).optional(),
  creditLoad: z.coerce.number().int().min(1).max(10).optional(),
});

export const PUT = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = subjectUpdateSchema.parse(await parseJson(request));
    return service.updateSubject(context.user!, id, payload);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_UPDATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);

export const PATCH = PUT;
