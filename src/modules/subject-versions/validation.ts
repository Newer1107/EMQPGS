import { SubjectVersionStatus } from "@prisma/client";
import { z } from "zod";

export const subjectVersionSchema = z.object({
  subjectId: z.string().min(1),
  title: z.string().trim().min(1),
  syllabusDescription: z.string().optional().nullable(),
  effectiveFromAcademicYearId: z.string().min(1),
  status: z.nativeEnum(SubjectVersionStatus).optional(),
});

export type SubjectVersionInput = z.infer<typeof subjectVersionSchema>;
