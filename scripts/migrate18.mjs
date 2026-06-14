#!/usr/bin/env node
// Run from project root: node scripts/migrate18.mjs
import { createConnection } from "/home/ubuntu/refrigerator-validation-portal/node_modules/mysql2/promise/index.js";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await createConnection(url);
try {
  await conn.execute("ALTER TABLE `checklistAnswers` ADD `warehouseEquipmentId` int");
  console.log("Migration 18 applied: warehouseEquipmentId added");
} catch(e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("Already applied: warehouseEquipmentId exists");
  } else {
    console.error("Error:", e.message);
    process.exit(1);
  }
} finally {
  await conn.end();
}
