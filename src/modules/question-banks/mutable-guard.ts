import { QuestionBankStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

export function ensureQuestionBankMutable(status: QuestionBankStatus): void {
  if (status === QuestionBankStatus.LOCKED) {
    throw new AppError("Locked question bank cannot be modified", 409);
  }
}
