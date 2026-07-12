ALTER TABLE `pvSessions`
  ADD COLUMN `planBackgroundImageKey` varchar(512) NULL AFTER `planImageUrl`;

ALTER TABLE `pvSessions`
  ADD COLUMN `planBackgroundImageUrl` varchar(512) NULL AFTER `planBackgroundImageKey`;
