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
  questionType: emptyStrToNull(z.enum(["THEORY", "NUMERICAL"]).nullable()).optional(),
  poMapping: z.array(z.string().trim().min(1).max(50)).max(50).refine(values => new Set(values).size === values.length, "Duplicate PO mappings").optional(),
  piMapping: z.array(z.string().trim().min(1).max(50)).max(100).refine(values => new Set(values).size === values.length, "Duplicate PI mappings").optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
});

export const questionLibraryUpdateSchema = questionLibraryItemSchema.partial();

export type QuestionLibraryItemInput = z.infer<typeof questionLibraryItemSchema>;
