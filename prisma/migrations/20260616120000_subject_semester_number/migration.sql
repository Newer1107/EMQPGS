-- Add nullable semesterNumber column
ALTER TABLE `Subject` ADD COLUMN `semesterNumber` INT NULL;

-- Backfill from existing Semester.number
UPDATE `Subject` s
JOIN `Semester` sem ON s.`semesterId` = sem.`id`
SET s.`semesterNumber` = sem.`number`;

-- Drop FK and old column
ALTER TABLE `Subject` DROP FOREIGN KEY `Subject_semesterId_fkey`;
ALTER TABLE `Subject` DROP INDEX `Subject_semesterId_idx`;
ALTER TABLE `Subject` DROP COLUMN `semesterId`;

-- Make semesterNumber required
ALTER TABLE `Subject` MODIFY COLUMN `semesterNumber` INT NOT NULL;

-- Add index on semesterNumber
CREATE INDEX `Subject_semesterNumber_idx` ON `Subject`(`semesterNumber`);
