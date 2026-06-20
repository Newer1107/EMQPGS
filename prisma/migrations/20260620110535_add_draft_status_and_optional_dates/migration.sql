-- AlterTable
ALTER TABLE `AcademicYear` MODIFY `startDate` DATETIME(3) NULL,
    MODIFY `endDate` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE `CurriculumSubject` ADD CONSTRAINT `CurriculumSubject_curriculumSchemeId_fkey` FOREIGN KEY (`curriculumSchemeId`) REFERENCES `CurriculumScheme`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
