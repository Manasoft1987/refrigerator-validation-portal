CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdByAdminId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companyMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyId` int NOT NULL,
	`role` enum('admin','user') NOT NULL DEFAULT 'user',
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	`rejectedAt` timestamp,
	`approvedByAdminId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companyMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `organizations` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `protocols` ADD `companyId` int NOT NULL;