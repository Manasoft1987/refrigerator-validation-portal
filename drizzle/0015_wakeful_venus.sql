ALTER TABLE `protocols` MODIFY COLUMN `equipmentType` enum('refrigerator','auto-refrigerator','warehouse','other') NOT NULL DEFAULT 'refrigerator';--> statement-breakpoint
ALTER TABLE `questionTemplates` MODIFY COLUMN `equipmentType` enum('refrigerator','auto-refrigerator','warehouse','other') NOT NULL DEFAULT 'refrigerator';--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whLengthM` decimal(8,2);--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whWidthM` decimal(8,2);--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whHeightM` decimal(8,2);--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whHumidityControl` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whHumidityMin` decimal(5,2);--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whHumidityMax` decimal(5,2);--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whSeason` varchar(16);--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whStudyType` varchar(32);--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whExternalEnv` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `generalInfo` ADD `whLayoutNotes` text;