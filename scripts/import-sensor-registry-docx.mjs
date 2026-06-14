import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node scripts/import-sensor-registry-docx.mjs <registry.docx>");
  process.exit(1);
}

const absoluteSource = path.resolve(sourcePath);
if (!existsSync(absoluteSource)) {
  console.error(`Registry file not found: ${absoluteSource}`);
  process.exit(1);
}

const root = process.cwd();
const workDir = path.join(root, ".codex-sensor-import", "runtime");
const zipPath = path.join(workDir, "registry.zip");
const unzipDir = path.join(workDir, "unzipped");
const documentXmlPath = path.join(unzipDir, "word", "document.xml");
const dbPath = path.join(root, ".storage", "dev-db.json");

function decodeXml(text) {
  return String(text ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function textFromXml(fragment) {
  return Array.from(fragment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map(match => decodeXml(match[1]))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDateFromRu(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

function statusFor(nextCalibrationDate) {
  const next = new Date(nextCalibrationDate).getTime();
  const now = Date.now();
  if (!Number.isFinite(next)) return "active";
  if (next < now) return "expired";
  if (next - now <= 30 * 24 * 60 * 60 * 1000) return "expiring_soon";
  return "active";
}

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });
copyFileSync(absoluteSource, zipPath);

execFileSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${unzipDir.replace(/'/g, "''")}' -Force`,
], { stdio: "pipe" });

const xml = readFileSync(documentXmlPath, "utf8");
const rows = Array.from(xml.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)).map(match => match[0]);
const registry = [];
const seen = new Set();

for (const row of rows) {
  const cells = Array.from(row.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)).map(match => textFromXml(match[0]));
  const rowText = cells.join(" ");
  const number = rowText.match(/\b\d{6}STS\d{7}\b/i)?.[0]?.toUpperCase();
  const dates = Array.from(rowText.matchAll(/\b\d{2}\.\d{2}\.\d{4}\b/g)).map(match => match[0]);
  if (!number || dates.length < 2 || seen.has(number)) continue;
  const calibrationDate = isoDateFromRu(dates[0]);
  const nextCalibrationDate = isoDateFromRu(dates[1]);
  if (!calibrationDate || !nextCalibrationDate) continue;
  seen.add(number);
  registry.push({
    number,
    calibrationDate,
    nextCalibrationDate,
    status: statusFor(nextCalibrationDate),
  });
}

if (registry.length === 0) {
  console.error("No sensor rows found in registry.");
  process.exit(1);
}

const db = existsSync(dbPath)
  ? JSON.parse(readFileSync(dbPath, "utf8"))
  : { counters: {}, sensors: [], protocolSensors: [] };

db.counters ??= {};
db.sensors ??= [];
db.protocolSensors ??= [];
db.counters.sensors = Math.max(
  db.counters.sensors ?? 0,
  ...db.sensors.map(sensor => Number(sensor.id) || 0),
);
db.counters.protocolSensors = Math.max(
  db.counters.protocolSensors ?? 0,
  ...db.protocolSensors.map(link => Number(link.id) || 0),
);

let inserted = 0;
let updated = 0;
let linked = 0;
const nowIso = new Date().toISOString();

for (const sensor of registry) {
  const existing = db.sensors.find(item => String(item.number).toLowerCase() === sensor.number.toLowerCase());
  if (existing) {
    existing.calibrationDate = sensor.calibrationDate;
    existing.nextCalibrationDate = sensor.nextCalibrationDate;
    existing.status = sensor.status;
    existing.updatedAt = nowIso;
    updated += 1;
  } else {
    db.counters.sensors += 1;
    db.sensors.push({
      id: db.counters.sensors,
      number: sensor.number,
      calibrationDate: sensor.calibrationDate,
      nextCalibrationDate: sensor.nextCalibrationDate,
      status: sensor.status,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    inserted += 1;
  }
}

const sensorsByNumber = new Map(
  db.sensors.map(sensor => [String(sensor.number).toLowerCase(), sensor]),
);
const existingLinks = new Set(
  db.protocolSensors.map(link => `${link.protocolId}:${link.sensorId}`),
);
const loggers = [
  ...(Array.isArray(db.pvLoggers) ? db.pvLoggers : []),
  ...(Array.isArray(db.excursionLoggers) ? db.excursionLoggers : []),
];

for (const logger of loggers) {
  const number = String(logger.label ?? "").trim().toLowerCase();
  const sensor = sensorsByNumber.get(number);
  if (!sensor || !logger.protocolId) continue;
  const key = `${logger.protocolId}:${sensor.id}`;
  if (existingLinks.has(key)) continue;
  db.counters.protocolSensors += 1;
  db.protocolSensors.push({
    id: db.counters.protocolSensors,
    protocolId: logger.protocolId,
    sensorId: sensor.id,
    createdAt: nowIso,
  });
  existingLinks.add(key);
  linked += 1;
}

writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");

console.log(JSON.stringify({
  registryRows: registry.length,
  inserted,
  updated,
  linked,
  totalSensors: db.sensors.length,
  totalProtocolSensorLinks: db.protocolSensors.length,
}, null, 2));
