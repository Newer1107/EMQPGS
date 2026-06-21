-- AlterTable
ALTER TABLE `ResponsibilityAssignment` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedById` VARCHAR(191) NULL,
    ADD COLUMN `deletionReason` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ResponsibilityAssignment_deletedAt_idx` ON `ResponsibilityAssignment`(`deletedAt`);
