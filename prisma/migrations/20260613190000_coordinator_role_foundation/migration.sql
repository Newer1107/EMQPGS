ALTER TABLE `ExamCycle`
    ADD COLUMN `startDate` DATETIME(3) NULL,
    ADD COLUMN `endDate` DATETIME(3) NULL;

ALTER TABLE `Subject`
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `Subject`
    DROP INDEX `Subject_subjectCode_key`,
    ADD UNIQUE INDEX `Subject_subjectCode_departmentId_key`(`subjectCode`, `departmentId`);

ALTER TABLE `TeacherAssignment`
    ADD COLUMN `moduleNumber` INTEGER NULL;

UPDATE `TeacherAssignment`
SET `moduleNumber` = NULL
WHERE `assignmentRole` = 'MODERATOR';

UPDATE `TeacherAssignment` AS `target`
INNER JOIN (
    SELECT
        `id`,
        ROW_NUMBER() OVER (
            PARTITION BY `questionBankId`, `assignmentRole`
            ORDER BY `createdAt`, `id`
        ) AS `module_rank`
    FROM `TeacherAssignment`
    WHERE `assignmentRole` = 'CONTRIBUTOR'
) AS `ranked`
    ON `target`.`id` = `ranked`.`id`
SET `target`.`moduleNumber` = `ranked`.`module_rank`;

ALTER TABLE `TeacherAssignment`
    DROP INDEX `TeacherAssignment_questionBankId_teacherId_assignmentRole_key`,
    ADD UNIQUE INDEX `TeacherAssignment_qb_teacher_role_module_key`(`questionBankId`, `teacherId`, `assignmentRole`, `moduleNumber`);

CREATE TABLE `CoordinatorDepartmentAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `coordinatorId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CoordinatorDepartmentAssignment_coordinatorId_departmentId_key`(`coordinatorId`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubjectExamCycleLink` (
    `id` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `examCycleId` VARCHAR(191) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SubjectExamCycleLink_subjectId_examCycleId_key`(`subjectId`, `examCycleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CoordinatorDepartmentAssignment`
    ADD CONSTRAINT `CoordinatorDepartmentAssignment_coordinatorId_fkey`
        FOREIGN KEY (`coordinatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `CoordinatorDepartmentAssignment_departmentId_fkey`
        FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SubjectExamCycleLink`
    ADD CONSTRAINT `SubjectExamCycleLink_subjectId_fkey`
        FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `SubjectExamCycleLink_examCycleId_fkey`
        FOREIGN KEY (`examCycleId`) REFERENCES `ExamCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
