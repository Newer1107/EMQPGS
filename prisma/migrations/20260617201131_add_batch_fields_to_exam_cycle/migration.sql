-- AlterTable
ALTER TABLE `ExamCycle` ADD COLUMN `academicUnitId` VARCHAR(191) NULL,
    ADD COLUMN `batchId` VARCHAR(191) NULL,
    ADD COLUMN `batchSemesterId` VARCHAR(191) NULL,
    ADD COLUMN `groupNumber` INTEGER NULL,
    ADD COLUMN `semesterNumber` INTEGER NULL;

-- CreateIndex
CREATE INDEX `ExamCycle_batchId_idx` ON `ExamCycle`(`batchId`);

-- CreateIndex
CREATE INDEX `ExamCycle_batchSemesterId_idx` ON `ExamCycle`(`batchSemesterId`);

-- CreateIndex
CREATE INDEX `ExamCycle_academicUnitId_idx` ON `ExamCycle`(`academicUnitId`);

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_batchSemesterId_fkey` FOREIGN KEY (`batchSemesterId`) REFERENCES `BatchSemester`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_academicUnitId_fkey` FOREIGN KEY (`academicUnitId`) REFERENCES `AcademicUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
