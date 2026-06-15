import { NotificationType, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { NotificationService } from "@/modules/notifications/service";
import { ReportService } from "@/modules/reports/service";
import { DepartmentAccessUtils, type Actor } from "@/modules/coordinator/department-utils";

export class ReportingCoordinatorService {
  constructor(
    private readonly deptUtils = new DepartmentAccessUtils(),
    private readonly reportService = new ReportService(),
    private readonly notifications = new NotificationService(),
  ) {}

  async triggerAiAnalysis(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true, _count: { select: { bankQuestions: true } } },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);
    if (bank._count.bankQuestions < 3) {
      throw new AppError("Question bank does not meet the minimum question threshold for AI analysis.", 409);
    }

    const report = await this.reportService.createAiReport(questionBankId, actor);
    await this.notifications.create(
      actor.id,
      "AI analysis ready",
      `AI analysis report is ready for ${bank.subject.subjectName}.`,
      `/dashboard/coordinator/question-banks?bank=${questionBankId}`,
      NotificationType.INFO,
    );
    return report;
  }

  async listAiReports(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId }, include: { subject: true } });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);
    return this.reportService.listAiReports(questionBankId);
  }

  async triggerPaperGeneration(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { subject: true },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);
    const generatedPapers = await this.reportService.generatePapers(questionBankId, actor, ["PAPER_A", "PAPER_B", "PAPER_C"]);
    await this.notifications.create(
      actor.id,
      "Paper generation complete",
      `Papers A, B, C have been generated for ${bank.subject.subjectName}.`,
      `/dashboard/coordinator/question-banks?bank=${questionBankId}`,
      NotificationType.SUCCESS,
    );
    return generatedPapers;
  }

  async listGeneratedPapers(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({ where: { id: questionBankId }, include: { subject: true, deanReview: true } });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);
    const papers = await this.reportService.listGeneratedPapers(questionBankId);
    return {
      papers,
      deanReview: bank.deanReview,
    };
  }

  async getDeanReviewStatus(actor: Actor, questionBankId: string) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        subject: true,
        deanReview: {
          include: {
            reviewedBy: true,
          },
        },
      },
    });
    if (!bank) throw new NotFoundError("Question bank not found");
    await this.deptUtils.assertDepartmentAccess(actor, bank.subject.departmentId);

    return bank.deanReview
      ? {
          complete: true,
          review: {
            regularPaper: bank.deanReview.regularPaper,
            supplementaryPaper: bank.deanReview.supplementaryPaper,
            ktPaper: bank.deanReview.ktPaper,
            reviewedAt: bank.deanReview.reviewedAt.toISOString(),
            reviewedBy: {
              id: bank.deanReview.reviewedBy.id,
              name: bank.deanReview.reviewedBy.name,
              email: bank.deanReview.reviewedBy.email,
            },
          },
        }
      : { complete: false, review: null };
  }
}
