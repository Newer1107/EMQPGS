import { QuestionBankPhase } from "@prisma/client";
import { z } from "zod";

export const advancePhaseSchema = z.object({
  targetPhase: z.nativeEnum(QuestionBankPhase),
});

export type AdvancePhaseInput = z.infer<typeof advancePhaseSchema>;
