ALTER TABLE `protocols` MODIFY COLUMN `equipmentType` enum('refrigerator','auto-refrigerator','other') NOT NULL DEFAULT 'refrigerator';--> statement-breakpoint
ALTER TABLE `protocols` ADD `customEquipmentName` varchar(255);--> statement-breakpoint
ALTER TABLE `questionTemplates` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `questionTemplates` ADD `equipmentType` enum('refrigerator','auto-refrigerator','other') DEFAULT 'refrigerator' NOT NULL;