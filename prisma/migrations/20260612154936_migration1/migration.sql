-- AlterTable
ALTER TABLE `AiReport` MODIFY `summary` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `DeanReview` MODIFY `notes` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Question` MODIFY `questionText` VARCHAR(191) NOT NULL;
