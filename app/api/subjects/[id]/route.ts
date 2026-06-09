import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { SubjectService } from "@/modules/subjects/service";
import { subjectSchema } from "@/modules/subjects/validation";

const service = new SubjectService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = subjectSchema.partial().parse(await parseJson(request));
    return service.update(id, payload);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_UPDATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);
