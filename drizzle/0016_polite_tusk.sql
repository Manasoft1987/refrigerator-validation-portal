CREATE TABLE `warehouseEquipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolId` int NOT NULL,
	`ord` int NOT NULL DEFAULT 0,
	`name` varchar(255) NOT NULL,
	`manufacturer` varchar(255),
	`model` varchar(255),
	`serial` varchar(128),
	`inventory` varchar(128),
	`purpose` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseEquipment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouseProtocolSections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolId` int NOT NULL,
	`sectionKey` varchar(16) NOT NULL,
	`content` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `warehouseProtocolSections_id` PRIMARY KEY(`id`)
);
