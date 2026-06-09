import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(10).toUpperCase(),
  hodName: z.string().min(2),
  isActive: z.boolean().optional(),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
