#!/usr/bin/env node
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

// Load .env.local if it exists
dotenv.config({ path: envPath });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set in environment");
  process.exit(1);
}

const runMigration = async () => {
  try {
    const connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);

    console.log("Running migration 0017...");
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "..", "drizzle"),
    });

    console.log("✓ Migration 0017 completed successfully");
    await connection.end();
  } catch (error) {
    // Ignore "already exists" errors (idempotent)
    if (error.message && error.message.includes("Duplicate column")) {
      console.log("✓ Columns already exist (idempotent)");
      return;
    }
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
