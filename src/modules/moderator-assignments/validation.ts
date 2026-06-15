import { z } from "zod";

export const assignmentSchema = z.object({
  moderatorId: z.string().min(1, "Moderator is required"),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;
