-- AlterTable: Change summary from VARCHAR(191) to TEXT to support AI-generated long-form content
ALTER TABLE `AiReport` MODIFY COLUMN `summary` TEXT NULL;
