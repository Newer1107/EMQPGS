import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BackupStatus, ExportArtifactStatus, type Prisma } from "@prisma/client";
import { type Actor } from "@/lib/types";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { StorageService } from "@/lib/storage/storage-service";
import { ENTITY_TYPES } from "@/lib/constants";

const execFileAsync = promisify(execFile);


export class BackupService {
  constructor(
    private readonly storageService = new StorageService(),
  ) {}

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
      const password = decodeURIComponent(databaseUrl.password);
      const args = [
        `--host=${databaseUrl.hostname}`,
        `--port=${databaseUrl.port || "3306"}`,
        `--user=${decodeURIComponent(databaseUrl.username)}`,
        databaseUrl.pathname.replace("/", ""),
      ];

      const { stdout } = await execFileAsync("mysqldump", args, {
        maxBuffer: 50 * 1024 * 1024,
        env: { ...process.env, MYSQL_PWD: password },
      });

      const buffer = Buffer.from(stdout, "utf8");
      const asset = await this.storageService.uploadServerFile({
        bucket: "system-backups",
        fileName: `mysql-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
        mimeType: "application/sql",
        body: buffer,
        size: buffer.byteLength,
        uploadedById: actor?.id ?? null,
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

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
