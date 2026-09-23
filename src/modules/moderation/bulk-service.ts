import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError } from "@/lib/errors";
import { ModeratorService } from "./service";

export const bulkModerationSchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1).max(50).refine(ids => new Set(ids).size === ids.length, "Select each question only once."),
  action: z.enum(["approve", "reject", "request-revision"]),
  reason: z.string().trim().max(2000).optional(),
}).refine(input => input.action === "approve" || Boolean(input.reason), { message: "A reason is required for rejection or revision.", path: ["reason"] });

export class BulkModerationService {
  constructor(private readonly moderator = new ModeratorService()) {}

  async run(ctx: { userId: string; bankId: string }, input: z.infer<typeof bulkModerationSchema>) {
    const payload = bulkModerationSchema.parse(input);
    const bank = await prisma.questionBank.findUnique({ where: { id: ctx.bankId }, select: { phase: true, recordStatus: true } });
    if (!bank || bank.phase !== "MODERATION" || bank.recordStatus !== "ACTIVE") throw new AppError("An active bank in moderation is required.", 409);
    const questions = await prisma.questionLibraryItem.findMany({
      where: { id: { in: payload.questionIds }, slotAssignments: { some: { questionBankId: ctx.bankId } } },
      select: { id: true },
    });
    if (questions.length !== payload.questionIds.length) {
      throw new ForbiddenError("Every selected question must belong to your active moderation bank.");
    }
    const results: Array<{ questionId: string; success: boolean; error?: string }> = [];
    for (const questionId of payload.questionIds) {
      try {
        if (payload.action === "approve") await this.moderator.approveQuestion(ctx, questionId);
        else if (payload.action === "reject") await this.moderator.rejectQuestion(ctx, questionId, payload.reason!);
        else await this.moderator.requestRevision(ctx, questionId, payload.reason!);
        results.push({ questionId, success: true });
      } catch (error) {
        results.push({ questionId, success: false, error: error instanceof Error ? error.message : "Moderation failed." });
      }
    }
    return { results, succeeded: results.filter(result => result.success).length };
  }
}
