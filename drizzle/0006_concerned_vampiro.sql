ALTER TABLE `pvLoggers` ADD `position` enum('top','middle','bottom','door','external','unset') DEFAULT 'unset' NOT NULL;--> statement-breakpoint
ALTER TABLE `pvLoggers` ADD `posX` decimal(5,2);--> statement-breakpoint
ALTER TABLE `pvLoggers` ADD `posY` decimal(5,2);