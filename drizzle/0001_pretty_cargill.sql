CREATE TABLE `checklistAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolId` int NOT NULL,
	`stage` enum('iq','oq') NOT NULL,
	`questionIndex` int NOT NULL,
	`questionText` text NOT NULL,
	`answer` enum('yes','no','na','unset') NOT NULL DEFAULT 'unset',
	`comment` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklistAnswers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generalInfo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolId` int NOT NULL,
	`equipmentType` varchar(64),
	`manufacturer` varchar(255),
	`model` varchar(255),
	`serial` varchar(128),
	`inventory` varchar(128),
	`year` int,
	`tempMode` varchar(16),
	`location` text,
	`purpose` text,
	`validationDate` varchar(32),
	`basis` varchar(64),
	`commissionMembers` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generalInfo_id` PRIMARY KEY(`id`),
	CONSTRAINT `generalInfo_protocolId_unique` UNIQUE(`protocolId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`bin` varchar(32),
	`addressLegal` text,
	`addressFact` text,
	`responsible` varchar(255),
	`phone` varchar(64),
	`email` varchar(320),
	`logoUrl` varchar(512),
	`logoKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `protocols` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`number` varchar(32) NOT NULL,
	`status` enum('draft','iq_done','oq_done','pv_done','completed') NOT NULL DEFAULT 'draft',
	`iqVerdict` enum('pass','fail','none') NOT NULL DEFAULT 'none',
	`oqVerdict` enum('pass','fail','none') NOT NULL DEFAULT 'none',
	`pvVerdict` enum('pass','fail','none') NOT NULL DEFAULT 'none',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `protocols_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pvLoggers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pvSessionId` int NOT NULL,
	`protocolId` int NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`label` varchar(64) NOT NULL,
	`customName` varchar(128),
	`role` enum('internal','external') NOT NULL DEFAULT 'internal',
	`pointCount` int NOT NULL DEFAULT 0,
	`minVal` decimal(8,3),
	`maxVal` decimal(8,3),
	`avgVal` decimal(8,3),
	`stdVal` decimal(8,3),
	`mktVal` decimal(8,3),
	`series` json,
	`deviations` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pvLoggers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pvSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolId` int NOT NULL,
	`tempMode` varchar(16),
	`startAt` bigint,
	`endAt` bigint,
	`minDurationHours` int NOT NULL DEFAULT 72,
	`minSensorCount` int NOT NULL DEFAULT 9,
	`customMin` decimal(6,2),
	`customMax` decimal(6,2),
	`verdict` enum('pass','fail','none') NOT NULL DEFAULT 'none',
	`stats` json,
	`deviations` json,
	`conclusionText` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pvSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pvSessions_protocolId_unique` UNIQUE(`protocolId`)
);
--> statement-breakpoint
CREATE TABLE `questionTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stage` enum('iq','oq') NOT NULL,
	`ord` int NOT NULL,
	`text` text NOT NULL,
	`isDefault` int NOT NULL DEFAULT 1,
	CONSTRAINT `questionTemplates_id` PRIMARY KEY(`id`)
);
