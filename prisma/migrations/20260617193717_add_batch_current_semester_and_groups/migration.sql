-- AlterTable
ALTER TABLE `Batch` ADD COLUMN `currentBatchSemesterId` VARCHAR(191) NULL,
    ADD COLUMN `currentSemesterNumber` INTEGER NULL,
    ADD COLUMN `hasTeachingGroups` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Batch_currentBatchSemesterId_idx` ON `Batch`(`currentBatchSemesterId`);

-- AddForeignKey
ALTER TABLE `Batch` ADD CONSTRAINT `Batch_currentBatchSemesterId_fkey` FOREIGN KEY (`currentBatchSemesterId`) REFERENCES `BatchSemester`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
