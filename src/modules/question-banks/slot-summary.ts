import { QuestionStatus } from "@prisma/client";

export function summarizeBankSlots(
  slots: Array<{
    assignedQuestion?: {
      status: QuestionStatus;
    } | null;
  }>,
) {
  const totalSlots = slots.length;
  let filledCount = 0;
  let pendingModerationCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const slot of slots) {
    if (slot.assignedQuestion) {
      filledCount += 1;
      if (slot.assignedQuestion.status === QuestionStatus.PENDING || slot.assignedQuestion.status === QuestionStatus.REVISION_SUBMITTED) pendingModerationCount += 1;
      if (slot.assignedQuestion.status === QuestionStatus.APPROVED) approvedCount += 1;
      if (slot.assignedQuestion.status === QuestionStatus.REJECTED || slot.assignedQuestion.status === QuestionStatus.REVISION_REQUESTED) rejectedCount += 1;
    }
  }

  return {
    totalSlots,
    filledCount,
    pendingModerationCount,
    approvedCount,
    rejectedCount,
    fillPercentage: totalSlots > 0 ? Number(((filledCount / totalSlots) * 100).toFixed(2)) : 0,
  };
}
