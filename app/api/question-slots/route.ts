import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { QuestionService } from "@/modules/questions/service";
import { reserveSlotSchema } from "@/modules/questions/validation";

const service = new QuestionService();

export const GET = withApiHandler(async (request) => {
  const questionBankId = request.nextUrl.searchParams.get("questionBankId");
  if (!questionBankId) {
    return [];
  }
  return service.listSlots(questionBankId);
}, { roles: [Role.COORDINATOR, Role.MODERATOR, Role.CONTRIBUTOR, Role.COE] });

export const POST = withApiHandler(
  async (request, context) => {
    const payload = reserveSlotSchema.parse(await parseJson(request));
    return service.reserveSlot(payload, context.user!);
  },
  {
    roles: [Role.MODERATOR, Role.CONTRIBUTOR],
    audit: { action: "QUESTION_SLOT_RESERVED", entityType: "QUESTION_SLOT", getEntityId: (result) => (result as { id?: string }).id },
  },
);
