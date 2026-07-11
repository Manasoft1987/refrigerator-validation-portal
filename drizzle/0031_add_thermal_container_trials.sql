ALTER TABLE `pvSessions`
  ADD COLUMN `trialKey` varchar(32) NOT NULL DEFAULT 'default' AFTER `protocolId`;

ALTER TABLE `pvSessions`
  DROP INDEX `pvSessions_protocolId_unique`;

ALTER TABLE `pvSessions`
  ADD UNIQUE INDEX `pvSessions_protocolId_trialKey_unique` (`protocolId`, `trialKey`);

ALTER TABLE `pvLoggers`
  ADD COLUMN `trialKey` varchar(32) NOT NULL DEFAULT 'default' AFTER `protocolId`;

CREATE INDEX `pvLoggers_protocolId_trialKey_idx`
  ON `pvLoggers` (`protocolId`, `trialKey`);
