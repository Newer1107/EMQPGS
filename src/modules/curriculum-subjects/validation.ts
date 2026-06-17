import { GroupAssignment } from "@prisma/client";
import { z } from "zod";

export const curriculumSubjectSchema = z.object({
  curriculumSchemeId: z.string().min(1, "Curriculum scheme is required"),
  subjectId: z.string().min(1, "Subject is required"),
  semesterNumber: z.number().int().min(1).max(8),
  academicUnitId: z.string().min(1, "Academic unit is required"),
  groupAssignment: z.nativeEnum(GroupAssignment).default(GroupAssignment.ALL),
});

export const curriculumSubjectUpdateSchema = curriculumSubjectSchema.partial();

export type CurriculumSubjectInput = z.infer<typeof curriculumSubjectSchema>;
export type CurriculumSubjectUpdateInput = z.infer<typeof curriculumSubjectUpdateSchema>;

export const curriculumSubjectFilterSchema = z.object({
  curriculumSchemeId: z.string().optional(),
  semesterNumber: z.coerce.number().int().min(1).max(8).optional(),
  academicUnitId: z.string().optional(),
  groupAssignment: z.nativeEnum(GroupAssignment).optional(),
  subjectId: z.string().optional(),
});
