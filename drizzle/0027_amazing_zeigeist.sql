CREATE TABLE `protocolSensors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`protocolId` int NOT NULL,
	`sensorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
