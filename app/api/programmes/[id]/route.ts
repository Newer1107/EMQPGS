import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ProgrammeService } from "@/modules/programmes/service";
import { programmeSchema, programmeUpdateSchema } from "@/modules/programmes/validation";

const service = new ProgrammeService();

export const GET = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.findById(id);
  },
  { roles: [Role.COE, Role.COORDINATOR] },
);

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = programmeUpdateSchema.parse(await request.json());
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "PROGRAMME_UPDATED", entityType: "PROGRAMME", getEntityId: (r) => (r as { id?: string }).id } },
);

export const DELETE = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    return service.delete(id);
  },
  { roles: [Role.COE], audit: { action: "PROGRAMME_DELETED", entityType: "PROGRAMME", getEntityId: (r) => (r as { id?: string }).id } },
);
