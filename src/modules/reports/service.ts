import { CoordinatorDecision, QuestionBankStatus, type User } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ENTITY_TYPES } from "@/lib/constants";
import { AiReportService } from "@/modules/reports/ai-report.service";
import { SignedReportService } from "@/modules/reports/signed-report.service";
import { PaperGenerationService } from "@/modules/reports/paper.service";

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class ReportService {
  constructor(
    private readonly aiService = new AiReportService(),
    private readonly signedService = new SignedReportService(),
    private readonly paperService = new PaperGenerationService(),
  ) {}

  async createAiReport(questionBankId: string, actor: Actor) {
    return this.aiService.createAiReport(questionBankId, actor);
  }

  async listAiReports(questionBankId: string) {
    return this.aiService.listAiReports(questionBankId);
  }

  async uploadSignedReport(questionBankId: string, fileAssetId: string, actor: Actor) {
    return this.signedService.uploadSignedReport(questionBankId, fileAssetId, actor);
  }

  async createSignedReportUploadUrl(questionBankId: string, actor: Actor, fileName: string, mimeType: string, size: number) {
    return this.signedService.createSignedReportUploadUrl(questionBankId, actor, fileName, mimeType, size);
  }

  async coordinatorDecision(questionBankId: string, decision: CoordinatorDecision, remark: string | undefined, actor: Actor) {
    if (actor.role !== "COORDINATOR") throw new ForbiddenError("Only coordinators can approve or reject reports");
    const questionBank = await prisma.questionBank.findUnique({ where: { id: questionBankId } });
    if (!questionBank) throw new NotFoundError("Question bank not found");

    const status =
      decision === CoordinatorDecision.APPROVED
        ? QuestionBankStatus.APPROVED
        : QuestionBankStatus.AWAITING_HOD_SIGN;

    const updated = await prisma.questionBank.update({
      where: { id: questionBankId },
      data: {
        coordinatorDecision: decision,
        coordinatorReviewedAt: new Date(),
        coordinatorReviewRemark: remark ?? null,
        status,
        lockedAt: null,
      },
    });

    await logAudit({
      actorId: actor.id,
      action: decision === CoordinatorDecision.APPROVED ? "QUESTION_BANK_APPROVED" : "QUESTION_BANK_REJECTED",
      entityType: ENTITY_TYPES.QUESTION_BANK,
      entityId: questionBankId,
      metadata: { remark },
    });

    return updated;
  }

  async generatePapers(questionBankId: string, actor: Actor, variants: import("@prisma/client").PaperVariant[]) {
    return this.paperService.generatePapers(questionBankId, actor, variants);
  }

  async listGeneratedPapers(questionBankId: string) {
    return this.paperService.listGeneratedPapers(questionBankId);
  }
}
