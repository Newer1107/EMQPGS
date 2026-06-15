import { z } from "zod";

export const assignToSlotSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
});

export type AssignToSlotInput = z.infer<typeof assignToSlotSchema>;
