import { Role } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { ModeratorService } from "@/modules/moderation/service";

const service = new ModeratorService();
const rejectSchema = z.object({
  reason: z.string().trim().min(1),
});

export const PATCH = withApiHandler(
  async (request, context) => {
    const id = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = rejectSchema.parse(await parseJson(request));
    return service.rejectQuestion(context.user!, id, payload.reason);
  },
  { roles: [Role.MODERATOR], audit: { action: "QUESTION_REJECTED", entityType: "QUESTION", getEntityId: (result) => (result as { id?: string }).id } },
);
