import { Role } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();
const revisionSchema = z.object({
  instructions: z.string().trim().min(1),
});

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = revisionSchema.parse(await parseJson(request));
    return service.requestRevision(context.user!, id, payload.instructions);
  },
  { roles: [Role.MODERATOR], audit: { action: "QUESTION_REVISION_REQUESTED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
