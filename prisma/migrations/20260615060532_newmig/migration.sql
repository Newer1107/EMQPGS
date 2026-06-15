/*
  Warnings:

  - You are about to drop the column `academicYear` on the `ExamCycle` table. All the data in the column will be lost.
  - You are about to drop the column `semester` on the `ExamCycle` table. All the data in the column will be lost.
  - You are about to drop the column `moderatorComment` on the `QuestionRevision` table. All the data in the column will be lost.
  - You are about to drop the column `questionText` on the `QuestionRevision` table. All the data in the column will be lost.
  - You are about to drop the column `submittedAt` on the `QuestionRevision` table. All the data in the column will be lost.
  - You are about to drop the column `submittedById` on the `QuestionRevision` table. All the data in the column will be lost.
  - You are about to drop the column `versionNumber` on the `QuestionRevision` table. All the data in the column will be lost.
  - You are about to drop the column `academicYear` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `semester` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the `Question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionAttachment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionSlot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TeacherAssignment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[semesterId,examType]` on the table `ExamCycle` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[questionId,revisionNumber]` on the table `QuestionRevision` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYearId` to the `ExamCycle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semesterId` to the `ExamCycle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `changedById` to the `QuestionRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `revisionNumber` to the `QuestionRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshotCo` to the `QuestionRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshotMarks` to the `QuestionRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshotModule` to the `QuestionRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshotQuestionText` to the `QuestionRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `snapshotRbt` to the `QuestionRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semesterId` to the `Subject` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `GeneratedPaperItem` DROP FOREIGN KEY `GeneratedPaperItem_questionId_fkey`;

-- DropForeignKey
ALTER TABLE `ModerationEvent` DROP FOREIGN KEY `ModerationEvent_questionId_fkey`;

-- DropForeignKey
ALTER TABLE `Question` DROP FOREIGN KEY `Question_contributorId_fkey`;

-- DropForeignKey
ALTER TABLE `Question` DROP FOREIGN KEY `Question_questionBankId_fkey`;

-- DropForeignKey
ALTER TABLE `Question` DROP FOREIGN KEY `Question_slotId_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionAttachment` DROP FOREIGN KEY `QuestionAttachment_fileAssetId_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionAttachment` DROP FOREIGN KEY `QuestionAttachment_questionId_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionAttachment` DROP FOREIGN KEY `QuestionAttachment_uploadedById_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionRevision` DROP FOREIGN KEY `QuestionRevision_questionId_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionRevision` DROP FOREIGN KEY `QuestionRevision_submittedById_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionSlot` DROP FOREIGN KEY `QuestionSlot_questionBankId_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionSlot` DROP FOREIGN KEY `QuestionSlot_reservedById_fkey`;

-- DropForeignKey
ALTER TABLE `TeacherAssignment` DROP FOREIGN KEY `TeacherAssignment_assignedById_fkey`;

-- DropForeignKey
ALTER TABLE `TeacherAssignment` DROP FOREIGN KEY `TeacherAssignment_questionBankId_fkey`;

-- DropForeignKey
ALTER TABLE `TeacherAssignment` DROP FOREIGN KEY `TeacherAssignment_teacherId_fkey`;

-- DropIndex
DROP INDEX `ExamCycle_academicYear_semester_examType_key` ON `ExamCycle`;

-- DropIndex
DROP INDEX `GeneratedPaperItem_questionId_fkey` ON `GeneratedPaperItem`;

-- DropIndex
DROP INDEX `QuestionRevision_questionId_submittedAt_idx` ON `QuestionRevision`;

-- DropIndex
DROP INDEX `QuestionRevision_questionId_versionNumber_key` ON `QuestionRevision`;

-- DropIndex
DROP INDEX `QuestionRevision_submittedById_fkey` ON `QuestionRevision`;

-- DropIndex
DROP INDEX `Subject_semester_idx` ON `Subject`;

-- AlterTable
ALTER TABLE `ExamCycle` DROP COLUMN `academicYear`,
    DROP COLUMN `semester`,
    ADD COLUMN `academicYearId` VARCHAR(191) NOT NULL,
    ADD COLUMN `semesterId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `QuestionRevision` DROP COLUMN `moderatorComment`,
    DROP COLUMN `questionText`,
    DROP COLUMN `submittedAt`,
    DROP COLUMN `submittedById`,
    DROP COLUMN `versionNumber`,
    ADD COLUMN `changeReason` VARCHAR(191) NULL,
    ADD COLUMN `changedById` VARCHAR(191) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `revisionNumber` INTEGER NOT NULL,
    ADD COLUMN `snapshotCo` ENUM('CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6') NOT NULL,
    ADD COLUMN `snapshotDifficulty` ENUM('EASY', 'MEDIUM', 'HARD') NULL,
    ADD COLUMN `snapshotMarks` INTEGER NOT NULL,
    ADD COLUMN `snapshotModule` INTEGER NOT NULL,
    ADD COLUMN `snapshotQuestionText` VARCHAR(191) NOT NULL,
    ADD COLUMN `snapshotRbt` ENUM('L1', 'L2', 'L3', 'L4', 'L5', 'L6') NOT NULL,
    ADD COLUMN `snapshotTeachingIndex` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Subject` DROP COLUMN `academicYear`,
    DROP COLUMN `semester`,
    ADD COLUMN `semesterId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `Question`;

-- DropTable
DROP TABLE `QuestionAttachment`;

-- DropTable
DROP TABLE `QuestionSlot`;

-- DropTable
DROP TABLE `TeacherAssignment`;

-- CreateTable
CREATE TABLE `AcademicYear` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AcademicYear_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Semester` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Semester_academicYearId_idx`(`academicYearId`),
    UNIQUE INDEX `Semester_academicYearId_number_key`(`academicYearId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubjectVersion` (
    `id` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `syllabusDescription` VARCHAR(191) NULL,
    `effectiveFromAcademicYearId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SubjectVersion_subjectId_status_idx`(`subjectId`, `status`),
    UNIQUE INDEX `SubjectVersion_subjectId_versionNumber_key`(`subjectId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionLibraryItem` (
    `id` VARCHAR(191) NOT NULL,
    `subjectVersionId` VARCHAR(191) NOT NULL,
    `moduleNumber` INTEGER NOT NULL,
    `marks` INTEGER NOT NULL,
    `questionText` VARCHAR(191) NOT NULL,
    `coMapping` ENUM('CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6') NOT NULL,
    `rbtLevel` ENUM('L1', 'L2', 'L3', 'L4', 'L5', 'L6') NOT NULL,
    `difficultyLevel` ENUM('EASY', 'MEDIUM', 'HARD') NULL,
    `teachingIndex` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'REVISION_SUBMITTED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `moderatorRemark` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuestionLibraryItem_subjectVersionId_moduleNumber_marks_idx`(`subjectVersionId`, `moduleNumber`, `marks`),
    INDEX `QuestionLibraryItem_createdById_status_idx`(`createdById`, `status`),
    INDEX `QuestionLibraryItem_ownerId_idx`(`ownerId`),
    INDEX `QuestionLibraryItem_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionOwnershipHistory` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `transferredById` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `transferredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionOwnershipHistory_questionId_transferredAt_idx`(`questionId`, `transferredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionUsageHistory` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `examCycleId` VARCHAR(191) NULL,
    `generatedPaperId` VARCHAR(191) NULL,
    `generatedPaperItemId` VARCHAR(191) NULL,
    `academicYearId` VARCHAR(191) NULL,
    `semesterId` VARCHAR(191) NULL,
    `examType` ENUM('ISE_1', 'ISE_2', 'ENDSEM', 'SUPPLEMENTARY', 'KT') NULL,
    `usedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionUsageHistory_questionId_usedAt_idx`(`questionId`, `usedAt`),
    INDEX `QuestionUsageHistory_academicYearId_idx`(`academicYearId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionBankQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionBankQuestion_questionBankId_idx`(`questionBankId`),
    INDEX `QuestionBankQuestion_questionId_idx`(`questionId`),
    UNIQUE INDEX `QuestionBankQuestion_questionBankId_questionId_key`(`questionBankId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ExamCycle_academicYearId_idx` ON `ExamCycle`(`academicYearId`);

-- CreateIndex
CREATE INDEX `ExamCycle_semesterId_idx` ON `ExamCycle`(`semesterId`);

-- CreateIndex
CREATE UNIQUE INDEX `ExamCycle_semesterId_examType_key` ON `ExamCycle`(`semesterId`, `examType`);

-- CreateIndex
CREATE INDEX `QuestionRevision_questionId_createdAt_idx` ON `QuestionRevision`(`questionId`, `createdAt`);

-- CreateIndex
CREATE UNIQUE INDEX `QuestionRevision_questionId_revisionNumber_key` ON `QuestionRevision`(`questionId`, `revisionNumber`);

-- CreateIndex
CREATE INDEX `Subject_semesterId_idx` ON `Subject`(`semesterId`);

-- AddForeignKey
ALTER TABLE `Semester` ADD CONSTRAINT `Semester_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubjectVersion` ADD CONSTRAINT `SubjectVersion_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubjectVersion` ADD CONSTRAINT `SubjectVersion_effectiveFromAcademicYearId_fkey` FOREIGN KEY (`effectiveFromAcademicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionLibraryItem` ADD CONSTRAINT `QuestionLibraryItem_subjectVersionId_fkey` FOREIGN KEY (`subjectVersionId`) REFERENCES `SubjectVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionLibraryItem` ADD CONSTRAINT `QuestionLibraryItem_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionLibraryItem` ADD CONSTRAINT `QuestionLibraryItem_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOwnershipHistory` ADD CONSTRAINT `QuestionOwnershipHistory_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOwnershipHistory` ADD CONSTRAINT `QuestionOwnershipHistory_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOwnershipHistory` ADD CONSTRAINT `QuestionOwnershipHistory_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOwnershipHistory` ADD CONSTRAINT `QuestionOwnershipHistory_transferredById_fkey` FOREIGN KEY (`transferredById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionRevision` ADD CONSTRAINT `QuestionRevision_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionRevision` ADD CONSTRAINT `QuestionRevision_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionUsageHistory` ADD CONSTRAINT `QuestionUsageHistory_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionUsageHistory` ADD CONSTRAINT `QuestionUsageHistory_examCycleId_fkey` FOREIGN KEY (`examCycleId`) REFERENCES `ExamCycle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionUsageHistory` ADD CONSTRAINT `QuestionUsageHistory_generatedPaperId_fkey` FOREIGN KEY (`generatedPaperId`) REFERENCES `GeneratedPaper`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionUsageHistory` ADD CONSTRAINT `QuestionUsageHistory_generatedPaperItemId_fkey` FOREIGN KEY (`generatedPaperItemId`) REFERENCES `GeneratedPaperItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBankQuestion` ADD CONSTRAINT `QuestionBankQuestion_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBankQuestion` ADD CONSTRAINT `QuestionBankQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationEvent` ADD CONSTRAINT `ModerationEvent_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedPaperItem` ADD CONSTRAINT `GeneratedPaperItem_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
