import { AssignmentRole } from "@prisma/client";
import { z } from "zod";

export const assignmentSchema = z.object({
  questionBankId: z.string().min(1),
  moderatorId: z.string().min(1).optional(),
  contributorIds: z.array(z.string().min(1)).default([]),
});

export const teacherAssignmentRowSchema = z.object({
  questionBankId: z.string().min(1),
  teacherId: z.string().min(1),
  assignmentRole: z.nativeEnum(AssignmentRole),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;
