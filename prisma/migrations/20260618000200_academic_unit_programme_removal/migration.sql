-- DropForeignKey
ALTER TABLE `Batch` DROP FOREIGN KEY `Batch_programmeId_fkey`;

-- DropForeignKey
ALTER TABLE `BatchSemester` DROP FOREIGN KEY `BatchSemester_academicUnitId_fkey`;

-- DropForeignKey
ALTER TABLE `CurriculumScheme` DROP FOREIGN KEY `CurriculumScheme_programmeId_fkey`;

-- DropForeignKey
ALTER TABLE `CurriculumSubject` DROP FOREIGN KEY `CurriculumSubject_academicUnitId_fkey`;

-- DropForeignKey
ALTER TABLE `CurriculumSubject` DROP FOREIGN KEY `CurriculumSubject_curriculumSchemeId_fkey`;

-- DropForeignKey
ALTER TABLE `Programme` DROP FOREIGN KEY `Programme_firstYearAcademicUnitId_fkey`;

-- DropForeignKey
ALTER TABLE `Programme` DROP FOREIGN KEY `Programme_homeAcademicUnitId_fkey`;

-- DropIndex
DROP INDEX `Batch_programmeId_fkey` ON `Batch`;

-- DropIndex
DROP INDEX `BatchSemester_academicUnitId_idx` ON `BatchSemester`;

-- DropIndex
DROP INDEX `CurriculumScheme_programmeId_year_key` ON `CurriculumScheme`;

-- DropIndex
DROP INDEX `CurriculumSubject_academicUnitId_fkey` ON `CurriculumSubject`;

-- DropIndex
DROP INDEX `CurriculumSubject_curriculumSchemeId_semesterNumber_academic_idx` ON `CurriculumSubject`;

-- AlterTable
ALTER TABLE `Batch` DROP COLUMN `programmeId`,
    ADD COLUMN `departmentId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `BatchSemester` DROP COLUMN `academicUnitId`,
    ADD COLUMN `departmentId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `CurriculumScheme` DROP COLUMN `programmeId`,
    ADD COLUMN `departmentId` VARCHAR(191) NOT NULL,
    ADD COLUMN `durationSemesters` INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE `CurriculumSubject` DROP COLUMN `academicUnitId`,
    ADD COLUMN `departmentId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `AcademicUnit`;

-- DropTable
DROP TABLE `Programme`;

-- CreateIndex
CREATE INDEX `BatchSemester_departmentId_idx` ON `BatchSemester`(`departmentId`);

-- CreateIndex
CREATE UNIQUE INDEX `CurriculumScheme_departmentId_year_key` ON `CurriculumScheme`(`departmentId`, `year`);

-- CreateIndex
CREATE INDEX `CurriculumSubject_curriculumSchemeId_semesterNumber_departme_idx` ON `CurriculumSubject`(`curriculumSchemeId`, `semesterNumber`, `departmentId`);

-- AddForeignKey
ALTER TABLE `CurriculumScheme` ADD CONSTRAINT `CurriculumScheme_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CurriculumSubject` ADD CONSTRAINT `CurriculumSubject_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Batch` ADD CONSTRAINT `Batch_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchSemester` ADD CONSTRAINT `BatchSemester_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
