import { QuestionBankPhase } from "@prisma/client";
import { z } from "zod";

export const questionBankInputSchema = z.object({
  subjectId: z.string().min(1),
  examCycleId: z.string().min(1),
});

export const advancePhaseSchema = z.object({
  targetPhase: z.nativeEnum(QuestionBankPhase),
});

export type QuestionBankInput = z.infer<typeof questionBankInputSchema>;
export type AdvancePhaseInput = z.infer<typeof advancePhaseSchema>;
