-- DropForeignKey
ALTER TABLE `Question` DROP FOREIGN KEY `Question_slotId_fkey`;

-- DropIndex
DROP INDEX `DeanReview_ktPaperId_fkey` ON `DeanReview`;

-- DropIndex
DROP INDEX `DeanReview_regularPaperId_fkey` ON `DeanReview`;

-- DropIndex
DROP INDEX `DeanReview_supplementaryPaperId_fkey` ON `DeanReview`;

-- AlterTable
ALTER TABLE `ExamCycle` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Question` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `QuestionBank` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `QuestionRevision` MODIFY `questionText` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `QuestionSlot` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `AuditLog_entityType_entityId_createdAt_idx` ON `AuditLog`(`entityType`, `entityId`, `createdAt`);

-- CreateIndex
CREATE INDEX `ExamCycle_status_departmentId_idx` ON `ExamCycle`(`status`, `departmentId`);

-- CreateIndex
CREATE INDEX `Notification_recipientId_isRead_createdAt_idx` ON `Notification`(`recipientId`, `isRead`, `createdAt`);

-- CreateIndex
CREATE INDEX `Question_status_idx` ON `Question`(`status`);

-- CreateIndex
CREATE INDEX `QuestionBank_status_idx` ON `QuestionBank`(`status`);

-- CreateIndex
CREATE INDEX `QuestionBank_subjectId_idx` ON `QuestionBank`(`subjectId`);

-- CreateIndex
CREATE INDEX `Subject_semester_idx` ON `Subject`(`semester`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `QuestionSlot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `AuditLog` RENAME INDEX `AuditLog_actorId_fkey` TO `AuditLog_actorId_idx`;

-- RenameIndex
ALTER TABLE `ExamCycle` RENAME INDEX `ExamCycle_departmentId_fkey` TO `ExamCycle_departmentId_idx`;

-- RenameIndex
ALTER TABLE `Subject` RENAME INDEX `Subject_departmentId_fkey` TO `Subject_departmentId_idx`;

-- RenameIndex
ALTER TABLE `TeacherAssignment` RENAME INDEX `TeacherAssignment_qb_teacher_role_module_key` TO `TeacherAssignment_questionBankId_teacherId_assignmentRole_mo_key`;

-- RenameIndex
ALTER TABLE `TeacherAssignment` RENAME INDEX `TeacherAssignment_teacherId_fkey` TO `TeacherAssignment_teacherId_idx`;

-- RenameIndex
ALTER TABLE `User` RENAME INDEX `User_departmentId_fkey` TO `User_departmentId_idx`;
