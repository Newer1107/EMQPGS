import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  BackupStatus,
  ExportArtifactStatus,
  ExportFormat,
  NotificationType,
  PaperVariant,
  PaperGenerationStatus,
  Role,
  AiReportStatus,
  type Prisma,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { DocumentService } from "@/modules/production/document-service";

const execFileAsync = promisify(execFile);
const DEAN_REVIEW_REMINDER_DAYS = Number(process.env.DEAN_REVIEW_REMINDER_DAYS ?? "3");

type Actor = Pick<User, "id" | "role" | "email" | "name" | "departmentId">;

export type CoeOverviewItem = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: true;
    aiReports: { orderBy: { createdAt: "desc" }; take: 1; include: { pdfFileAsset: true; jsonFileAsset: true } };
    generatedPapers: { orderBy: { variant: "asc" }; include: { paperFileAsset: true } };
    deanReview: {
      include: {
        reviewedBy: true;
      };
    };
    exportArtifacts: { orderBy: { createdAt: "desc" }; include: { fileAsset: true }; take: 5 };
  };
}>;

type DeanDashboardQuestionBank = Prisma.QuestionBankGetPayload<{ include: typeof deanDashboardInclude }>;
type DeanWorkspaceQuestionBank = Prisma.QuestionBankGetPayload<{ include: typeof deanWorkspaceInclude }>;

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
};

export type DeanDashboardData = {
  pendingReviews: DeanDashboardItem[];
  completedReviews: DeanDashboardItem[];
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

type ExportInput = {
  questionBankId: string;
  format: ExportFormat;
  examDate: string;
  duration: string;
  maximumMarks: number;
  instructions: string[];
  institutionName?: string;
};

type DeanReviewInput = {
  regularPaper: PaperVariant;
  supplementaryPaper: PaperVariant;
  ktPaper: PaperVariant;
};

export class ProductionService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
    private readonly documentService = new DocumentService(),
  ) {}

  async getDeanDashboardData(actor: Actor): Promise<DeanDashboardData> {
    this.assertDean(actor);
    await this.ensureDeanNotifications(actor);

    const [questionBanks, notifications, unreadNotificationCount] = await Promise.all([
      this.listDeanQuestionBanks(actor),
      this.notificationService.listForUser(actor.id, 25),
      this.notificationService.unreadCount(actor.id),
    ]);

    const items = questionBanks.map((questionBank) => this.mapDeanDashboardItem(questionBank));

    return {
      pendingReviews: items.filter((item) => !item.reviewSubmitted),
      completedReviews: items.filter((item) => item.reviewSubmitted),
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

  async getDeanReviewWorkspace(questionBankId: string, actor: Actor): Promise<DeanReviewWorkspace> {
    this.assertDean(actor);
    const questionBank = await this.findDeanQuestionBank(questionBankId, actor);
    await this.notificationService.markByActionUrlAsRead(actor.id, `/dashboard/dean/review?bank=${questionBankId}`);

    return {
      bankId: questionBank.id,
      subjectName: questionBank.subject.subjectName,
      subjectCode: questionBank.subject.subjectCode,
      examCycleLabel: formatExamCycleLabel(questionBank.examCycle.academicYear, questionBank.examCycle.semester, questionBank.examCycle.examType),
      generationTimestamp: getGenerationTimestamp(questionBank.generatedPapers),
      papers: questionBank.generatedPapers.map((paper) => ({
        paperId: paper.variant,
        paperLabel: paper.variant,
        coverageScore: paper.coverageScore ?? null,
        difficultyScore: paper.difficultyScore ?? null,
        qualityScore: paper.qualityScore ?? null,
        duplicateRisk: paper.duplicateRisk ?? null,
        aiRecommendation: paper.recommendation ?? questionBank.aiReports[0]?.summary ?? "No AI recommendation available.",
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
      })),
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

  async submitDeanReview(questionBankId: string, payload: DeanReviewInput, actor: Actor) {
    this.assertDean(actor);
    const questionBank = await this.findDeanQuestionBank(questionBankId, actor);

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
        reviewedById: actor.id,
      },
      include: {
        reviewedBy: true,
      },
    });

    const coeUsers = await prisma.user.findMany({
      where: {
        role: Role.COE,
        departmentId: actor.departmentId ?? undefined,
      },
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
      this.notificationService.create(
        actor.id,
        "Selection confirmed",
        `Your selection for ${questionBank.subject.subjectName} has been submitted successfully.`,
        `/dashboard/dean/review?bank=${questionBankId}`,
        NotificationType.SUCCESS,
      ),
      this.notificationService.markByActionUrlAsRead(actor.id, `/dashboard/dean/review?bank=${questionBankId}`),
    ]);

    await logAudit({
      actorId: actor.id,
      action: "DEAN_SELECTION_SUBMITTED",
      entityType: "DEAN_REVIEW",
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

  private assertDean(actor: Actor) {
    if (actor.role !== Role.DEAN) {
      throw new ForbiddenError("Only the dean can access this resource.");
    }
    if (!actor.departmentId) {
      throw new ForbiddenError("Dean account is not associated with an institution.");
    }
  }

  private async listDeanQuestionBanks(actor: Actor) {
    return prisma.questionBank.findMany({
      where: {
        status: "LOCKED",
        subject: { departmentId: actor.departmentId! },
        generatedPapers: {
          some: { status: PaperGenerationStatus.COMPLETED },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: deanDashboardInclude,
    });
  }

  private async findDeanQuestionBank(questionBankId: string, actor: Actor): Promise<DeanWorkspaceQuestionBank> {
    const questionBank = await prisma.questionBank.findFirst({
      where: {
        id: questionBankId,
        status: "LOCKED",
        subject: { departmentId: actor.departmentId! },
        generatedPapers: {
          some: { status: PaperGenerationStatus.COMPLETED },
        },
      },
      include: deanWorkspaceInclude,
    });

    if (!questionBank) {
      throw new ForbiddenError("You do not have access to this question bank.");
    }

    return questionBank;
  }

  private mapDeanDashboardItem(questionBank: DeanDashboardQuestionBank): DeanDashboardItem {
    return {
      id: questionBank.id,
      subjectName: questionBank.subject.subjectName,
      subjectCode: questionBank.subject.subjectCode,
      examCycleLabel: formatExamCycleLabel(questionBank.examCycle.academicYear, questionBank.examCycle.semester, questionBank.examCycle.examType),
      generationTimestamp: getGenerationTimestamp(questionBank.generatedPapers),
      reviewSubmitted: Boolean(questionBank.deanReview),
      reviewSummary: questionBank.deanReview ? {
        regularPaper: questionBank.deanReview.regularPaper,
        supplementaryPaper: questionBank.deanReview.supplementaryPaper,
        ktPaper: questionBank.deanReview.ktPaper,
      } : null,
    };
  }

  private async ensureDeanNotifications(actor: Actor) {
    const questionBanks = await this.listDeanQuestionBanks(actor);
    const readyNotifications = questionBanks
      .filter((questionBank) => !questionBank.deanReview)
      .map((questionBank) => {
        const generationTimestamp = getGenerationDate(questionBank.generatedPapers);
        const ageInDays = generationTimestamp ? Math.floor((Date.now() - generationTimestamp.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const readyActionUrl = `/dashboard/dean/review?bank=${questionBank.id}`;
        const notificationsToCreate: Array<Promise<unknown>> = [];

        notificationsToCreate.push(
          prisma.notification.upsert({
            where: { id: `dean-ready-${questionBank.id}-${actor.id}` },
            update: {},
            create: {
              id: `dean-ready-${questionBank.id}-${actor.id}`,
              recipientId: actor.id,
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
              where: { id: `dean-reminder-${questionBank.id}-${actor.id}-${DEAN_REVIEW_REMINDER_DAYS}` },
              update: {},
              create: {
                id: `dean-reminder-${questionBank.id}-${actor.id}-${DEAN_REVIEW_REMINDER_DAYS}`,
                recipientId: actor.id,
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

  async listCoeOverview(): Promise<CoeOverviewItem[]> {
    return prisma.questionBank.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        subject: true,
        examCycle: true,
        aiReports: { orderBy: { createdAt: "desc" }, take: 1, include: { pdfFileAsset: true, jsonFileAsset: true } },
        generatedPapers: { orderBy: { variant: "asc" }, include: { paperFileAsset: true } },
        deanReview: {
          include: {
            reviewedBy: true,
          },
        },
        exportArtifacts: { orderBy: { createdAt: "desc" }, include: { fileAsset: true }, take: 5 },
      },
    });
  }

  async listExportArtifacts(questionBankId?: string) {
    return prisma.exportArtifact.findMany({
      where: questionBankId ? { questionBankId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        fileAsset: true,
        questionBank: { include: { subject: true, examCycle: true } },
      },
    });
  }

  async createExport(input: ExportInput, actor: Actor) {
    if (actor.role !== Role.COE) throw new ForbiddenError("Only COE can create exports");
    const questionBank = await prisma.questionBank.findUnique({
      where: { id: input.questionBankId },
      include: exportQuestionBankInclude,
    });
    if (!questionBank) throw new NotFoundError("Question bank not found");
    if (!questionBank.deanReview) throw new AppError("Dean selections are required before export", 409);

    const artifact = await prisma.exportArtifact.create({
      data: {
        questionBankId: questionBank.id,
        generatedById: actor.id,
        format: input.format,
        status: ExportArtifactStatus.PENDING,
        metadata: {
          examDate: input.examDate,
          duration: input.duration,
          maximumMarks: input.maximumMarks,
          instructions: input.instructions,
          institutionName: input.institutionName ?? env.INSTITUTION_NAME,
        } as Prisma.InputJsonValue,
        expiresAt: addDays(env.EXPORT_RETENTION_DAYS),
      },
    });

    try {
      const selectedPapers = buildSelectedPapers(questionBank, input);
      let buffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (input.format === ExportFormat.PDF) {
        buffer = Buffer.from(await this.documentService.createCombinedPdf(selectedPapers));
        fileName = `${questionBank.subject.subjectCode}-final-papers.pdf`;
        mimeType = "application/pdf";
      } else if (input.format === ExportFormat.DOCX) {
        buffer = await this.documentService.createCombinedDocx(selectedPapers);
        fileName = `${questionBank.subject.subjectCode}-final-papers.docx`;
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else {
        const pdfBuffer = Buffer.from(await this.documentService.createCombinedPdf(selectedPapers));
        const docxBuffer = await this.documentService.createCombinedDocx(selectedPapers);
        const manifest = Buffer.from(
          JSON.stringify(
            {
              subject: questionBank.subject.subjectCode,
              papers: selectedPapers.map((paper) => paper.label),
              generatedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
          "utf8",
        );
        buffer = await this.documentService.createZipBundle([
          { fileName: `${questionBank.subject.subjectCode}-final-papers.pdf`, content: pdfBuffer },
          { fileName: `${questionBank.subject.subjectCode}-final-papers.docx`, content: docxBuffer },
          { fileName: "manifest.json", content: manifest },
        ]);
        fileName = `${questionBank.subject.subjectCode}-final-papers.zip`;
        mimeType = "application/zip";
      }

      const asset = await this.storageService.uploadServerFile({
        bucket: "exports",
        fileName,
        mimeType,
        body: buffer,
        size: buffer.byteLength,
        uploadedById: actor.id,
        linkedEntityType: "EXPORT_ARTIFACT",
        linkedEntityId: artifact.id,
      });

      return prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: {
          status: ExportArtifactStatus.COMPLETED,
          fileAssetId: asset.id,
        },
        include: { fileAsset: true },
      });
    } catch (error) {
      await prisma.exportArtifact.update({
        where: { id: artifact.id },
        data: {
          status: ExportArtifactStatus.FAILED,
          metadata: {
            ...(artifact.metadata as object | null ?? {}),
            failure: error instanceof Error ? error.message : "Unknown export error",
          } as Prisma.InputJsonValue,
        },
      });
      throw error;
    }
  }

  async createExportDownloadLink(exportArtifactId: string, actor: Actor) {
    if (actor.role !== Role.COE) throw new ForbiddenError("Only COE can download export artifacts");
    const artifact = await prisma.exportArtifact.findUnique({
      where: { id: exportArtifactId },
      include: { fileAsset: true },
    });
    if (!artifact || !artifact.fileAsset) throw new NotFoundError("Export artifact not found");
    return this.storageService.createDownloadLinkForAsset(artifact.fileAsset);
  }

  async getObservabilityOverview() {
    const startedAt = Date.now();
    const dbHealthy = await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startedAt;

    const [minioOk, pendingAiReports, pendingPapers, pendingExports, pendingBackups, userCount, bankCount, reportCount, exportCount, backupCount, bucketCounts] = await Promise.all([
      this.storageService.checkBucketHealth("exports").then(() => true).catch(() => false),
      prisma.aiReport.count({ where: { status: { in: [AiReportStatus.PENDING, AiReportStatus.PROCESSING] } } }),
      prisma.generatedPaper.count({ where: { status: { in: [PaperGenerationStatus.PENDING, PaperGenerationStatus.PROCESSING] } } }),
      prisma.exportArtifact.count({ where: { status: ExportArtifactStatus.PENDING } }),
      prisma.systemBackup.count({ where: { status: BackupStatus.PENDING } }),
      prisma.user.count(),
      prisma.questionBank.count(),
      prisma.aiReport.count(),
      prisma.exportArtifact.count(),
      prisma.systemBackup.count(),
      prisma.fileAsset.groupBy({ by: ["bucket"], _count: { _all: true } }),
    ]);

    return {
      health: {
        database: { ok: !!dbHealthy, latencyMs: dbLatencyMs },
        minio: { ok: minioOk },
      },
      metrics: {
        users: userCount,
        questionBanks: bankCount,
        aiReports: reportCount,
        exports: exportCount,
        backups: backupCount,
        buckets: bucketCounts.map((bucket) => ({ bucket: bucket.bucket, count: bucket._count._all })),
      },
      workflows: {
        aiReportsInProgress: pendingAiReports,
        paperGenerationsInProgress: pendingPapers,
        exportsInProgress: pendingExports,
        backupsInProgress: pendingBackups,
      },
    };
  }

  async runSystemBackup(actor?: Actor) {
    const backup = await prisma.systemBackup.create({
      data: {
        status: BackupStatus.PENDING,
        triggeredById: actor?.id ?? null,
        expiresAt: addDays(env.BACKUP_RETENTION_DAYS),
      },
    });

    try {
      const databaseUrl = new URL(env.DATABASE_URL);
      const args = [
        `--host=${databaseUrl.hostname}`,
        `--port=${databaseUrl.port || "3306"}`,
        `--user=${decodeURIComponent(databaseUrl.username)}`,
        `--password=${decodeURIComponent(databaseUrl.password)}`,
        databaseUrl.pathname.replace("/", ""),
      ];

      const { stdout } = await execFileAsync("mysqldump", args, {
        maxBuffer: 50 * 1024 * 1024,
      });

      const buffer = Buffer.from(stdout, "utf8");
      const asset = await this.storageService.uploadServerFile({
        bucket: "system-backups",
        fileName: `mysql-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
        mimeType: "application/sql",
        body: buffer,
        size: buffer.byteLength,
        uploadedById: actor?.id ?? null,
        linkedEntityType: "SYSTEM_BACKUP",
        linkedEntityId: backup.id,
      });

      return prisma.systemBackup.update({
        where: { id: backup.id },
        data: {
          status: BackupStatus.COMPLETED,
          fileAssetId: asset.id,
          completedAt: new Date(),
          metadata: { bytes: buffer.byteLength } as Prisma.InputJsonValue,
        },
        include: { fileAsset: true },
      });
    } catch (error) {
      await prisma.systemBackup.update({
        where: { id: backup.id },
        data: {
          status: BackupStatus.FAILED,
          failureReason: error instanceof Error ? error.message.slice(0, 190) : "Backup failed",
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async cleanupExpiredArtifacts() {
    const now = new Date();
    const expiredExports = await prisma.exportArtifact.findMany({
      where: { expiresAt: { lt: now }, status: { not: ExportArtifactStatus.EXPIRED }, fileAssetId: { not: null } },
      include: { fileAsset: true },
    });
    const expiredBackups = await prisma.systemBackup.findMany({
      where: { expiresAt: { lt: now }, status: { not: BackupStatus.EXPIRED }, fileAssetId: { not: null } },
      include: { fileAsset: true },
    });

    for (const artifact of expiredExports) {
      if (artifact.fileAssetId) await this.storageService.deleteAsset(artifact.fileAssetId);
      await prisma.exportArtifact.update({ where: { id: artifact.id }, data: { status: ExportArtifactStatus.EXPIRED, fileAssetId: null } });
    }

    for (const backup of expiredBackups) {
      if (backup.fileAssetId) await this.storageService.deleteAsset(backup.fileAssetId);
      await prisma.systemBackup.update({ where: { id: backup.id }, data: { status: BackupStatus.EXPIRED, fileAssetId: null } });
    }

    return {
      expiredExports: expiredExports.length,
      expiredBackups: expiredBackups.length,
    };
  }
}

const deanDashboardInclude = {
  subject: true,
  examCycle: true,
  generatedPapers: {
    orderBy: [{ generatedAt: "desc" as const }, { createdAt: "desc" as const }],
  },
  deanReview: {
    include: {
      reviewedBy: true,
    },
  },
} satisfies Prisma.QuestionBankInclude;

const deanWorkspaceInclude = {
  subject: true,
  examCycle: true,
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

const exportQuestionBankInclude = {
  subject: true,
  examCycle: true,
  generatedPapers: {
    include: {
      items: {
        include: { question: true },
      },
    },
  },
  deanReview: {
    include: { reviewedBy: true },
  },
} satisfies Prisma.QuestionBankInclude;

function buildSelectedPapers(questionBank: Prisma.QuestionBankGetPayload<{ include: typeof exportQuestionBankInclude }>, input: ExportInput) {
  const institutionName = input.institutionName ?? env.INSTITUTION_NAME;
  const deanReview = questionBank.deanReview;
  if (!deanReview) throw new AppError("Dean review not found", 409);

  const papersByVariant = new Map(questionBank.generatedPapers.map((paper) => [paper.variant, paper]));
  const regularPaper = papersByVariant.get(deanReview.regularPaper);
  const supplementaryPaper = papersByVariant.get(deanReview.supplementaryPaper);
  const ktPaper = papersByVariant.get(deanReview.ktPaper);

  if (!regularPaper || !supplementaryPaper || !ktPaper) {
    throw new AppError("Dean review references unavailable generated papers", 409);
  }

  return [
    { label: "Regular Exam Paper", paper: regularPaper },
    { label: "Supplementary Paper", paper: supplementaryPaper },
    { label: "KT Paper", paper: ktPaper },
  ].map(({ label, paper }) => ({
    label,
    subjectName: questionBank.subject.subjectName,
    subjectCode: questionBank.subject.subjectCode,
    examType: questionBank.examCycle.examType,
    examDate: input.examDate,
    duration: input.duration,
    maximumMarks: input.maximumMarks,
    institutionName,
    instructions: input.instructions,
    questions: paper.items.map((item) => ({
      moduleNumber: item.question.moduleNumber,
      marks: item.question.marks,
      questionText: item.question.questionText,
      coMapping: item.question.coMapping,
      rbtLevel: item.question.rbtLevel,
    })),
  }));
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function formatExamCycleLabel(academicYear: string, semester: number, examType: string) {
  return `${academicYear} · Sem ${semester} · ${examType.replaceAll("_", " ")}`;
}

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
