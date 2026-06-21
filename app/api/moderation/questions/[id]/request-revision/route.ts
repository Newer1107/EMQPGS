import { ResponsibilityType } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();
const revisionSchema = z.object({
  instructions: z.string().trim().min(1),
});

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = revisionSchema.parse(await request.json());
    return service.requestRevision({ userId: context.auth!.user.id }, id, payload.instructions);
  },
  { responsibility: ["MODERATOR" as ResponsibilityType], audit: { action: "QUESTION_REVISION_REQUESTED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
