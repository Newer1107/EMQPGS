import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { parseJson } from "@/lib/parse-body";
import { AppError } from "@/lib/errors";
import { QuestionService } from "@/modules/questions/service";
import { z } from "zod";

const service = new QuestionService();
const overrideSchema = z.object({
  questionBankId: z.string().min(1),
});

export const POST = withApiHandler(
  async (request, context) => {
    const slotId = request.nextUrl.pathname.split("/").slice(-2)[0]!;
    const payload = overrideSchema.parse(await parseJson(request));
    const slots = await service.listSlots(payload.questionBankId);
    const slot = slots.find((item) => item.id === slotId);
    if (!slot) {
      throw new AppError("Slot not found", 404);
    }
    return service.reserveSlot(
      {
        questionBankId: payload.questionBankId,
        moduleNumber: slot.moduleNumber,
        marks: slot.marks,
        slotNumber: slot.slotNumber,
      },
      context.user!,
      true,
    );
  },
  { roles: [Role.MODERATOR], audit: { action: "QUESTION_SLOT_OVERRIDE", entityType: "QUESTION_SLOT", getEntityId: (result) => (result as { id?: string }).id } },
);
