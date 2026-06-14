import { QuestionBankStatus } from "@prisma/client";

const QUESTION_BANK_TRANSITIONS: Record<QuestionBankStatus, QuestionBankStatus[]> = {
  [QuestionBankStatus.DRAFT]: [QuestionBankStatus.IN_PROGRESS, QuestionBankStatus.LOCKED],
  [QuestionBankStatus.IN_PROGRESS]: [QuestionBankStatus.UNDER_MODERATION, QuestionBankStatus.LOCKED],
  [QuestionBankStatus.UNDER_MODERATION]: [QuestionBankStatus.MODERATED, QuestionBankStatus.LOCKED],
  [QuestionBankStatus.MODERATED]: [QuestionBankStatus.REPORT_GENERATED, QuestionBankStatus.LOCKED],
  [QuestionBankStatus.REPORT_GENERATED]: [QuestionBankStatus.AWAITING_HOD_SIGN, QuestionBankStatus.LOCKED],
  [QuestionBankStatus.AWAITING_HOD_SIGN]: [QuestionBankStatus.SIGNED_REPORT_UPLOADED, QuestionBankStatus.LOCKED],
  [QuestionBankStatus.SIGNED_REPORT_UPLOADED]: [QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL, QuestionBankStatus.LOCKED],
  [QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL]: [QuestionBankStatus.APPROVED, QuestionBankStatus.LOCKED, QuestionBankStatus.AWAITING_HOD_SIGN],
  [QuestionBankStatus.APPROVED]: [QuestionBankStatus.LOCKED],
  [QuestionBankStatus.LOCKED]: [],
};

export function isValidTransition(current: QuestionBankStatus, next: QuestionBankStatus): boolean {
  return QUESTION_BANK_TRANSITIONS[current]?.includes(next) ?? false;
}
