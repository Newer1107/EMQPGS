-- AlterTable
ALTER TABLE `AcademicYear` ADD COLUMN `activeSemesterType` ENUM('ODD', 'EVEN') NOT NULL DEFAULT 'ODD';
