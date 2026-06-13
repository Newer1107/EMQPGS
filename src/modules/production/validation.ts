import { ExportFormat, PaperVariant } from "@prisma/client";
import { z } from "zod";

export const deanReviewSchema = z.object({
  regularPaper: z.nativeEnum(PaperVariant),
  supplementaryPaper: z.nativeEnum(PaperVariant),
  ktPaper: z.nativeEnum(PaperVariant),
}).superRefine((value, ctx) => {
  const distinctValues = new Set([value.regularPaper, value.supplementaryPaper, value.ktPaper]);
  if (distinctValues.size !== 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Each exam slot must be assigned to a different paper.",
      path: ["regularPaper"],
    });
  }
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
