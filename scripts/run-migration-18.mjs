import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, "../drizzle/0018_deep_lyja.sql");
const sql = readFileSync(sqlPath, "utf8").trim();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection(url);
try {
  const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log("✓", stmt.slice(0, 80));
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME" || e.code === "ER_DUP_KEYNAME" || e.code === "ER_TABLE_EXISTS_ERROR") {
        console.log("⚠ already applied:", stmt.slice(0, 80));
      } else {
        throw e;
      }
    }
  }
  console.log("Migration 18 complete");
} finally {
  await conn.end();
}
