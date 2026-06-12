ALTER TABLE `ExamCycle`
    ADD COLUMN `timetableDocumentRef` VARCHAR(191) NULL,
    ADD COLUMN `timetableIssueDate` DATETIME(3) NULL,
    ADD COLUMN `timetableTitle` VARCHAR(191) NULL,
    ADD COLUMN `timetableBranch` VARCHAR(191) NULL,
    ADD COLUMN `timetableRows` JSON NULL,
    ADD COLUMN `timetableSignature` VARCHAR(191) NULL;
