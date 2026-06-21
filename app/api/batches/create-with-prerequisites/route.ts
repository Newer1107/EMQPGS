import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";

import { BatchService } from "@/modules/batches/service";
import { batchSchema } from "@/modules/batches/validation";

const service = new BatchService();

export const POST = withApiHandler(
  async (request) => {
    const payload = batchSchema.parse(await request.json());
    return service.createWithPrerequisites(payload);
  },
  {
    responsibility: ["COE" as ResponsibilityType],
    audit: {
      action: "BATCH_CREATED",
      entityType: "BATCH",
      getEntityId: (result) => ((result as { batch: { id?: string } }).batch?.id),
    },
  },
);
