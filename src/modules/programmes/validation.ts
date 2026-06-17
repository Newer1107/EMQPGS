import { DegreeType } from "@prisma/client";
import { z } from "zod";

export const programmeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.string().trim().min(1, "Code is required").max(20),
  degreeType: z.nativeEnum(DegreeType).default(DegreeType.BE),
  durationYears: z.number().int().min(1).max(8).default(4),
  durationSemesters: z.number().int().min(1).max(12).default(8),
  homeAcademicUnitId: z.string().min(1, "Home academic unit is required"),
  firstYearAcademicUnitId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const programmeUpdateSchema = programmeSchema.partial();

export type ProgrammeInput = z.infer<typeof programmeSchema>;
export type ProgrammeUpdateInput = z.infer<typeof programmeUpdateSchema>;
