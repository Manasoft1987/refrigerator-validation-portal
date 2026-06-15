import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const tables = [
  "users",
  "companies",
  "organizations",
  "protocols",
  "generalInfo",
  "pvSessions",
  "pvLoggers",
  "excursionStudySessions",
  "excursionLoggers",
  "checklistAnswers",
  "sensors",
  "protocolSensors",
  "questionTemplates",
];

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  for (const table of tables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    console.log(`${table}: ${rows[0].count}`);
  }

  const [protocolRows] = await connection.query(
    "SELECT number, equipmentType, status FROM protocols ORDER BY id LIMIT 5",
  );
  console.log("protocols_sample:", JSON.stringify(protocolRows));
} finally {
  await connection.end();
}
