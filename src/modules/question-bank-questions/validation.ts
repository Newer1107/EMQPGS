import { z } from "zod";

export const questionBankQuestionSchema = z.object({
  questionBankId: z.string().min(1, "Question bank is required"),
  questionId: z.string().min(1, "Question is required"),
});

export type QuestionBankQuestionInput = z.infer<typeof questionBankQuestionSchema>;
