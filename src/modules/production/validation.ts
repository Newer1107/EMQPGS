import { ExportFormat } from "@prisma/client";
import { z } from "zod";

export const deanReviewSchema = z.object({
  regularPaperId: z.string().min(1),
  supplementaryPaperId: z.string().min(1),
  ktPaperId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export const exportRequestSchema = z.object({
  questionBankId: z.string().min(1),
  format: z.nativeEnum(ExportFormat),
  examDate: z.string().min(1),
  duration: z.string().min(1),
  maximumMarks: z.coerce.number().int().positive(),
  instructions: z.array(z.string().min(1)).min(1),
  institutionName: z.string().min(1).optional(),
});
