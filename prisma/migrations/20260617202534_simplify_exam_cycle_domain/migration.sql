/*
  Warnings:

  - You are about to drop the column `academicUnitId` on the `ExamCycle` table. All the data in the column will be lost.
  - You are about to drop the column `batchId` on the `ExamCycle` table. All the data in the column will be lost.
  - You are about to drop the column `groupNumber` on the `ExamCycle` table. All the data in the column will be lost.
  - You are about to drop the column `semesterNumber` on the `ExamCycle` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `ExamCycle` DROP FOREIGN KEY `ExamCycle_academicUnitId_fkey`;

-- DropForeignKey
ALTER TABLE `ExamCycle` DROP FOREIGN KEY `ExamCycle_batchId_fkey`;

-- DropIndex
DROP INDEX `ExamCycle_academicUnitId_idx` ON `ExamCycle`;

-- DropIndex
DROP INDEX `ExamCycle_batchId_idx` ON `ExamCycle`;

-- AlterTable
ALTER TABLE `ExamCycle` DROP COLUMN `academicUnitId`,
    DROP COLUMN `batchId`,
    DROP COLUMN `groupNumber`,
    DROP COLUMN `semesterNumber`;
