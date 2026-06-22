-- DropIndex
DROP INDEX `AuditLog_securityEventId_idx` ON `AuditLog`;

-- AlterTable
ALTER TABLE `AiReport` ADD COLUMN `paperAnalysisId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `QuestionBankAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('INITIALIZED', 'EXTRACTING', 'COMPUTING', 'AI_PENDING', 'AI_COMPLETE', 'COMPLETE', 'FAILED') NOT NULL DEFAULT 'INITIALIZED',
    `triggeredById` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `evaluationEngineVersion` VARCHAR(191) NULL,
    `analysisSchemaVersion` VARCHAR(191) NULL,
    `ollamaModel` VARCHAR(191) NULL,
    `ollamaContext` INTEGER NULL,
    `ollamaTemperature` DOUBLE NULL,
    `qpqi` DOUBLE NULL,
    `qpqiClassification` ENUM('EXEMPLARY', 'HIGHLY_EFFECTIVE', 'EFFECTIVE', 'ACCEPTABLE', 'NEEDS_IMPROVEMENT', 'MAJOR_REVISION_REQUIRED') NULL,
    `oci` DOUBLE NULL,
    `ociClassification` ENUM('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW') NULL,
    `finalVerdict` ENUM('APPROVED_WITHOUT_MODIFICATION', 'APPROVED_WITH_MINOR_IMPROVEMENTS', 'APPROVED_SUBJECT_TO_REVISION', 'MAJOR_REVISION_REQUIRED', 'NOT_APPROVED') NULL,
    `executiveSummary` TEXT NULL,
    `accreditationReadiness` JSON NULL,
    `failureReason` VARCHAR(191) NULL,
    `errorDetails` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuestionBankAnalysis_questionBankId_status_idx`(`questionBankId`, `status`),
    INDEX `QuestionBankAnalysis_questionBankId_createdAt_idx`(`questionBankId`, `createdAt`),
    UNIQUE INDEX `QuestionBankAnalysis_questionBankId_version_key`(`questionBankId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisVersion` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankAnalysisId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `evaluationEngineVersion` VARCHAR(191) NOT NULL,
    `promptVersionString` VARCHAR(191) NULL,
    `analysisSchemaVersion` VARCHAR(191) NOT NULL,
    `ollamaModel` VARCHAR(191) NULL,
    `ollamaContext` INTEGER NULL,
    `ollamaTemperature` DOUBLE NULL,
    `evidenceHash` VARCHAR(191) NULL,
    `promptVersionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisVersion_questionBankAnalysisId_versionNumber_idx`(`questionBankAnalysisId`, `versionNumber`),
    INDEX `AnalysisVersion_evidenceHash_idx`(`evidenceHash`),
    UNIQUE INDEX `AnalysisVersion_questionBankAnalysisId_versionNumber_key`(`questionBankAnalysisId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvidenceSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `analysisVersionId` VARCHAR(191) NOT NULL,
    `totalQuestions` INTEGER NOT NULL,
    `verifiedQuestions` INTEGER NOT NULL,
    `unableToVerifyQuestions` INTEGER NOT NULL,
    `missingDataQuestions` INTEGER NOT NULL,
    `extractionCompletenessScore` DOUBLE NULL,
    `extractionQualityIndex` DOUBLE NULL,
    `evidenceSummary` JSON NULL,
    `sourceDataSnapshot` JSON NULL,
    `evidenceHash` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EvidenceSnapshot_analysisVersionId_key`(`analysisVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `analysisVersionId` VARCHAR(191) NOT NULL,
    `fullReport` JSON NULL,
    `strengths` JSON NULL,
    `weaknesses` JSON NULL,
    `recommendationsJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AnalysisSnapshot_analysisVersionId_key`(`analysisVersionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaperAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankAnalysisId` VARCHAR(191) NOT NULL,
    `generatedPaperId` VARCHAR(191) NOT NULL,
    `indexValues` JSON NULL,
    `aiNarrative` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaperAnalysis_questionBankAnalysisId_idx`(`questionBankAnalysisId`),
    INDEX `PaperAnalysis_generatedPaperId_idx`(`generatedPaperId`),
    UNIQUE INDEX `PaperAnalysis_questionBankAnalysisId_generatedPaperId_key`(`questionBankAnalysisId`, `generatedPaperId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UAFMetric` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankAnalysisId` VARCHAR(191) NOT NULL,
    `indexCode` ENUM('SCI', 'MII', 'BDI', 'CVI', 'MCAI', 'DBI', 'QCQI', 'CAI', 'AMI', 'FRI', 'QPQI', 'OCI', 'ECS', 'EQI', 'COA', 'POA', 'PIA', 'RBTA', 'DA', 'MAA', 'QTA', 'MC', 'MCS', 'LOTS', 'HOTS', 'CBR') NOT NULL,
    `value` DOUBLE NULL,
    `classification` ENUM('EXEMPLARY', 'HIGHLY_EFFECTIVE', 'EFFECTIVE', 'ACCEPTABLE', 'NEEDS_IMPROVEMENT', 'MAJOR_REVISION_REQUIRED') NULL,
    `weight` DOUBLE NULL,
    `weightedScore` DOUBLE NULL,
    `formulaUsed` VARCHAR(191) NULL,
    `computationOrder` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UAFMetric_questionBankAnalysisId_indexCode_idx`(`questionBankAnalysisId`, `indexCode`),
    INDEX `UAFMetric_indexCode_value_idx`(`indexCode`, `value`),
    UNIQUE INDEX `UAFMetric_questionBankAnalysisId_indexCode_key`(`questionBankAnalysisId`, `indexCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConfidenceScore` (
    `id` VARCHAR(191) NOT NULL,
    `uafMetricId` VARCHAR(191) NOT NULL,
    `verifiedItems` INTEGER NOT NULL,
    `requiredItems` INTEGER NOT NULL,
    `score` DOUBLE NOT NULL,
    `percentage` DOUBLE NOT NULL,
    `classification` ENUM('VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW') NOT NULL,
    `justification` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ConfidenceScore_uafMetricId_key`(`uafMetricId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Risk` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankAnalysisId` VARCHAR(191) NOT NULL,
    `finding` TEXT NOT NULL,
    `educationalRisk` TEXT NULL,
    `institutionalRisk` TEXT NULL,
    `priority` ENUM('CRITICAL', 'MAJOR', 'MODERATE', 'MINOR') NOT NULL,
    `riskType` ENUM('EDUCATIONAL', 'INSTITUTIONAL', 'ASSESSMENT', 'ACCREDITATION') NULL,
    `affectedModules` JSON NULL,
    `affectedCOs` JSON NULL,
    `evidenceReference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Risk_questionBankAnalysisId_priority_idx`(`questionBankAnalysisId`, `priority`),
    INDEX `Risk_questionBankAnalysisId_riskType_idx`(`questionBankAnalysisId`, `riskType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Recommendation` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankAnalysisId` VARCHAR(191) NOT NULL,
    `finding` TEXT NOT NULL,
    `recommendation` TEXT NOT NULL,
    `priority` ENUM('CRITICAL', 'MAJOR', 'MODERATE', 'MINOR') NOT NULL,
    `impact` TEXT NULL,
    `suggestedActions` JSON NULL,
    `evidenceReference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Recommendation_questionBankAnalysisId_priority_idx`(`questionBankAnalysisId`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisEvidence` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankAnalysisId` VARCHAR(191) NOT NULL,
    `evidenceType` ENUM('DIRECT', 'METADATA', 'CALCULATED', 'PROFESSIONAL_JUDGEMENT', 'UNSUPPORTED') NOT NULL,
    `level` INTEGER NOT NULL,
    `category` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `sourceReference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalysisEvidence_questionBankAnalysisId_evidenceType_idx`(`questionBankAnalysisId`, `evidenceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromptVersion` (
    `id` VARCHAR(191) NOT NULL,
    `moduleId` ENUM('EXECUTIVE_SUMMARY', 'BLOOM_ANALYSIS', 'DIFFICULTY_ANALYSIS', 'CO_COVERAGE', 'MODULE_COVERAGE', 'CONCEPT_DIVERSITY', 'RISK_ANALYSIS', 'RECOMMENDATIONS', 'ACADEMIC_QUALITY', 'FINAL_VERDICT', 'SYSTEM_PREAMBLE') NOT NULL,
    `version` INTEGER NOT NULL,
    `promptText` TEXT NOT NULL,
    `outputSchema` JSON NULL,
    `contextBudget` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supersededAt` DATETIME(3) NULL,

    INDEX `PromptVersion_moduleId_supersededAt_idx`(`moduleId`, `supersededAt`),
    UNIQUE INDEX `PromptVersion_moduleId_version_key`(`moduleId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PaperDownload_downloadId_idx` ON `PaperDownload`(`downloadId`);

-- AddForeignKey
ALTER TABLE `AiReport` ADD CONSTRAINT `AiReport_paperAnalysisId_fkey` FOREIGN KEY (`paperAnalysisId`) REFERENCES `PaperAnalysis`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBankAnalysis` ADD CONSTRAINT `QuestionBankAnalysis_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBankAnalysis` ADD CONSTRAINT `QuestionBankAnalysis_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisVersion` ADD CONSTRAINT `AnalysisVersion_questionBankAnalysisId_fkey` FOREIGN KEY (`questionBankAnalysisId`) REFERENCES `QuestionBankAnalysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisVersion` ADD CONSTRAINT `AnalysisVersion_promptVersionId_fkey` FOREIGN KEY (`promptVersionId`) REFERENCES `PromptVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceSnapshot` ADD CONSTRAINT `EvidenceSnapshot_analysisVersionId_fkey` FOREIGN KEY (`analysisVersionId`) REFERENCES `AnalysisVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisSnapshot` ADD CONSTRAINT `AnalysisSnapshot_analysisVersionId_fkey` FOREIGN KEY (`analysisVersionId`) REFERENCES `AnalysisVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperAnalysis` ADD CONSTRAINT `PaperAnalysis_questionBankAnalysisId_fkey` FOREIGN KEY (`questionBankAnalysisId`) REFERENCES `QuestionBankAnalysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperAnalysis` ADD CONSTRAINT `PaperAnalysis_generatedPaperId_fkey` FOREIGN KEY (`generatedPaperId`) REFERENCES `GeneratedPaper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UAFMetric` ADD CONSTRAINT `UAFMetric_questionBankAnalysisId_fkey` FOREIGN KEY (`questionBankAnalysisId`) REFERENCES `QuestionBankAnalysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConfidenceScore` ADD CONSTRAINT `ConfidenceScore_uafMetricId_fkey` FOREIGN KEY (`uafMetricId`) REFERENCES `UAFMetric`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Risk` ADD CONSTRAINT `Risk_questionBankAnalysisId_fkey` FOREIGN KEY (`questionBankAnalysisId`) REFERENCES `QuestionBankAnalysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recommendation` ADD CONSTRAINT `Recommendation_questionBankAnalysisId_fkey` FOREIGN KEY (`questionBankAnalysisId`) REFERENCES `QuestionBankAnalysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisEvidence` ADD CONSTRAINT `AnalysisEvidence_questionBankAnalysisId_fkey` FOREIGN KEY (`questionBankAnalysisId`) REFERENCES `QuestionBankAnalysis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
