import { QuestionStatus } from "@prisma/client";
import { QUESTION_MODULE_COUNT, QUESTION_SLOT_COUNT, QUESTION_MARKS } from "@/modules/questions/slot-template";

export function summarizeBankSlots(
  slots: Array<{
    reservedById?: string | null;
    question: {
      status: QuestionStatus;
    } | null;
  }>,
) {
  const totalSlots = QUESTION_MODULE_COUNT * QUESTION_MARKS.length * QUESTION_SLOT_COUNT;
  let filledCount = 0;
  let pendingModerationCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const slot of slots) {
    if (slot.question) {
      filledCount += 1;
      if (slot.question.status === QuestionStatus.PENDING || slot.question.status === QuestionStatus.REVISION_SUBMITTED) pendingModerationCount += 1;
      if (slot.question.status === QuestionStatus.APPROVED) approvedCount += 1;
      if (slot.question.status === QuestionStatus.REJECTED || slot.question.status === QuestionStatus.REVISION_REQUESTED) rejectedCount += 1;
    }
  }

  return {
    totalSlots,
    filledCount,
    pendingModerationCount,
    approvedCount,
    rejectedCount,
    fillPercentage: Number(((filledCount / totalSlots) * 100).toFixed(2)),
  };
}
