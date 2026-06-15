import { config } from "dotenv";
import mysql from "mysql2/promise";

config({ path: ".env.local", override: false });
config({ override: false });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'passwordHash'`,
  );

  if (columns.length === 0) {
    await connection.execute(`ALTER TABLE users ADD COLUMN passwordHash varchar(255) NULL AFTER loginMethod`);
    console.log("Added users.passwordHash");
  } else {
    console.log("users.passwordHash already exists");
  }

  const [indexes] = await connection.execute(`SHOW INDEX FROM users WHERE Key_name = 'users_email_idx'`);
  if (indexes.length === 0) {
    await connection.execute(`CREATE INDEX users_email_idx ON users (email)`);
    console.log("Added users_email_idx");
  } else {
    console.log("users_email_idx already exists");
  }
} finally {
  await connection.end();
}
