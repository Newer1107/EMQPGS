-- AlterTable
ALTER TABLE `AuditLog`
ADD COLUMN `previousHash` VARCHAR(191) NULL,
ADD COLUMN `integrityHash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `GeneratedPaper`
ADD COLUMN `coverageScore` DOUBLE NULL,
ADD COLUMN `difficultyScore` DOUBLE NULL,
ADD COLUMN `qualityScore` DOUBLE NULL,
ADD COLUMN `duplicateRisk` DOUBLE NULL,
ADD COLUMN `recommendation` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `DeanReview` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `regularPaperId` VARCHAR(191) NOT NULL,
    `supplementaryPaperId` VARCHAR(191) NOT NULL,
    `ktPaperId` VARCHAR(191) NOT NULL,
    `selectedById` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `selectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeanReview_questionBankId_key`(`questionBankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExportArtifact` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `generatedById` VARCHAR(191) NULL,
    `format` ENUM('PDF', 'DOCX', 'ZIP') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `fileAssetId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExportArtifact_questionBankId_format_status_idx`(`questionBankId`, `format`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemBackup` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `fileAssetId` VARCHAR(191) NULL,
    `triggeredById` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `failureReason` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_regularPaperId_fkey` FOREIGN KEY (`regularPaperId`) REFERENCES `GeneratedPaper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_supplementaryPaperId_fkey` FOREIGN KEY (`supplementaryPaperId`) REFERENCES `GeneratedPaper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_ktPaperId_fkey` FOREIGN KEY (`ktPaperId`) REFERENCES `GeneratedPaper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_selectedById_fkey` FOREIGN KEY (`selectedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportArtifact` ADD CONSTRAINT `ExportArtifact_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ExportArtifact` ADD CONSTRAINT `ExportArtifact_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ExportArtifact` ADD CONSTRAINT `ExportArtifact_fileAssetId_fkey` FOREIGN KEY (`fileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemBackup` ADD CONSTRAINT `SystemBackup_fileAssetId_fkey` FOREIGN KEY (`fileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SystemBackup` ADD CONSTRAINT `SystemBackup_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
