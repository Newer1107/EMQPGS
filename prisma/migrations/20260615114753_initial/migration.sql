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
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `hodName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('COE', 'COORDINATOR', 'MODERATOR', 'CONTRIBUTOR', 'DEAN') NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `departmentId` VARCHAR(191) NULL,
    `resetTokenHash` VARCHAR(191) NULL,
    `resetTokenExpiry` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_departmentId_idx`(`departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamCycle` (
    `id` VARCHAR(191) NOT NULL,
    `examType` ENUM('ISE_1', 'ISE_2', 'ENDSEM', 'SUPPLEMENTARY', 'KT') NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `departmentId` VARCHAR(191) NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `semesterId` VARCHAR(191) NOT NULL,
    `timetableDocumentRef` VARCHAR(191) NULL,
    `timetableIssueDate` DATETIME(3) NULL,
    `timetableTitle` VARCHAR(191) NULL,
    `timetableBranch` VARCHAR(191) NULL,
    `timetableRows` JSON NULL,
    `timetableSignature` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExamCycle_status_departmentId_idx`(`status`, `departmentId`),
    INDEX `ExamCycle_departmentId_idx`(`departmentId`),
    INDEX `ExamCycle_academicYearId_idx`(`academicYearId`),
    INDEX `ExamCycle_semesterId_idx`(`semesterId`),
    UNIQUE INDEX `ExamCycle_semesterId_examType_key`(`semesterId`, `examType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(191) NOT NULL,
    `subjectCode` VARCHAR(191) NOT NULL,
    `subjectName` VARCHAR(191) NOT NULL,
    `credits` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `questionBankDueDate` DATETIME(3) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `semesterId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subject_departmentId_idx`(`departmentId`),
    INDEX `Subject_semesterId_idx`(`semesterId`),
    UNIQUE INDEX `Subject_subjectCode_departmentId_key`(`subjectCode`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionBank` (
    `id` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `examCycleId` VARCHAR(191) NOT NULL,
    `phase` ENUM('DRAFTING', 'MODERATION', 'APPROVAL', 'COMPLETE') NOT NULL DEFAULT 'DRAFTING',
    `recordStatus` ENUM('ACTIVE', 'LOCKED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NOT NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuestionBank_subjectId_idx`(`subjectId`),
    INDEX `QuestionBank_phase_recordStatus_idx`(`phase`, `recordStatus`),
    UNIQUE INDEX `QuestionBank_subjectId_examCycleId_key`(`subjectId`, `examCycleId`),
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
CREATE TABLE `QuestionRevision` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `snapshotQuestionText` VARCHAR(191) NOT NULL,
    `snapshotModule` INTEGER NOT NULL,
    `snapshotMarks` INTEGER NOT NULL,
    `snapshotCo` ENUM('CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6') NOT NULL,
    `snapshotRbt` ENUM('L1', 'L2', 'L3', 'L4', 'L5', 'L6') NOT NULL,
    `snapshotDifficulty` ENUM('EASY', 'MEDIUM', 'HARD') NULL,
    `snapshotTeachingIndex` VARCHAR(191) NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `changeReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionRevision_questionId_createdAt_idx`(`questionId`, `createdAt`),
    UNIQUE INDEX `QuestionRevision_questionId_revisionNumber_key`(`questionId`, `revisionNumber`),
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
CREATE TABLE `QuestionSlot` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `moduleNumber` INTEGER NOT NULL,
    `marks` INTEGER NOT NULL,
    `slotNumber` INTEGER NOT NULL,
    `assignedQuestionId` VARCHAR(191) NULL,
    `reservedById` VARCHAR(191) NULL,
    `reservedAt` DATETIME(3) NULL,
    `isLocked` BOOLEAN NOT NULL DEFAULT false,

    INDEX `QuestionSlot_questionBankId_assignedQuestionId_idx`(`questionBankId`, `assignedQuestionId`),
    INDEX `QuestionSlot_assignedQuestionId_idx`(`assignedQuestionId`),
    UNIQUE INDEX `QuestionSlot_questionBankId_moduleNumber_marks_slotNumber_key`(`questionBankId`, `moduleNumber`, `marks`, `slotNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaperPattern` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `examType` ENUM('ISE_1', 'ISE_2', 'ENDSEM', 'SUPPLEMENTARY', 'KT') NOT NULL,
    `totalModules` INTEGER NOT NULL,
    `marksPattern` JSON NOT NULL,
    `slotsPerModule` INTEGER NOT NULL,
    `totalSlots` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaperPattern_questionBankId_key`(`questionBankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalDecision` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `remark` VARCHAR(191) NULL,
    `decidedById` VARCHAR(191) NOT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApprovalDecision_questionBankId_idx`(`questionBankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionBankSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `snapshotType` ENUM('LOCKED', 'APPROVED', 'EXPORTED') NOT NULL,
    `phase` ENUM('DRAFTING', 'MODERATION', 'APPROVAL', 'COMPLETE') NOT NULL,
    `status` ENUM('ACTIVE', 'LOCKED', 'ARCHIVED') NOT NULL,
    `slotAssignments` JSON NOT NULL,
    `paperAssignments` JSON NULL,
    `metadata` JSON NULL,
    `version` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuestionBankSnapshot_questionBankId_snapshotType_createdAt_idx`(`questionBankId`, `snapshotType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaperSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `variant` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    `paperJson` JSON NOT NULL,
    `coverageScore` DOUBLE NULL,
    `difficultyScore` DOUBLE NULL,
    `qualityScore` DOUBLE NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaperSnapshot_questionBankId_variant_key`(`questionBankId`, `variant`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoordinatorDepartmentAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `coordinatorId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CoordinatorDepartmentAssignment_coordinatorId_departmentId_key`(`coordinatorId`, `departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubjectExamCycleLink` (
    `id` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `examCycleId` VARCHAR(191) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SubjectExamCycleLink_subjectId_examCycleId_key`(`subjectId`, `examCycleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'ACTION_REQUIRED') NOT NULL DEFAULT 'INFO',
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `actionUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Notification_recipientId_isRead_createdAt_idx`(`recipientId`, `isRead`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `previousHash` VARCHAR(191) NULL,
    `integrityHash` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    INDEX `AuditLog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileAsset` (
    `id` VARCHAR(191) NOT NULL,
    `bucket` VARCHAR(191) NOT NULL,
    `objectKey` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `linkedEntityType` VARCHAR(191) NULL,
    `linkedEntityId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FileAsset_objectKey_key`(`objectKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

-- CreateTable
CREATE TABLE `ModeratorBankAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `moderatorId` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ModeratorBankAssignment_moderatorId_questionBankId_key`(`moderatorId`, `questionBankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiReport` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `modelName` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NULL,
    `reportJson` JSON NULL,
    `chartData` JSON NULL,
    `failureReason` VARCHAR(191) NULL,
    `generatedById` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NULL,
    `jsonFileAssetId` VARCHAR(191) NULL,
    `pdfFileAssetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiReport_questionBankId_status_idx`(`questionBankId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedPaper` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `variant` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `generatedById` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NULL,
    `failureReason` VARCHAR(191) NULL,
    `paperJson` JSON NULL,
    `paperFileAssetId` VARCHAR(191) NULL,
    `coverageScore` DOUBLE NULL,
    `difficultyScore` DOUBLE NULL,
    `qualityScore` DOUBLE NULL,
    `duplicateRisk` DOUBLE NULL,
    `recommendation` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GeneratedPaper_questionBankId_variant_key`(`questionBankId`, `variant`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedPaperItem` (
    `id` VARCHAR(191) NOT NULL,
    `generatedPaperId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GeneratedPaperItem_generatedPaperId_questionId_key`(`generatedPaperId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeanReview` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `regularPaperId` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    `supplementaryPaperId` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    `ktPaperId` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    `selectedById` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `selectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'SUBMITTED', 'CONFIRMED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeanReview_questionBankId_key`(`questionBankId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExportArtifact` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `generatedById` VARCHAR(191) NULL,
    `format` ENUM('PDF', 'DOCX', 'ZIP') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `fileAssetId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExportArtifact_questionBankId_format_status_idx`(`questionBankId`, `format`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemBackup` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `fileAssetId` VARCHAR(191) NULL,
    `triggeredById` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `failureReason` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Semester` ADD CONSTRAINT `Semester_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubjectVersion` ADD CONSTRAINT `SubjectVersion_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubjectVersion` ADD CONSTRAINT `SubjectVersion_effectiveFromAcademicYearId_fkey` FOREIGN KEY (`effectiveFromAcademicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBank` ADD CONSTRAINT `QuestionBank_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBank` ADD CONSTRAINT `QuestionBank_examCycleId_fkey` FOREIGN KEY (`examCycleId`) REFERENCES `ExamCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBank` ADD CONSTRAINT `QuestionBank_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE `QuestionSlot` ADD CONSTRAINT `QuestionSlot_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionSlot` ADD CONSTRAINT `QuestionSlot_assignedQuestionId_fkey` FOREIGN KEY (`assignedQuestionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionSlot` ADD CONSTRAINT `QuestionSlot_reservedById_fkey` FOREIGN KEY (`reservedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperPattern` ADD CONSTRAINT `PaperPattern_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalDecision` ADD CONSTRAINT `ApprovalDecision_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalDecision` ADD CONSTRAINT `ApprovalDecision_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionBankSnapshot` ADD CONSTRAINT `QuestionBankSnapshot_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperSnapshot` ADD CONSTRAINT `PaperSnapshot_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoordinatorDepartmentAssignment` ADD CONSTRAINT `CoordinatorDepartmentAssignment_coordinatorId_fkey` FOREIGN KEY (`coordinatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoordinatorDepartmentAssignment` ADD CONSTRAINT `CoordinatorDepartmentAssignment_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubjectExamCycleLink` ADD CONSTRAINT `SubjectExamCycleLink_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubjectExamCycleLink` ADD CONSTRAINT `SubjectExamCycleLink_examCycleId_fkey` FOREIGN KEY (`examCycleId`) REFERENCES `ExamCycle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationEvent` ADD CONSTRAINT `ModerationEvent_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModerationEvent` ADD CONSTRAINT `ModerationEvent_moderatorId_fkey` FOREIGN KEY (`moderatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModeratorBankAssignment` ADD CONSTRAINT `ModeratorBankAssignment_moderatorId_fkey` FOREIGN KEY (`moderatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModeratorBankAssignment` ADD CONSTRAINT `ModeratorBankAssignment_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiReport` ADD CONSTRAINT `AiReport_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiReport` ADD CONSTRAINT `AiReport_jsonFileAssetId_fkey` FOREIGN KEY (`jsonFileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiReport` ADD CONSTRAINT `AiReport_pdfFileAssetId_fkey` FOREIGN KEY (`pdfFileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedPaper` ADD CONSTRAINT `GeneratedPaper_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedPaper` ADD CONSTRAINT `GeneratedPaper_paperFileAssetId_fkey` FOREIGN KEY (`paperFileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedPaperItem` ADD CONSTRAINT `GeneratedPaperItem_generatedPaperId_fkey` FOREIGN KEY (`generatedPaperId`) REFERENCES `GeneratedPaper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedPaperItem` ADD CONSTRAINT `GeneratedPaperItem_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `QuestionLibraryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeanReview` ADD CONSTRAINT `DeanReview_selectedById_fkey` FOREIGN KEY (`selectedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportArtifact` ADD CONSTRAINT `ExportArtifact_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportArtifact` ADD CONSTRAINT `ExportArtifact_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExportArtifact` ADD CONSTRAINT `ExportArtifact_fileAssetId_fkey` FOREIGN KEY (`fileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemBackup` ADD CONSTRAINT `SystemBackup_fileAssetId_fkey` FOREIGN KEY (`fileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemBackup` ADD CONSTRAINT `SystemBackup_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
