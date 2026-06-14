CREATE TABLE `sensors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`number` varchar(128) NOT NULL,
	`calibrationDate` timestamp NOT NULL,
	`nextCalibrationDate` timestamp NOT NULL,
	`status` enum('active','expiring_soon','expired') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE `excursionStudySessions` DROP INDEX `excursionStudySessions_protocolId_unique`;--> statement-breakpoint
ALTER TABLE `generalInfo` DROP INDEX `generalInfo_protocolId_unique`;--> statement-breakpoint
ALTER TABLE `pvSessions` DROP INDEX `pvSessions_protocolId_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `checklistAnswers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `companies` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `companyMembers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `excursionLoggers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `excursionStudySessions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `generalInfo` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `organizations` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `protocols` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `pvLoggers` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `pvSessions` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `questionTemplates` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `users` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `warehouseEquipment` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `warehouseProtocolSections` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `companies` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `companyMembers` MODIFY COLUMN `invitedAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `companyMembers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `excursionLoggers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `organizations` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `protocols` MODIFY COLUMN `companyId` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `protocols` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `pvLoggers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `warehouseEquipment` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE INDEX `excursionStudySessions_protocolId_unique` ON `excursionStudySessions` (`protocolId`);--> statement-breakpoint
CREATE INDEX `generalInfo_protocolId_unique` ON `generalInfo` (`protocolId`);--> statement-breakpoint
CREATE INDEX `pvSessions_protocolId_unique` ON `pvSessions` (`protocolId`);--> statement-breakpoint
CREATE INDEX `users_openId_unique` ON `users` (`openId`);