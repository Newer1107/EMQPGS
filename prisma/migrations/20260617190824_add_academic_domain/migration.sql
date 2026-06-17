-- DropIndex
DROP INDEX `Subject_semesterNumber_idx` ON `Subject`;

-- CreateTable
CREATE TABLE `AcademicUnit` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('ES_H', 'DEPARTMENT') NOT NULL DEFAULT 'DEPARTMENT',
    `hodName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AcademicUnit_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Programme` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `degreeType` ENUM('BE', 'BTECH', 'MTECH', 'PHD', 'DIPLOMA') NOT NULL DEFAULT 'BE',
    `durationYears` INTEGER NOT NULL DEFAULT 4,
    `durationSemesters` INTEGER NOT NULL DEFAULT 8,
    `homeAcademicUnitId` VARCHAR(191) NOT NULL,
    `firstYearAcademicUnitId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Programme_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CurriculumScheme` (
    `id` VARCHAR(191) NOT NULL,
    `programmeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CurriculumScheme_programmeId_year_key`(`programmeId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CurriculumSubject` (
    `id` VARCHAR(191) NOT NULL,
    `curriculumSchemeId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `semesterNumber` INTEGER NOT NULL,
    `academicUnitId` VARCHAR(191) NOT NULL,
    `groupAssignment` ENUM('ALL', 'GROUP_1', 'GROUP_2') NOT NULL DEFAULT 'ALL',
    `questionBankDueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CurriculumSubject_curriculumSchemeId_semesterNumber_academic_idx`(`curriculumSchemeId`, `semesterNumber`, `academicUnitId`),
    INDEX `CurriculumSubject_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `CurriculumSubject_curriculumSchemeId_subjectId_semesterNumbe_key`(`curriculumSchemeId`, `subjectId`, `semesterNumber`, `groupAssignment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Batch` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `programmeId` VARCHAR(191) NOT NULL,
    `curriculumSchemeId` VARCHAR(191) NOT NULL,
    `admissionYear` INTEGER NOT NULL,
    `graduationYear` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'GRADUATED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Batch_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchSemester` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `semesterNumber` INTEGER NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `academicUnitId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` ENUM('UPCOMING', 'ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'UPCOMING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BatchSemester_academicYearId_idx`(`academicYearId`),
    INDEX `BatchSemester_academicUnitId_idx`(`academicUnitId`),
    UNIQUE INDEX `BatchSemester_batchId_semesterNumber_key`(`batchId`, `semesterNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeachingGroup` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `groupNumber` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TeachingGroup_batchId_groupNumber_key`(`batchId`, `groupNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Programme` ADD CONSTRAINT `Programme_homeAcademicUnitId_fkey` FOREIGN KEY (`homeAcademicUnitId`) REFERENCES `AcademicUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Programme` ADD CONSTRAINT `Programme_firstYearAcademicUnitId_fkey` FOREIGN KEY (`firstYearAcademicUnitId`) REFERENCES `AcademicUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CurriculumScheme` ADD CONSTRAINT `CurriculumScheme_programmeId_fkey` FOREIGN KEY (`programmeId`) REFERENCES `Programme`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CurriculumSubject` ADD CONSTRAINT `CurriculumSubject_curriculumSchemeId_fkey` FOREIGN KEY (`curriculumSchemeId`) REFERENCES `CurriculumScheme`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CurriculumSubject` ADD CONSTRAINT `CurriculumSubject_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CurriculumSubject` ADD CONSTRAINT `CurriculumSubject_academicUnitId_fkey` FOREIGN KEY (`academicUnitId`) REFERENCES `AcademicUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Batch` ADD CONSTRAINT `Batch_programmeId_fkey` FOREIGN KEY (`programmeId`) REFERENCES `Programme`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Batch` ADD CONSTRAINT `Batch_curriculumSchemeId_fkey` FOREIGN KEY (`curriculumSchemeId`) REFERENCES `CurriculumScheme`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchSemester` ADD CONSTRAINT `BatchSemester_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchSemester` ADD CONSTRAINT `BatchSemester_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchSemester` ADD CONSTRAINT `BatchSemester_academicUnitId_fkey` FOREIGN KEY (`academicUnitId`) REFERENCES `AcademicUnit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeachingGroup` ADD CONSTRAINT `TeachingGroup_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
