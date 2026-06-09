import { QuestionBankStatus } from "@prisma/client";
import { z } from "zod";

export const questionBankSchema = z.object({
  subjectId: z.string(),
  examCycleId: z.string(),
  status: z.nativeEnum(QuestionBankStatus).optional(),
});

export const questionBankStatusSchema = z.object({
  status: z.nativeEnum(QuestionBankStatus),
});

export type QuestionBankInput = z.infer<typeof questionBankSchema>;
