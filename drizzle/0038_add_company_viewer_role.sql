ALTER TABLE `companyMembers`
  MODIFY COLUMN `role` enum('admin','user','viewer') NOT NULL DEFAULT 'user';
