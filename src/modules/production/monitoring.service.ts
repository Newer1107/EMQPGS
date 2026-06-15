import { AiReportStatus, BackupStatus, ExportArtifactStatus, PaperGenerationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { StorageService } from "@/lib/storage/storage-service";

export class MonitoringService {
  constructor(
    private readonly storageService = new StorageService(),
  ) {}

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
}
