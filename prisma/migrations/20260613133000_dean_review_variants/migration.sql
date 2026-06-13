-- Drop foreign keys that forced dean selections to reference GeneratedPaper ids.
ALTER TABLE `DeanReview` DROP FOREIGN KEY `DeanReview_regularPaperId_fkey`;
ALTER TABLE `DeanReview` DROP FOREIGN KEY `DeanReview_supplementaryPaperId_fkey`;
ALTER TABLE `DeanReview` DROP FOREIGN KEY `DeanReview_ktPaperId_fkey`;

-- Preserve any existing selections by rewriting stored paper ids to their PAPER_A/B/C variants.
UPDATE `DeanReview` AS `dr`
INNER JOIN `GeneratedPaper` AS `gp` ON `dr`.`regularPaperId` = `gp`.`id`
SET `dr`.`regularPaperId` = `gp`.`variant`;

UPDATE `DeanReview` AS `dr`
INNER JOIN `GeneratedPaper` AS `gp` ON `dr`.`supplementaryPaperId` = `gp`.`id`
SET `dr`.`supplementaryPaperId` = `gp`.`variant`;

UPDATE `DeanReview` AS `dr`
INNER JOIN `GeneratedPaper` AS `gp` ON `dr`.`ktPaperId` = `gp`.`id`
SET `dr`.`ktPaperId` = `gp`.`variant`;

-- Convert the stored slot selections into enum-style paper variants.
ALTER TABLE `DeanReview`
    MODIFY `regularPaperId` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    MODIFY `supplementaryPaperId` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL,
    MODIFY `ktPaperId` ENUM('PAPER_A', 'PAPER_B', 'PAPER_C') NOT NULL;
