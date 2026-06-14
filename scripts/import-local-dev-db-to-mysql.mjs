import mysql from "mysql2/promise";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dbPath = process.env.LOCAL_DEV_DB_PATH
  ? path.resolve(process.env.LOCAL_DEV_DB_PATH)
  : path.join(root, ".storage", "dev-db.json");

const replace = process.argv.includes("--replace");
const dryRun = process.argv.includes("--dry-run");

if (!existsSync(dbPath)) {
  throw new Error(`Local dev DB not found: ${dbPath}`);
}

const raw = readFileSync(dbPath, "utf8");
const localDb = JSON.parse(raw);

const tablePlan = [
  {
    key: "users",
    table: "users",
    columns: ["id", "openId", "name", "email", "loginMethod", "role", "createdAt", "updatedAt", "lastSignedIn"],
  },
  {
    key: "companies",
    table: "companies",
    columns: ["id", "name", "createdByAdminId", "createdAt", "updatedAt"],
  },
  {
    key: "companyMembers",
    table: "companyMembers",
    columns: [
      "id",
      "userId",
      "companyId",
      "role",
      "status",
      "invitedAt",
      "approvedAt",
      "rejectedAt",
      "approvedByAdminId",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "organizations",
    table: "organizations",
    columns: [
      "id",
      "userId",
      "name",
      "bin",
      "addressLegal",
      "addressFact",
      "responsible",
      "phone",
      "email",
      "logoUrl",
      "logoKey",
      "createdAt",
      "updatedAt",
      "companyId",
    ],
  },
  {
    key: "protocols",
    table: "protocols",
    columns: [
      "id",
      "organizationId",
      "userId",
      "number",
      "status",
      "iqVerdict",
      "oqVerdict",
      "pvVerdict",
      "createdAt",
      "updatedAt",
      "companyId",
      "equipmentType",
      "customEquipmentName",
    ],
  },
  {
    key: "generalInfo",
    table: "generalInfo",
    jsonColumns: ["commissionMembers", "signatoriesPart1", "signatoriesPart2"],
    columns: [
      "id",
      "protocolId",
      "equipmentType",
      "manufacturer",
      "model",
      "serial",
      "inventory",
      "year",
      "tempMode",
      "location",
      "purpose",
      "validationDate",
      "basis",
      "commissionMembers",
      "updatedAt",
      "signatoriesPart1",
      "signatoriesPart2",
      "planDeviations",
      "recommendations",
      "reportDate",
      "documentValidityPeriod",
      "whLengthM",
      "whWidthM",
      "whHeightM",
      "whHumidityControl",
      "whHumidityMin",
      "whHumidityMax",
      "whSeason",
      "whStudyType",
      "whExternalEnv",
      "whLayoutNotes",
      "qualificationType",
      "season",
      "fillStatus",
      "loadPercent",
    ],
  },
  {
    key: "pvSessions",
    table: "pvSessions",
    jsonColumns: ["stats", "deviations", "coolingUnitPos", "doorPos", "floorPlanObjects"],
    columns: [
      "id",
      "protocolId",
      "tempMode",
      "startAt",
      "endAt",
      "minDurationHours",
      "minSensorCount",
      "customMin",
      "customMax",
      "verdict",
      "stats",
      "deviations",
      "conclusionText",
      "updatedAt",
      "samplingStepMinutes",
      "coolingUnitPos",
      "doorPos",
      "floorPlanObjects",
      "roomLengthM",
      "roomWidthM",
      "roomHeightM",
      "planImageKey",
      "planImageUrl",
    ],
  },
  {
    key: "pvLoggers",
    table: "pvLoggers",
    jsonColumns: ["series", "deviations"],
    columns: [
      "id",
      "pvSessionId",
      "protocolId",
      "fileKey",
      "fileUrl",
      "fileName",
      "label",
      "customName",
      "role",
      "pointCount",
      "minVal",
      "maxVal",
      "avgVal",
      "stdVal",
      "mktVal",
      "series",
      "deviations",
      "createdAt",
      "position",
      "posX",
      "posY",
      "firstTs",
    ],
  },
  {
    key: "excursionStudySessions",
    table: "excursionStudySessions",
    jsonColumns: ["t1SensorEntries", "warnings", "t2SensorBreaks", "t3SensorBreaks"],
    columns: [
      "id",
      "protocolId",
      "enabled",
      "timingVsPv",
      "test1Enabled",
      "test2Enabled",
      "test3Enabled",
      "recordStartAt",
      "recordEndAt",
      "t1PowerOnAt",
      "t1StabilizationThresholdMinutes",
      "t1TStableAt",
      "t1DurationSec",
      "t1CriticalSensor",
      "t1SensorEntries",
      "t2DoorOpenAt",
      "t2DoorCloseAt",
      "t2TBreakAt",
      "t2DurationSec",
      "t2CriticalSensor",
      "t2NoBreak",
      "t3PowerOffAt",
      "t3TBreakAt",
      "t3DurationSec",
      "t3CriticalSensor",
      "t3NoBreak",
      "stabilizationBetweenT2T3Ok",
      "warnings",
      "updatedAt",
      "t2SensorBreaks",
      "t3SensorBreaks",
      "t3TestEndAt",
    ],
  },
  {
    key: "excursionLoggers",
    table: "excursionLoggers",
    jsonColumns: ["series"],
    columns: [
      "id",
      "excursionSessionId",
      "protocolId",
      "fileKey",
      "fileUrl",
      "fileName",
      "label",
      "customName",
      "role",
      "pointCount",
      "series",
      "createdAt",
    ],
  },
  {
    key: "checklistAnswers",
    table: "checklistAnswers",
    columns: [
      "id",
      "protocolId",
      "stage",
      "questionIndex",
      "questionText",
      "answer",
      "comment",
      "updatedAt",
      "warehouseEquipmentId",
    ],
  },
  {
    key: "sensors",
    table: "sensors",
    columns: ["id", "number", "calibrationDate", "nextCalibrationDate", "status", "createdAt", "updatedAt"],
  },
  {
    key: "protocolSensors",
    table: "protocolSensors",
    columns: ["id", "protocolId", "sensorId", "createdAt"],
  },
  {
    key: "questionTemplates",
    table: "questionTemplates",
    columns: ["id", "stage", "ord", "text", "isDefault", "companyId", "equipmentType", "equipmentKind"],
  },
  {
    key: "warehouseProtocolSections",
    table: "warehouseProtocolSections",
    columns: ["id", "protocolId", "sectionKey", "content", "updatedAt", "fillStatus"],
  },
  {
    key: "warehouseEquipment",
    table: "warehouseEquipment",
    columns: [
      "id",
      "protocolId",
      "ord",
      "name",
      "manufacturer",
      "model",
      "serial",
      "inventory",
      "purpose",
      "createdAt",
      "updatedAt",
      "kind",
    ],
  },
];

function quoteIdent(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function normalizeValue(row, column, jsonColumns = []) {
  const value = row[column];
  if (value === undefined) return null;
  if (value === null) return null;
  if (jsonColumns.includes(column) && typeof value !== "string") {
    return JSON.stringify(value);
  }
  return value;
}

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function assertTargetIsEmpty(connection) {
  const nonEmpty = [];
  for (const plan of tablePlan) {
    const [rows] = await connection.query(`select count(*) as count from ${quoteIdent(plan.table)}`);
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) nonEmpty.push(`${plan.table}=${count}`);
  }

  if (nonEmpty.length > 0) {
    throw new Error(
      `Target database is not empty (${nonEmpty.join(", ")}). Re-run with --replace only after backup.`,
    );
  }
}

async function clearTarget(connection) {
  await connection.query("set foreign_key_checks = 0");
  for (const plan of [...tablePlan].reverse()) {
    await connection.query(`delete from ${quoteIdent(plan.table)}`);
  }
  await connection.query("set foreign_key_checks = 1");
}

async function insertRows(connection, plan, rows) {
  if (!rows.length) return;

  for (const group of chunks(rows, 100)) {
    const placeholders = group
      .map(() => `(${plan.columns.map(() => "?").join(", ")})`)
      .join(", ");
    const values = group.flatMap(row =>
      plan.columns.map(column => normalizeValue(row, column, plan.jsonColumns ?? [])),
    );

    await connection.query(
      `insert into ${quoteIdent(plan.table)} (${plan.columns.map(quoteIdent).join(", ")}) values ${placeholders}`,
      values,
    );
  }

  const maxId = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
  if (maxId > 0) {
    await connection.query(`alter table ${quoteIdent(plan.table)} auto_increment = ?`, [maxId + 1]);
  }
}

const summary = tablePlan.map(plan => ({
  table: plan.table,
  rows: Array.isArray(localDb[plan.key]) ? localDb[plan.key].length : 0,
}));

console.log(`Import source: ${dbPath}`);
for (const item of summary) console.log(`${item.table}: ${item.rows}`);

if (dryRun) {
  console.log("Dry run complete. No data was written.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required, for example mysql://user:pass@host:3306/database");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  if (replace) {
    console.log("Clearing target database (--replace)...");
    await clearTarget(connection);
  } else {
    await assertTargetIsEmpty(connection);
  }

  for (const plan of tablePlan) {
    const rows = Array.isArray(localDb[plan.key]) ? localDb[plan.key] : [];
    await insertRows(connection, plan, rows);
  }

  console.log("Local dev DB import complete.");
} finally {
  await connection.end();
}
