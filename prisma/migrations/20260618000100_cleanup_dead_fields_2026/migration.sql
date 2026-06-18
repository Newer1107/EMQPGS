-- Cleanup dead runtime fields and add ContributorBankAssignment

-- Drop DeanReview.status column (ReviewStatus enum removed)
ALTER TABLE `DeanReview` DROP COLUMN `status`;

-- Drop unused metadata fields
ALTER TABLE `PaperSnapshot` DROP COLUMN `metadata`;
ALTER TABLE `QuestionBankSnapshot` DROP COLUMN `metadata`;
ALTER TABLE `QuestionBankSnapshot` DROP COLUMN `paperAssignments`;

-- Remove ARCHIVED from RecordStatus enum
ALTER TABLE `QuestionBank` MODIFY `recordStatus` ENUM('ACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE `QuestionBankSnapshot` MODIFY `status` ENUM('ACTIVE', 'LOCKED') NOT NULL;

-- Remove APPROVED and EXPORTED from SnapshotType enum
ALTER TABLE `QuestionBankSnapshot` MODIFY `snapshotType` ENUM('LOCKED') NOT NULL;

-- Create ContributorBankAssignment table
CREATE TABLE `ContributorBankAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `contributorId` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ContributorBankAssignment_contributorId_questionBankId_key`(`contributorId`, `questionBankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ContributorBankAssignment` ADD CONSTRAINT `ContributorBankAssignment_contributorId_fkey` FOREIGN KEY (`contributorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ContributorBankAssignment` ADD CONSTRAINT `ContributorBankAssignment_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
