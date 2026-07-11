ALTER TABLE `protocols`
  MODIFY COLUMN `equipmentType`
  enum('refrigerator','auto-refrigerator','thermal-container','warehouse','other')
  NOT NULL DEFAULT 'refrigerator';

ALTER TABLE `generalInfo`
  ADD COLUMN `thermalContainerConfig` json NULL AFTER `tempMode`;

ALTER TABLE `questionTemplates`
  MODIFY COLUMN `equipmentType`
  enum('refrigerator','auto-refrigerator','chamber','thermal-container','warehouse','other')
  NOT NULL DEFAULT 'refrigerator';
