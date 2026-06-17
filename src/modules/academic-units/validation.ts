import { AcademicUnitType } from "@prisma/client";
import { z } from "zod";

export const academicUnitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.string().trim().min(1, "Code is required").max(20),
  type: z.nativeEnum(AcademicUnitType).default(AcademicUnitType.DEPARTMENT),
  hodName: z.string().trim().min(1, "HOD name is required").max(200),
  isActive: z.boolean().optional(),
});

export const academicUnitUpdateSchema = academicUnitSchema.partial();

export type AcademicUnitInput = z.infer<typeof academicUnitSchema>;
export type AcademicUnitUpdateInput = z.infer<typeof academicUnitUpdateSchema>;
