ALTER TABLE `QuestionLibraryItem`
  ADD COLUMN `questionType` ENUM('THEORY', 'NUMERICAL') NULL,
  ADD COLUMN `poMapping` JSON NULL,
  ADD COLUMN `piMapping` JSON NULL;

ALTER TABLE `QuestionRevision`
  ADD COLUMN `snapshotQuestionType` ENUM('THEORY', 'NUMERICAL') NULL,
  ADD COLUMN `snapshotPoMapping` JSON NULL,
  ADD COLUMN `snapshotPiMapping` JSON NULL;

CREATE TABLE `UafReview` (
  `id` VARCHAR(191) NOT NULL,
  `questionBankId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `reviewerId` VARCHAR(191) NOT NULL,
  `evidence` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UafReview_questionBankId_version_key` (`questionBankId`, `version`),
  CONSTRAINT `UafReview_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `UafReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QBAuditBlueprint` (
  `id` VARCHAR(191) NOT NULL,
  `questionBankId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `data` JSON NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `QBAuditBlueprint_questionBankId_version_key` (`questionBankId`, `version`),
  CONSTRAINT `QBAuditBlueprint_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QBAuditSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `questionBankId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'FINAL') NOT NULL,
  `finalizedFromId` VARCHAR(191) NULL,
  `evaluatorId` VARCHAR(191) NOT NULL,
  `evaluatorName` VARCHAR(191) NOT NULL,
  `remarks` TEXT NOT NULL,
  `score` INTEGER NOT NULL,
  `decision` VARCHAR(191) NOT NULL,
  `payload` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `QBAuditSnapshot_questionBankId_version_key` (`questionBankId`, `version`),
  UNIQUE INDEX `QBAuditSnapshot_finalizedFromId_key` (`finalizedFromId`),
  INDEX `QBAuditSnapshot_questionBankId_status_idx` (`questionBankId`, `status`),
  CONSTRAINT `QBAuditSnapshot_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
