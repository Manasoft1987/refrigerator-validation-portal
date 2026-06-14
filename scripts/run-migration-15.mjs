import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import fs from "fs";

const db = drizzle(process.env.DATABASE_URL);
const file = "drizzle/0015_wakeful_venus.sql";
const text = fs.readFileSync(file, "utf8");
const stmts = text.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

for (const s of stmts) {
  console.log(">", s.slice(0, 80));
  try {
    await db.execute(sql.raw(s));
  } catch (e) {
    if (e?.cause?.code === "ER_DUP_FIELDNAME" || e?.cause?.code === "ER_DUP_KEYNAME") {
      console.log("   skip (already exists):", e.cause.sqlMessage);
      continue;
    }
    throw e;
  }
}
console.log("done");
process.exit(0);
