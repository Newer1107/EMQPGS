-- Make departmentId required and scope ExamCycle by (semester, examType, departmentId)

-- 1. Drop the old unique index
DROP INDEX `ExamCycle_semesterId_examType_key` ON `ExamCycle`;

-- 2. Drop old FK to re-add with RESTRICT
ALTER TABLE `ExamCycle` DROP FOREIGN KEY `ExamCycle_departmentId_fkey`;

-- 3. Backfill any NULL departmentId (assign to first department as fallback)
UPDATE `ExamCycle` SET `departmentId` = (SELECT id FROM `Department` ORDER BY `createdAt` ASC LIMIT 1) WHERE `departmentId` IS NULL;

-- 4. Make departmentId NOT NULL
ALTER TABLE `ExamCycle` MODIFY `departmentId` VARCHAR(191) NOT NULL;

-- 5. Create new unique constraint with departmentId
CREATE UNIQUE INDEX `ExamCycle_semesterId_examType_departmentId_key` ON `ExamCycle`(`semesterId`, `examType`, `departmentId`);

-- 6. Re-add FK with ON DELETE RESTRICT
ALTER TABLE `ExamCycle` ADD CONSTRAINT `ExamCycle_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;