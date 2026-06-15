import mysql from "mysql2/promise";

const [url] = process.argv.slice(2);
if (!url) throw new Error("Usage: node scripts/check-tidb-connection.mjs <database-url>");

const safeUrl = new URL(url);
safeUrl.password = "***";

try {
  const connection = await mysql.createConnection(url);
  const [rows] = await connection.query("select current_user() as currentUser, database() as databaseName");
  await connection.end();
  console.log("Connection OK:", JSON.stringify(rows[0]));
} catch (error) {
  console.error("Connection failed:", error.code || error.name, error.message);
  process.exit(1);
}
