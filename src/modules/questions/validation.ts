import { CourseOutcome, DifficultyLevel, QuestionStatus, RbtLevel } from "@prisma/client";
import { z } from "zod";
import { QUESTION_MODULE_COUNT, QUESTION_SLOT_COUNT, QUESTION_MARKS } from "@/modules/questions/slot-template";

export const reserveSlotSchema = z.object({
  questionBankId: z.string().min(1),
  moduleNumber: z.coerce.number().int().min(1).max(QUESTION_MODULE_COUNT),
  marks: z.union(QUESTION_MARKS.map((m) => z.literal(m)) as [z.ZodLiteral<2>, z.ZodLiteral<5>, z.ZodLiteral<10>]),
  slotNumber: z.coerce.number().int().min(1).max(QUESTION_SLOT_COUNT),
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
