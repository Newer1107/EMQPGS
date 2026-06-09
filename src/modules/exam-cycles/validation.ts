import { ExamCycleStatus, ExamType } from "@prisma/client";
import { z } from "zod";

export const examCycleSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  semester: z.coerce.number().int().min(1).max(8),
  examType: z.nativeEnum(ExamType),
  status: z.nativeEnum(ExamCycleStatus).optional(),
  departmentId: z.string().nullable().optional(),
});

export type ExamCycleInput = z.infer<typeof examCycleSchema>;
