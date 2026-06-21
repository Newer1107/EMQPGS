/*
  Warnings:

  - You are about to drop the column `departmentId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ContributorBankAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CoordinatorDepartmentAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ModeratorBankAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `ContributorBankAssignment` DROP FOREIGN KEY `ContributorBankAssignment_contributorId_fkey`;

-- DropForeignKey
ALTER TABLE `ContributorBankAssignment` DROP FOREIGN KEY `ContributorBankAssignment_questionBankId_fkey`;

-- DropForeignKey
ALTER TABLE `CoordinatorDepartmentAssignment` DROP FOREIGN KEY `CoordinatorDepartmentAssignment_coordinatorId_fkey`;

-- DropForeignKey
ALTER TABLE `CoordinatorDepartmentAssignment` DROP FOREIGN KEY `CoordinatorDepartmentAssignment_departmentId_fkey`;

-- DropForeignKey
ALTER TABLE `ModeratorBankAssignment` DROP FOREIGN KEY `ModeratorBankAssignment_moderatorId_fkey`;

-- DropForeignKey
ALTER TABLE `ModeratorBankAssignment` DROP FOREIGN KEY `ModeratorBankAssignment_questionBankId_fkey`;

-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_departmentId_fkey`;

-- DropIndex
DROP INDEX `User_departmentId_idx` ON `User`;

-- DropIndex
DROP INDEX `User_role_idx` ON `User`;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `departmentId`,
    DROP COLUMN `role`,
    ADD COLUMN `homeDepartmentId` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `ContributorBankAssignment`;

-- DropTable
DROP TABLE `CoordinatorDepartmentAssignment`;

-- DropTable
DROP TABLE `ModeratorBankAssignment`;

-- CreateTable
CREATE TABLE `ResponsibilityAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `responsibility` ENUM('COE', 'DEAN', 'COORDINATOR', 'MODERATOR', 'CONTRIBUTOR') NOT NULL,
    `scopeType` ENUM('INSTITUTION', 'DEPARTMENT', 'QUESTION_BANK') NOT NULL,
    `scopeId` VARCHAR(191) NULL,
    `activeFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activeTo` DATETIME(3) NULL,
    `assignedById` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ResponsibilityAssignment_userId_idx`(`userId`),
    INDEX `ResponsibilityAssignment_responsibility_scopeType_scopeId_idx`(`responsibility`, `scopeType`, `scopeId`),
    INDEX `ResponsibilityAssignment_activeTo_idx`(`activeTo`),
    UNIQUE INDEX `ResponsibilityAssignment_userId_responsibility_scopeType_sco_key`(`userId`, `responsibility`, `scopeType`, `scopeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_homeDepartmentId_idx` ON `User`(`homeDepartmentId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_homeDepartmentId_fkey` FOREIGN KEY (`homeDepartmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResponsibilityAssignment` ADD CONSTRAINT `ResponsibilityAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
