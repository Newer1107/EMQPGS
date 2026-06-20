import { z } from "zod";

export const batchSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.string().trim().min(1, "Code is required").max(20),
  departmentId: z.string().min(1, "Department is required"),
  curriculumSchemeId: z.string().min(1, "Curriculum scheme is required"),
  admissionYear: z.number().int().min(1900).max(2100),
  graduationYear: z.number().int().min(1900).max(2100),
  hasTeachingGroups: z.boolean().optional(),
});

export const batchUpdateSchema = batchSchema.partial();

export type BatchInput = z.infer<typeof batchSchema>;
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;
