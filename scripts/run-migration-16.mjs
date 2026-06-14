import mysql from "mysql2/promise";
import fs from "fs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const conn = await mysql.createConnection(url);
const sql = fs.readFileSync(
  new URL("../drizzle/0016_polite_tusk.sql", import.meta.url),
  "utf8"
);
const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log("OK:", stmt.slice(0, 80));
  } catch (e) {
    if (e.code === "ER_TABLE_EXISTS_ERROR" || e.code === "ER_DUP_FIELDNAME") {
      console.log("SKIP (already exists):", stmt.slice(0, 60));
    } else {
      console.error("ERROR:", e.message, "\n", stmt.slice(0, 100));
    }
  }
}
await conn.end();
console.log("Migration 0016 done");
