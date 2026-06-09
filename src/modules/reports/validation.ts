import { CoordinatorDecision, PaperVariant } from "@prisma/client";
import { z } from "zod";

export const signedReportSchema = z.object({
  fileAssetId: z.string().min(1),
});

export const coordinatorDecisionSchema = z.object({
  decision: z.nativeEnum(CoordinatorDecision),
  remark: z.string().max(500).optional(),
});

export const paperGenerationSchema = z.object({
  variants: z.array(z.nativeEnum(PaperVariant)).default([PaperVariant.PAPER_A, PaperVariant.PAPER_B, PaperVariant.PAPER_C]),
});
