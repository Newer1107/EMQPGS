import { CoordinatorDecision, QuestionBankPhase, type User } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ENTITY_TYPES } from "@/lib/constants";
import { AiReportService } from "@/modules/reports/ai-report.service";
import { PaperGenerationService } from "@/modules/reports/paper.service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class ReportService {
  constructor(
    private readonly aiService = new AiReportService(),
    private readonly paperService = new PaperGenerationService(),
  ) {}

  async createAiReport(questionBankId: string, actor: Actor) {
    return this.aiService.createAiReport(questionBankId, actor);
  }

  async listAiReports(questionBankId: string) {
    return this.aiService.listAiReports(questionBankId);
  }

  async coordinatorDecision(questionBankId: string, decision: CoordinatorDecision, remark: string | undefined, actor: Actor) {
    if (actor.role !== "COORDINATOR") throw new ForbiddenError("Only coordinators can approve or reject reports");
    const questionBank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!questionBank) throw new NotFoundError("Question bank not found");
    if (questionBank.phase !== QuestionBankPhase.APPROVAL) {
      throw new AppError("Coordinator decision can only be made when the bank is in APPROVAL phase.", 409);
    }

    const targetPhase =
      decision === CoordinatorDecision.APPROVED
        ? QuestionBankPhase.COMPLETE
        : QuestionBankPhase.MODERATION;

    const [approvalDecision] = await prisma.$transaction([
      prisma.approvalDecision.create({
        data: {
          questionBankId,
          decision,
          remark: remark ?? null,
          decidedById: actor.id,
        },
      }),
      prisma.questionBank.update({
        where: { id: questionBankId },
        data: { phase: targetPhase },
      }),
    ]);

    await logAudit({
      actorId: actor.id,
      action: decision === CoordinatorDecision.APPROVED ? "QUESTION_BANK_APPROVED" : "QUESTION_BANK_REJECTED",
      entityType: ENTITY_TYPES.QUESTION_BANK,
      entityId: questionBankId,
      metadata: { remark, approvalDecisionId: approvalDecision.id },
    });

    return approvalDecision;
  }

  async generatePapers(questionBankId: string, actor: Actor, variants: import("@prisma/client").PaperVariant[]) {
    return this.paperService.generatePapers(questionBankId, actor, variants);
  }

  async listGeneratedPapers(questionBankId: string) {
    return this.paperService.listGeneratedPapers(questionBankId);
  }
}
