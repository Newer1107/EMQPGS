/*
  Warnings:

  - You are about to drop the column `ktPaperId` on the `DeanReview` table. All the data in the column will be lost.
  - You are about to drop the column `regularPaperId` on the `DeanReview` table. All the data in the column will be lost.
  - You are about to drop the column `selectedAt` on the `DeanReview` table. All the data in the column will be lost.
  - You are about to drop the column `selectedById` on the `DeanReview` table. All the data in the column will be lost.
  - You are about to drop the column `supplementaryPaperId` on the `DeanReview` table. All the data in the column will be lost.
  - You are about to drop the column `linkedEntityId` on the `FileAsset` table. All the data in the column will be lost.
  - You are about to drop the column `linkedEntityType` on the `FileAsset` table. All the data in the column will be lost.
  - You are about to drop the column `academicYearId` on the `QuestionUsageHistory` table. All the data in the column will be lost.
  - You are about to drop the column `examType` on the `QuestionUsageHistory` table. All the data in the column will be lost.
  - You are about to drop the column `generatedPaperId` on the `QuestionUsageHistory` table. All the data in the column will be lost.
  - You are about to drop the column `generatedPaperItemId` on the `QuestionUsageHistory` table. All the data in the column will be lost.
  - You are about to drop the column `semesterId` on the `QuestionUsageHistory` table. All the data in the column will be lost.
  - Added the required column `ktPaper` to the `DeanReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `regularPaper` to the `DeanReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reviewedById` to the `DeanReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplementaryPaper` to the `DeanReview` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceId` to the `QuestionUsageHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceType` to the `QuestionUsageHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `DeanReview` DROP FOREIGN KEY `DeanReview_selectedById_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionUsageHistory` DROP FOREIGN KEY `QuestionUsageHistory_generatedPaperId_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionUsageHistory` DROP FOREIGN KEY `QuestionUsageHistory_generatedPaperItemId_fkey`;

-- DropIndex
DROP INDEX `DeanReview_selectedById_fkey` ON `DeanReview`;

-- DropIndex
DROP INDEX `QuestionUsageHistory_academicYearId_idx` ON `QuestionUsageHistory`;

-- DropIndex
DROP INDEX `QuestionUsageHistory_generatedPaperId_fkey` ON `QuestionUsageHistory`;

-- DropIndex
DROP INDEX `QuestionUsageHistory_generatedPaperItemId_fkey` ON `QuestionUsageHistory`;

-- AlterTable
ALTER TABLE `DeanReview` DROP COLUMN `ktPaperId`,
    DROP COLUMN `regularPaperId`,
    DROP COLUMN `selectedAt`,
    DROP COLUMN `selectedById`,
    DROP COLUMN `supplementaryPaperId`,
    ADD COLUMN `ktPaper` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    ADD COLUMN `regularPaper` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `reviewedById` VARCHAR(191) NOT NULL,
    ADD COLUMN `supplementaryPaper` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL;

-- AlterTable
ALTER TABLE `FileAsset` DROP COLUMN `linkedEntityId`,
    DROP COLUMN `linkedEntityType`;

-- AlterTable
ALTER TABLE `QuestionUsageHistory` DROP COLUMN `academicYearId`,
    DROP COLUMN `examType`,
    DROP COLUMN `generatedPaperId`,
    DROP COLUMN `generatedPaperItemId`,
    DROP COLUMN `semesterId`,
    ADD COLUMN `sourceId` VARCHAR(191) NOT NULL,
    ADD COLUMN `sourceType` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `QuestionUsageHistory_sourceType_sourceId_idx` ON `QuestionUsageHistory`(`sourceType`, `sourceId`);

-- AddForeignKey
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
