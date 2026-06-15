import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel } from "@prisma/client";
import { z } from "zod";

export const questionLibraryItemSchema = z.object({
  subjectVersionId: z.string().min(1),
  moduleNumber: z.coerce.number().int().min(1).max(6),
  marks: z.coerce.number().int().refine((value) => [2, 5, 10].includes(value), { message: "Marks must be 2, 5, or 10" }),
  questionText: z.string().min(15),
  coMapping: z.nativeEnum(CourseOutcome),
  rbtLevel: z.nativeEnum(RbtLevel),
  difficultyLevel: z.nativeEnum(DifficultyLevel).optional().nullable(),
  teachingIndex: z.string().max(50).optional().nullable(),
  status: z.nativeEnum(QuestionStatus).optional(),
});

export const questionLibraryUpdateSchema = questionLibraryItemSchema.partial();

export type QuestionLibraryItemInput = z.infer<typeof questionLibraryItemSchema>;
