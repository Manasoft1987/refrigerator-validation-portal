import mysql from "mysql2/promise";
import process from "node:process";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const replace = process.argv.includes("--replace");

const tableNames = [
  "protocolSensors",
  "sensors",
  "warehouseProtocolSections",
  "warehouseEquipment",
  "questionTemplates",
  "checklistAnswers",
  "excursionLoggers",
  "excursionStudySessions",
  "pvLoggers",
  "pvSessions",
  "generalInfo",
  "protocols",
  "organizations",
  "companyMembers",
  "companies",
  "users",
];

const schemaSql = [
  `CREATE TABLE IF NOT EXISTS users (
    id int AUTO_INCREMENT NOT NULL,
    openId varchar(64) NOT NULL,
    name text,
    email varchar(320),
    loginMethod varchar(64),
    passwordHash varchar(255),
    role enum('user','admin') NOT NULL DEFAULT 'user',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastSignedIn timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_openId_unique (openId)
  )`,
  `CREATE TABLE IF NOT EXISTS companies (
    id int AUTO_INCREMENT NOT NULL,
    name varchar(255) NOT NULL,
    createdByAdminId int NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS companyMembers (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    companyId int NOT NULL,
    role enum('admin','user') NOT NULL DEFAULT 'user',
    status enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    invitedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approvedAt timestamp NULL,
    rejectedAt timestamp NULL,
    approvedByAdminId int,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS organizations (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    name varchar(255) NOT NULL,
    bin varchar(32),
    addressLegal text,
    addressFact text,
    responsible varchar(255),
    phone varchar(64),
    email varchar(320),
    logoUrl varchar(512),
    logoKey varchar(512),
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    companyId int,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS protocols (
    id int AUTO_INCREMENT NOT NULL,
    organizationId int NOT NULL,
    userId int NOT NULL,
    number varchar(32) NOT NULL,
    status enum('draft','iq_done','oq_done','pv_done','completed') NOT NULL DEFAULT 'draft',
    iqVerdict enum('pass','fail','none') NOT NULL DEFAULT 'none',
    oqVerdict enum('pass','fail','none') NOT NULL DEFAULT 'none',
    pvVerdict enum('pass','fail','none') NOT NULL DEFAULT 'none',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    companyId int NOT NULL DEFAULT 0,
    equipmentType enum('refrigerator','auto-refrigerator','warehouse','other') NOT NULL DEFAULT 'refrigerator',
    customEquipmentName varchar(255),
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS generalInfo (
    id int AUTO_INCREMENT NOT NULL,
    protocolId int NOT NULL,
    equipmentType varchar(64),
    manufacturer varchar(255),
    model varchar(255),
    serial varchar(128),
    inventory varchar(128),
    year int,
    tempMode varchar(16),
    location text,
    purpose text,
    validationDate varchar(32),
    basis varchar(64),
    commissionMembers json,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    signatoriesPart1 json,
    signatoriesPart2 json,
    planDeviations text,
    recommendations text,
    reportDate varchar(32),
    documentValidityPeriod text,
    whLengthM decimal(8,2),
    whWidthM decimal(8,2),
    whHeightM decimal(8,2),
    whHumidityControl int DEFAULT 0,
    whHumidityMin decimal(5,2),
    whHumidityMax decimal(5,2),
    whSeason varchar(16),
    whStudyType varchar(32),
    whExternalEnv int DEFAULT 0,
    whLayoutNotes text,
    qualificationType varchar(32),
    season varchar(32),
    fillStatus enum('empty','loaded'),
    loadPercent decimal(5,2),
    PRIMARY KEY (id),
    UNIQUE KEY generalInfo_protocolId_unique (protocolId)
  )`,
  `CREATE TABLE IF NOT EXISTS pvSessions (
    id int AUTO_INCREMENT NOT NULL,
    protocolId int NOT NULL,
    tempMode varchar(16),
    startAt bigint,
    endAt bigint,
    minDurationHours int NOT NULL DEFAULT 72,
    minSensorCount int NOT NULL DEFAULT 9,
    customMin decimal(6,2),
    customMax decimal(6,2),
    verdict enum('pass','fail','none') NOT NULL DEFAULT 'none',
    stats json,
    deviations json,
    conclusionText text,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    samplingStepMinutes int,
    coolingUnitPos json,
    doorPos json,
    floorPlanObjects json,
    roomLengthM decimal(6,2),
    roomWidthM decimal(6,2),
    roomHeightM decimal(6,2),
    planImageKey varchar(512),
    planImageUrl varchar(512),
    PRIMARY KEY (id),
    UNIQUE KEY pvSessions_protocolId_unique (protocolId)
  )`,
  `CREATE TABLE IF NOT EXISTS pvLoggers (
    id int AUTO_INCREMENT NOT NULL,
    pvSessionId int NOT NULL,
    protocolId int NOT NULL,
    fileKey varchar(512) NOT NULL,
    fileUrl varchar(512) NOT NULL,
    fileName varchar(255) NOT NULL,
    label varchar(64) NOT NULL,
    customName varchar(128),
    role enum('internal','external') NOT NULL DEFAULT 'internal',
    pointCount int NOT NULL DEFAULT 0,
    minVal decimal(8,3),
    maxVal decimal(8,3),
    avgVal decimal(8,3),
    stdVal decimal(8,3),
    mktVal decimal(8,3),
    series json,
    deviations json,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    position varchar(32) NOT NULL DEFAULT 'unset',
    posX decimal(5,2),
    posY decimal(5,2),
    firstTs bigint,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS excursionStudySessions (
    id int AUTO_INCREMENT NOT NULL,
    protocolId int NOT NULL,
    enabled int NOT NULL DEFAULT 0,
    timingVsPv enum('before_pv','after_pv','independent') DEFAULT 'after_pv',
    test1Enabled int NOT NULL DEFAULT 0,
    test2Enabled int NOT NULL DEFAULT 0,
    test3Enabled int NOT NULL DEFAULT 0,
    recordStartAt bigint,
    recordEndAt bigint,
    t1PowerOnAt bigint,
    t1StabilizationThresholdMinutes int DEFAULT 15,
    t1TStableAt bigint,
    t1DurationSec int,
    t1CriticalSensor varchar(128),
    t1SensorEntries json,
    t2DoorOpenAt bigint,
    t2DoorCloseAt bigint,
    t2TBreakAt bigint,
    t2DurationSec int,
    t2CriticalSensor varchar(128),
    t2NoBreak int DEFAULT 0,
    t3PowerOffAt bigint,
    t3TBreakAt bigint,
    t3DurationSec int,
    t3CriticalSensor varchar(128),
    t3NoBreak int DEFAULT 0,
    stabilizationBetweenT2T3Ok int,
    warnings json,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    t2SensorBreaks json,
    t3SensorBreaks json,
    t3TestEndAt bigint,
    PRIMARY KEY (id),
    UNIQUE KEY excursionStudySessions_protocolId_unique (protocolId)
  )`,
  `CREATE TABLE IF NOT EXISTS excursionLoggers (
    id int AUTO_INCREMENT NOT NULL,
    excursionSessionId int NOT NULL,
    protocolId int NOT NULL,
    fileKey varchar(512) NOT NULL,
    fileUrl varchar(512) NOT NULL,
    fileName varchar(255) NOT NULL,
    label varchar(64) NOT NULL,
    customName varchar(128),
    role enum('internal','external') NOT NULL DEFAULT 'internal',
    pointCount int NOT NULL DEFAULT 0,
    series json,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS checklistAnswers (
    id int AUTO_INCREMENT NOT NULL,
    protocolId int NOT NULL,
    stage enum('iq','oq') NOT NULL,
    questionIndex int NOT NULL,
    questionText text NOT NULL,
    answer enum('yes','no','na','unset') NOT NULL DEFAULT 'unset',
    comment text,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    warehouseEquipmentId int,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS questionTemplates (
    id int AUTO_INCREMENT NOT NULL,
    stage enum('iq','oq') NOT NULL,
    ord int NOT NULL,
    text text NOT NULL,
    isDefault int NOT NULL DEFAULT 1,
    companyId int,
    equipmentType enum('refrigerator','auto-refrigerator','warehouse','other') NOT NULL DEFAULT 'refrigerator',
    equipmentKind enum('conditioner','ventilation','heat_curtain','chiller','fan_coil','other'),
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS warehouseEquipment (
    id int AUTO_INCREMENT NOT NULL,
    protocolId int NOT NULL,
    ord int NOT NULL DEFAULT 0,
    name varchar(255) NOT NULL,
    manufacturer varchar(255),
    model varchar(255),
    serial varchar(128),
    inventory varchar(128),
    purpose text,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    kind enum('conditioner','ventilation','heat_curtain','chiller','fan_coil','other') NOT NULL DEFAULT 'other',
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS warehouseProtocolSections (
    id int AUTO_INCREMENT NOT NULL,
    protocolId int NOT NULL,
    sectionKey varchar(16) NOT NULL,
    content text,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fillStatus enum('empty','loaded'),
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS sensors (
    id int AUTO_INCREMENT NOT NULL,
    number varchar(128) NOT NULL,
    calibrationDate timestamp NOT NULL,
    nextCalibrationDate timestamp NOT NULL,
    status enum('active','expiring_soon','expired') NOT NULL DEFAULT 'active',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY sensors_number_unique (number)
  )`,
  `CREATE TABLE IF NOT EXISTS protocolSensors (
    id int AUTO_INCREMENT NOT NULL,
    protocolId int NOT NULL,
    sensorId int NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  )`,
];

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  if (replace) {
    console.log("Dropping existing portal tables...");
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.query("DROP TABLE IF EXISTS `__drizzle_migrations`");
    for (const table of tableNames) {
      await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  for (const sql of schemaSql) {
    await connection.query(sql);
  }

  const [rows] = await connection.query("SHOW TABLES");
  console.log(`TiDB schema ready. Tables: ${rows.length}`);
} finally {
  await connection.end();
}
