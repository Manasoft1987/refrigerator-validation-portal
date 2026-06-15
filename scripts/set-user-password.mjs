import { config } from "dotenv";
import { randomBytes, scryptSync, createHash } from "node:crypto";
import { parseArgs } from "node:util";
import mysql from "mysql2/promise";

config({ path: ".env.local", override: false });
config({ override: false });

const KEY_LENGTH = 32;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt:v1:${salt}:${key}`;
}

function stableOpenId(email) {
  const digest = createHash("sha256").update(email).digest("hex").slice(0, 48);
  return `password:${digest}`;
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
    role: { type: "string", default: "user" },
    "open-id": { type: "string" },
    "company-id": { type: "string" },
    "company-role": { type: "string", default: "user" },
  },
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const email = values.email?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  throw new Error("--email is required");
}

const name = values.name?.trim() || email;
const role = values.role === "admin" ? "admin" : "user";
const companyRole = values["company-role"] === "admin" ? "admin" : "user";
const openId = values["open-id"]?.trim() || stableOpenId(email);
const password = values.password || randomBytes(12).toString("base64url");
const passwordHash = hashPassword(password);
const companyId = values["company-id"] ? Number(values["company-id"]) : null;

if (companyId !== null && (!Number.isInteger(companyId) || companyId <= 0)) {
  throw new Error("--company-id must be a positive integer");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [existingRows] = await connection.execute(
    `SELECT id FROM users WHERE openId = ? OR email = ? ORDER BY openId = ? DESC LIMIT 1`,
    [openId, email, openId],
  );

  let userId;
  if (existingRows.length > 0) {
    userId = existingRows[0].id;
    await connection.execute(
      `UPDATE users
          SET openId = ?, name = ?, email = ?, loginMethod = 'password', role = ?, passwordHash = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [openId, name, email, role, passwordHash, userId],
    );
  } else {
    const [insertResult] = await connection.execute(
      `INSERT INTO users (openId, name, email, loginMethod, role, passwordHash)
       VALUES (?, ?, ?, 'password', ?, ?)`,
      [openId, name, email, role, passwordHash],
    );
    userId = insertResult.insertId;
  }

  if (companyId !== null) {
    const [companyRows] = await connection.execute(`SELECT id FROM companies WHERE id = ? LIMIT 1`, [companyId]);
    if (companyRows.length === 0) {
      throw new Error(`Company ${companyId} not found`);
    }

    const [memberRows] = await connection.execute(
      `SELECT id FROM companyMembers WHERE userId = ? AND companyId = ? LIMIT 1`,
      [userId, companyId],
    );

    if (memberRows.length > 0) {
      await connection.execute(
        `UPDATE companyMembers
            SET role = ?, status = 'approved', approvedAt = COALESCE(approvedAt, CURRENT_TIMESTAMP),
                approvedByAdminId = COALESCE(approvedByAdminId, 1), updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [companyRole, memberRows[0].id],
      );
    } else {
      await connection.execute(
        `INSERT INTO companyMembers (userId, companyId, role, status, approvedAt, approvedByAdminId)
         VALUES (?, ?, ?, 'approved', CURRENT_TIMESTAMP, 1)`,
        [userId, companyId, companyRole],
      );
    }
  }

  console.log(`User ready: ${name} <${email}>`);
  console.log(`Open ID: ${openId}`);
  if (companyId !== null) console.log(`Company membership: approved in company ${companyId}`);
  console.log(`Password: ${password}`);
} finally {
  await connection.end();
}
