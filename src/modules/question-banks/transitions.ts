import { QuestionBankPhase } from "@prisma/client";

const PHASE_TRANSITIONS: Record<QuestionBankPhase, QuestionBankPhase[]> = {
  [QuestionBankPhase.DRAFTING]: [QuestionBankPhase.MODERATION],
  [QuestionBankPhase.MODERATION]: [QuestionBankPhase.APPROVAL],
  [QuestionBankPhase.APPROVAL]: [QuestionBankPhase.MODERATION],
  [QuestionBankPhase.COMPLETE]: [],
};

export function isValidPhaseTransition(current: QuestionBankPhase, next: QuestionBankPhase): boolean {
  return PHASE_TRANSITIONS[current]?.includes(next) ?? false;
}
