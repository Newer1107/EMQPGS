-- AlterTable
ALTER TABLE `QuestionBank`
ADD COLUMN `signedReportAssetId` VARCHAR(191) NULL,
ADD COLUMN `signedReportUploadedAt` DATETIME(3) NULL,
ADD COLUMN `coordinatorDecision` ENUM('APPROVED', 'REJECTED') NULL,
ADD COLUMN `coordinatorReviewedAt` DATETIME(3) NULL,
ADD COLUMN `coordinatorReviewRemark` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Question`
ADD COLUMN `usageCount` INTEGER NOT NULL DEFAULT 0,
ADD COLUMN `lastUsedExam` VARCHAR(191) NULL,
ADD COLUMN `lastUsedYear` VARCHAR(191) NULL,
ADD COLUMN `lastUsedSemester` INTEGER NULL,
ADD COLUMN `lastUsedType` ENUM('ISE_1', 'ISE_2', 'ENDSEM', 'SUPPLEMENTARY', 'KT') NULL;

-- CreateTable
CREATE TABLE `AiReport` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `modelName` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `reportJson` JSON NULL,
    `chartData` JSON NULL,
    `failureReason` VARCHAR(191) NULL,
    `generatedById` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NULL,
    `jsonFileAssetId` VARCHAR(191) NULL,
    `pdfFileAssetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiReport_questionBankId_status_idx`(`questionBankId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedPaper` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `variant` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `generatedById` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `paperJson` JSON NULL,
    `paperFileAssetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GeneratedPaper_questionBankId_variant_key`(`questionBankId`, `variant`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedPaperItem` (
    `id` VARCHAR(191) NOT NULL,
    `generatedPaperId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GeneratedPaperItem_generatedPaperId_questionId_key`(`generatedPaperId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuestionBank` ADD CONSTRAINT `QuestionBank_signedReportAssetId_fkey` FOREIGN KEY (`signedReportAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiReport` ADD CONSTRAINT `AiReport_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AiReport` ADD CONSTRAINT `AiReport_jsonFileAssetId_fkey` FOREIGN KEY (`jsonFileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AiReport` ADD CONSTRAINT `AiReport_pdfFileAssetId_fkey` FOREIGN KEY (`pdfFileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedPaper` ADD CONSTRAINT `GeneratedPaper_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `GeneratedPaper` ADD CONSTRAINT `GeneratedPaper_paperFileAssetId_fkey` FOREIGN KEY (`paperFileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedPaperItem` ADD CONSTRAINT `GeneratedPaperItem_generatedPaperId_fkey` FOREIGN KEY (`generatedPaperId`) REFERENCES `GeneratedPaper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `GeneratedPaperItem` ADD CONSTRAINT `GeneratedPaperItem_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
