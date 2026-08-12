ALTER TABLE `protocols`
  MODIFY COLUMN `equipmentType`
  enum('refrigerator','freezer','auto-refrigerator','auto-refrigerator-kg','thermal-container','computerized-system','warehouse','warehouse-expert','other')
  NOT NULL DEFAULT 'refrigerator';--> statement-breakpoint
ALTER TABLE `questionTemplates`
  MODIFY COLUMN `equipmentType`
  enum('refrigerator','freezer','auto-refrigerator','auto-refrigerator-kg','chamber','thermal-container','computerized-system','warehouse','warehouse-expert','other')
  DEFAULT 'refrigerator';--> statement-breakpoint
