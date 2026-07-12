ALTER TABLE `protocols`
  MODIFY COLUMN `equipmentType`
  enum('refrigerator','auto-refrigerator','thermal-container','computerized-system','warehouse','other')
  DEFAULT 'refrigerator';

ALTER TABLE `generalInfo`
  ADD COLUMN `computerizedSystemConfig` json NULL AFTER `thermalContainerConfig`;
