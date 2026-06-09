import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { SubjectService } from "@/modules/subjects/service";
import { subjectSchema } from "@/modules/subjects/validation";

const service = new SubjectService();

export const GET = withApiHandler(() => service.list(), { roles: [Role.COE, Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.DEAN] });

export const POST = withApiHandler(
  async (request) => {
    const payload = subjectSchema.parse(await parseJson(request));
    return service.create(payload);
  },
  { roles: [Role.COORDINATOR], audit: { action: "SUBJECT_CREATED", entityType: "SUBJECT", getEntityId: (result) => (result as { id?: string }).id } },
);
