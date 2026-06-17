/*
  Warnings:

  - You are about to drop the column `questionBankDueDate` on the `CurriculumSubject` table. All the data in the column will be lost.
  - Added the required column `name` to the `TeachingGroup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `BatchSemester` MODIFY `startDate` DATETIME(3) NULL,
    MODIFY `endDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `CurriculumSubject` DROP COLUMN `questionBankDueDate`;

-- AlterTable
ALTER TABLE `Programme` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `TeachingGroup` ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `name` VARCHAR(191) NOT NULL;
