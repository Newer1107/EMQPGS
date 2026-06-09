import { Worker } from "bullmq";
import { getRetentionCleanupQueue, getSystemBackupQueue, queueConnection, queueNames } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { ProductionService } from "@/modules/production/service";

const productionService = new ProductionService();

export function createExportGenerationWorker() {
  return new Worker(
    queueNames.exportGeneration,
    async (job) => {
      const { input, actor } = job.data as {
        input: {
          questionBankId: string;
          format: "PDF" | "DOCX" | "ZIP";
          examDate: string;
          duration: string;
          maximumMarks: number;
          instructions: string[];
          institutionName?: string;
        };
        actor: { id: string; role: "COE"; email: string; name: string };
      };
      return productionService.createExport(input, actor);
    },
    { connection: queueConnection },
  );
}

export function createRetentionCleanupWorker() {
  return new Worker(
    queueNames.retentionCleanup,
    async () => productionService.cleanupExpiredArtifacts(),
    { connection: queueConnection },
  );
}

export function createSystemBackupWorker() {
  return new Worker(
    queueNames.systemBackup,
    async (job) => {
      const { actor } = job.data as { actor?: { id: string; role: "COE"; email: string; name: string } };
      return productionService.runSystemBackup(actor);
    },
    { connection: queueConnection },
  );
}

export async function registerMaintenanceJobs() {
  await getRetentionCleanupQueue().add(
    "cleanup-expired-artifacts",
    {},
    {
      repeat: { pattern: "0 2 * * *" },
      jobId: "cleanup-expired-artifacts-daily",
    },
  );

  await getSystemBackupQueue().add(
    "nightly-mysql-backup",
    {},
    {
      repeat: { pattern: "0 1 * * *" },
      jobId: "nightly-mysql-backup",
    },
  );

  logger.info("Maintenance jobs registered");
}
