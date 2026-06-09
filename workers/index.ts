import { createAiAnalysisWorker, createPaperGenerationWorker, createPdfGenerationWorker } from "@/modules/reports/jobs";
import { createExportGenerationWorker, createRetentionCleanupWorker, createSystemBackupWorker, registerMaintenanceJobs } from "@/modules/production/jobs";

createAiAnalysisWorker();
createPdfGenerationWorker();
createPaperGenerationWorker();
createExportGenerationWorker();
createRetentionCleanupWorker();
createSystemBackupWorker();
void registerMaintenanceJobs();

console.info("EMQPGS workers started");
