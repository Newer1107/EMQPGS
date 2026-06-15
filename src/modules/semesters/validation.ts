import { z } from "zod";

export const semesterSchema = z.object({
  number: z.coerce.number().int().min(1).max(8),
  name: z.string().trim().min(1),
  academicYearId: z.string().min(1),
});

export type SemesterInput = z.infer<typeof semesterSchema>;
