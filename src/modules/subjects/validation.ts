import { z } from "zod";

export const subjectSchema = z.object({
  subjectCode: z.string().min(2).max(20).toUpperCase(),
  subjectName: z.string().min(2),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  semester: z.coerce.number().int().min(1).max(8),
  credits: z.coerce.number().int().min(1).max(10),
  questionBankDueDate: z.coerce.date(),
  departmentId: z.string(),
});

export type SubjectInput = z.infer<typeof subjectSchema>;
