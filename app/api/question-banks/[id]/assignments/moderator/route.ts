import { Role } from "@prisma/client";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { AssignmentService } from "@/modules/assignments/service";

const service = new AssignmentService();

const assignModeratorSchema = z.object({
  moderatorId: z.string().min(1),
});

export const POST = withApiHandler(
  async (request, _context) => {
    const questionBankId = request.nextUrl.pathname.split("/").slice(-3)[0]!;
    const payload = assignModeratorSchema.parse(await parseJson(request));
    return service.assignModerator(questionBankId, payload.moderatorId);
  },
  {
    roles: [Role.COORDINATOR],
    successStatus: 201,
    audit: { action: "MODERATOR_ASSIGNED", entityType: "MODERATOR_BANK_ASSIGNMENT", getEntityId: (result) => (result as { id?: string }).id },
  },
);
