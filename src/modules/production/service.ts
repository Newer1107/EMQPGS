import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  BackupStatus,
  ExportArtifactStatus,
  ExportFormat,
  NotificationType,
  PaperGenerationStatus,
  Role,
  type Prisma,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  getAiAnalysisQueue,
  getExportGenerationQueue,
  getPaperGenerationQueue,
  getRetentionCleanupQueue,
  getSystemBackupQueue,
} from "@/lib/queue";
import { logAudit } from "@/lib/audit";
import { StorageService } from "@/lib/storage/storage-service";
import { NotificationService } from "@/modules/notifications/service";
import { DocumentService } from "@/modules/production/document-service";

const execFileAsync = promisify(execFile);

type Actor = Pick<User, "id" | "role" | "email" | "name">;

export type DeanReviewQueueItem = Prisma.QuestionBankGetPayload<{ include: typeof deanReviewInclude }>;
export type CoeOverviewItem = Prisma.QuestionBankGetPayload<{
  include: {
    subject: true;
    examCycle: true;
    aiReports: { orderBy: { createdAt: "desc" }; take: 1; include: { pdfFileAsset: true; jsonFileAsset: true } };
    generatedPapers: { orderBy: { variant: "asc" }; include: { paperFileAsset: true } };
    deanReview: {
      include: {
        selectedBy: true;
        regularPaper: true;
        supplementaryPaper: true;
        ktPaper: true;
      };
    };
    exportArtifacts: { orderBy: { createdAt: "desc" }; include: { fileAsset: true }; take: 5 };
  };
}>;

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
  regularPaperId: string;
  supplementaryPaperId: string;
  ktPaperId: string;
  notes?: string;
};

export class ProductionService {
  constructor(
    private readonly storageService = new StorageService(),
    private readonly notificationService = new NotificationService(),
    private readonly documentService = new DocumentService(),
  ) {}

  async listDeanReviewQueue(): Promise<DeanReviewQueueItem[]> {
    return prisma.questionBank.findMany({
      where: {
        status: "LOCKED",
        generatedPapers: {
          some: { status: PaperGenerationStatus.COMPLETED },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: deanReviewInclude,
    });
  }

  async getDeanReviewWorkspace(questionBankId: string): Promise<DeanReviewQueueItem> {
    const questionBank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: deanReviewInclude,
    });
    if (!questionBank) throw new NotFoundError("Question bank not found");
    return questionBank;
  }

  async submitDeanReview(questionBankId: string, payload: DeanReviewInput, actor: Actor) {
    if (actor.role !== Role.DEAN) throw new ForbiddenError("Only the dean can submit selections");
    const questionBank = await this.getDeanReviewWorkspace(questionBankId);

    const availableIds = new Set(questionBank.generatedPapers.map((paper) => paper.id));
    [payload.regularPaperId, payload.supplementaryPaperId, payload.ktPaperId].forEach((paperId) => {
      if (!availableIds.has(paperId)) throw new AppError("Selected paper does not belong to this question bank", 400);
    });

    const review = await prisma.deanReview.upsert({
      where: { questionBankId },
      update: {
        regularPaperId: payload.regularPaperId,
        supplementaryPaperId: payload.supplementaryPaperId,
        ktPaperId: payload.ktPaperId,
        notes: payload.notes ?? null,
        selectedById: actor.id,
        selectedAt: new Date(),
      },
      create: {
        questionBankId,
        regularPaperId: payload.regularPaperId,
        supplementaryPaperId: payload.supplementaryPaperId,
        ktPaperId: payload.ktPaperId,
        notes: payload.notes ?? null,
        selectedById: actor.id,
      },
      include: {
        regularPaper: true,
        supplementaryPaper: true,
        ktPaper: true,
        selectedBy: true,
      },
    });

    const coeUsers = await prisma.user.findMany({ where: { role: Role.COE } });
    await Promise.all(
      coeUsers.map((coe) =>
        this.notificationService.createAndEmail(
          coe,
          "Dean review completed",
          `Dean selections are ready for ${questionBank.subject.subjectCode}.`,
          "/dashboard/coe/production",
          NotificationType.ACTION_REQUIRED,
        ),
      ),
    );

    await logAudit({
      actorId: actor.id,
      action: "DEAN_SELECTION_SUBMITTED",
      entityType: "DEAN_REVIEW",
      entityId: review.id,
      metadata: {
        questionBankId,
        regularPaperId: payload.regularPaperId,
        supplementaryPaperId: payload.supplementaryPaperId,
        ktPaperId: payload.ktPaperId,
      },
    });

    return review;
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
            selectedBy: true,
            regularPaper: true,
            supplementaryPaper: true,
            ktPaper: true,
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

  async queueExport(input: ExportInput, actor: Actor) {
    if (actor.role !== Role.COE) throw new ForbiddenError("Only COE can create exports");
    const job = await getExportGenerationQueue().add("generate-export", { input, actor });
    await logAudit({
      actorId: actor.id,
      action: "EXPORT_JOB_QUEUED",
      entityType: "EXPORT_ARTIFACT",
      entityId: input.questionBankId,
      metadata: { format: input.format },
    });
    return { queued: true, jobId: job.id };
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

    const [redisInfo, minioOk, aiQueueCounts, paperQueueCounts, exportQueueCounts, cleanupQueueCounts, backupQueueCounts] = await Promise.all([
      getRedisHealth(),
      this.storageService.checkBucketHealth("exports").then(() => true).catch(() => false),
      getAiAnalysisQueue().getJobCounts(),
      getPaperGenerationQueue().getJobCounts(),
      getExportGenerationQueue().getJobCounts(),
      getRetentionCleanupQueue().getJobCounts(),
      getSystemBackupQueue().getJobCounts(),
    ]);

    const [userCount, bankCount, reportCount, exportCount, backupCount, bucketCounts] = await Promise.all([
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
        redis: redisInfo,
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
      queues: {
        aiAnalysis: aiQueueCounts,
        paperGeneration: paperQueueCounts,
        exportGeneration: exportQueueCounts,
        retentionCleanup: cleanupQueueCounts,
        systemBackup: backupQueueCounts,
      },
    };
  }

  async queueSystemBackup(actor?: Actor) {
    const job = await getSystemBackupQueue().add("run-system-backup", { actor });
    return { queued: true, jobId: job.id };
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

const deanReviewInclude = {
  subject: true,
  examCycle: true,
  aiReports: { orderBy: { createdAt: "desc" }, take: 1 },
  generatedPapers: {
    orderBy: { variant: "asc" as const },
    include: {
      paperFileAsset: true,
      items: {
        include: { question: true },
      },
    },
  },
  deanReview: {
    include: {
      selectedBy: true,
      regularPaper: true,
      supplementaryPaper: true,
      ktPaper: true,
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
    include: {
      regularPaper: { include: { items: { include: { question: true } } } },
      supplementaryPaper: { include: { items: { include: { question: true } } } },
      ktPaper: { include: { items: { include: { question: true } } } },
    },
  },
} satisfies Prisma.QuestionBankInclude;

function buildSelectedPapers(questionBank: Prisma.QuestionBankGetPayload<{ include: typeof exportQuestionBankInclude }>, input: ExportInput) {
  const institutionName = input.institutionName ?? env.INSTITUTION_NAME;
  const deanReview = questionBank.deanReview;
  if (!deanReview) throw new AppError("Dean review not found", 409);

  return [
    { label: "Regular Exam Paper", paper: deanReview.regularPaper },
    { label: "Supplementary Paper", paper: deanReview.supplementaryPaper },
    { label: "KT Paper", paper: deanReview.ktPaper },
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

async function getRedisHealth() {
  try {
    const { redis } = await import("@/lib/redis");
    await redis.connect().catch(() => undefined);
    const pong = await redis.ping();
    return { ok: pong === "PONG" };
  } catch {
    return { ok: false };
  }
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
