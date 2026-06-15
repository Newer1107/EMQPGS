-- Drop timetableBranch from ExamCycle (redundant with Department.name/code)
ALTER TABLE `ExamCycle` DROP COLUMN `timetableBranch`;
