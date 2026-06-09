import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel } from "@prisma/client";
import { z } from "zod";

export const reserveSlotSchema = z.object({
  questionBankId: z.string().min(1),
  moduleNumber: z.coerce.number().int().min(1).max(6),
  marks: z.union([z.literal(2), z.literal(5), z.literal(10)]),
  slotNumber: z.coerce.number().int().min(1).max(7),
});

export const questionSchema = z.object({
  slotId: z.string().min(1),
  questionText: z.string().min(15),
  coMapping: z.nativeEnum(CourseOutcome),
  rbtLevel: z.nativeEnum(RbtLevel),
  teachingIndex: z.string().max(50).optional().nullable(),
  difficultyLevel: z.nativeEnum(DifficultyLevel).optional().nullable(),
});

export const questionUpdateSchema = questionSchema.partial().extend({
  status: z.nativeEnum(QuestionStatus).optional(),
});

export const moderationSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_REVISION"]),
  remark: z.string().max(500).optional(),
});

export const attachmentSchema = z.object({
  fileAssetId: z.string().min(1),
});

export const attachmentReplaceSchema = z.object({
  fileAssetId: z.string().min(1),
});

export type QuestionInput = z.infer<typeof questionSchema>;
