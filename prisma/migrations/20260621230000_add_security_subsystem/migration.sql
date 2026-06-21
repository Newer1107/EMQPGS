-- Add securityEventId and sessionId to AuditLog
ALTER TABLE `AuditLog` ADD COLUMN `securityEventId` VARCHAR(191) NULL,
    ADD COLUMN `sessionId` VARCHAR(191) NULL;

-- Add UNIQUE constraint to AuditLog.previousHash
-- MySQL treats NULLs as distinct in UNIQUE constraints, so existing null values are fine.
-- If duplicate non-null values exist, this migration will fail — deduplicate first.
CREATE UNIQUE INDEX `AuditLog_previousHash_key` ON `AuditLog`(`previousHash`);
CREATE INDEX `AuditLog_securityEventId_idx` ON `AuditLog`(`securityEventId`);

-- Create OtpCode table
CREATE TABLE `OtpCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `browserFingerprint` VARCHAR(191) NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `usedAt` DATETIME(3) NULL,
    `securityEventId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `OtpCode_userId_purpose_createdAt_idx` ON `OtpCode`(`userId`, `purpose`, `createdAt`);
CREATE INDEX `OtpCode_expiresAt_idx` ON `OtpCode`(`expiresAt`);

-- Create SecurityConfig table
CREATE TABLE `SecurityConfig` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `SecurityConfig_key_key` ON `SecurityConfig`(`key`);

-- Create PaperDownload table
CREATE TABLE `PaperDownload` (
    `id` VARCHAR(191) NOT NULL,
    `downloadId` VARCHAR(191) NOT NULL,
    `paperId` VARCHAR(191) NOT NULL,
    `variant` VARCHAR(191) NOT NULL,
    `downloadedById` VARCHAR(191) NOT NULL,
    `downloadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `securityEventId` VARCHAR(191) NULL,
    `downloadReason` VARCHAR(191) NULL,
    `auditLogId` VARCHAR(191) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `PaperDownload_downloadId_key` ON `PaperDownload`(`downloadId`);
CREATE INDEX `PaperDownload_paperId_downloadedAt_idx` ON `PaperDownload`(`paperId`, `downloadedAt`);
CREATE INDEX `PaperDownload_securityEventId_idx` ON `PaperDownload`(`securityEventId`);

-- Create EmergencyApproval table
CREATE TABLE `EmergencyApproval` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetUserId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `EmergencyApproval_status_expiresAt_idx` ON `EmergencyApproval`(`status`, `expiresAt`);

-- Add foreign keys for EmergencyApproval
ALTER TABLE `EmergencyApproval` ADD CONSTRAINT `EmergencyApproval_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `EmergencyApproval` ADD CONSTRAINT `EmergencyApproval_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
