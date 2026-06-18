import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { ExamCycleService } from "@/modules/exam-cycles/service";
import { examCycleSchema } from "@/modules/exam-cycles/validation";

const service = new ExamCycleService();

export const PATCH = withApiHandler(
  async (request) => {
    const id = request.nextUrl.pathname.split("/").pop()!;
    const payload = examCycleSchema.partial().parse(await request.json());
    return service.update(id, payload);
  },
  { roles: [Role.COE], audit: { action: "EXAM_CYCLE_UPDATED", entityType: "EXAM_CYCLE", getEntityId: (result) => (result as { id?: string }).id } },
);
