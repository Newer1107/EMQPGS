ALTER TABLE `Question`
    MODIFY `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'REVISION_SUBMITTED') NOT NULL DEFAULT 'DRAFT',
    MODIFY `slotId` VARCHAR(191) NULL;

UPDATE `Question`
SET `status` = 'PENDING'
WHERE `status` = 'SUBMITTED';

ALTER TABLE `Question`
    MODIFY `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'REVISION_SUBMITTED') NOT NULL DEFAULT 'DRAFT';

CREATE TABLE `ModerationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `moderatorId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ModerationEvent_questionId_createdAt_idx`(`questionId`, `createdAt`),
    INDEX `ModerationEvent_moderatorId_createdAt_idx`(`moderatorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuestionRevision` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `questionText` TEXT NOT NULL,
    `submittedById` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL,
    `moderatorComment` VARCHAR(191) NULL,

    UNIQUE INDEX `QuestionRevision_questionId_versionNumber_key`(`questionId`, `versionNumber`),
    INDEX `QuestionRevision_questionId_submittedAt_idx`(`questionId`, `submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ModeratorBankAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `moderatorId` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ModeratorBankAssignment_moderatorId_questionBankId_key`(`moderatorId`, `questionBankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ModeratorBankAssignment` (`id`, `moderatorId`, `questionBankId`, `assignedAt`)
SELECT
    CONCAT('mba_', SUBSTRING(MD5(CONCAT(`teacherId`, ':', `questionBankId`)), 1, 24)),
    `teacherId`,
    `questionBankId`,
    `createdAt`
FROM `TeacherAssignment`
WHERE `assignmentRole` = 'MODERATOR'
ON DUPLICATE KEY UPDATE `assignedAt` = `ModeratorBankAssignment`.`assignedAt`;

ALTER TABLE `ModerationEvent`
    ADD CONSTRAINT `ModerationEvent_questionId_fkey`
        FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ModerationEvent_moderatorId_fkey`
        FOREIGN KEY (`moderatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QuestionRevision`
    ADD CONSTRAINT `QuestionRevision_questionId_fkey`
        FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `QuestionRevision_submittedById_fkey`
        FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ModeratorBankAssignment`
    ADD CONSTRAINT `ModeratorBankAssignment_moderatorId_fkey`
        FOREIGN KEY (`moderatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ModeratorBankAssignment_questionBankId_fkey`
        FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
