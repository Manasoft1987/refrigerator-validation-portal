/**
 * Backfill script: update organizations with NULL companyId.
 * For each organization, find the company created by the same admin (userId)
 * and set companyId accordingly.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

// Find all organizations with NULL companyId
const [orgs] = await conn.execute(
  "SELECT id, userId FROM organizations WHERE companyId IS NULL"
);
console.log(`Found ${orgs.length} organizations with NULL companyId`);

let updated = 0;
for (const org of orgs) {
  // Find a company created by this user (admin)
  const [companies] = await conn.execute(
    "SELECT id FROM companies WHERE createdByAdminId = ? ORDER BY id ASC LIMIT 1",
    [org.userId]
  );
  if (companies.length > 0) {
    const companyId = companies[0].id;
    await conn.execute(
      "UPDATE organizations SET companyId = ? WHERE id = ?",
      [companyId, org.id]
    );
    console.log(`  org ${org.id} (userId=${org.userId}) → companyId=${companyId}`);
    updated++;
  } else {
    console.log(`  org ${org.id} (userId=${org.userId}) — no company found, skipping`);
  }
}

console.log(`\nDone. Updated ${updated} / ${orgs.length} organizations.`);
await conn.end();
