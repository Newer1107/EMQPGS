import { Queue } from "bullmq";
import { env } from "@/lib/env";

export const queueNames = {
  aiAnalysis: "ai-analysis",
  pdfGeneration: "pdf-generation",
  paperGeneration: "paper-generation",
  exportGeneration: "export-generation",
  retentionCleanup: "retention-cleanup",
  systemBackup: "system-backup",
} as const;

const redisUrl = new URL(env.REDIS_URL);
const queueConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: redisUrl.pathname ? Number(redisUrl.pathname.replace("/", "") || 0) : 0,
};

export function getAiAnalysisQueue() {
  return new Queue(queueNames.aiAnalysis, { connection: queueConnection });
}

export function getPdfGenerationQueue() {
  return new Queue(queueNames.pdfGeneration, { connection: queueConnection });
}

export function getPaperGenerationQueue() {
  return new Queue(queueNames.paperGeneration, { connection: queueConnection });
}

export function getExportGenerationQueue() {
  return new Queue(queueNames.exportGeneration, { connection: queueConnection });
}

export function getRetentionCleanupQueue() {
  return new Queue(queueNames.retentionCleanup, { connection: queueConnection });
}

export function getSystemBackupQueue() {
  return new Queue(queueNames.systemBackup, { connection: queueConnection });
}

export { queueConnection };
