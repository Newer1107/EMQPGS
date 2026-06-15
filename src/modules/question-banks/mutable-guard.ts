import { RecordStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

export function ensureQuestionBankMutable(recordStatus: RecordStatus): void {
  if (recordStatus === RecordStatus.LOCKED) {
    throw new AppError("Locked question bank cannot be modified", 409);
  }
}
