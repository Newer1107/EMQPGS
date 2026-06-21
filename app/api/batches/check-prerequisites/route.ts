import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { BatchService } from "@/modules/batches/service";
import { z } from "zod";

const service = new BatchService();

const checkSchema = z.object({
  admissionYear: z.number().int().min(1900).max(2100),
  curriculumSchemeId: z.string().min(1),
});

export const POST = withApiHandler(
  async (request) => {
    const payload = checkSchema.parse(await request.json());
    return service.checkPrerequisites(payload.admissionYear, payload.curriculumSchemeId);
  },
  { responsibility: ["COE" as ResponsibilityType] },
);
