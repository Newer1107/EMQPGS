import { z } from "zod";

export const curriculumSchemeSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  name: z.string().trim().min(1, "Name is required").max(200),
  year: z.number().int().min(1900).max(2100),
  durationSemesters: z.number().int().min(1).max(12).default(8),
  isActive: z.boolean().optional(),
});

export const curriculumSchemeUpdateSchema = curriculumSchemeSchema.partial();

export type CurriculumSchemeInput = z.infer<typeof curriculumSchemeSchema>;
export type CurriculumSchemeUpdateInput = z.infer<typeof curriculumSchemeUpdateSchema>;
