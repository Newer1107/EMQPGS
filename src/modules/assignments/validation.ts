import { AssignmentRole } from "@prisma/client";
import { z } from "zod";

export const assignmentSchema = z.object({
  questionBankId: z.string(),
  moderatorId: z.string().optional(),
  contributorIds: z.array(z.string()).default([]),
});

export const teacherAssignmentRowSchema = z.object({
  questionBankId: z.string(),
  teacherId: z.string(),
  assignmentRole: z.nativeEnum(AssignmentRole),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;
