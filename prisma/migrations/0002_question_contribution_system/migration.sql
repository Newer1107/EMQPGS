-- CreateTable
CREATE TABLE `QuestionSlot` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `moduleNumber` INTEGER NOT NULL,
    `marks` INTEGER NOT NULL,
    `slotNumber` INTEGER NOT NULL,
    `reservedById` VARCHAR(191) NULL,
    `reservedAt` DATETIME(3) NULL,
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuestionSlot_questionBankId_moduleNumber_marks_slotNumber_key`(`questionBankId`, `moduleNumber`, `marks`, `slotNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` VARCHAR(191) NOT NULL,
    `questionBankId` VARCHAR(191) NOT NULL,
    `slotId` VARCHAR(191) NOT NULL,
    `questionText` TEXT NOT NULL,
    `moduleNumber` INTEGER NOT NULL,
    `marks` INTEGER NOT NULL,
    `slotNumber` INTEGER NOT NULL,
    `coMapping` ENUM('CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6') NOT NULL,
    `rbtLevel` ENUM('L1', 'L2', 'L3', 'L4', 'L5', 'L6') NOT NULL,
    `teachingIndex` VARCHAR(191) NULL,
    `difficultyLevel` ENUM('EASY', 'MEDIUM', 'HARD') NULL,
    `contributorId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'DRAFT',
    `moderatorRemark` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Question_slotId_key`(`slotId`),
    INDEX `Question_questionBankId_moduleNumber_marks_slotNumber_idx`(`questionBankId`, `moduleNumber`, `marks`, `slotNumber`),
    INDEX `Question_contributorId_status_idx`(`contributorId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `fileAssetId` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QuestionAttachment_questionId_fileAssetId_key`(`questionId`, `fileAssetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuestionSlot` ADD CONSTRAINT `QuestionSlot_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionSlot` ADD CONSTRAINT `QuestionSlot_reservedById_fkey` FOREIGN KEY (`reservedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_questionBankId_fkey` FOREIGN KEY (`questionBankId`) REFERENCES `QuestionBank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `QuestionSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_contributorId_fkey` FOREIGN KEY (`contributorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionAttachment` ADD CONSTRAINT `QuestionAttachment_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionAttachment` ADD CONSTRAINT `QuestionAttachment_fileAssetId_fkey` FOREIGN KEY (`fileAssetId`) REFERENCES `FileAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionAttachment` ADD CONSTRAINT `QuestionAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
