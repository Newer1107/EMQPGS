import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel } from "@prisma/client";
import { z } from "zod";

function emptyStrToNull<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (v === "" ? null : v), schema);
}

export const questionLibraryItemSchema = z.object({
  subjectVersionId: z.string().min(1),
  moduleNumber: z.coerce.number().int().min(1).max(6),
  marks: z.coerce.number().int().refine((value) => [2, 5, 10].includes(value), { message: "Marks must be 2, 5, or 10" }),
  questionText: z.string().min(15),
  coMapping: z.nativeEnum(CourseOutcome),
  rbtLevel: z.nativeEnum(RbtLevel),
  difficultyLevel: emptyStrToNull(z.nativeEnum(DifficultyLevel).nullable()).optional(),
  teachingIndex: emptyStrToNull(z.string().max(50).nullable()).optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
});

export const questionLibraryUpdateSchema = questionLibraryItemSchema.partial();

export type QuestionLibraryItemInput = z.infer<typeof questionLibraryItemSchema>;
