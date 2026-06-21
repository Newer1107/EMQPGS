import {
  NotificationType,
  PaperGenerationStatus,
  PaperVariant,
  RecordStatus,
  type Prisma,
} from "@prisma/client";
import type { AuthContext } from "@/lib/types";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { ENTITY_TYPES } from "@/lib/constants";
import type { EvaluationReport } from "@/modules/paper-generation-engine/types";

const DEAN_REVIEW_REMINDER_DAYS = Number(process.env.DEAN_REVIEW_REMINDER_DAYS ?? "3");


export type DeanDashboardItem = {
  id: string;
  subjectName: string;
  subjectCode: string;
  examCycleLabel: string;
  generationTimestamp: string | null;
  reviewSubmitted: boolean;
  reviewSummary: {
    regularPaper: PaperVariant;
    supplementaryPaper: PaperVariant;
    ktPaper: PaperVariant;
  } | null;
  qualityScore: number | null;
  coverageScore: number | null;
  aiSummary: string | null;
  reviewedAt: string | null;
  daysWaiting: number;
};

export type DeanDashboardData = {
  pendingReviews: DeanDashboardItem[];
  completedReviews: DeanDashboardItem[];
  approvalHistory: Array<{
    subjectName: string;
    subjectCode: string;
    examCycleLabel: string;
    regularPaper: PaperVariant;
    supplementaryPaper: PaperVariant;
    ktPaper: PaperVariant;
    reviewedAt: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    actionUrl: string | null;
    isRead: boolean;
    createdAt: string;
  }>;
  unreadNotificationCount: number;
};

export type DeanReviewWorkspace = {
  bankId: string;
  subjectName: string;
  subjectCode: string;
  examCycleLabel: string;
  generationTimestamp: string | null;
  papers: Array<{
    paperId: PaperVariant;
    paperLabel: string;
    coverageScore: number | null;
    difficultyScore: number | null;
    qualityScore: number | null;
    duplicateRisk: number | null;
    aiRecommendation: string;
    evaluationReport: EvaluationReport | null;
    scoreBreakdown: string | null;
    hasGenerationTrace: boolean;
    questions: Array<{
      questionText: string;
      markType: number;
      moduleNumber: number;
      co: string;
      rbtLevel: string;
      difficultyLevel: string | null;
    }>;
  }>;
  deanReview: null | {
    id: string;
    regularPaper: PaperVariant;
    supplementaryPaper: PaperVariant;
    ktPaper: PaperVariant;
    reviewedAt: string;
    reviewedBy: {
      id: string;
      name: string;
      email: string;
    };
  };
};

type DeanReviewInput = {
  regularPaper: PaperVariant;
  supplementaryPaper: PaperVariant;
  ktPaper: PaperVariant;
};

type DeanDashboardQuestionBank = Prisma.QuestionBankGetPayload<{ include: typeof deanDashboardInclude }>;
type DeanWorkspaceQuestionBank = Prisma.QuestionBankGetPayload<{ include: typeof deanWorkspaceInclude }>;

export class DeanReviewService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
  ) {}

  async getDeanDashboardData(authContext: AuthContext): Promise<DeanDashboardData> {
    new AuthorizationService(authContext).requireDean();
    await this.ensureDeanNotifications(authContext);

    const [questionBanks, notifications, unreadNotificationCount] = await Promise.all([
      this.listDeanQuestionBanks(authContext),
      this.notificationService.listForUser(authContext.user.id, 25),
      this.notificationService.unreadCount(authContext.user.id),
    ]);

    const items = questionBanks.map((questionBank) => this.mapDeanDashboardItem(questionBank));

    const approvalHistory = items
      .filter((item) => item.reviewSubmitted && item.reviewedAt)
      .map((item) => ({
        subjectName: item.subjectName,
        subjectCode: item.subjectCode,
        examCycleLabel: item.examCycleLabel,
        regularPaper: item.reviewSummary!.regularPaper,
        supplementaryPaper: item.reviewSummary!.supplementaryPaper,
        ktPaper: item.reviewSummary!.ktPaper,
        reviewedAt: item.reviewedAt!,
      }));

    return {
      pendingReviews: items.filter((item) => !item.reviewSubmitted).sort((a, b) => b.daysWaiting - a.daysWaiting),
      completedReviews: items.filter((item) => item.reviewSubmitted),
      approvalHistory,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        actionUrl: notification.actionUrl ?? null,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString(),
      })),
      unreadNotificationCount,
    };
  }

  async getDeanReviewWorkspace(questionBankId: string, authContext: AuthContext): Promise<DeanReviewWorkspace> {
    new AuthorizationService(authContext).requireDean();
    const questionBank = await this.findDeanQuestionBank(questionBankId, authContext);
    await this.notificationService.markByActionUrlAsRead(authContext.user.id, `/dashboard/dean/review?bank=${questionBankId}`);

    return {
      bankId: questionBank.id,
      subjectName: questionBank.subject.subjectName,
      subjectCode: questionBank.subject.subjectCode,
      examCycleLabel: `${questionBank.batchSemester.academicYear.code} · Sem ${questionBank.batchSemester.semesterNumber}`,
      generationTimestamp: getGenerationTimestamp(questionBank.generatedPapers),
      papers: questionBank.generatedPapers.map((paper) => {
        const pj = paper.paperJson as Record<string, unknown> | null;
        return {
          paperId: paper.variant,
          paperLabel: paper.variant,
          coverageScore: paper.coverageScore ?? null,
          difficultyScore: paper.difficultyScore ?? null,
          qualityScore: paper.qualityScore ?? null,
          duplicateRisk: paper.duplicateRisk ?? null,
          aiRecommendation: paper.recommendation ?? questionBank.aiReports[0]?.summary ?? "No AI recommendation available.",
          evaluationReport: (pj?.evaluationReport as EvaluationReport) ?? null,
          scoreBreakdown: (pj?.scoreBreakdown as string) ?? null,
          hasGenerationTrace: Boolean(pj?.generationTrace ?? false),
          questions: paper.items
            .map((item) => ({
              questionText: item.question.questionText,
              markType: item.question.marks,
              moduleNumber: item.question.moduleNumber,
              co: item.question.coMapping,
              rbtLevel: item.question.rbtLevel,
              difficultyLevel: item.question.difficultyLevel ?? null,
            }))
            .sort((left, right) => left.moduleNumber - right.moduleNumber || left.markType - right.markType || left.questionText.localeCompare(right.questionText)),
        };
      }),
      deanReview: questionBank.deanReview ? {
        id: questionBank.deanReview.id,
        regularPaper: questionBank.deanReview.regularPaper,
        supplementaryPaper: questionBank.deanReview.supplementaryPaper,
        ktPaper: questionBank.deanReview.ktPaper,
        reviewedAt: questionBank.deanReview.reviewedAt.toISOString(),
        reviewedBy: {
          id: questionBank.deanReview.reviewedBy.id,
          name: questionBank.deanReview.reviewedBy.name,
          email: questionBank.deanReview.reviewedBy.email,
        },
      } : null,
    };
  }

  async submitDeanReview(questionBankId: string, payload: DeanReviewInput, authContext: AuthContext) {
    new AuthorizationService(authContext).requireDean();
    const questionBank = await this.findDeanQuestionBank(questionBankId, authContext);

    if (questionBank.deanReview) {
      throw new AppError("A dean selection has already been submitted for this question bank.", 409, "DEAN_REVIEW_LOCKED");
    }

    const distinctSelections = new Set([payload.regularPaper, payload.supplementaryPaper, payload.ktPaper]);
    if (distinctSelections.size !== 3) {
      throw new AppError("Each exam slot must be assigned to a different paper.", 400, "INVALID_DEAN_SELECTION");
    }

    const availableVariants = new Set(questionBank.generatedPapers.map((paper) => paper.variant));
    for (const selectedPaper of distinctSelections) {
      if (!availableVariants.has(selectedPaper)) {
        throw new AppError(`Selected paper ${selectedPaper} does not belong to this question bank.`, 400, "INVALID_DEAN_SELECTION");
      }
    }

    const review = await prisma.deanReview.create({
      data: {
        questionBankId,
        regularPaper: payload.regularPaper,
        supplementaryPaper: payload.supplementaryPaper,
        ktPaper: payload.ktPaper,
        reviewedById: authContext.user.id,
      },
      include: {
        reviewedBy: true,
      },
    });

    const coeResponsibilityAssignments = await prisma.responsibilityAssignment.findMany({
      where: { responsibility: "COE", scopeType: "INSTITUTION" },
      include: { user: true },
    });
    const coeUsers = coeResponsibilityAssignments.map((ra) => ra.user);
    const coordinatorAssignments = await prisma.responsibilityAssignment.findMany({
      where: { responsibility: "COORDINATOR", scopeType: "DEPARTMENT", scopeId: questionBank.subject.departmentId },
      include: { user: true },
    });

    await Promise.all([
      ...coeUsers.map((coe) =>
        this.notificationService.createAndEmail(
          coe,
          "Dean review complete",
          `Dean review complete for ${questionBank.subject.subjectName} - ready for export`,
          "/dashboard/coe/production",
          NotificationType.ACTION_REQUIRED,
        ),
      ),
      ...coordinatorAssignments.map(({ user }) =>
        this.notificationService.create(
          user.id,
          "Dean review complete",
          `Dean review is complete for ${questionBank.subject.subjectName}. Papers have been assigned.`,
          `/dashboard/coordinator/question-banks?bank=${questionBankId}`,
          NotificationType.SUCCESS,
        ),
      ),
      this.notificationService.create(
        authContext.user.id,
        "Selection confirmed",
        `Your selection for ${questionBank.subject.subjectName} has been submitted successfully.`,
        `/dashboard/dean/review?bank=${questionBankId}`,
        NotificationType.SUCCESS,
      ),
      this.notificationService.markByActionUrlAsRead(authContext.user.id, `/dashboard/dean/review?bank=${questionBankId}`),
    ]);

    await logAudit({
      actorId: authContext.user.id,
      action: "DEAN_SELECTION_SUBMITTED",
      entityType: ENTITY_TYPES.DEAN_REVIEW,
      entityId: review.id,
      metadata: {
        questionBankId,
        regularPaper: payload.regularPaper,
        supplementaryPaper: payload.supplementaryPaper,
        ktPaper: payload.ktPaper,
        reviewedAt: review.reviewedAt.toISOString(),
      },
    });

    return {
      id: review.id,
      questionBankId,
      regularPaper: review.regularPaper,
      supplementaryPaper: review.supplementaryPaper,
      ktPaper: review.ktPaper,
      reviewedAt: review.reviewedAt.toISOString(),
      reviewedBy: {
        id: review.reviewedBy.id,
        name: review.reviewedBy.name,
        email: review.reviewedBy.email,
      },
    };
  }



  private deanDepartmentFilter(authContext: AuthContext): { departmentId?: { in: string[] } } {
    const deptIds = new AuthorizationService(authContext).getScopeIds("DEAN", "DEPARTMENT");
    if (deptIds.length > 0) {
      return { departmentId: { in: deptIds } };
    }
    return {};
  }

  private async listDeanQuestionBanks(authContext: AuthContext) {
    return prisma.questionBank.findMany({
      where: {
        recordStatus: RecordStatus.LOCKED,
        subject: this.deanDepartmentFilter(authContext),
        generatedPapers: {
          some: { status: PaperGenerationStatus.COMPLETED },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: deanDashboardInclude,
    });
  }

  private async findDeanQuestionBank(questionBankId: string, authContext: AuthContext): Promise<DeanWorkspaceQuestionBank> {
    const questionBank = await prisma.questionBank.findFirst({
      where: {
        id: questionBankId,
        recordStatus: RecordStatus.LOCKED,
        subject: this.deanDepartmentFilter(authContext),
      },
      include: deanWorkspaceInclude,
    });

    if (!questionBank) {
      throw new ForbiddenError("You do not have access to this question bank.");
    }

    const hasCompletedPapers = questionBank.generatedPapers.some(
      (p) => p.status === PaperGenerationStatus.COMPLETED,
    );
    if (!hasCompletedPapers) {
      throw new AppError(
        "This question bank has not been generated yet. No papers available for review.",
        400,
        "NO_GENERATED_PAPERS",
      );
    }

    return questionBank;
  }

  private mapDeanDashboardItem(questionBank: DeanDashboardQuestionBank): DeanDashboardItem {
    const aiReport = questionBank.aiReports?.[0];
    const scoredPapers = questionBank.generatedPapers.filter((p) => p.qualityScore != null);
    const avgQuality = scoredPapers.length > 0
      ? scoredPapers.reduce((acc, p) => acc + (p.qualityScore ?? 0), 0) / scoredPapers.length
      : null;
    const scoredCoverage = questionBank.generatedPapers.filter((p) => p.coverageScore != null);
    const avgCoverage = scoredCoverage.length > 0
      ? scoredCoverage.reduce((acc, p) => acc + (p.coverageScore ?? 0), 0) / scoredCoverage.length
      : null;
    const generationDate = getGenerationDate(questionBank.generatedPapers);
    const daysWaiting = generationDate ? Math.floor((Date.now() - generationDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      id: questionBank.id,
      subjectName: questionBank.subject.subjectName,
      subjectCode: questionBank.subject.subjectCode,
      examCycleLabel: `${questionBank.batchSemester.academicYear.code} · Sem ${questionBank.batchSemester.semesterNumber}`,
      generationTimestamp: generationDate?.toISOString() ?? null,
      reviewSubmitted: Boolean(questionBank.deanReview),
      reviewSummary: questionBank.deanReview ? {
        regularPaper: questionBank.deanReview.regularPaper,
        supplementaryPaper: questionBank.deanReview.supplementaryPaper,
        ktPaper: questionBank.deanReview.ktPaper,
      } : null,
      qualityScore: avgQuality != null ? Math.round(avgQuality * 10) / 10 : null,
      coverageScore: avgCoverage != null ? Math.round(avgCoverage * 10) / 10 : null,
      aiSummary: aiReport?.summary ?? null,
      reviewedAt: questionBank.deanReview?.reviewedAt.toISOString() ?? null,
      daysWaiting,
    };
  }

  private async ensureDeanNotifications(authContext: AuthContext) {
    const questionBanks = await this.listDeanQuestionBanks(authContext);
    const readyNotifications = questionBanks
      .filter((questionBank) => !questionBank.deanReview)
      .map((questionBank) => {
        const generationTimestamp = getGenerationDate(questionBank.generatedPapers);
        const ageInDays = generationTimestamp ? Math.floor((Date.now() - generationTimestamp.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const readyActionUrl = `/dashboard/dean/review?bank=${questionBank.id}`;
        const notificationsToCreate: Array<Promise<unknown>> = [];

        notificationsToCreate.push(
          prisma.notification.upsert({
            where: { id: `dean-ready-${questionBank.id}-${authContext.user.id}` },
            update: {},
            create: {
              id: `dean-ready-${questionBank.id}-${authContext.user.id}`,
              recipientId: authContext.user.id,
              title: "Papers ready for review",
              message: `Papers for ${questionBank.subject.subjectName} are ready for your review.`,
              actionUrl: readyActionUrl,
              type: NotificationType.ACTION_REQUIRED,
            },
          }),
        );

        if (ageInDays >= DEAN_REVIEW_REMINDER_DAYS) {
          notificationsToCreate.push(
            prisma.notification.upsert({
              where: { id: `dean-reminder-${questionBank.id}-${authContext.user.id}-${DEAN_REVIEW_REMINDER_DAYS}` },
              update: {},
              create: {
                id: `dean-reminder-${questionBank.id}-${authContext.user.id}-${DEAN_REVIEW_REMINDER_DAYS}`,
                recipientId: authContext.user.id,
                title: "Pending review reminder",
                message: `Reminder: ${questionBank.subject.subjectName} review has been pending for ${ageInDays} days.`,
                actionUrl: readyActionUrl,
                type: NotificationType.WARNING,
              },
            }),
          );
        }

        return notificationsToCreate;
      })
      .flat();

    await Promise.all(readyNotifications);
  }
}

const deanDashboardInclude = {
  subject: true,
  batchSemester: { include: { academicYear: true, batch: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } },
  generatedPapers: {
    orderBy: [{ generatedAt: "desc" as const }, { createdAt: "desc" as const }],
  },
  deanReview: {
    include: {
      reviewedBy: true,
    },
  },
  aiReports: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.QuestionBankInclude;

const deanWorkspaceInclude = {
  subject: true,
  batchSemester: { include: { academicYear: true, batch: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } },
  aiReports: { orderBy: { createdAt: "desc" as const }, take: 1 },
  generatedPapers: {
    orderBy: { variant: "asc" as const },
    include: {
      items: {
        include: { question: true },
      },
    },
  },
  deanReview: {
    include: {
      reviewedBy: true,
    },
  },
} satisfies Prisma.QuestionBankInclude;

function getGenerationDate(
  generatedPapers: Array<{
    generatedAt: Date | null;
    createdAt: Date;
  }>,
) {
  if (generatedPapers.length === 0) return null;
  return generatedPapers.reduce<Date | null>((latest, paper) => {
    const candidate = paper.generatedAt ?? paper.createdAt;
    if (!latest || candidate.getTime() > latest.getTime()) return candidate;
    return latest;
  }, null);
}

function getGenerationTimestamp(
  generatedPapers: Array<{
    generatedAt: Date | null;
    createdAt: Date;
  }>,
) {
  return getGenerationDate(generatedPapers)?.toISOString() ?? null;
}
