import mysql from "mysql2/promise";
import process from "node:process";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const url = new URL(process.env.DATABASE_URL);
const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

if (!databaseName || databaseName === "sys") {
  throw new Error("DATABASE_URL must point to an application database, not sys");
}

const adminUrl = new URL(process.env.DATABASE_URL);
adminUrl.pathname = "/";

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

const connection = await mysql.createConnection(adminUrl.toString());

try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(databaseName)}`);
  console.log(`Database is ready: ${databaseName}`);
} finally {
  await connection.end();
}
