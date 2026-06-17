import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ProgrammeService } from "@/modules/programmes/service";
import { programmeSchema } from "@/modules/programmes/validation";

const service = new ProgrammeService();

export const GET = withApiHandler(() => service.list(), { roles: [Role.COE, Role.COORDINATOR] });

export const POST = withApiHandler(
  async (request) => {
    const payload = programmeSchema.parse(await parseJson(request));
    return service.create(payload);
  },
  { roles: [Role.COE], audit: { action: "PROGRAMME_CREATED", entityType: "PROGRAMME", getEntityId: (r) => (r as { id?: string }).id } },
);
