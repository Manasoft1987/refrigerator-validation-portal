ALTER TABLE `protocols`
  MODIFY COLUMN `equipmentType`
  enum('refrigerator','auto-refrigerator','thermal-container','computerized-system','warehouse','other')
  NULL DEFAULT 'refrigerator';

ALTER TABLE `generalInfo`
  ADD COLUMN `computerizedSystemConfig` json NULL AFTER `thermalContainerConfig`;

ALTER TABLE `generalInfo`
  MODIFY COLUMN `equipmentType`
  enum('refrigerator','auto-refrigerator','chamber','thermal-container','computerized-system','warehouse','other')
  NOT NULL DEFAULT 'refrigerator';
