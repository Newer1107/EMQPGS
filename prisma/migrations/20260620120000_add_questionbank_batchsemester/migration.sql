-- Migrate QuestionBank from examCycleId to batchSemesterId + academicYearId
-- Drop FK referencing ExamCycle
ALTER TABLE `QuestionBank` DROP FOREIGN KEY `QuestionBank_examCycleId_fkey`;

-- Drop old unique index
DROP INDEX `QuestionBank_subjectId_examCycleId_key` ON `QuestionBank`;

-- Remove old data since schema changed fundamentally
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM `QuestionSlot`;
DELETE FROM `PaperPattern`;
DELETE FROM `ApprovalDecision`;
DELETE FROM `QuestionBankSnapshot`;
DELETE FROM `PaperSnapshot`;
DELETE FROM `ModeratorBankAssignment`;
DELETE FROM `ContributorBankAssignment`;
DELETE FROM `AiReport`;
DELETE FROM `GeneratedPaper`;
DELETE FROM `DeanReview`;
DELETE FROM `ExportArtifact`;
DELETE FROM `QuestionBank`;
SET FOREIGN_KEY_CHECKS = 1;

-- Rename examCycleId → batchSemesterId
ALTER TABLE `QuestionBank` CHANGE `examCycleId` `batchSemesterId` VARCHAR(191) NOT NULL;

-- Add academicYearId column
ALTER TABLE `QuestionBank` ADD COLUMN `academicYearId` VARCHAR(191) NOT NULL;

-- New indexes
CREATE INDEX `QuestionBank_batchSemesterId_idx` ON `QuestionBank`(`batchSemesterId`);
CREATE UNIQUE INDEX `QuestionBank_batchSemesterId_subjectId_key` ON `QuestionBank`(`batchSemesterId`, `subjectId`);

-- New foreign keys
ALTER TABLE `QuestionBank` ADD CONSTRAINT `QuestionBank_batchSemesterId_fkey` FOREIGN KEY (`batchSemesterId`) REFERENCES `BatchSemester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `QuestionBank` ADD CONSTRAINT `QuestionBank_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
