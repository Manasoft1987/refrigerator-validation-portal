var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import { mysqlTable, int, mysqlEnum, text, timestamp, varchar, json, index, bigint, decimal } from "drizzle-orm/mysql-core";
var checklistAnswers, companies, companyMembers, excursionLoggers, excursionStudySessions, generalInfo, organizations, protocols, pvLoggers, pvSessions, questionTemplates, users, warehouseEquipment, warehouseProtocolSections, sensors, sensorsIndex, protocolSensors;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    checklistAnswers = mysqlTable("checklistAnswers", {
      id: int().autoincrement().notNull(),
      protocolId: int().notNull(),
      stage: mysqlEnum(["iq", "oq"]).notNull(),
      questionIndex: int().notNull(),
      questionText: text().notNull(),
      answer: mysqlEnum(["yes", "no", "na", "unset"]).default("unset").notNull(),
      comment: text(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      warehouseEquipmentId: int()
    });
    companies = mysqlTable("companies", {
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      createdByAdminId: int().notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    companyMembers = mysqlTable("companyMembers", {
      id: int().autoincrement().notNull(),
      userId: int().notNull(),
      companyId: int().notNull(),
      role: mysqlEnum(["admin", "user"]).default("user").notNull(),
      status: mysqlEnum(["pending", "approved", "rejected"]).default("pending").notNull(),
      invitedAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      approvedAt: timestamp({ mode: "string" }),
      rejectedAt: timestamp({ mode: "string" }),
      approvedByAdminId: int(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    excursionLoggers = mysqlTable("excursionLoggers", {
      id: int().autoincrement().notNull(),
      excursionSessionId: int().notNull(),
      protocolId: int().notNull(),
      fileKey: varchar({ length: 512 }).notNull(),
      fileUrl: varchar({ length: 512 }).notNull(),
      fileName: varchar({ length: 255 }).notNull(),
      label: varchar({ length: 64 }).notNull(),
      customName: varchar({ length: 128 }),
      role: mysqlEnum(["internal", "external"]).default("internal").notNull(),
      pointCount: int().default(0).notNull(),
      series: json(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
    });
    excursionStudySessions = mysqlTable(
      "excursionStudySessions",
      {
        id: int().autoincrement().notNull(),
        protocolId: int().notNull(),
        enabled: int().default(0).notNull(),
        timingVsPv: mysqlEnum(["before_pv", "after_pv", "independent"]).default("after_pv"),
        test1Enabled: int().default(0).notNull(),
        test2Enabled: int().default(0).notNull(),
        test3Enabled: int().default(0).notNull(),
        recordStartAt: bigint({ mode: "number" }),
        recordEndAt: bigint({ mode: "number" }),
        t1PowerOnAt: bigint({ mode: "number" }),
        t1StabilizationThresholdMinutes: int().default(15),
        t1TStableAt: bigint({ mode: "number" }),
        t1DurationSec: int(),
        t1CriticalSensor: varchar({ length: 128 }),
        t1SensorEntries: json(),
        t2DoorOpenAt: bigint({ mode: "number" }),
        t2DoorCloseAt: bigint({ mode: "number" }),
        t2TBreakAt: bigint({ mode: "number" }),
        t2DurationSec: int(),
        t2CriticalSensor: varchar({ length: 128 }),
        t2NoBreak: int().default(0),
        t3PowerOffAt: bigint({ mode: "number" }),
        t3TBreakAt: bigint({ mode: "number" }),
        t3DurationSec: int(),
        t3CriticalSensor: varchar({ length: 128 }),
        t3NoBreak: int().default(0),
        stabilizationBetweenT2T3Ok: int(),
        warnings: json(),
        updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
        t2SensorBreaks: json(),
        t3SensorBreaks: json(),
        t3TestEndAt: bigint({ mode: "number" })
      },
      (table) => [
        index("excursionStudySessions_protocolId_unique").on(table.protocolId)
      ]
    );
    generalInfo = mysqlTable(
      "generalInfo",
      {
        id: int().autoincrement().notNull(),
        protocolId: int().notNull(),
        equipmentType: varchar({ length: 64 }),
        manufacturer: varchar({ length: 255 }),
        model: varchar({ length: 255 }),
        serial: varchar({ length: 128 }),
        inventory: varchar({ length: 128 }),
        year: int(),
        tempMode: varchar({ length: 16 }),
        location: text(),
        purpose: text(),
        validationDate: varchar({ length: 32 }),
        basis: varchar({ length: 64 }),
        commissionMembers: json(),
        updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
        signatoriesPart1: json(),
        signatoriesPart2: json(),
        planDeviations: text(),
        recommendations: text(),
        reportDate: varchar({ length: 32 }),
        documentValidityPeriod: text(),
        whLengthM: decimal({ precision: 8, scale: 2 }),
        whWidthM: decimal({ precision: 8, scale: 2 }),
        whHeightM: decimal({ precision: 8, scale: 2 }),
        whHumidityControl: int().default(0),
        whHumidityMin: decimal({ precision: 5, scale: 2 }),
        whHumidityMax: decimal({ precision: 5, scale: 2 }),
        whSeason: varchar({ length: 16 }),
        whStudyType: varchar({ length: 32 }),
        whExternalEnv: int().default(0),
        whLayoutNotes: text(),
        qualificationType: varchar({ length: 32 }),
        season: varchar({ length: 32 }),
        fillStatus: mysqlEnum(["empty", "loaded"]),
        loadPercent: decimal({ precision: 5, scale: 2 })
      },
      (table) => [
        index("generalInfo_protocolId_unique").on(table.protocolId)
      ]
    );
    organizations = mysqlTable("organizations", {
      id: int().autoincrement().notNull(),
      userId: int().notNull(),
      name: varchar({ length: 255 }).notNull(),
      bin: varchar({ length: 32 }),
      addressLegal: text(),
      addressFact: text(),
      responsible: varchar({ length: 255 }),
      phone: varchar({ length: 64 }),
      email: varchar({ length: 320 }),
      logoUrl: varchar({ length: 512 }),
      logoKey: varchar({ length: 512 }),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      companyId: int()
    });
    protocols = mysqlTable("protocols", {
      id: int().autoincrement().notNull(),
      organizationId: int().notNull(),
      userId: int().notNull(),
      number: varchar({ length: 32 }).notNull(),
      status: mysqlEnum(["draft", "iq_done", "oq_done", "pv_done", "completed"]).default("draft").notNull(),
      iqVerdict: mysqlEnum(["pass", "fail", "none"]).default("none").notNull(),
      oqVerdict: mysqlEnum(["pass", "fail", "none"]).default("none").notNull(),
      pvVerdict: mysqlEnum(["pass", "fail", "none"]).default("none").notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      companyId: int().default(0).notNull(),
      equipmentType: mysqlEnum(["refrigerator", "auto-refrigerator", "warehouse", "other"]).default("refrigerator").notNull(),
      customEquipmentName: varchar({ length: 255 })
    });
    pvLoggers = mysqlTable("pvLoggers", {
      id: int().autoincrement().notNull(),
      pvSessionId: int().notNull(),
      protocolId: int().notNull(),
      fileKey: varchar({ length: 512 }).notNull(),
      fileUrl: varchar({ length: 512 }).notNull(),
      fileName: varchar({ length: 255 }).notNull(),
      label: varchar({ length: 64 }).notNull(),
      customName: varchar({ length: 128 }),
      role: mysqlEnum(["internal", "external"]).default("internal").notNull(),
      pointCount: int().default(0).notNull(),
      minVal: decimal({ precision: 8, scale: 3 }),
      maxVal: decimal({ precision: 8, scale: 3 }),
      avgVal: decimal({ precision: 8, scale: 3 }),
      stdVal: decimal({ precision: 8, scale: 3 }),
      mktVal: decimal({ precision: 8, scale: 3 }),
      series: json(),
      deviations: json(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      position: varchar({ length: 32 }).default("unset").notNull(),
      posX: decimal({ precision: 5, scale: 2 }),
      posY: decimal({ precision: 5, scale: 2 }),
      firstTs: bigint({ mode: "number" })
    });
    pvSessions = mysqlTable(
      "pvSessions",
      {
        id: int().autoincrement().notNull(),
        protocolId: int().notNull(),
        tempMode: varchar({ length: 16 }),
        startAt: bigint({ mode: "number" }),
        endAt: bigint({ mode: "number" }),
        minDurationHours: int().default(72).notNull(),
        minSensorCount: int().default(9).notNull(),
        customMin: decimal({ precision: 6, scale: 2 }),
        customMax: decimal({ precision: 6, scale: 2 }),
        verdict: mysqlEnum(["pass", "fail", "none"]).default("none").notNull(),
        stats: json(),
        deviations: json(),
        conclusionText: text(),
        updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
        samplingStepMinutes: int(),
        coolingUnitPos: json(),
        doorPos: json(),
        floorPlanObjects: json(),
        roomLengthM: decimal({ precision: 6, scale: 2 }),
        roomWidthM: decimal({ precision: 6, scale: 2 }),
        roomHeightM: decimal({ precision: 6, scale: 2 }),
        planImageKey: varchar({ length: 512 }),
        planImageUrl: varchar({ length: 512 })
      },
      (table) => [
        index("pvSessions_protocolId_unique").on(table.protocolId)
      ]
    );
    questionTemplates = mysqlTable("questionTemplates", {
      id: int().autoincrement().notNull(),
      stage: mysqlEnum(["iq", "oq"]).notNull(),
      ord: int().notNull(),
      text: text().notNull(),
      isDefault: int().default(1).notNull(),
      companyId: int(),
      equipmentType: mysqlEnum(["refrigerator", "auto-refrigerator", "warehouse", "other"]).default("refrigerator").notNull(),
      equipmentKind: mysqlEnum(["conditioner", "ventilation", "heat_curtain", "chiller", "fan_coil", "other"])
    });
    users = mysqlTable(
      "users",
      {
        id: int().autoincrement().notNull(),
        openId: varchar({ length: 64 }).notNull(),
        name: text(),
        email: varchar({ length: 320 }),
        loginMethod: varchar({ length: 64 }),
        role: mysqlEnum(["user", "admin"]).default("user").notNull(),
        createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
        updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
        lastSignedIn: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
      },
      (table) => [
        index("users_openId_unique").on(table.openId)
      ]
    );
    warehouseEquipment = mysqlTable("warehouseEquipment", {
      id: int().autoincrement().notNull(),
      protocolId: int().notNull(),
      ord: int().default(0).notNull(),
      name: varchar({ length: 255 }).notNull(),
      manufacturer: varchar({ length: 255 }),
      model: varchar({ length: 255 }),
      serial: varchar({ length: 128 }),
      inventory: varchar({ length: 128 }),
      purpose: text(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      kind: mysqlEnum(["conditioner", "ventilation", "heat_curtain", "chiller", "fan_coil", "other"]).default("other").notNull()
    });
    warehouseProtocolSections = mysqlTable("warehouseProtocolSections", {
      id: int().autoincrement().notNull(),
      protocolId: int().notNull(),
      sectionKey: varchar({ length: 16 }).notNull(),
      content: text(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      fillStatus: mysqlEnum(["empty", "loaded"])
    });
    sensors = mysqlTable("sensors", {
      id: int().autoincrement().notNull(),
      number: varchar({ length: 128 }).notNull(),
      calibrationDate: timestamp({ mode: "string" }).notNull(),
      nextCalibrationDate: timestamp({ mode: "string" }).notNull(),
      status: mysqlEnum(["active", "expiring_soon", "expired"]).default("active").notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    sensorsIndex = index("sensors_number_unique").on(sensors.number);
    protocolSensors = mysqlTable("protocolSensors", {
      id: int().autoincrement().notNull(),
      protocolId: int().notNull(),
      sensorId: int().notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      devAuthEnabled: process.env.DEV_AUTH_ENABLED === "1",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      storageProvider: process.env.STORAGE_PROVIDER ?? "",
      storageMirrorProvider: process.env.STORAGE_MIRROR_PROVIDER ?? "",
      storageLocalRoot: process.env.STORAGE_LOCAL_ROOT ?? ".storage",
      s3Region: process.env.S3_REGION ?? "auto",
      s3Endpoint: process.env.S3_ENDPOINT ?? "",
      s3Bucket: process.env.S3_BUCKET ?? "",
      s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE ?? ""
    };
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  addSensorToProtocol: () => addSensorToProtocol,
  approveCompanyMember: () => approveCompanyMember,
  bulkCreateSensors: () => bulkCreateSensors,
  clearProtocolSensors: () => clearProtocolSensors,
  cloneProtocol: () => cloneProtocol,
  createCompany: () => createCompany,
  createSensor: () => createSensor,
  createWarehouseEquipment: () => createWarehouseEquipment,
  deleteAllExcursionLoggers: () => deleteAllExcursionLoggers,
  deleteExcursionLogger: () => deleteExcursionLogger,
  deleteLogger: () => deleteLogger,
  deleteOrganization: () => deleteOrganization,
  deleteProtocolCascade: () => deleteProtocolCascade,
  deleteQuestionTemplate: () => deleteQuestionTemplate,
  deleteSensor: () => deleteSensor,
  deleteWarehouseEquipment: () => deleteWarehouseEquipment,
  getCompany: () => getCompany,
  getCompanyMember: () => getCompanyMember,
  getDb: () => getDb,
  getExcursionSession: () => getExcursionSession,
  getGeneralInfo: () => getGeneralInfo,
  getOrganization: () => getOrganization,
  getOrganizationByCompany: () => getOrganizationByCompany,
  getPVSession: () => getPVSession,
  getProtocol: () => getProtocol,
  getProtocolByCompany: () => getProtocolByCompany,
  getProtocolSensors: () => getProtocolSensors,
  getSensor: () => getSensor,
  getSensorsExpiringIn30Days: () => getSensorsExpiringIn30Days,
  getUserByEmail: () => getUserByEmail,
  getUserByOpenId: () => getUserByOpenId,
  getUserCompanies: () => getUserCompanies,
  getUserPendingMemberships: () => getUserPendingMemberships,
  getWarehouseSections: () => getWarehouseSections,
  insertExcursionLogger: () => insertExcursionLogger,
  insertLogger: () => insertLogger,
  insertOrganization: () => insertOrganization,
  insertProtocol: () => insertProtocol,
  insertQuestionTemplate: () => insertQuestionTemplate,
  inviteUserToCompany: () => inviteUserToCompany,
  listAllProtocols: () => listAllProtocols,
  listAllProtocolsByCompany: () => listAllProtocolsByCompany,
  listAllProtocolsForAdmin: () => listAllProtocolsForAdmin,
  listAllQuestionTemplates: () => listAllQuestionTemplates,
  listChecklist: () => listChecklist,
  listCompanies: () => listCompanies,
  listCompanyMembers: () => listCompanyMembers,
  listExcursionLoggers: () => listExcursionLoggers,
  listLoggers: () => listLoggers,
  listOrganizations: () => listOrganizations,
  listOrganizationsByCompany: () => listOrganizationsByCompany,
  listProtocolsByCompany: () => listProtocolsByCompany,
  listProtocolsForOrg: () => listProtocolsForOrg,
  listQuestionTemplates: () => listQuestionTemplates,
  listSensors: () => listSensors,
  listWarehouseEquipment: () => listWarehouseEquipment,
  nextProtocolNumber: () => nextProtocolNumber,
  rejectCompanyMember: () => rejectCompanyMember,
  removeCompanyMember: () => removeCompanyMember,
  removeProtocolSensor: () => removeProtocolSensor,
  saveChecklist: () => saveChecklist,
  saveWarehouseSections: () => saveWarehouseSections,
  updateExcursionLogger: () => updateExcursionLogger,
  updateLogger: () => updateLogger,
  updateOrganization: () => updateOrganization,
  updatePVSession: () => updatePVSession,
  updateProtocolStatus: () => updateProtocolStatus,
  updateQuestionTemplate: () => updateQuestionTemplate,
  updateSensor: () => updateSensor,
  updateWarehouseEquipment: () => updateWarehouseEquipment,
  upsertExcursionSession: () => upsertExcursionSession,
  upsertGeneralInfo: () => upsertGeneralInfo,
  upsertUser: () => upsertUser
});
import { and, desc, eq, isNull, sql, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
function shouldUseLocalDevDb() {
  return !ENV.isProduction && !process.env.DATABASE_URL;
}
function localDevDbPath() {
  return path.resolve(process.cwd(), ENV.storageLocalRoot || ".storage", "dev-db.json");
}
function createEmptyLocalDevDb() {
  return {
    counters: {
      companies: 0,
      companyMembers: 0,
      organizations: 0,
      protocols: 0,
      pvSessions: 0,
      pvLoggers: 0,
      excursionStudySessions: 0,
      excursionLoggers: 0,
      sensors: 0,
      protocolSensors: 0,
      users: 1,
      questionTemplates: 0
    },
    companies: [],
    companyMembers: [],
    organizations: [],
    protocols: [],
    pvSessions: [],
    generalInfo: [],
    checklistAnswers: [],
    pvLoggers: [],
    excursionStudySessions: [],
    excursionLoggers: [],
    sensors: [],
    protocolSensors: [],
    users: [localDevAdminUser()],
    questionTemplates: []
  };
}
async function readLocalDevDb() {
  try {
    const raw = await readFile(localDevDbPath(), "utf8");
    const parsed = JSON.parse(raw);
    const hasAdmin = parsed.users.some((user) => user.id === 1);
    return {
      counters: {
        companies: parsed.counters?.companies ?? parsed.companies.length,
        companyMembers: parsed.counters?.companyMembers ?? parsed.companyMembers.length,
        organizations: parsed.counters?.organizations ?? (parsed.organizations ?? []).length,
        protocols: parsed.counters?.protocols ?? (parsed.protocols ?? []).length,
        pvSessions: parsed.counters?.pvSessions ?? (parsed.pvSessions ?? []).length,
        pvLoggers: parsed.counters?.pvLoggers ?? (parsed.pvLoggers ?? []).length,
        excursionStudySessions: parsed.counters?.excursionStudySessions ?? (parsed.excursionStudySessions ?? []).length,
        excursionLoggers: parsed.counters?.excursionLoggers ?? (parsed.excursionLoggers ?? []).length,
        sensors: parsed.counters?.sensors ?? (parsed.sensors ?? []).length,
        protocolSensors: parsed.counters?.protocolSensors ?? (parsed.protocolSensors ?? []).length,
        users: parsed.counters?.users ?? Math.max(1, ...parsed.users.map((user) => user.id)),
        questionTemplates: parsed.counters?.questionTemplates ?? (parsed.questionTemplates ?? []).length
      },
      companies: parsed.companies ?? [],
      companyMembers: parsed.companyMembers ?? [],
      organizations: parsed.organizations ?? [],
      protocols: parsed.protocols ?? [],
      pvSessions: parsed.pvSessions ?? [],
      generalInfo: parsed.generalInfo ?? [],
      checklistAnswers: parsed.checklistAnswers ?? [],
      pvLoggers: parsed.pvLoggers ?? [],
      excursionStudySessions: parsed.excursionStudySessions ?? [],
      excursionLoggers: parsed.excursionLoggers ?? [],
      sensors: parsed.sensors ?? [],
      protocolSensors: parsed.protocolSensors ?? [],
      users: hasAdmin ? parsed.users : [localDevAdminUser(), ...parsed.users ?? []],
      questionTemplates: parsed.questionTemplates ?? []
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[LocalDevDb] Failed to read local store; starting empty:", error);
    }
    return createEmptyLocalDevDb();
  }
}
async function writeLocalDevDb(data) {
  const filePath = localDevDbPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
async function updateLocalDevDb(updater) {
  const data = await readLocalDevDb();
  const result = await updater(data);
  await writeLocalDevDb(data);
  return result;
}
function companyMemberWithUser(member, user) {
  return {
    ...member,
    user: user ?? localDevAdminUser()
  };
}
function protocolSummary(data, protocol) {
  const org = data.organizations.find((item) => item.id === protocol.organizationId);
  const gi = data.generalInfo.find((item) => item.protocolId === protocol.id);
  return {
    ...protocol,
    organizationName: org?.name ?? null,
    equipmentModel: gi?.model ?? null,
    serialNumber: gi?.serial ?? null
  };
}
function sortByCreatedDesc(items) {
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return;
    await updateLocalDevDb((data) => {
      const existing = data.users.find((localUser) => localUser.openId === user.openId);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (existing) {
        if (user.name !== void 0) existing.name = user.name ?? null;
        if (user.email !== void 0) existing.email = user.email ?? null;
        if (user.loginMethod !== void 0) existing.loginMethod = user.loginMethod ?? null;
        if (user.role !== void 0) existing.role = user.role;
        existing.lastSignedIn = user.lastSignedIn ?? now;
        existing.updatedAt = now;
        return;
      }
      data.counters.users += 1;
      data.users.push({
        id: data.counters.users,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now
      });
    });
    return;
  }
  try {
    const values = { openId: user.openId };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = (/* @__PURE__ */ new Date()).toISOString();
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = (/* @__PURE__ */ new Date()).toISOString();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.users.find((user) => user.openId === openId);
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function listOrganizations(userId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.organizations.filter((org) => org.userId === userId).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  return db.select().from(organizations).where(eq(organizations.userId, userId)).orderBy(desc(organizations.updatedAt));
}
async function listOrganizationsByCompany(companyId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.organizations.filter((org) => org.companyId === companyId).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  return db.select().from(organizations).where(eq(organizations.companyId, companyId)).orderBy(desc(organizations.updatedAt));
}
async function getOrganization(userId, orgId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.organizations.find((org) => org.id === orgId && org.userId === userId);
  }
  const rows = await db.select().from(organizations).where(and(eq(organizations.id, orgId), eq(organizations.userId, userId))).limit(1);
  return rows[0];
}
async function insertOrganization(data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      localData.counters.organizations += 1;
      const organization = {
        id: localData.counters.organizations,
        userId: data.userId,
        name: data.name,
        bin: data.bin ?? null,
        addressLegal: data.addressLegal ?? null,
        addressFact: data.addressFact ?? null,
        responsible: data.responsible ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        logoUrl: data.logoUrl ?? null,
        logoKey: data.logoKey ?? null,
        createdAt: now,
        updatedAt: now,
        companyId: data.companyId ?? null
      };
      localData.organizations.push(organization);
      return organization;
    });
  }
  const res = await db.insert(organizations).values(data);
  const [row] = await db.select().from(organizations).where(eq(organizations.id, res[0].insertId)).limit(1);
  return row;
}
async function updateOrganization(userId, orgId, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const organization = localData.organizations.find(
        (org) => org.id === orgId && org.userId === userId
      );
      if (!organization) return void 0;
      const updates = data;
      if (updates.name !== void 0) organization.name = updates.name;
      if (updates.bin !== void 0) organization.bin = updates.bin ?? null;
      if (updates.addressLegal !== void 0) organization.addressLegal = updates.addressLegal ?? null;
      if (updates.addressFact !== void 0) organization.addressFact = updates.addressFact ?? null;
      if (updates.responsible !== void 0) organization.responsible = updates.responsible ?? null;
      if (updates.phone !== void 0) organization.phone = updates.phone ?? null;
      if (updates.email !== void 0) organization.email = updates.email ?? null;
      if (updates.logoUrl !== void 0) organization.logoUrl = updates.logoUrl ?? null;
      if (updates.logoKey !== void 0) organization.logoKey = updates.logoKey ?? null;
      if (updates.companyId !== void 0) organization.companyId = updates.companyId ?? null;
      organization.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      return organization;
    });
  }
  await db.update(organizations).set(data).where(and(eq(organizations.id, orgId), eq(organizations.userId, userId)));
  return getOrganization(userId, orgId);
}
async function deleteOrganization(userId, orgId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((data) => {
      data.organizations = data.organizations.filter(
        (org) => !(org.id === orgId && org.userId === userId)
      );
    });
    return;
  }
  const orgProtocols = await db.select({ id: protocols.id }).from(protocols).where(and(eq(protocols.organizationId, orgId), eq(protocols.userId, userId)));
  for (const p of orgProtocols) {
    await deleteProtocolCascade(userId, p.id);
  }
  await db.delete(organizations).where(and(eq(organizations.id, orgId), eq(organizations.userId, userId)));
}
async function listProtocolsForOrg(userId, orgId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return sortByCreatedDesc(
      data.protocols.filter((protocol) => protocol.organizationId === orgId && protocol.userId === userId)
    );
  }
  return db.select().from(protocols).where(and(eq(protocols.organizationId, orgId), eq(protocols.userId, userId))).orderBy(desc(protocols.createdAt));
}
async function listAllProtocols(userId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) {
      return [];
    }
    const data = await readLocalDevDb();
    return sortByCreatedDesc(
      data.protocols.filter((protocol) => protocol.userId === userId).map((protocol) => protocolSummary(data, protocol))
    );
  }
  return db.select({
    protocol: protocols,
    organizationName: organizations.name,
    equipmentModel: generalInfo.model,
    serialNumber: generalInfo.serial
  }).from(protocols).leftJoin(organizations, eq(organizations.id, protocols.organizationId)).leftJoin(generalInfo, eq(generalInfo.protocolId, protocols.id)).where(eq(protocols.userId, userId)).orderBy(desc(protocols.createdAt)).then((rows) => rows.map((r) => ({
    ...r.protocol,
    organizationName: r.organizationName,
    equipmentModel: r.equipmentModel,
    serialNumber: r.serialNumber
  })));
}
async function listAllProtocolsByCompany(companyId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) {
      return [];
    }
    const data = await readLocalDevDb();
    return sortByCreatedDesc(
      data.protocols.filter((protocol) => protocol.companyId === companyId).map((protocol) => protocolSummary(data, protocol))
    );
  }
  const rows = await db.select({
    protocol: protocols,
    organizationName: organizations.name,
    equipmentModel: generalInfo.model,
    serialNumber: generalInfo.serial
  }).from(protocols).leftJoin(organizations, eq(organizations.id, protocols.organizationId)).leftJoin(generalInfo, eq(generalInfo.protocolId, protocols.id)).where(eq(protocols.companyId, companyId)).orderBy(desc(protocols.createdAt));
  return rows.map((r) => ({
    ...r.protocol,
    organizationName: r.organizationName,
    equipmentModel: r.equipmentModel,
    serialNumber: r.serialNumber
  }));
}
async function getOrganizationByCompany(companyId, orgId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.organizations.find((org) => org.id === orgId && org.companyId === companyId);
  }
  const rows = await db.select().from(organizations).where(and(eq(organizations.id, orgId), eq(organizations.companyId, companyId))).limit(1);
  return rows[0];
}
async function getProtocolByCompany(companyId, protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.protocols.find((protocol) => protocol.id === protocolId && protocol.companyId === companyId);
  }
  const rows = await db.select().from(protocols).where(and(eq(protocols.id, protocolId), eq(protocols.companyId, companyId))).limit(1);
  return rows[0];
}
async function getProtocol(userId, protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.protocols.find((protocol) => protocol.id === protocolId && protocol.userId === userId);
  }
  const rows = await db.select().from(protocols).where(and(eq(protocols.id, protocolId), eq(protocols.userId, userId))).limit(1);
  return rows[0];
}
async function nextProtocolNumber(orgId, year) {
  const db = await getDb();
  const prefix = `VAL-${year}-`;
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    let max2 = 0;
    for (const protocol of data.protocols) {
      if (protocol.organizationId !== orgId || !protocol.number.startsWith(prefix)) continue;
      const m = protocol.number.match(/-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max2) max2 = n;
      }
    }
    const next2 = (max2 + 1).toString().padStart(4, "0");
    return `${prefix}${next2}`;
  }
  const rows = await db.select({ number: protocols.number }).from(protocols).where(and(eq(protocols.organizationId, orgId), sql`${protocols.number} LIKE ${prefix + "%"}`));
  let max = 0;
  for (const r of rows) {
    const m = r.number.match(/-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = (max + 1).toString().padStart(4, "0");
  return `${prefix}${next}`;
}
async function insertProtocol(data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      localData.counters.protocols += 1;
      const protocol = {
        id: localData.counters.protocols,
        organizationId: data.organizationId,
        userId: data.userId,
        number: data.number,
        status: data.status ?? "draft",
        iqVerdict: data.iqVerdict ?? "none",
        oqVerdict: data.oqVerdict ?? "none",
        pvVerdict: data.pvVerdict ?? "none",
        createdAt: now,
        updatedAt: now,
        companyId: data.companyId ?? 0,
        equipmentType: data.equipmentType ?? "refrigerator",
        customEquipmentName: data.customEquipmentName ?? null
      };
      localData.protocols.push(protocol);
      localData.counters.pvSessions += 1;
      localData.pvSessions.push({
        id: localData.counters.pvSessions,
        protocolId: protocol.id,
        tempMode: null,
        startAt: null,
        endAt: null,
        minDurationHours: 72,
        minSensorCount: 9,
        customMin: null,
        customMax: null,
        verdict: "none",
        stats: null,
        deviations: null,
        conclusionText: null,
        updatedAt: now,
        samplingStepMinutes: null,
        coolingUnitPos: null,
        doorPos: null,
        floorPlanObjects: null,
        roomLengthM: null,
        roomWidthM: null,
        roomHeightM: null,
        planImageKey: null,
        planImageUrl: null
      });
      return protocol;
    });
  }
  const res = await db.insert(protocols).values(data);
  const [row] = await db.select().from(protocols).where(eq(protocols.id, res[0].insertId)).limit(1);
  await db.insert(pvSessions).values({
    protocolId: row.id,
    minDurationHours: 72,
    minSensorCount: 9
  });
  return row;
}
async function updateProtocolStatus(userId, protocolId, patch) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((data) => {
      const protocol = data.protocols.find((item) => item.id === protocolId && item.userId === userId);
      if (!protocol) return;
      Object.assign(protocol, patch);
      protocol.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    });
    return;
  }
  await db.update(protocols).set(patch).where(and(eq(protocols.id, protocolId), eq(protocols.userId, userId)));
}
async function deleteProtocolCascade(userId, protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((data) => {
      const owned2 = data.protocols.some((protocol) => protocol.id === protocolId && protocol.userId === userId);
      if (!owned2) return;
      data.checklistAnswers = data.checklistAnswers.filter((item) => item.protocolId !== protocolId);
      data.generalInfo = data.generalInfo.filter((item) => item.protocolId !== protocolId);
      data.pvLoggers = data.pvLoggers.filter((item) => item.protocolId !== protocolId);
      data.pvSessions = data.pvSessions.filter((item) => item.protocolId !== protocolId);
      data.protocols = data.protocols.filter((item) => item.id !== protocolId);
    });
    return;
  }
  const owned = await getProtocol(userId, protocolId);
  if (!owned) return;
  await db.delete(checklistAnswers).where(eq(checklistAnswers.protocolId, protocolId));
  await db.delete(generalInfo).where(eq(generalInfo.protocolId, protocolId));
  await db.delete(pvLoggers).where(eq(pvLoggers.protocolId, protocolId));
  await db.delete(pvSessions).where(eq(pvSessions.protocolId, protocolId));
  await db.delete(protocols).where(eq(protocols.id, protocolId));
}
async function getGeneralInfo(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.generalInfo.find((item) => item.protocolId === protocolId);
  }
  const rows = await db.select().from(generalInfo).where(eq(generalInfo.protocolId, protocolId)).limit(1);
  return rows[0];
}
async function upsertGeneralInfo(protocolId, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const existing2 = localData.generalInfo.find((item) => item.protocolId === protocolId);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (existing2) {
        Object.assign(existing2, data, { updatedAt: now });
        return existing2;
      }
      localData.generalInfo.push({
        id: localData.generalInfo.length + 1,
        protocolId,
        equipmentType: null,
        manufacturer: null,
        model: null,
        serial: null,
        inventory: null,
        year: null,
        tempMode: null,
        location: null,
        purpose: null,
        validationDate: null,
        basis: null,
        commissionMembers: null,
        updatedAt: now,
        signatoriesPart1: null,
        signatoriesPart2: null,
        planDeviations: null,
        recommendations: null,
        reportDate: null,
        documentValidityPeriod: null,
        whLengthM: null,
        whWidthM: null,
        whHeightM: null,
        whHumidityControl: 0,
        whHumidityMin: null,
        whHumidityMax: null,
        whSeason: null,
        whStudyType: null,
        whExternalEnv: 0,
        whLayoutNotes: null,
        qualificationType: null,
        season: null,
        fillStatus: null,
        loadPercent: null,
        ...data
      });
      return localData.generalInfo[localData.generalInfo.length - 1];
    });
  }
  const existing = await getGeneralInfo(protocolId);
  if (existing) {
    await db.update(generalInfo).set(data).where(eq(generalInfo.protocolId, protocolId));
  } else {
    await db.insert(generalInfo).values({ ...data, protocolId });
  }
  return getGeneralInfo(protocolId);
}
async function listChecklist(protocolId, stage, warehouseEquipmentId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.checklistAnswers.filter((item) => {
      const sameEquipment = warehouseEquipmentId != null ? item.warehouseEquipmentId === warehouseEquipmentId : item.warehouseEquipmentId == null;
      return item.protocolId === protocolId && item.stage === stage && sameEquipment;
    });
  }
  const conditions = [
    eq(checklistAnswers.protocolId, protocolId),
    eq(checklistAnswers.stage, stage)
  ];
  if (warehouseEquipmentId != null) {
    conditions.push(eq(checklistAnswers.warehouseEquipmentId, warehouseEquipmentId));
  } else {
    conditions.push(isNull(checklistAnswers.warehouseEquipmentId));
  }
  return db.select().from(checklistAnswers).where(and(...conditions));
}
async function saveChecklist(protocolId, stage, items, warehouseEquipmentId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((data) => {
      data.checklistAnswers = data.checklistAnswers.filter((item) => {
        const sameEquipment = warehouseEquipmentId != null ? item.warehouseEquipmentId === warehouseEquipmentId : item.warehouseEquipmentId == null;
        return !(item.protocolId === protocolId && item.stage === stage && sameEquipment);
      });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      data.checklistAnswers.push(...items.map((item, index2) => ({
        id: data.checklistAnswers.length + index2 + 1,
        protocolId,
        stage,
        questionIndex: item.questionIndex,
        questionText: item.questionText,
        answer: item.answer,
        comment: item.comment,
        updatedAt: now,
        warehouseEquipmentId: warehouseEquipmentId ?? null
      })));
    });
    return;
  }
  const delConditions = [
    eq(checklistAnswers.protocolId, protocolId),
    eq(checklistAnswers.stage, stage)
  ];
  if (warehouseEquipmentId != null) {
    delConditions.push(eq(checklistAnswers.warehouseEquipmentId, warehouseEquipmentId));
  } else {
    delConditions.push(isNull(checklistAnswers.warehouseEquipmentId));
  }
  await db.delete(checklistAnswers).where(and(...delConditions));
  if (items.length === 0) return;
  await db.insert(checklistAnswers).values(
    items.map((it) => ({
      protocolId,
      stage,
      warehouseEquipmentId: warehouseEquipmentId ?? null,
      questionIndex: it.questionIndex,
      questionText: it.questionText,
      answer: it.answer,
      comment: it.comment
    }))
  );
}
async function getPVSession(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.pvSessions.find((item) => item.protocolId === protocolId);
  }
  const rows = await db.select().from(pvSessions).where(eq(pvSessions.protocolId, protocolId)).limit(1);
  return rows[0];
}
async function updatePVSession(protocolId, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const existing2 = localData.pvSessions.find((item) => item.protocolId === protocolId);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (existing2) {
        Object.assign(existing2, data, { updatedAt: now });
        return existing2;
      }
      localData.counters.pvSessions += 1;
      localData.pvSessions.push({
        id: localData.counters.pvSessions,
        protocolId,
        tempMode: null,
        startAt: null,
        endAt: null,
        minDurationHours: 72,
        minSensorCount: 9,
        customMin: null,
        customMax: null,
        verdict: "none",
        stats: null,
        deviations: null,
        conclusionText: null,
        updatedAt: now,
        samplingStepMinutes: null,
        coolingUnitPos: null,
        doorPos: null,
        floorPlanObjects: null,
        roomLengthM: null,
        roomWidthM: null,
        roomHeightM: null,
        planImageKey: null,
        planImageUrl: null,
        ...data
      });
      return localData.pvSessions[localData.pvSessions.length - 1];
    });
  }
  const existing = await getPVSession(protocolId);
  if (existing) {
    await db.update(pvSessions).set(data).where(eq(pvSessions.protocolId, protocolId));
  } else {
    await db.insert(pvSessions).values({ ...data, protocolId });
  }
  return getPVSession(protocolId);
}
async function listLoggers(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.pvLoggers.filter((logger) => logger.protocolId === protocolId).sort((a, b) => a.id - b.id);
  }
  return db.select().from(pvLoggers).where(eq(pvLoggers.protocolId, protocolId)).orderBy(pvLoggers.id);
}
async function insertLogger(data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      localData.counters.pvLoggers += 1;
      const row2 = {
        id: localData.counters.pvLoggers,
        pvSessionId: data.pvSessionId,
        protocolId: data.protocolId,
        fileKey: data.fileKey,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        label: data.label,
        customName: data.customName ?? null,
        role: data.role ?? "internal",
        pointCount: data.pointCount ?? 0,
        minVal: data.minVal ?? null,
        maxVal: data.maxVal ?? null,
        avgVal: data.avgVal ?? null,
        stdVal: data.stdVal ?? null,
        mktVal: data.mktVal ?? null,
        series: data.series ?? null,
        deviations: data.deviations ?? null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        position: data.position ?? "unset",
        posX: data.posX ?? null,
        posY: data.posY ?? null,
        firstTs: data.firstTs ?? null
      };
      localData.pvLoggers.push(row2);
      return row2;
    });
  }
  const res = await db.insert(pvLoggers).values(data);
  const [row] = await db.select().from(pvLoggers).where(eq(pvLoggers.id, res[0].insertId)).limit(1);
  return row;
}
async function updateLogger(loggerId, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const logger = localData.pvLoggers.find((item) => item.id === loggerId);
      if (!logger) return void 0;
      Object.assign(logger, data);
      return logger;
    });
  }
  await db.update(pvLoggers).set(data).where(eq(pvLoggers.id, loggerId));
  const [row] = await db.select().from(pvLoggers).where(eq(pvLoggers.id, loggerId)).limit(1);
  return row;
}
async function deleteLogger(loggerId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((localData) => {
      localData.pvLoggers = localData.pvLoggers.filter((item) => item.id !== loggerId);
    });
    return;
  }
  await db.delete(pvLoggers).where(eq(pvLoggers.id, loggerId));
}
async function listQuestionTemplates(stage, equipmentType) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.questionTemplates.filter((item) => item.stage === stage && (!equipmentType || item.equipmentType === equipmentType)).sort((a, b) => a.ord - b.ord);
  }
  const conditions = [eq(questionTemplates.stage, stage)];
  if (equipmentType) {
    conditions.push(eq(questionTemplates.equipmentType, equipmentType));
  }
  return db.select().from(questionTemplates).where(and(...conditions)).orderBy(questionTemplates.ord);
}
async function listAllQuestionTemplates(equipmentType, equipmentKind) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.questionTemplates.filter((item) => {
      if (equipmentType && item.equipmentType !== equipmentType) return false;
      if (equipmentKind !== void 0) {
        if (equipmentKind === null && item.equipmentKind !== null) return false;
        if (equipmentKind !== null && item.equipmentKind !== equipmentKind) return false;
      }
      return true;
    }).sort((a, b) => a.stage.localeCompare(b.stage) || a.ord - b.ord);
  }
  const conditions = [];
  if (equipmentType) {
    conditions.push(eq(questionTemplates.equipmentType, equipmentType));
  }
  if (equipmentKind !== void 0) {
    if (equipmentKind === null) {
      conditions.push(isNull(questionTemplates.equipmentKind));
    } else {
      conditions.push(eq(questionTemplates.equipmentKind, equipmentKind));
    }
  }
  const query = db.select().from(questionTemplates).orderBy(questionTemplates.stage, questionTemplates.ord);
  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}
async function insertQuestionTemplate(data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const id = (localData.counters.questionTemplates ?? localData.questionTemplates.length) + 1;
      localData.counters.questionTemplates = id;
      const row2 = {
        id,
        stage: data.stage,
        ord: data.ord,
        text: data.text,
        isDefault: 0,
        companyId: data.companyId ?? null,
        equipmentType: data.equipmentType ?? "refrigerator",
        equipmentKind: data.equipmentKind ?? null
      };
      localData.questionTemplates.push(row2);
      return row2;
    });
  }
  const [result] = await db.insert(questionTemplates).values({
    ...data,
    isDefault: 0,
    equipmentType: data.equipmentType ?? "refrigerator",
    equipmentKind: data.equipmentKind ?? null
  });
  const [row] = await db.select().from(questionTemplates).where(eq(questionTemplates.id, result.insertId)).limit(1);
  return row;
}
async function updateQuestionTemplate(id, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const row2 = localData.questionTemplates.find((item) => item.id === id);
      if (!row2) throw new Error("Question template not found");
      if (data.text !== void 0) row2.text = data.text;
      if (data.ord !== void 0) row2.ord = data.ord;
      return row2;
    });
  }
  await db.update(questionTemplates).set(data).where(eq(questionTemplates.id, id));
  const [row] = await db.select().from(questionTemplates).where(eq(questionTemplates.id, id)).limit(1);
  return row;
}
async function deleteQuestionTemplate(id) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((localData) => {
      localData.questionTemplates = localData.questionTemplates.filter((item) => item.id !== id);
    });
    return;
  }
  await db.delete(questionTemplates).where(eq(questionTemplates.id, id));
}
async function getExcursionSession(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.excursionStudySessions.find((item) => item.protocolId === protocolId) ?? null;
  }
  const [row] = await db.select().from(excursionStudySessions).where(eq(excursionStudySessions.protocolId, protocolId)).limit(1);
  return row ?? null;
}
async function upsertExcursionSession(protocolId, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing2 = localData.excursionStudySessions.find((item) => item.protocolId === protocolId);
      if (existing2) {
        Object.assign(existing2, data, { updatedAt: now });
        return existing2;
      }
      localData.counters.excursionStudySessions += 1;
      const row = {
        id: localData.counters.excursionStudySessions,
        protocolId,
        enabled: data.enabled ?? 0,
        timingVsPv: data.timingVsPv ?? "after_pv",
        test1Enabled: data.test1Enabled ?? 0,
        test2Enabled: data.test2Enabled ?? 0,
        test3Enabled: data.test3Enabled ?? 0,
        recordStartAt: data.recordStartAt ?? null,
        recordEndAt: data.recordEndAt ?? null,
        t1PowerOnAt: data.t1PowerOnAt ?? null,
        t1StabilizationThresholdMinutes: data.t1StabilizationThresholdMinutes ?? 15,
        t1TStableAt: data.t1TStableAt ?? null,
        t1DurationSec: data.t1DurationSec ?? null,
        t1CriticalSensor: data.t1CriticalSensor ?? null,
        t1SensorEntries: data.t1SensorEntries ?? null,
        t2DoorOpenAt: data.t2DoorOpenAt ?? null,
        t2DoorCloseAt: data.t2DoorCloseAt ?? null,
        t2TBreakAt: data.t2TBreakAt ?? null,
        t2DurationSec: data.t2DurationSec ?? null,
        t2CriticalSensor: data.t2CriticalSensor ?? null,
        t2NoBreak: data.t2NoBreak ?? 0,
        t3PowerOffAt: data.t3PowerOffAt ?? null,
        t3TBreakAt: data.t3TBreakAt ?? null,
        t3DurationSec: data.t3DurationSec ?? null,
        t3CriticalSensor: data.t3CriticalSensor ?? null,
        t3NoBreak: data.t3NoBreak ?? 0,
        stabilizationBetweenT2T3Ok: data.stabilizationBetweenT2T3Ok ?? null,
        warnings: data.warnings ?? null,
        updatedAt: now,
        t2SensorBreaks: data.t2SensorBreaks ?? null,
        t3SensorBreaks: data.t3SensorBreaks ?? null,
        t3TestEndAt: data.t3TestEndAt ?? null
      };
      localData.excursionStudySessions.push(row);
      return row;
    });
  }
  const existing = await getExcursionSession(protocolId);
  if (existing) {
    await db.update(excursionStudySessions).set(data).where(eq(excursionStudySessions.protocolId, protocolId));
  } else {
    await db.insert(excursionStudySessions).values({ protocolId, ...data });
  }
  return getExcursionSession(protocolId);
}
async function listExcursionLoggers(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.excursionLoggers.filter((logger) => logger.protocolId === protocolId).sort((a, b) => a.id - b.id);
  }
  return db.select().from(excursionLoggers).where(eq(excursionLoggers.protocolId, protocolId)).orderBy(excursionLoggers.id);
}
async function insertExcursionLogger(data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      localData.counters.excursionLoggers += 1;
      const row2 = {
        id: localData.counters.excursionLoggers,
        excursionSessionId: data.excursionSessionId,
        protocolId: data.protocolId,
        fileKey: data.fileKey,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        label: data.label,
        customName: data.customName ?? null,
        role: data.role ?? "internal",
        pointCount: data.pointCount ?? 0,
        series: data.series ?? null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      localData.excursionLoggers.push(row2);
      return row2;
    });
  }
  const [result] = await db.insert(excursionLoggers).values({
    ...data,
    role: data.role ?? "internal",
    pointCount: data.pointCount ?? 0
  });
  const [row] = await db.select().from(excursionLoggers).where(eq(excursionLoggers.id, result.insertId)).limit(1);
  return row;
}
async function updateExcursionLogger(id, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const logger = localData.excursionLoggers.find((item) => item.id === id);
      if (!logger) return void 0;
      Object.assign(logger, data);
      return logger;
    });
  }
  await db.update(excursionLoggers).set(data).where(eq(excursionLoggers.id, id));
  const [row] = await db.select().from(excursionLoggers).where(eq(excursionLoggers.id, id)).limit(1);
  return row;
}
async function deleteExcursionLogger(id) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((localData) => {
      localData.excursionLoggers = localData.excursionLoggers.filter((item) => item.id !== id);
    });
    return;
  }
  await db.delete(excursionLoggers).where(eq(excursionLoggers.id, id));
}
async function deleteAllExcursionLoggers(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((localData) => {
      localData.excursionLoggers = localData.excursionLoggers.filter((item) => item.protocolId !== protocolId);
    });
    return;
  }
  await db.delete(excursionLoggers).where(eq(excursionLoggers.protocolId, protocolId));
}
async function createCompany(input) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      data.counters.companies += 1;
      const company = {
        id: data.counters.companies,
        name: input.name,
        createdByAdminId: input.createdByAdminId,
        createdAt: now,
        updatedAt: now
      };
      data.companies.push(company);
      const existingOwnerMember = data.companyMembers.find(
        (member) => member.companyId === company.id && member.userId === input.createdByAdminId
      );
      if (!existingOwnerMember) {
        data.counters.companyMembers += 1;
        data.companyMembers.push({
          id: data.counters.companyMembers,
          userId: input.createdByAdminId,
          companyId: company.id,
          role: "admin",
          status: "approved",
          invitedAt: now,
          approvedAt: now,
          rejectedAt: null,
          approvedByAdminId: input.createdByAdminId,
          createdAt: now,
          updatedAt: now
        });
      }
      return company;
    });
  }
  const result = await db.insert(companies).values(input);
  const id = result[0].insertId;
  const row = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row[0];
}
async function listCompanies(adminId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companies.filter((company) => company.createdByAdminId === adminId);
  }
  return db.select().from(companies).where(eq(companies.createdByAdminId, adminId));
}
async function getCompany(id) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.companies.find((company) => company.id === id);
  }
  const row = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row[0];
}
async function inviteUserToCompany(input) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      data.counters.companyMembers += 1;
      const member = {
        id: data.counters.companyMembers,
        userId: input.userId,
        companyId: input.companyId,
        role: input.role ?? "user",
        status: input.status ?? "pending",
        invitedAt: now,
        approvedAt: null,
        rejectedAt: null,
        approvedByAdminId: null,
        createdAt: now,
        updatedAt: now
      };
      data.companyMembers.push(member);
      return member;
    });
  }
  const result = await db.insert(companyMembers).values(input);
  const id = result[0].insertId;
  const row = await db.select().from(companyMembers).where(eq(companyMembers.id, id)).limit(1);
  return row[0];
}
async function getCompanyMember(userId, companyId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.companyMembers.find((member) => member.userId === userId && member.companyId === companyId);
  }
  const row = await db.select().from(companyMembers).where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId))).limit(1);
  return row[0];
}
async function listCompanyMembers(companyId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companyMembers.filter((member) => member.companyId === companyId).map((member) => companyMemberWithUser(member, data.users.find((user) => user.id === member.userId)));
  }
  return db.select().from(companyMembers).leftJoin(users, eq(companyMembers.userId, users.id)).where(eq(companyMembers.companyId, companyId)).then((rows) => rows.map((r) => ({ ...r.companyMembers, user: r.users })));
}
async function approveCompanyMember(memberId, adminId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((data) => {
      const member = data.companyMembers.find((item) => item.id === memberId);
      if (!member) return;
      member.status = "approved";
      member.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
      member.approvedByAdminId = adminId;
      member.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    });
    return;
  }
  await db.update(companyMembers).set({ status: "approved", approvedAt: (/* @__PURE__ */ new Date()).toISOString(), approvedByAdminId: adminId }).where(eq(companyMembers.id, memberId));
}
async function rejectCompanyMember(memberId, adminId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((data) => {
      const member = data.companyMembers.find((item) => item.id === memberId);
      if (!member) return;
      member.status = "rejected";
      member.rejectedAt = (/* @__PURE__ */ new Date()).toISOString();
      member.approvedByAdminId = adminId;
      member.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    });
    return;
  }
  await db.update(companyMembers).set({ status: "rejected", rejectedAt: (/* @__PURE__ */ new Date()).toISOString(), approvedByAdminId: adminId }).where(eq(companyMembers.id, memberId));
}
async function removeCompanyMember(memberId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((data) => {
      data.companyMembers = data.companyMembers.filter((member) => member.id !== memberId);
    });
    return;
  }
  await db.delete(companyMembers).where(eq(companyMembers.id, memberId));
}
async function getUserCompanies(userId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companyMembers.filter((member) => member.userId === userId && member.status === "approved").map((member) => {
      const company = data.companies.find((item) => item.id === member.companyId);
      return company ? { ...company, membership: member } : null;
    }).filter((item) => Boolean(item));
  }
  return db.select().from(companyMembers).innerJoin(companies, eq(companyMembers.companyId, companies.id)).where(and(eq(companyMembers.userId, userId), eq(companyMembers.status, "approved"))).then((rows) => rows.map((r) => ({ ...r.companies, membership: r.companyMembers })));
}
async function listAllProtocolsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: protocols.id,
    number: protocols.number,
    status: protocols.status,
    companyId: protocols.companyId,
    userId: protocols.userId,
    organizationId: protocols.organizationId,
    createdAt: protocols.createdAt,
    updatedAt: protocols.updatedAt,
    iqVerdict: protocols.iqVerdict,
    oqVerdict: protocols.oqVerdict,
    pvVerdict: protocols.pvVerdict,
    companyName: companies.name,
    userName: users.name,
    userEmail: users.email
  }).from(protocols).leftJoin(companies, eq(protocols.companyId, companies.id)).leftJoin(users, eq(protocols.userId, users.id)).orderBy(desc(protocols.createdAt));
  return rows;
}
async function listProtocolsByCompany(companyId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: protocols.id,
    number: protocols.number,
    status: protocols.status,
    companyId: protocols.companyId,
    userId: protocols.userId,
    organizationId: protocols.organizationId,
    createdAt: protocols.createdAt,
    updatedAt: protocols.updatedAt,
    iqVerdict: protocols.iqVerdict,
    oqVerdict: protocols.oqVerdict,
    pvVerdict: protocols.pvVerdict,
    companyName: companies.name,
    userName: users.name,
    userEmail: users.email
  }).from(protocols).leftJoin(companies, eq(protocols.companyId, companies.id)).leftJoin(users, eq(protocols.userId, users.id)).where(eq(protocols.companyId, companyId)).orderBy(desc(protocols.createdAt));
  return rows;
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return void 0;
    const data = await readLocalDevDb();
    return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  }
  const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row[0];
}
async function getUserPendingMemberships(userId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companyMembers.filter((member) => member.userId === userId && member.status === "pending").map((member) => {
      const company = data.companies.find((item) => item.id === member.companyId);
      return company ? { ...member, companyName: company.name } : null;
    }).filter((item) => Boolean(item));
  }
  const rows = await db.select({
    member: companyMembers,
    companyName: companies.name
  }).from(companyMembers).innerJoin(companies, eq(companyMembers.companyId, companies.id)).where(and(eq(companyMembers.userId, userId), eq(companyMembers.status, "pending")));
  return rows.map((r) => ({ ...r.member, companyName: r.companyName }));
}
async function cloneProtocol(userId, sourceProtocolId, organizationId) {
  const db = await getDb();
  let sourceProto;
  let targetOrg;
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    const accessibleCompanyIds = /* @__PURE__ */ new Set();
    for (const member of data.companyMembers) {
      if (member.userId === userId && member.status === "approved") accessibleCompanyIds.add(member.companyId);
    }
    for (const company of data.companies) {
      if (company.createdByAdminId === userId) accessibleCompanyIds.add(company.id);
    }
    sourceProto = data.protocols.find(
      (protocol) => protocol.id === sourceProtocolId && (protocol.userId === userId || accessibleCompanyIds.has(protocol.companyId))
    );
    if (!sourceProto) throw new Error("Source protocol not found or not accessible");
    targetOrg = data.organizations.find(
      (org) => org.id === organizationId && (org.userId === userId || org.companyId != null && accessibleCompanyIds.has(org.companyId))
    );
    if (!targetOrg) throw new Error("Target organization not found or not accessible");
    const year2 = (/* @__PURE__ */ new Date()).getFullYear();
    const number2 = await nextProtocolNumber(organizationId, year2);
    const newProto2 = await insertProtocol({
      organizationId,
      companyId: targetOrg.companyId ?? sourceProto.companyId,
      userId,
      number: number2,
      equipmentType: sourceProto.equipmentType,
      customEquipmentName: sourceProto.customEquipmentName
    });
    const sourceGI2 = data.generalInfo.find((item) => item.protocolId === sourceProtocolId);
    if (sourceGI2) {
      await upsertGeneralInfo(newProto2.id, {
        equipmentType: sourceGI2.equipmentType,
        manufacturer: sourceGI2.manufacturer,
        model: sourceGI2.model,
        serial: sourceGI2.serial,
        inventory: sourceGI2.inventory,
        year: sourceGI2.year,
        tempMode: sourceGI2.tempMode,
        location: sourceGI2.location,
        purpose: sourceGI2.purpose,
        basis: "periodic",
        commissionMembers: sourceGI2.commissionMembers,
        qualificationType: sourceGI2.qualificationType,
        season: sourceGI2.season,
        whLengthM: sourceGI2.whLengthM,
        whWidthM: sourceGI2.whWidthM,
        whHeightM: sourceGI2.whHeightM,
        whHumidityControl: sourceGI2.whHumidityControl,
        whHumidityMin: sourceGI2.whHumidityMin,
        whHumidityMax: sourceGI2.whHumidityMax,
        whSeason: sourceGI2.whSeason,
        whStudyType: sourceGI2.whStudyType,
        whExternalEnv: sourceGI2.whExternalEnv,
        whLayoutNotes: sourceGI2.whLayoutNotes,
        fillStatus: sourceGI2.fillStatus,
        loadPercent: sourceGI2.loadPercent
      });
    }
    return newProto2;
  }
  sourceProto = await getProtocol(userId, sourceProtocolId);
  if (!sourceProto) {
    const userCompanies = await getUserCompanies(userId);
    for (const company of userCompanies) {
      sourceProto = await getProtocolByCompany(company.id, sourceProtocolId);
      if (sourceProto) break;
    }
  }
  if (!sourceProto) {
    const adminCompanies = await listCompanies(userId);
    for (const company of adminCompanies) {
      sourceProto = await getProtocolByCompany(company.id, sourceProtocolId);
      if (sourceProto) break;
    }
  }
  if (!sourceProto) throw new Error("Source protocol not found or not accessible");
  targetOrg = await getOrganization(userId, organizationId);
  if (!targetOrg) {
    const userCompanies = await getUserCompanies(userId);
    for (const company of userCompanies) {
      targetOrg = await getOrganizationByCompany(company.id, organizationId);
      if (targetOrg) break;
    }
  }
  if (!targetOrg) {
    const adminCompanies = await listCompanies(userId);
    for (const company of adminCompanies) {
      targetOrg = await getOrganizationByCompany(company.id, organizationId);
      if (targetOrg) break;
    }
  }
  if (!targetOrg) throw new Error("Target organization not found or not accessible");
  const sourceGI = await getGeneralInfo(sourceProtocolId);
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const number = await nextProtocolNumber(organizationId, year);
  const newProto = await insertProtocol({
    organizationId,
    companyId: targetOrg.companyId ?? sourceProto.companyId,
    userId,
    number,
    equipmentType: sourceProto.equipmentType,
    customEquipmentName: sourceProto.customEquipmentName
  });
  if (sourceGI) {
    await db.insert(generalInfo).values({
      protocolId: newProto.id,
      equipmentType: sourceGI.equipmentType,
      manufacturer: sourceGI.manufacturer,
      model: sourceGI.model,
      serial: sourceGI.serial,
      inventory: sourceGI.inventory,
      year: sourceGI.year,
      tempMode: sourceGI.tempMode,
      location: sourceGI.location,
      purpose: sourceGI.purpose,
      basis: "periodic",
      commissionMembers: sourceGI.commissionMembers,
      qualificationType: sourceGI.qualificationType,
      season: sourceGI.season,
      whLengthM: sourceGI.whLengthM,
      whWidthM: sourceGI.whWidthM,
      whHeightM: sourceGI.whHeightM,
      whHumidityControl: sourceGI.whHumidityControl,
      whHumidityMin: sourceGI.whHumidityMin,
      whHumidityMax: sourceGI.whHumidityMax,
      whSeason: sourceGI.whSeason,
      whStudyType: sourceGI.whStudyType,
      whExternalEnv: sourceGI.whExternalEnv,
      whLayoutNotes: sourceGI.whLayoutNotes,
      fillStatus: sourceGI.fillStatus,
      loadPercent: sourceGI.loadPercent
      // Do NOT copy: validationDate, reportDate, planDeviations, recommendations, documentValidityPeriod, signatoriesPart1, signatoriesPart2
    });
  }
  return newProto;
}
async function getWarehouseSections(protocolId) {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(warehouseProtocolSections).where(eq(warehouseProtocolSections.protocolId, protocolId));
  const map = {};
  for (const r of rows) map[r.sectionKey] = r.content ?? "";
  return map;
}
async function saveWarehouseSections(protocolId, sections) {
  const db = await getDb();
  if (!db) return;
  for (const [sectionKey, content] of Object.entries(sections)) {
    const existing = await db.select({ id: warehouseProtocolSections.id }).from(warehouseProtocolSections).where(
      and(
        eq(warehouseProtocolSections.protocolId, protocolId),
        eq(warehouseProtocolSections.sectionKey, sectionKey)
      )
    ).limit(1);
    if (existing.length > 0) {
      await db.update(warehouseProtocolSections).set({ content }).where(eq(warehouseProtocolSections.id, existing[0].id));
    } else {
      await db.insert(warehouseProtocolSections).values({ protocolId, sectionKey, content });
    }
  }
}
async function listWarehouseEquipment(protocolId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(warehouseEquipment).where(eq(warehouseEquipment.protocolId, protocolId)).orderBy(warehouseEquipment.ord, warehouseEquipment.id);
}
async function createWarehouseEquipment(data) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(warehouseEquipment).values(data);
  const [row] = await db.select().from(warehouseEquipment).where(eq(warehouseEquipment.id, result.insertId)).limit(1);
  return row;
}
async function updateWarehouseEquipment(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(warehouseEquipment).set(data).where(eq(warehouseEquipment.id, id));
}
async function deleteWarehouseEquipment(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(warehouseEquipment).where(eq(warehouseEquipment.id, id));
}
async function listSensors() {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return [...data.sensors].sort((a, b) => a.number.localeCompare(b.number));
  }
  return db.select().from(sensors);
}
async function getSensor(sensorId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.sensors.find((sensor) => sensor.id === sensorId);
  }
  const result = await db.select().from(sensors).where(eq(sensors.id, sensorId));
  return result[0];
}
async function createSensor(data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const existing = localData.sensors.find((sensor2) => sensor2.number.toLowerCase() === data.number.toLowerCase());
      if (existing) throw new Error("Sensor already exists");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      localData.counters.sensors += 1;
      const sensor = {
        id: localData.counters.sensors,
        number: data.number,
        calibrationDate: data.calibrationDate,
        nextCalibrationDate: data.nextCalibrationDate,
        status: data.status ?? "active",
        createdAt: now,
        updatedAt: now
      };
      localData.sensors.push(sensor);
      return sensor;
    });
  }
  await db.insert(sensors).values(data);
  const result = await db.select().from(sensors).where(eq(sensors.number, data.number));
  return result[0];
}
async function updateSensor(sensorId, data) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const sensor = localData.sensors.find((item) => item.id === sensorId);
      if (!sensor) throw new Error("Sensor not found");
      if (data.number !== void 0) sensor.number = data.number;
      if (data.calibrationDate !== void 0) sensor.calibrationDate = data.calibrationDate;
      if (data.nextCalibrationDate !== void 0) sensor.nextCalibrationDate = data.nextCalibrationDate;
      if (data.status !== void 0) sensor.status = data.status;
      sensor.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      return sensor;
    });
  }
  await db.update(sensors).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(sensors.id, sensorId));
  const result = await db.select().from(sensors).where(eq(sensors.id, sensorId));
  return result[0];
}
async function deleteSensor(sensorId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((localData) => {
      localData.sensors = localData.sensors.filter((sensor) => sensor.id !== sensorId);
      localData.protocolSensors = localData.protocolSensors.filter((link) => link.sensorId !== sensorId);
    });
    return;
  }
  await db.delete(sensors).where(eq(sensors.id, sensorId));
}
async function getSensorsExpiringIn30Days() {
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3);
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.sensors.filter((sensor) => {
      const next = new Date(sensor.nextCalibrationDate);
      return sensor.status === "active" && next >= now && next <= in30Days;
    });
  }
  return db.select().from(sensors).where(
    and(
      gte(sensors.nextCalibrationDate, now.toISOString()),
      lte(sensors.nextCalibrationDate, in30Days.toISOString()),
      eq(sensors.status, "active")
    )
  );
}
async function bulkCreateSensors(sensorsData) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const item of sensorsData) {
        const existing = localData.sensors.find((sensor) => sensor.number.toLowerCase() === item.number.toLowerCase());
        if (existing) {
          existing.calibrationDate = item.calibrationDate;
          existing.nextCalibrationDate = item.nextCalibrationDate;
          existing.status = "active";
          existing.updatedAt = now;
          continue;
        }
        localData.counters.sensors += 1;
        localData.sensors.push({
          id: localData.counters.sensors,
          number: item.number,
          calibrationDate: item.calibrationDate,
          nextCalibrationDate: item.nextCalibrationDate,
          status: "active",
          createdAt: now,
          updatedAt: now
        });
      }
      return [...localData.sensors].sort((a, b) => a.number.localeCompare(b.number));
    });
  }
  for (const data of sensorsData) {
    try {
      await db.insert(sensors).values({
        number: data.number,
        calibrationDate: data.calibrationDate,
        nextCalibrationDate: data.nextCalibrationDate,
        status: "active"
      });
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY") {
        console.warn(`Failed to insert sensor ${data.number}:`, err.message);
      }
    }
  }
  return db.select().from(sensors);
}
async function addSensorToProtocol(protocolId, sensorId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb((localData) => {
      const existing = localData.protocolSensors.find(
        (link2) => link2.protocolId === protocolId && link2.sensorId === sensorId
      );
      if (existing) return existing;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      localData.counters.protocolSensors += 1;
      const link = {
        id: localData.counters.protocolSensors,
        protocolId,
        sensorId,
        createdAt: now
      };
      localData.protocolSensors.push(link);
      return link;
    });
  }
  const result = await db.insert(protocolSensors).values({
    protocolId,
    sensorId
  });
  const inserted = await db.select().from(protocolSensors).where(
    and(
      eq(protocolSensors.protocolId, protocolId),
      eq(protocolSensors.sensorId, sensorId)
    )
  );
  return inserted[0];
}
async function getProtocolSensors(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.protocolSensors.filter((link) => link.protocolId === protocolId).map((link) => {
      const sensor = data.sensors.find((item) => item.id === link.sensorId);
      return sensor ? { ...sensor, protocolSensorId: link.id } : null;
    }).filter((item) => Boolean(item)).sort((a, b) => a.number.localeCompare(b.number));
  }
  const result = await db.select({
    id: sensors.id,
    number: sensors.number,
    calibrationDate: sensors.calibrationDate,
    nextCalibrationDate: sensors.nextCalibrationDate,
    status: sensors.status,
    createdAt: sensors.createdAt,
    updatedAt: sensors.updatedAt,
    protocolSensorId: protocolSensors.id
  }).from(protocolSensors).innerJoin(sensors, eq(protocolSensors.sensorId, sensors.id)).where(eq(protocolSensors.protocolId, protocolId));
  return result;
}
async function removeProtocolSensor(protocolId, sensorId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((localData) => {
      localData.protocolSensors = localData.protocolSensors.filter(
        (link) => !(link.protocolId === protocolId && link.sensorId === sensorId)
      );
    });
    return;
  }
  await db.delete(protocolSensors).where(
    and(
      eq(protocolSensors.protocolId, protocolId),
      eq(protocolSensors.sensorId, sensorId)
    )
  );
}
async function clearProtocolSensors(protocolId) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb((localData) => {
      localData.protocolSensors = localData.protocolSensors.filter((link) => link.protocolId !== protocolId);
    });
    return;
  }
  await db.delete(protocolSensors).where(
    eq(protocolSensors.protocolId, protocolId)
  );
}
var _db, localDevAdminUser;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
    localDevAdminUser = () => ({
      id: 1,
      openId: "local-dev-admin",
      name: "Local Dev Admin",
      email: "dev@local.test",
      loginMethod: "local-dev",
      role: "admin",
      createdAt: (/* @__PURE__ */ new Date(0)).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
      lastSignedIn: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});

// server/_core/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : String(forwardedProto).split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var warnedMissingCookieSecret = false;
var DEV_AUTH_OPEN_ID = "local-dev-admin";
var DEV_AUTH_APP_ID = "local-dev";
var DEV_AUTH_NAME = "Local Dev Admin";
var DEV_AUTH_SECRET = "local-development-session-secret";
function isLocalDevAuthEnabled() {
  return !ENV.isProduction && ENV.devAuthEnabled;
}
function getLocalDevUser() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: 1,
    openId: DEV_AUTH_OPEN_ID,
    name: DEV_AUTH_NAME,
    email: "dev@local.test",
    loginMethod: "local-dev",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now
  };
}
var localDevSessionPayload = {
  openId: DEV_AUTH_OPEN_ID,
  appId: DEV_AUTH_APP_ID,
  name: DEV_AUTH_NAME
};
var OAuthService = class {
  constructor(client) {
    this.client = client;
    if (!ENV.oAuthServerUrl) {
      console.warn(
        "[OAuth] OAUTH_SERVER_URL is not configured; OAuth login is disabled."
      );
    } else {
      console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret || (isLocalDevAuthEnabled() ? DEV_AUTH_SECRET : "");
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      return null;
    }
    if (!ENV.cookieSecret && !isLocalDevAuthEnabled()) {
      if (!warnedMissingCookieSecret) {
        console.warn("[Auth] JWT_SECRET is not configured; session cookies cannot be verified.");
        warnedMissingCookieSecret = true;
      }
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (isLocalDevAuthEnabled() && session.openId === DEV_AUTH_OPEN_ID) {
      return getLocalDevUser();
    }
    const sessionUserId = session.openId;
    const signedInAt = (/* @__PURE__ */ new Date()).toISOString();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/dev/login", async (req, res) => {
    if (!isLocalDevAuthEnabled()) {
      res.status(404).json({ error: "Local development login is disabled" });
      return;
    }
    try {
      const sessionToken = await sdk.signSession(localDevSessionPayload, {
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[DevAuth] Login failed", error);
      res.status(500).json({ error: "Local development login failed" });
    }
  });
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: (/* @__PURE__ */ new Date()).toISOString()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
init_env();

// server/storage.ts
init_env();
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path2 from "path";
var STORAGE_PROXY_PREFIX = "/storage";
var MANUS_PROXY_PREFIX = "/manus-storage";
var s3Client = null;
async function fetchWithRetry(url, init, maxRetries = 4) {
  let delay = 500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, init);
    if (resp.status !== 429 || attempt === maxRetries) return resp;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8e3);
  }
  return fetch(url, init);
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/?(storage|manus-storage)\//, "").replace(/^\/+/, "").replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..").join("/");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
function configuredProvider(value) {
  if (value === "manus" || value === "local" || value === "s3") return value;
  return null;
}
function primaryProvider() {
  const explicit = configuredProvider(ENV.storageProvider);
  if (explicit) return explicit;
  return ENV.forgeApiUrl && ENV.forgeApiKey ? "manus" : "local";
}
function mirrorProvider() {
  const mirror = configuredProvider(ENV.storageMirrorProvider);
  const primary = primaryProvider();
  return mirror && mirror !== primary ? mirror : null;
}
function publicUrl(provider, key) {
  return provider === "manus" ? `${MANUS_PROXY_PREFIX}/${key}` : `${STORAGE_PROXY_PREFIX}/${key}`;
}
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function localRoot() {
  return path2.resolve(process.cwd(), ENV.storageLocalRoot || ".storage");
}
function localPathForKey(relKey) {
  const root = localRoot();
  const target = path2.resolve(root, normalizeKey(relKey));
  const rootWithSep = root.endsWith(path2.sep) ? root : `${root}${path2.sep}`;
  const targetLc = target.toLowerCase();
  const rootLc = root.toLowerCase();
  const rootWithSepLc = rootWithSep.toLowerCase();
  if (targetLc !== rootLc && !targetLc.startsWith(rootWithSepLc)) {
    throw new Error("Storage key resolves outside local storage root");
  }
  return target;
}
function getS3Client() {
  if (!ENV.s3Bucket) {
    throw new Error("S3 storage config missing: set S3_BUCKET");
  }
  if (!s3Client) {
    const credentials = ENV.s3AccessKeyId && ENV.s3SecretAccessKey ? {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey
    } : void 0;
    s3Client = new S3Client({
      region: ENV.s3Region || "auto",
      endpoint: ENV.s3Endpoint || void 0,
      credentials,
      forcePathStyle: ENV.s3ForcePathStyle === "true" || ENV.s3ForcePathStyle === "1" || Boolean(ENV.s3Endpoint)
    });
  }
  return s3Client;
}
async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const maybeWebBody = body;
  if (typeof maybeWebBody.transformToByteArray === "function") {
    return Buffer.from(await maybeWebBody.transformToByteArray());
  }
  if (typeof maybeWebBody.arrayBuffer === "function") {
    return Buffer.from(await maybeWebBody.arrayBuffer());
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
async function putManus(key, data, contentType) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetchWithRetry(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
}
async function readManus(key) {
  const signed = await getManusSignedUrl(key);
  const response = await fetch(signed);
  if (!response.ok) {
    throw new Error(`Manus storage read failed (${response.status})`);
  }
  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || contentTypeForKey(key)
  };
}
async function getManusSignedUrl(key) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetchWithRetry(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  return url;
}
async function putLocal(key, data) {
  const target = localPathForKey(key);
  await fs.mkdir(path2.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}
async function readLocal(key) {
  const target = localPathForKey(key);
  return {
    data: await fs.readFile(target),
    contentType: contentTypeForKey(key)
  };
}
async function putS3(key, data, contentType) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: data,
      ContentType: contentType
    })
  );
}
async function readS3(key) {
  const result = await getS3Client().send(
    new GetObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key
    })
  );
  return {
    data: await streamToBuffer(result.Body),
    contentType: result.ContentType || contentTypeForKey(key)
  };
}
async function putWithProvider(provider, key, data, contentType) {
  if (provider === "manus") return putManus(key, data, contentType);
  if (provider === "s3") return putS3(key, data, contentType);
  return putLocal(key, data);
}
async function readWithProvider(provider, key) {
  if (provider === "manus") return readManus(key);
  if (provider === "s3") return readS3(key);
  return readLocal(key);
}
function readProviders() {
  const primary = primaryProvider();
  const providers = [primary];
  const mirror = mirrorProvider();
  if (mirror) providers.push(mirror);
  if (primary !== "manus" && ENV.forgeApiUrl && ENV.forgeApiKey) {
    providers.push("manus");
  }
  return [...new Set(providers)];
}
function contentTypeForKey(relKey) {
  const ext = path2.extname(normalizeKey(relKey)).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".csv":
      return "text/csv; charset=utf-8";
    case ".json":
      return "application/json";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const provider = primaryProvider();
  const key = appendHashSuffix(normalizeKey(relKey));
  await putWithProvider(provider, key, data, contentType);
  const mirror = mirrorProvider();
  if (mirror) {
    try {
      await putWithProvider(mirror, key, data, contentType);
    } catch (error) {
      console.warn(`[Storage] Mirror write to ${mirror} failed:`, error);
    }
  }
  return { key, url: publicUrl(provider, key) };
}
async function storageReadBuffer(relKey) {
  const key = normalizeKey(relKey);
  const failures = [];
  for (const provider of readProviders()) {
    try {
      return await readWithProvider(provider, key);
    } catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Storage object not found: ${key}. Tried ${failures.join("; ")}`);
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  const expressApp = app2;
  expressApp.get("/storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    try {
      const object = await storageReadBuffer(key);
      res.set("Cache-Control", "private, max-age=300");
      res.type(object.contentType);
      res.send(object.data);
    } catch (err) {
      console.error("[StorageProxy] storage read failed:", err);
      res.status(404).send("Storage object not found");
    }
  });
  expressApp.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// shared/validation.ts
var TEMP_MODES = [
  { id: "2-8", label: "2\u20138 \xB0C", min: 2, max: 8 },
  { id: "8-15", label: "8\u201315 \xB0C", min: 8, max: 15 },
  { id: "15-25", label: "15\u201325 \xB0C", min: 15, max: 25 }
];
var DEFAULT_SENSOR_ACCURACY_C = 0.2;
function applySensorAccuracyGuardBand(rawMin, rawMax, sensorAccuracy = DEFAULT_SENSOR_ACCURACY_C) {
  const safeRawMin = Number.isFinite(rawMin) ? rawMin : 2;
  const safeRawMax = Number.isFinite(rawMax) ? rawMax : 8;
  const safeAccuracy = Math.max(0, Math.abs(sensorAccuracy));
  const min = Number((safeRawMin + safeAccuracy).toFixed(3));
  const max = Number((safeRawMax - safeAccuracy).toFixed(3));
  if (min > max) {
    return {
      rawMin: safeRawMin,
      rawMax: safeRawMax,
      sensorAccuracy: safeAccuracy,
      min: safeRawMin,
      max: safeRawMax
    };
  }
  return {
    rawMin: safeRawMin,
    rawMax: safeRawMax,
    sensorAccuracy: safeAccuracy,
    min,
    max
  };
}
var DEFAULT_IQ_QUESTIONS_WAREHOUSE = [
  "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0442\u0430\u0431\u043B\u0438\u0447\u043A\u043E\u0439 \u0438\u043B\u0438 \u0432\u044B\u0432\u0435\u0441\u043A\u043E\u0439?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u043D\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0430\u0441\u043F\u043E\u0440\u0442?",
  "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0430\u0434\u0440\u0435\u0441 \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0430\u0434\u0440\u0435\u0441\u0443, \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u043C\u0443 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u043A \u043B\u0438\u0446\u0435\u043D\u0437\u0438\u0438?",
  "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u043E \u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0446\u0435\u043D\u0442\u0440\u0430\u043B\u044C\u043D\u044B\u043C \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u0435\u043C?",
  "\u041F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E \u043B\u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043F\u0438\u0442\u0430\u043D\u0438\u0435 (\u0418\u0411\u041F/\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440) \u0434\u043B\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0449\u0435\u0433\u043E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C?",
  "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u043B\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B (\u0438 \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438) \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438?",
  "\u0420\u0435\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D \u043B\u0438 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u0432 \u0437\u043E\u043D\u0443 (\u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043D\u0435\u0443\u043F\u043E\u043B\u043D\u043E\u043C\u043E\u0447\u0435\u043D\u043D\u044B\u0445 \u043B\u0438\u0446)?",
  "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043E\u0442\u0434\u0435\u043B\u043A\u0430 \u0438 \u0441\u0430\u043D\u0438\u0442\u0430\u0440\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u0421\u0430\u043D\u041F\u0438\u041D?"
];
var DEFAULT_OQ_QUESTIONS_WAREHOUSE = [
  "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0432\u0441\u0451 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u043E\u043D\u044B (\u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u044B\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438, \u043A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D\u0435\u0440\u044B, \u043E\u0431\u043E\u0433\u0440\u0435\u0432\u0430\u0442\u0435\u043B\u0438) \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u043F\u0443\u043B\u044C\u0442\u044B \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0438 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u044B \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u043E\u043D\u044B?",
  "\u0420\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u0432\u043A\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 (\u0438 \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C) \u043D\u0430 \u0438\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430\u0445 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430?",
  "\u0421\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u043B\u0438 \u0441\u0438\u0433\u043D\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F (\u0437\u0432\u0443\u043A\u043E\u0432\u0430\u044F/\u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u0430\u044F/\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F) \u043F\u0440\u0438 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0437\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u0433\u0440\u0430\u043D\u0438\u0446\u044B?",
  "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u043E\u0435 \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043F\u043E \u043E\u0431\u044A\u0451\u043C\u0443 \u0437\u043E\u043D\u044B (\u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440\u044B, \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u0432\u043E\u0434\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0448\u0442\u0430\u0442\u043D\u043E)?",
  "\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432 \u043F\u0443\u0441\u0442\u043E\u0439 \u0437\u043E\u043D\u0435 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430?",
  "\u0413\u043E\u0442\u043E\u0432\u043E \u043B\u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043A \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044E \u043F\u0440\u0438 \u0432\u044B\u0445\u043E\u0434\u0435 \u0438\u0437 \u0441\u0442\u0440\u043E\u044F \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0433\u043E (\u0435\u0441\u043B\u0438 \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E)?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u043B\u043E\u0433\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u0438 \u0430\u0440\u0445\u0438\u0432\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B (\u0438 \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u0438)?",
  "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438, \u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u043E \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044F\u0445 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u043E\u043D\u044B?"
];
var DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR = [
  "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0431\u0438\u0440\u043A\u043E\u0439 (\u0441\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440)?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F?",
  "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u043C\u043E\u0434\u0435\u043B\u044C \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u043D\u043E\u0433\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u043E\u0439?",
  "\u0421\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u043B\u0438 VIN \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u0430 \u0441 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438?",
  "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0434\u0430\u043D\u043D\u044B\u043C \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438?",
  "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u043D\u0430\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C (12/24V)?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E \u043E \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0422\u0421?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u0441\u0442\u0440\u0430\u0445\u043E\u0432\u043E\u0439 \u043F\u043E\u043B\u0438\u0441?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0435 \u0443\u0434\u043E\u0441\u0442\u043E\u0432\u0435\u0440\u0435\u043D\u0438\u0435 \u0443 \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
  "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u0443 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0432\u0438\u0434\u0438\u043C\u044B\u0435 \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0438 \u0434\u0435\u0444\u0435\u043A\u0442\u043E\u0432 \u0438\u043B\u0438 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F?",
  "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043B\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043A \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u043F\u0438\u0442\u0430\u043D\u0438\u044F?",
  "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u0432\u0438\u0434\u0438\u043C\u044B\u0435 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F \u0432 \u043A\u0443\u0437\u043E\u0432\u0435 \u0438\u043B\u0438 \u0434\u0432\u0435\u0440\u0438 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430?"
];
var DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR = [
  "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0442\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u043D\u043E\u0433\u043E \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E?",
  "\u0420\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043B\u0438 \u043F\u0443\u043B\u044C\u0442 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432 \u043A\u0430\u0431\u0438\u043D\u0435 \u0431\u0435\u0437 \u043E\u0448\u0438\u0431\u043E\u043A?",
  "\u0420\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u043B\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u0432\u043A\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B?",
  "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438 \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u044B \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0438\u043D\u0434\u0438\u043A\u0430\u0446\u0438\u044F \u043D\u0430 \u0434\u0438\u0441\u043F\u043B\u0435\u0435 (\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u0440\u0435\u0436\u0438\u043C\u044B)?"
];
function computeWarehouseSensorCount(opts) {
  const horiz = (m) => {
    if (!m || m <= 0) return 0;
    if (m <= 10) return 2;
    if (m <= 40) return 3;
    if (m <= 60) return 4;
    return 5;
  };
  const vert = (m) => {
    if (!m || m <= 0) return 0;
    if (m <= 1.5) return 1;
    if (m < 5) return 2;
    return 3;
  };
  const nL = horiz(opts.lengthM ?? null);
  const nW = horiz(opts.widthM ?? null);
  const nV = vert(opts.heightM ?? null);
  const base = nL && nW && nV ? nL * nW * nV : 0;
  const external = opts.externalEnv ? 1 : 0;
  const total = base + external;
  const rationale = `\u0414\u043B\u0438\u043D\u0430 ${opts.lengthM ?? "\u2014"} \u043C \u2192 ${nL} \u0442\u043E\u0447\u0435\u043A; \u0448\u0438\u0440\u0438\u043D\u0430 ${opts.widthM ?? "\u2014"} \u043C \u2192 ${nW} \u0442\u043E\u0447\u0435\u043A; \u0432\u044B\u0441\u043E\u0442\u0430 ${opts.heightM ?? "\u2014"} \u043C \u2192 ${nV} \u044F\u0440\u0443\u0441(\u0430). \u0411\u0430\u0437\u0430: ${nL}\xD7${nW}\xD7${nV} = ${base}.` + (external ? " + 1 \u0432\u043D\u0435\u0448\u043D\u0438\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 (\u043A\u043E\u043D\u0442\u0430\u043A\u0442 \u0441 \u0432\u043D\u0435\u0448\u043D\u0435\u0439 \u0441\u0440\u0435\u0434\u043E\u0439)." : "");
  return { nL, nW, nV, base, external, total, rationale };
}
var DEFAULT_IQ_QUESTIONS = [
  "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0431\u0438\u0440\u043A\u043E\u0439 (\u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u043D\u044B\u0439/\u0441\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440)?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F / \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0432 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435?",
  "\u0418\u0434\u0435\u043D\u0442\u0438\u0447\u043D\u0430 \u043B\u0438 \u043C\u043E\u0434\u0435\u043B\u044C \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0438\u0440\u0443\u0435\u043C\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u0430\u043D\u043D\u044B\u043C \u0432 \u0441\u043E\u043F\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0445?",
  "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043A \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0435\u0442\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
  "\u041F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E \u043B\u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043F\u0438\u0442\u0430\u043D\u0438\u0435 (\u0435\u0441\u043B\u0438 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F)?",
  "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432 \u043C\u0435\u0441\u0442\u0435, \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0435\u043C \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F (\u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u044F, \u043E\u0442\u0441\u0442\u0443\u043F\u044B)?",
  "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430 \u043B\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F \u0432\u0438\u0434\u0438\u043C\u044B\u0445 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 \u043A\u043E\u0440\u043F\u0443\u0441\u0430 \u0438 \u0443\u043F\u043B\u043E\u0442\u043D\u0438\u0442\u0435\u043B\u0435\u0439?"
];
var DEFAULT_OQ_QUESTIONS = [
  "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0438\u043D\u0434\u0438\u043A\u0430\u0446\u0438\u044F \u043D\u0430 \u0434\u0438\u0441\u043F\u043B\u0435\u0435 (\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u0440\u0435\u0436\u0438\u043C\u044B) \u0438\u043B\u0438 \u0440\u0443\u0447\u043A\u0430 \u0442\u0435\u0440\u043C\u043E\u0441\u0442\u0430\u0442\u0430?",
  "\u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u0438 \u0438\u0437\u0434\u0430\u0435\u0442 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u0440\u0430\u0431\u043E\u0442\u044B \u043A\u043E\u043C\u043F\u0440\u0435\u0441\u0441\u043E\u0440\u0430?",
  "\u0420\u0435\u0430\u0433\u0438\u0440\u0443\u044E\u0442 \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u0432\u043A\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B?",
  "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B / \u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438, \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0449\u0438\u0435 \u043D\u0430 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C?"
];
var STAGE_TEMPLATES = {
  iq: {
    purpose: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C, \u0447\u0442\u043E \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u043C\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0438 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0432 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0435 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439, \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u043E\u0439 \u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0435\u0439, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F \u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C \u043F\u0440\u0435\u0434\u043F\u043E\u043B\u0430\u0433\u0430\u0435\u043C\u043E\u0433\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F.",
    description: "\u0412 \u0445\u043E\u0434\u0435 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u043C\u043E\u043D\u0442\u0430\u0436\u0430 (IQ) \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442\u0441\u044F \u043D\u0430\u043B\u0438\u0447\u0438\u0435 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0445 \u0431\u0438\u0440\u043E\u043A \u0438 \u0441\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438, \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043A \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u043C \u0441\u0435\u0442\u044F\u043C, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u043C\u0435\u0441\u0442\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438.",
    criteria: "\u0412\u0441\u0435 \u043F\u0443\u043D\u043A\u0442\u044B \u043E\u043F\u0440\u043E\u0441\u043D\u0438\u043A\u0430 IQ \u0434\u043E\u043B\u0436\u043D\u044B \u0438\u043C\u0435\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \xAB\u0414\u0430\xBB \u0438\u043B\u0438 \xAB\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E\xBB. \u041F\u0440\u0438 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430 \xAB\u041D\u0435\u0442\xBB \u044D\u0442\u0430\u043F \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043D\u044B\u043C, \u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u0447\u0435\u043D\u044C \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0439, \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u044D\u0442\u0430\u043F\u0443 OQ \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0434\u043E \u0438\u0445 \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F."
  },
  oq: {
    purpose: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C, \u0447\u0442\u043E \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u0443\u0435\u0442 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u044B\u043C\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u043C \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430\u043C\u0438 \u0432 \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u043E\u043C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432.",
    description: "\u0412 \u0445\u043E\u0434\u0435 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F (OQ) \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442\u0441\u044F \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u044B \u0435\u0433\u043E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0438 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C.",
    criteria: "\u0412\u0441\u0435 \u043F\u0443\u043D\u043A\u0442\u044B \u043E\u043F\u0440\u043E\u0441\u043D\u0438\u043A\u0430 OQ \u0434\u043E\u043B\u0436\u043D\u044B \u0438\u043C\u0435\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \xAB\u0414\u0430\xBB \u0438\u043B\u0438 \xAB\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E\xBB. \u041F\u0440\u0438 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430 \xAB\u041D\u0435\u0442\xBB \u044D\u0442\u0430\u043F \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043D\u044B\u043C, \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u044D\u0442\u0430\u043F\u0443 PV \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0434\u043E \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0439."
  },
  pv: {
    purpose: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C, \u0447\u0442\u043E \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432\u043E \u0432\u0441\u0451\u043C \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u043E\u0431\u044A\u0451\u043C\u0435 \u043A\u0443\u0437\u043E\u0432\u0430 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F, \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u0432 \u043D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \xAB\u0433\u043E\u0440\u044F\u0447\u0438\u0445\xBB \u0438 \xAB\u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0445\xBB \u0442\u043E\u0447\u043A\u0430\u0445 \u043A\u0443\u0437\u043E\u0432\u0430.",
    description: "\u0412 \u0445\u043E\u0434\u0435 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 (PV) \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0441 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 10-\u0442\u0438 \u043A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432-\u043B\u043E\u0433\u0433\u0435\u0440\u043E\u0432, \u0440\u0430\u0437\u043C\u0435\u0449\u0451\u043D\u043D\u044B\u0445 \u0432 \u043A\u0443\u0437\u043E\u0432\u0435 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u043F\u043E \u0432\u0441\u0435\u043C\u0443 \u043E\u0431\u044A\u0435\u043C\u0443. \u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432\u0435\u0434\u0451\u0442\u0441\u044F \u043D\u0435\u043F\u0440\u0435\u0440\u044B\u0432\u043D\u043E \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0432 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0440\u0435\u0436\u0438\u043C\u0435.",
    criteria: "\u0412\u0441\u0435 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u043D\u0430 \u043F\u0440\u043E\u0442\u044F\u0436\u0435\u043D\u0438\u0438 \u0432\u0441\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0437\u0430\u0434\u0430\u043D\u043D\u043E\u0433\u043E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430. MKT (\u0441\u0440\u0435\u0434\u043D\u044F\u044F \u043A\u0438\u043D\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430) \u043F\u043E \u043A\u0430\u0436\u0434\u043E\u043C\u0443 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u043C\u0443 \u0434\u0430\u0442\u0447\u0438\u043A\u0443 \u0442\u0430\u043A\u0436\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0440\u0435\u0436\u0438\u043C\u0430. \u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443, \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u0438 \u0441\u0440\u0435\u0434\u043D\u044E\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043F\u043E \u043A\u0430\u0436\u0434\u043E\u043C\u0443 \u0434\u0430\u0442\u0447\u0438\u043A\u0443, \u043F\u0440\u0438\u0432\u0435\u0441\u0442\u0438 \u0442\u0430\u0431\u043B\u0438\u0447\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0432 \u0432\u0438\u0434\u0435 \u0433\u0440\u0430\u0444\u0438\u043A\u043E\u0432 \u0438 \u0433\u0438\u0441\u0442\u043E\u0433\u0440\u0430\u043C\u043C\u044B."
  }
};
var WAREHOUSE_STAGE_TEMPLATES = {
  iq: {
    purpose: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C, \u0447\u0442\u043E \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u043C\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0438 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 (\u0437\u043E\u043D\u0435) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439, \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u043E\u0439 \u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0435\u0439, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F \u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C \u043F\u0440\u0435\u0434\u043F\u043E\u043B\u0430\u0433\u0430\u0435\u043C\u043E\u0433\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F.",
    description: "\u0412 \u0445\u043E\u0434\u0435 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u043C\u043E\u043D\u0442\u0430\u0436\u0430 (IQ) \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442\u0441\u044F \u043D\u0430\u043B\u0438\u0447\u0438\u0435 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0445 \u0431\u0438\u0440\u043E\u043A \u0438 \u0441\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438, \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043A \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u043C \u0441\u0435\u0442\u044F\u043C, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438.",
    criteria: "\u0412\u0441\u0435 \u043F\u0443\u043D\u043A\u0442\u044B \u043E\u043F\u0440\u043E\u0441\u043D\u0438\u043A\u0430 IQ \u0434\u043E\u043B\u0436\u043D\u044B \u0438\u043C\u0435\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \xAB\u0414\u0430\xBB \u0438\u043B\u0438 \xAB\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E\xBB. \u041F\u0440\u0438 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430 \xAB\u041D\u0435\u0442\xBB \u044D\u0442\u0430\u043F \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043D\u044B\u043C, \u0444\u043E\u0440\u043C\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u0447\u0435\u043D\u044C \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0439, \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u044D\u0442\u0430\u043F\u0443 OQ \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0434\u043E \u0438\u0445 \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F."
  },
  oq: {
    purpose: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C, \u0447\u0442\u043E \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u0443\u0435\u0442 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u044B\u043C\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u043C \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430\u043C\u0438 \u0432 \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u043E\u043C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432.",
    description: "\u0412 \u0445\u043E\u0434\u0435 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F (OQ) \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u0442\u0441\u044F \u0440\u0430\u0431\u043E\u0442\u043E\u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u044B \u0435\u0433\u043E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0445 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0438 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 (\u0437\u043E\u043D\u0435) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.",
    criteria: "\u0412\u0441\u0435 \u043F\u0443\u043D\u043A\u0442\u044B \u043E\u043F\u0440\u043E\u0441\u043D\u0438\u043A\u0430 OQ \u0434\u043E\u043B\u0436\u043D\u044B \u0438\u043C\u0435\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \xAB\u0414\u0430\xBB \u0438\u043B\u0438 \xAB\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E\xBB. \u041F\u0440\u0438 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430 \xAB\u041D\u0435\u0442\xBB \u044D\u0442\u0430\u043F \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043D\u044B\u043C, \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043A \u044D\u0442\u0430\u043F\u0443 PV \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0434\u043E \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0439."
  },
  pv: {
    purpose: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C, \u0447\u0442\u043E \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432\u043E \u0432\u0441\u0451\u043C \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u043E\u0431\u044A\u0451\u043C\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F, \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u0432 \u043D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \xAB\u0433\u043E\u0440\u044F\u0447\u0438\u0445\xBB \u0438 \xAB\u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0445\xBB \u0442\u043E\u0447\u043A\u0430\u0445 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.",
    description: "\u0412 \u0445\u043E\u0434\u0435 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 (PV) \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0441 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u043F\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0445 (\u043A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445) \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432-\u043B\u043E\u0433\u0433\u0435\u0440\u043E\u0432, \u0440\u0430\u0437\u043C\u0435\u0449\u0451\u043D\u043D\u044B\u0445 \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 (\u0437\u043E\u043D\u0435) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043F\u043E \u0432\u0441\u0435\u043C\u0443 \u043E\u0431\u044A\u0435\u043C\u0443. \u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432\u0435\u0434\u0451\u0442\u0441\u044F \u043D\u0435\u043F\u0440\u0435\u0440\u044B\u0432\u043D\u043E \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0432 \u0440\u0430\u0431\u043E\u0447\u0435\u043C \u0440\u0435\u0436\u0438\u043C\u0435.",
    criteria: "\u0412\u0441\u0435 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u043D\u0430 \u043F\u0440\u043E\u0442\u044F\u0436\u0435\u043D\u0438\u0438 \u0432\u0441\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0437\u0430\u0434\u0430\u043D\u043D\u043E\u0433\u043E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430. MKT (\u0441\u0440\u0435\u0434\u043D\u044F\u044F \u043A\u0438\u043D\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430) \u043F\u043E \u043A\u0430\u0436\u0434\u043E\u043C\u0443 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u043C\u0443 \u0434\u0430\u0442\u0447\u0438\u043A\u0443 \u0442\u0430\u043A\u0436\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0440\u0435\u0436\u0438\u043C\u0430. \u041D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443, \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u0438 \u0441\u0440\u0435\u0434\u043D\u044E\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043F\u043E \u043A\u0430\u0436\u0434\u043E\u043C\u0443 \u0434\u0430\u0442\u0447\u0438\u043A\u0443, \u043F\u0440\u0438\u0432\u0435\u0441\u0442\u0438 \u0442\u0430\u0431\u043B\u0438\u0447\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0438 \u0432\u0438\u0437\u0443\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0432 \u0432\u0438\u0434\u0435 \u0433\u0440\u0430\u0444\u0438\u043A\u043E\u0432 \u0438 \u0433\u0438\u0441\u0442\u043E\u0433\u0440\u0430\u043C\u043C\u044B."
  }
};

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_db();

// server/excursionCalc.ts
function tempAt(series, ts) {
  if (!series.ts.length) return null;
  let best = 0;
  let bestDiff = Math.abs(series.ts[0] - ts);
  for (let i = 1; i < series.ts.length; i++) {
    const d = Math.abs(series.ts[i] - ts);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return series.temp[best];
}
function inRange(t2, lo, hi) {
  return t2 >= lo && t2 <= hi;
}
function calcTest1(sensors2, powerOnAt, stabilizationThresholdMinutes, tempRange2, stableUntilAt) {
  const [lo, hi] = tempRange2;
  void stabilizationThresholdMinutes;
  const internals = sensors2.filter((s) => s.role === "internal");
  const warnings = [];
  const entries = [];
  const observationEndAt = stableUntilAt ?? Math.max(...internals.flatMap((s) => s.ts), powerOnAt);
  for (const s of internals) {
    const tempAtOn = tempAt(s, powerOnAt);
    const alreadyInRange = tempAtOn !== null && inRange(tempAtOn, lo, hi);
    let entryAt = null;
    const afterOn = s.ts.map((t2, i) => ({ t: t2, temp: s.temp[i] })).filter((p) => p.t >= powerOnAt && p.t <= observationEndAt);
    const remainsInRangeAfterOn = afterOn.length > 0 && afterOn.every((p) => inRange(p.temp, lo, hi));
    if (alreadyInRange && remainsInRangeAfterOn) {
      entryAt = powerOnAt;
      warnings.push(
        `[INFO] \u0414\u0430\u0442\u0447\u0438\u043A ${s.label}: \u043F\u0440\u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438 \u0443\u0436\u0435 \u043D\u0430\u0445\u043E\u0434\u0438\u043B\u0441\u044F \u0432 \u0446\u0435\u043B\u0435\u0432\u043E\u043C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435. \u0412\u0440\u0435\u043C\u044F \u043D\u0430\u0431\u043E\u0440\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u2014 0 \u0441\u0435\u043A.`
      );
    } else {
      for (let i = 0; i < afterOn.length; i++) {
        if (!inRange(afterOn[i].temp, lo, hi)) continue;
        const windowPoints = afterOn.slice(i);
        if (windowPoints.every((p) => inRange(p.temp, lo, hi))) {
          entryAt = afterOn[i].t;
          break;
        }
      }
      if (entryAt === null) {
        warnings.push(
          `\u0422\u0435\u0441\u0442 1 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \u0434\u0430\u0442\u0447\u0438\u043A ${s.label} \u043D\u0435 \u0432\u043E\u0448\u0451\u043B \u0432 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D. \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u0443\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F.`
        );
      }
    }
    entries.push({
      label: s.label,
      tempAtOn,
      entryAt,
      durationSec: entryAt !== null ? Math.round((entryAt - powerOnAt) / 1e3) : null
    });
  }
  const validEntries = entries.filter((e) => e.entryAt !== null);
  if (!validEntries.length) {
    return { tStableAt: null, durationSec: null, criticalSensor: null, sensorEntries: entries, warnings };
  }
  const critical = validEntries.reduce((a, b) => a.entryAt > b.entryAt ? a : b);
  return {
    tStableAt: critical.entryAt,
    durationSec: Math.round((critical.entryAt - powerOnAt) / 1e3),
    criticalSensor: critical.label,
    sensorEntries: entries,
    warnings
  };
}
function calcTest2(sensors2, doorOpenAt, doorCloseAt, tempRange2) {
  const [lo, hi] = tempRange2;
  const internals = sensors2.filter((s) => s.role === "internal");
  const warnings = [];
  const sensorBreaks = [];
  let tBreakAt = null;
  let criticalSensor = null;
  for (const s of internals) {
    const windowPoints = s.ts.map((t2, i) => ({ t: t2, temp: s.temp[i] })).filter((p) => p.t >= doorOpenAt && p.t <= doorCloseAt);
    let sBreakAt = null;
    for (const p of windowPoints) {
      if (!inRange(p.temp, lo, hi)) {
        sBreakAt = p.t;
        break;
      }
    }
    sensorBreaks.push({
      label: s.label,
      tBreakAt: sBreakAt,
      durationSec: sBreakAt !== null ? Math.round((sBreakAt - doorOpenAt) / 1e3) : null
    });
    if (sBreakAt !== null && (tBreakAt === null || sBreakAt < tBreakAt)) {
      tBreakAt = sBreakAt;
      criticalSensor = s.label;
    }
  }
  const noBreak = tBreakAt === null;
  const doorOpenDurationSec = Math.round((doorCloseAt - doorOpenAt) / 1e3);
  if (noBreak) {
    const mins = Math.round(doorOpenDurationSec / 60);
    warnings.push(
      `[INFO] \u0422\u0435\u0441\u0442 2: \u043D\u0438 \u043E\u0434\u0438\u043D \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u043D\u0435 \u0432\u044B\u0448\u0435\u043B \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0446\u0435\u043B\u0435\u0432\u043E\u0433\u043E \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u0432 \u043F\u0435\u0440\u0438\u043E\u0434 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439 \u0434\u0432\u0435\u0440\u0438. \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0434\u0432\u0435\u0440\u0438 \u2014 ${mins} \u043C\u0438\u043D (${doorOpenDurationSec} \u0441\u0435\u043A).`
    );
  }
  return {
    tBreakAt,
    durationSec: noBreak ? doorOpenDurationSec : tBreakAt !== null ? Math.round((tBreakAt - doorOpenAt) / 1e3) : null,
    criticalSensor,
    noBreak,
    sensorBreaks,
    warnings
  };
}
function calcTest3(sensors2, powerOffAt, recordEndAt, tempRange2, testEndAt) {
  const [lo, hi] = tempRange2;
  const internals = sensors2.filter((s) => s.role === "internal");
  const warnings = [];
  const sensorBreaks = [];
  let tBreakAt = null;
  let criticalSensor = null;
  for (const s of internals) {
    const windowPoints = s.ts.map((t2, i) => ({ t: t2, temp: s.temp[i] })).filter((p) => p.t >= powerOffAt && p.t <= recordEndAt);
    let sBreakAt = null;
    for (const p of windowPoints) {
      if (!inRange(p.temp, lo, hi)) {
        sBreakAt = p.t;
        break;
      }
    }
    sensorBreaks.push({
      label: s.label,
      tBreakAt: sBreakAt,
      durationSec: sBreakAt !== null ? Math.round((sBreakAt - powerOffAt) / 1e3) : null
    });
    if (sBreakAt !== null && (tBreakAt === null || sBreakAt < tBreakAt)) {
      tBreakAt = sBreakAt;
      criticalSensor = s.label;
    }
  }
  const noBreak = tBreakAt === null;
  const observationDurationSec = noBreak && testEndAt != null ? Math.round((testEndAt - powerOffAt) / 1e3) : tBreakAt !== null ? Math.round((tBreakAt - powerOffAt) / 1e3) : null;
  if (noBreak) {
    if (testEndAt != null) {
      warnings.push(
        `[INFO] \u0422\u0435\u0441\u0442 3: \u043D\u0438 \u043E\u0434\u0438\u043D \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u043D\u0435 \u0432\u044B\u0448\u0435\u043B \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0446\u0435\u043B\u0435\u0432\u043E\u0433\u043E \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043F\u0438\u0442\u0430\u043D\u0438\u044F. \u0412\u0440\u0435\u043C\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u2014 ${Math.round((testEndAt - powerOffAt) / 6e4)} \u043C\u0438\u043D.`
      );
    } else {
      warnings.push(
        `[INFO] \u0422\u0435\u0441\u0442 3: \u043D\u0438 \u043E\u0434\u0438\u043D \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u043D\u0435 \u0432\u044B\u0448\u0435\u043B \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0446\u0435\u043B\u0435\u0432\u043E\u0433\u043E \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043F\u0438\u0442\u0430\u043D\u0438\u044F. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0432\u0440\u0435\u043C\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u0434\u043B\u044F \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.`
      );
    }
  }
  return {
    tBreakAt,
    durationSec: observationDurationSec,
    criticalSensor,
    noBreak,
    sensorBreaks,
    warnings
  };
}

// server/loggerParser.ts
import * as XLSX from "xlsx";
var TIME_TOKENS = [
  "time",
  "datetime",
  "date",
  "timestamp",
  "recordtime",
  "logtime",
  "\u0434\u0430\u0442\u0430",
  "\u0432\u0440\u0435\u043C\u044F",
  "\u0434\u0430\u0442\u0430\u0438\u0432\u0440\u0435\u043C\u044F",
  "\u0434\u0430\u0442\u0430\u0432\u0440\u0435\u043C\u044F"
];
var TEMP_TOKENS = [
  "temperature",
  "temp",
  "celsius",
  "\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430",
  "\u0442\u0435\u043C\u043F",
  "ntc",
  "probe",
  "sensor",
  "channel",
  "\u043A\u0430\u043D\u0430\u043B",
  "\u0434\u0430\u0442\u0447\u0438\u043A",
  "ch1",
  "ch2"
];
var TEMP_EXCLUDE_TOKENS = [
  "ll",
  "hl",
  "lo",
  "hi",
  "low",
  "high",
  "min",
  "max",
  "limit",
  "alarm",
  "threshold",
  "setpoint",
  "set",
  "upper",
  "lower",
  "\u043D\u0438\u0436\u043D",
  "\u0432\u0435\u0440\u0445\u043D",
  "\u043C\u0438\u043D",
  "\u043C\u0430\u043A\u0441",
  "\u043F\u043E\u0440\u043E\u0433",
  "\u0443\u0441\u0442\u0430\u0432\u043A",
  "\u0442\u0440\u0435\u0432\u043E\u0433",
  "serial",
  "name",
  "logger",
  "device",
  "id",
  "\u2116",
  "index",
  "\u043D\u043E\u043C\u0435\u0440"
];
function normKey(k) {
  return String(k || "").toLowerCase().replace(/[\s_:°"'().\[\]\-,/\\]/g, "").trim();
}
function containsAny(hay, needles) {
  for (const n of needles) {
    if (!n) continue;
    if (hay.includes(n)) return true;
  }
  return false;
}
function scoreAsTime(header, columnValues) {
  const h = normKey(header);
  let s = 0;
  if (containsAny(h, TIME_TOKENS)) s += 10;
  const sample = columnValues.slice(0, 10);
  let ok = 0;
  let checked = 0;
  for (const v of sample) {
    if (v === null || v === void 0 || v === "") continue;
    checked++;
    if (parseTimestamp(v) !== null) ok++;
  }
  if (checked > 0 && ok / checked > 0.6) s += 8;
  return s;
}
function scoreAsTemp(header, columnValues) {
  const h = normKey(header);
  let s = 0;
  if (containsAny(h, TEMP_EXCLUDE_TOKENS)) {
    if (containsAny(h, ["temperature", "\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430"])) return 1;
    return -100;
  }
  if (containsAny(h, TEMP_TOKENS)) s += 10;
  const rawLower = String(header || "").toLowerCase();
  if (rawLower.includes("\xB0c") || rawLower.includes("\xB0c") || /\(\s*c\s*\)/.test(rawLower)) s += 5;
  const sample = columnValues.slice(0, 20);
  let plausible = 0;
  let checked = 0;
  for (const v of sample) {
    if (v === null || v === void 0 || v === "") continue;
    checked++;
    const n = parseNumber(v);
    if (n !== null && n > -80 && n < 80) plausible++;
  }
  if (checked > 0 && plausible / checked > 0.7) s += 4;
  return s;
}
function selectColumns(header, dataRows) {
  const colCount = header.length;
  const timeScores = [];
  const tempScores = [];
  for (let c = 0; c < colCount; c++) {
    const vals = dataRows.map((r) => r ? r[c] : void 0);
    timeScores.push(scoreAsTime(String(header[c] ?? ""), vals));
    tempScores.push(scoreAsTemp(String(header[c] ?? ""), vals));
  }
  let timeIdx = -1;
  let bestTime = 4;
  for (let c = 0; c < colCount; c++) {
    if (timeScores[c] > bestTime) {
      bestTime = timeScores[c];
      timeIdx = c;
    }
  }
  let tempIdx = -1;
  let bestTemp = 4;
  for (let c = 0; c < colCount; c++) {
    if (c === timeIdx) continue;
    if (tempScores[c] > bestTemp) {
      bestTemp = tempScores[c];
      tempIdx = c;
    }
  }
  return { timeIdx, tempIdx };
}
function parseNumber(raw) {
  if (raw === null || raw === void 0) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[^\d,.\-+eE]/g, "");
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function parseTimestamp(raw) {
  if (raw === null || raw === void 0 || raw === "") return null;
  if (typeof raw === "number" && raw > 2e4 && raw < 8e4) {
    const ms = Math.round((raw - 25569) * 86400 * 1e3);
    return ms;
  }
  if (raw instanceof Date) {
    const t2 = raw.getTime();
    return Number.isFinite(t2) ? t2 : null;
  }
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, " ");
  let m = s.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?/
  );
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    const year = yyyy.length === 2 ? 2e3 + Number(yyyy) : Number(yyyy);
    const t2 = Date.UTC(year, Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss || "0"));
    if (Number.isFinite(t2)) return t2;
  }
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const year = yyyy.length === 2 ? 2e3 + Number(yyyy) : Number(yyyy);
    const t2 = Date.UTC(year, Number(mm) - 1, Number(dd));
    if (Number.isFinite(t2)) return t2;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    const [, yyyy, mm, dd, hh, mi, ss] = m;
    const t2 = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss || "0"));
    if (Number.isFinite(t2)) return t2;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();
  return null;
}
function detectDelimiter(lines) {
  const candidates = [";", "	", "|", ","];
  const sample = lines.slice(0, Math.min(lines.length, 8));
  let best = { delim: ",", score: -1 };
  for (const d of candidates) {
    const regex = new RegExp(d === "|" ? "\\|" : d === "	" ? "	" : d, "g");
    const perLine = sample.map((l) => (l.match(regex) || []).length);
    if (perLine.every((c) => c === 0)) continue;
    const base = perLine[0] || 0;
    const consistent = perLine.filter((c) => c === base && c > 0).length;
    const score = base * 10 + consistent;
    if (score > best.score) best = { delim: d, score };
  }
  return best.score > 0 ? best.delim : ",";
}
function splitCsv(line, delim) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}
function parseCsvText(text2) {
  const lines = text2.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines);
  return lines.map((l) => splitCsv(l, delim));
}
function findHeaderRowIndex(rows) {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const r = rows[i] || [];
    let textCells = 0;
    let tokenHits = 0;
    for (const cell of r) {
      const s = String(cell ?? "").trim();
      if (!s) continue;
      if (parseNumber(cell) === null && parseTimestamp(cell) === null) textCells++;
      const nk = normKey(s);
      if (containsAny(nk, TIME_TOKENS)) tokenHits += 2;
      if (containsAny(nk, TEMP_TOKENS)) tokenHits += 2;
      const lower = s.toLowerCase();
      if (lower.includes("\xB0c") || /\(\s*c\s*\)/.test(lower)) tokenHits += 1;
    }
    const score = textCells + tokenHits * 3;
    if (score > bestScore && tokenHits > 0) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore > 0 ? bestIdx : 0;
}
var SENSOR_NAME_TOKENS = [
  "loggername",
  "loggernam",
  "devicename",
  "sensorname",
  "sensorid",
  "serialnumber",
  "serialno",
  "serial",
  "deviceid",
  "loggerid",
  "loggerno",
  "deviceno",
  "name",
  "id",
  "\u0438\u043C\u044F\u0434\u0430\u0442\u0447\u0438\u043A\u0430",
  "\u0434\u0430\u0442\u0447\u0438\u043A",
  "\u0441\u0435\u0440\u0438\u0439\u043D\u044B\u0439\u043D\u043E\u043C\u0435\u0440",
  "\u0441\u0435\u0440\u0438\u0439\u043D\u044B\u0439",
  "\u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435"
];
function extractSensorName(rows, headerIdx) {
  for (let i = 0; i < headerIdx; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < r.length - 1; c++) {
      const key = normKey(String(r[c] ?? ""));
      if (!key) continue;
      if (containsAny(key, SENSOR_NAME_TOKENS)) {
        for (let v = c + 1; v < r.length; v++) {
          const val = String(r[v] ?? "").trim();
          if (val && parseNumber(r[v]) === null && parseTimestamp(r[v]) === null) {
            return val;
          }
        }
      }
    }
  }
  const header = rows[headerIdx] || [];
  const dataRows = rows.slice(headerIdx + 1).filter((r) => Array.isArray(r) && r.length > 0);
  for (let c = 0; c < header.length; c++) {
    const key = normKey(String(header[c] ?? ""));
    if (!key) continue;
    if (containsAny(key, SENSOR_NAME_TOKENS)) {
      for (const dr of dataRows.slice(0, 5)) {
        const val = String(dr[c] ?? "").trim();
        if (val && parseTimestamp(dr[c]) === null) {
          return val;
        }
      }
    }
  }
  return void 0;
}
function parseLoggerBuffer(buffer, fileName) {
  const ext = (fileName.toLowerCase().split(".").pop() || "").trim();
  let rows = [];
  const isXlsxLike = ["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(ext);
  const isRealXls = buffer.length >= 8 && buffer[0] === 208 && buffer[1] === 207 && buffer[2] === 17 && buffer[3] === 224;
  const isRealXlsx = buffer.length >= 4 && buffer[0] === 80 && buffer[1] === 75;
  const isUtf16Le = buffer.length >= 2 && buffer[0] === 255 && buffer[1] === 254;
  const isUtf16Be = buffer.length >= 2 && buffer[0] === 254 && buffer[1] === 255;
  if (isUtf16Le || isUtf16Be) {
    const enc = isUtf16Le ? "utf16le" : "utf16le";
    let text2;
    if (isUtf16Be) {
      const swapped = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i + 1 < buffer.length; i += 2) {
        swapped[i - 2] = buffer[i + 1];
        swapped[i - 1] = buffer[i];
      }
      text2 = swapped.toString(enc);
    } else {
      text2 = buffer.slice(2).toString(enc);
    }
    text2 = text2.replace(/^\uFEFF/, "");
    rows = parseCsvText(text2);
  } else if (isXlsxLike && (isRealXls || isRealXlsx)) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false
    });
  } else if (isXlsxLike) {
    const text2 = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const csvRows = parseCsvText(text2);
    if (csvRows.length >= 2) {
      rows = csvRows;
    } else {
      try {
        const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: "",
          blankrows: false
        });
      } catch {
        rows = csvRows;
      }
    }
  } else {
    let text2;
    try {
      text2 = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    } catch {
      text2 = buffer.toString();
    }
    rows = parseCsvText(text2);
  }
  rows = rows.map(
    (r) => (r || []).map((c) => typeof c === "string" ? c.trim() : c)
  );
  if (rows.length < 2) return { ts: [], temp: [] };
  const headerIdx = findHeaderRowIndex(rows);
  const header = rows[headerIdx] || [];
  const dataRows = rows.slice(headerIdx + 1).filter((r) => Array.isArray(r) && r.length > 0);
  const sensorName = extractSensorName(rows, headerIdx);
  let { timeIdx, tempIdx } = selectColumns(header, dataRows);
  const ts = [];
  const temp = [];
  if (timeIdx === -1 || tempIdx === -1) {
    const { timeIdx: tA, tempIdx: tB } = heuristicColumnsFromData(dataRows);
    timeIdx = timeIdx === -1 ? tA : timeIdx;
    tempIdx = tempIdx === -1 ? tB : tempIdx;
  }
  if (timeIdx === -1 || tempIdx === -1) {
    return { ts: [], temp: [], sensorName };
  }
  for (const r of dataRows) {
    const t2 = parseTimestamp(r[timeIdx]);
    const v = parseNumber(r[tempIdx]);
    if (t2 !== null && v !== null && v > -80 && v < 80) {
      ts.push(t2);
      temp.push(v);
    }
  }
  const order = ts.map((_, i) => i).sort((a, b) => ts[a] - ts[b]);
  const sortedTs = order.map((i) => ts[i]);
  const sortedTemp = order.map((i) => temp[i]);
  return { ts: sortedTs, temp: sortedTemp, sensorName };
}
function heuristicColumnsFromData(rows) {
  if (rows.length === 0) return { timeIdx: -1, tempIdx: -1 };
  const colCount = Math.max(...rows.map((r) => r ? r.length : 0));
  const timeHits = new Array(colCount).fill(0);
  const tempHits = new Array(colCount).fill(0);
  const N = Math.min(rows.length, 40);
  for (let i = 0; i < N; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < colCount; c++) {
      const v = r[c];
      if (parseTimestamp(v) !== null) timeHits[c]++;
      const n = parseNumber(v);
      if (n !== null && n > -80 && n < 80 && !Number.isInteger(n * 1)) {
        tempHits[c] += 2;
      } else if (n !== null && n > -80 && n < 80) {
        tempHits[c] += 1;
      }
    }
  }
  let timeIdx = -1, bestT = N * 0.5;
  for (let c = 0; c < colCount; c++) {
    if (timeHits[c] > bestT) {
      bestT = timeHits[c];
      timeIdx = c;
    }
  }
  let tempIdx = -1, bestV = 0;
  for (let c = 0; c < colCount; c++) {
    if (c === timeIdx) continue;
    if (tempHits[c] > bestV) {
      bestV = tempHits[c];
      tempIdx = c;
    }
  }
  return { timeIdx, tempIdx };
}
function computeStats(temps) {
  if (!temps.length) return null;
  let min = temps[0], max = temps[0], sum = 0;
  for (const t2 of temps) {
    if (t2 < min) min = t2;
    if (t2 > max) max = t2;
    sum += t2;
  }
  const avg = sum / temps.length;
  let sq = 0;
  for (const t2 of temps) sq += (t2 - avg) ** 2;
  const std = Math.sqrt(sq / temps.length);
  const dH = 83144;
  const R = 8.314;
  let expSum = 0;
  for (const t2 of temps) {
    const Tk = t2 + 273.15;
    expSum += Math.exp(-dH / (R * Tk));
  }
  const mean = expSum / temps.length;
  const mktK = -dH / R / Math.log(mean);
  const mkt = mktK - 273.15;
  return {
    min: round(min),
    max: round(max),
    avg: round(avg),
    std: round(std),
    mkt: round(mkt)
  };
}
function round(n, decimals = 3) {
  const k = 10 ** decimals;
  return Math.round(n * k) / k;
}
function findDeviations(ts, temp, min, max) {
  const out = [];
  let i = 0;
  while (i < temp.length) {
    if (temp[i] > max || temp[i] < min) {
      const type = temp[i] > max ? "high" : "low";
      const start = ts[i];
      let extreme = temp[i];
      let j = i;
      while (j < temp.length) {
        const cur = temp[j];
        const isOut = type === "high" ? cur > max : cur < min;
        if (!isOut) break;
        if (type === "high" && cur > extreme) extreme = cur;
        if (type === "low" && cur < extreme) extreme = cur;
        j++;
      }
      const end = ts[Math.min(j, ts.length - 1)];
      out.push({
        start,
        end,
        durationMs: Math.max(0, end - start),
        value: round(extreme, 2),
        type
      });
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
}
function clipSeries(series, startMs, endMs) {
  if (!startMs && !endMs) return series;
  const ts = [];
  const temp = [];
  for (let i = 0; i < series.ts.length; i++) {
    const t2 = series.ts[i];
    if (startMs && t2 < startMs) continue;
    if (endMs && t2 > endMs) continue;
    ts.push(t2);
    temp.push(series.temp[i]);
  }
  return { ts, temp };
}
function resampleSeries(series, stepMinutes) {
  if (!stepMinutes || stepMinutes <= 0) return series;
  if (series.ts.length === 0) return series;
  const stepMs = stepMinutes * 6e4;
  const start = series.ts[0];
  const end = series.ts[series.ts.length - 1];
  const pointsSet = /* @__PURE__ */ new Set();
  for (const t2 of series.ts) {
    pointsSet.add(t2);
  }
  const firstTick = Math.ceil(start / stepMs) * stepMs;
  for (let g = firstTick; g <= end; g += stepMs) {
    pointsSet.add(g);
  }
  const allPoints = Array.from(pointsSet).sort((a, b) => a - b);
  const outTs = [];
  const outTemp = [];
  const originalMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < series.ts.length; i++) {
    originalMap.set(series.ts[i], series.temp[i]);
  }
  for (const t2 of allPoints) {
    if (originalMap.has(t2)) {
      outTs.push(t2);
      outTemp.push(originalMap.get(t2));
    } else {
      let before = null;
      let after = null;
      for (let i = 0; i < series.ts.length; i++) {
        if (series.ts[i] < t2) {
          before = { ts: series.ts[i], temp: series.temp[i] };
        } else if (series.ts[i] > t2 && !after) {
          after = { ts: series.ts[i], temp: series.temp[i] };
          break;
        }
      }
      if (before && after) {
        const ratio = (t2 - before.ts) / (after.ts - before.ts);
        const interpTemp = before.temp + (after.temp - before.temp) * ratio;
        outTs.push(t2);
        outTemp.push(interpTemp);
      } else if (before) {
        outTs.push(t2);
        outTemp.push(before.temp);
      } else if (after) {
        outTs.push(t2);
        outTemp.push(after.temp);
      }
    }
  }
  if (end - start < stepMs) {
    return series;
  }
  if (outTs.length === 0) {
    return series;
  }
  return { ts: outTs, temp: outTemp };
}
function detectExternalSensors(sensors2, rangeMin, rangeMax) {
  if (sensors2.length === 0) return [];
  const avgs = sensors2.map((s) => s.avg).slice().sort((a, b) => a - b);
  const median = avgs[Math.floor(avgs.length / 2)];
  const out = [];
  for (let i = 0; i < sensors2.length; i++) {
    const a = sensors2[i].avg;
    const farFromCohort = Math.abs(a - median) > 5;
    const outsideRange = a < rangeMin - 1 || a > rangeMax + 1;
    if (farFromCohort && outsideRange) out.push(i);
  }
  return out;
}

// server/pdfReport.ts
import PDFDocument from "pdfkit";
import path3 from "path";
import fs2 from "fs";
import { fileURLToPath } from "url";

// server/charts.ts
var ACCENT_PALETTE = [
  "#0f172a",
  "#1e3a8a",
  "#1e40af",
  "#155e75",
  "#0f766e",
  "#15803d",
  "#a16207",
  "#b45309",
  "#9d174d",
  "#7e22ce",
  "#312e81",
  "#374151",
  "#0e7490",
  "#166534",
  "#92400e",
  "#9f1239",
  "#5b21b6",
  "#1e293b",
  "#075985",
  "#3f6212"
];
var HOT_COLOR = "#dc2626";
var COLD_COLOR = "#2563eb";
var BAND_FILL = "#ecfdf5";
var BAND_LINE = "#10b981";
var AXIS_LINE = "#cbd5e1";
var GRID_LINE = "#eef2f7";
var LABEL_COLOR = "#475569";
var TITLE_COLOR = "#0f172a";
function fmtTime(ms) {
  const d = new Date(ms);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function pad(n) {
  return n.toString().padStart(2, "0");
}
function niceStep(range, targetTicks = 6) {
  if (range <= 0) return 1;
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * pow;
}
function tempRange(series, rangeMin, rangeMax) {
  let lo = rangeMin;
  let hi = rangeMax;
  for (const s of series) {
    for (const v of s.temp) {
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const pad3 = Math.max(0.5, (hi - lo) * 0.08);
  return { lo: lo - pad3, hi: hi + pad3 };
}
function ensureSpace(doc, h) {
  if (doc.y + h > doc.page.height - 72) {
    doc.addPage();
  }
}
function drawLineChart(doc, opts) {
  const {
    title,
    series,
    rangeMin,
    rangeMax,
    height = 260,
    showLegend = true,
    eventMarkers = []
  } = opts;
  const marginLeft = 56;
  const marginRight = 56;
  const x0 = marginLeft;
  const pageWidth = doc.page.width - marginLeft - marginRight;
  ensureSpace(doc, height + 20);
  const startY = doc.y;
  doc.font("bold").fontSize(11).fillColor(TITLE_COLOR).text(title, x0, startY, {
    width: pageWidth,
    align: "left"
  });
  const plotTopPad = eventMarkers.length > 0 ? 64 : 18;
  const plotTop = startY + plotTopPad;
  const plotLeftPad = 42;
  const plotBottomPad = showLegend ? 34 : 18;
  const plotRightPad = 14;
  const plotWidth = pageWidth - plotLeftPad - plotRightPad;
  const plotHeight = height - plotTopPad - plotBottomPad;
  const plotLeft = x0 + plotLeftPad;
  const plotRight = plotLeft + plotWidth;
  const plotBottom = plotTop + plotHeight;
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const s of series) {
    for (const t2 of s.ts) {
      if (t2 < tMin) tMin = t2;
      if (t2 > tMax) tMax = t2;
    }
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin === tMax) {
    tMin = Date.now() - 36e5;
    tMax = Date.now();
  }
  const { lo, hi } = tempRange(series, rangeMin, rangeMax);
  const xFor = (t2) => plotLeft + (t2 - tMin) / (tMax - tMin || 1) * plotWidth;
  const yFor = (v) => plotBottom - (v - lo) / (hi - lo || 1) * plotHeight;
  const bandTop = yFor(rangeMax);
  const bandBottom = yFor(rangeMin);
  const bandY = Math.min(bandTop, bandBottom);
  const bandH = Math.abs(bandBottom - bandTop);
  doc.save();
  doc.rect(plotLeft, bandY, plotWidth, bandH).fill(BAND_FILL);
  doc.restore();
  const yStep = niceStep(hi - lo, 5);
  const yStart = Math.ceil(lo / yStep) * yStep;
  doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
  for (let v = yStart; v <= hi; v += yStep) {
    const y = yFor(v);
    doc.save();
    doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(plotLeft, y).lineTo(plotRight, y).stroke();
    doc.restore();
    doc.fillColor(LABEL_COLOR).text(
      v.toFixed(Math.abs(yStep) < 1 ? 1 : 0) + " \xB0C",
      x0,
      y - 4,
      { width: plotLeftPad - 6, align: "right" }
    );
  }
  const xTicks = 6;
  for (let i = 0; i <= xTicks; i++) {
    const t2 = tMin + (tMax - tMin) * i / xTicks;
    const x = xFor(t2);
    doc.save();
    doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(x, plotTop).lineTo(x, plotBottom).stroke();
    doc.restore();
    const label = fmtTime(t2);
    doc.fillColor(LABEL_COLOR).fontSize(7).text(label, x - 26, plotBottom + 4, {
      width: 52,
      align: "center"
    });
  }
  doc.save();
  doc.lineWidth(0.7).strokeColor(AXIS_LINE).rect(plotLeft, plotTop, plotWidth, plotHeight).stroke();
  doc.restore();
  doc.save();
  doc.lineWidth(0.7).dash(3, { space: 3 }).strokeColor(BAND_LINE).moveTo(plotLeft, yFor(rangeMax)).lineTo(plotRight, yFor(rangeMax)).stroke().moveTo(plotLeft, yFor(rangeMin)).lineTo(plotRight, yFor(rangeMin)).stroke();
  doc.undash();
  doc.restore();
  series.forEach((s, i) => {
    const color = s.color || ACCENT_PALETTE[i % ACCENT_PALETTE.length];
    if (s.ts.length < 2) return;
    const maxPts = 700;
    const step = Math.max(1, Math.ceil(s.ts.length / maxPts));
    doc.save();
    doc.lineWidth(0.9).strokeColor(color);
    let started = false;
    for (let k = 0; k < s.ts.length; k += step) {
      const x = xFor(s.ts[k]);
      const y = yFor(s.temp[k]);
      if (!Number.isFinite(y)) continue;
      if (!started) {
        doc.moveTo(x, y);
        started = true;
      } else {
        doc.lineTo(x, y);
      }
    }
    const last = s.ts.length - 1;
    if (last > 0 && last % step !== 0) {
      const x = xFor(s.ts[last]);
      const y = yFor(s.temp[last]);
      if (Number.isFinite(y)) doc.lineTo(x, y);
    }
    if (started) doc.stroke();
    doc.restore();
  });
  if (eventMarkers.length > 0) {
    const placedLabels = [];
    for (const m of eventMarkers) {
      if (m.ts < tMin || m.ts > tMax) continue;
      const x = xFor(m.ts);
      doc.save();
      doc.lineWidth(1.2).dash(4, { space: 3 }).strokeColor(m.color);
      doc.moveTo(x, plotTop).lineTo(x, plotBottom).stroke();
      doc.undash();
      doc.restore();
      doc.font("body").fontSize(7);
      const lw = doc.widthOfString(m.label) + 8;
      const lh = 12;
      const lx = Math.min(Math.max(x - lw / 2, plotLeft), plotRight - lw);
      let level = 0;
      while (placedLabels.some((p) => p.level === level && lx < p.lx + p.lw && lx + lw > p.lx)) {
        level++;
      }
      placedLabels.push({ lx, lw, level });
      const ly = plotTop - 15 - level * (lh + 2);
      doc.save();
      doc.fillColor("white").roundedRect(lx - 1, ly - 1, lw + 2, lh + 2, 2).fill();
      doc.lineWidth(0.5).strokeColor(m.color).roundedRect(lx - 1, ly - 1, lw + 2, lh + 2, 2).stroke();
      doc.fillColor(m.color).text(m.label, lx + 2, ly + 1, { width: lw, lineBreak: false });
      doc.restore();
    }
  }
  if (showLegend) {
    let legendY = plotBottom + 18;
    let lx = plotLeft;
    doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
    const entries = [
      ...series.map((s, i) => ({
        name: s.name,
        color: s.color || ACCENT_PALETTE[i % ACCENT_PALETTE.length]
      })),
      { name: `\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D ${rangeMin}\u2026${rangeMax} \xB0C`, color: BAND_LINE }
    ];
    let legendRowCount = 1;
    for (const e of entries) {
      const textWidth = doc.widthOfString(e.name);
      const entryWidth = 10 + 4 + textWidth + 12;
      if (lx + entryWidth > plotRight && lx > plotLeft) {
        legendY += 14;
        lx = plotLeft;
        legendRowCount++;
      }
      doc.save();
      doc.rect(lx, legendY + 1, 10, 6).fill(e.color);
      doc.restore();
      doc.fillColor(LABEL_COLOR).text(e.name, lx + 14, legendY - 1, {
        width: textWidth + 2,
        lineBreak: false
      });
      lx += entryWidth;
    }
    doc.y = plotBottom + 18 + legendRowCount * 14;
  } else {
    doc.y = startY + height + 8;
  }
  doc.fillColor("#000000");
}
function drawHorizontalBarChart(doc, opts) {
  const { title, rows, valueUnit, height = 260 } = opts;
  const marginLeft = 56;
  const marginRight = 56;
  const x0 = marginLeft;
  const pageWidth = doc.page.width - marginLeft - marginRight;
  ensureSpace(doc, height + 20);
  const startY = doc.y;
  doc.font("bold").fontSize(11).fillColor(TITLE_COLOR).text(title, x0, startY, {
    width: pageWidth,
    align: "left"
  });
  const plotTop = startY + 18;
  const labelWidth = 110;
  const plotLeftPad = labelWidth + 6;
  const plotRightPad = 40;
  const plotWidth = pageWidth - plotLeftPad - plotRightPad;
  const plotHeight = height - 18 - 18;
  const plotLeft = x0 + plotLeftPad;
  const plotBottom = plotTop + plotHeight;
  const vals = rows.map((r) => r.value).filter((v) => Number.isFinite(v));
  const vMin = Math.min(...vals, 0);
  const vMax = Math.max(...vals, 1);
  const span = vMax - vMin || 1;
  const rowH = Math.min(24, plotHeight / Math.max(1, rows.length));
  const gap = 4;
  rows.forEach((r, i) => {
    const y = plotTop + i * (rowH + gap);
    doc.font("body").fontSize(9).fillColor(LABEL_COLOR).text(r.name, x0, y + (rowH - 10) / 2, {
      width: labelWidth,
      align: "right",
      lineBreak: false
    });
    doc.save();
    doc.rect(plotLeft, y, plotWidth, rowH).fill("#f1f5f9");
    doc.restore();
    const w = Math.max(2, (r.value - vMin) / span * plotWidth);
    doc.save();
    doc.rect(plotLeft, y, w, rowH).fill(r.color);
    doc.restore();
    doc.font("bold").fontSize(9).fillColor(TITLE_COLOR).text(
      `${r.value.toFixed(2)} ${valueUnit}`,
      plotLeft + w + 4,
      y + (rowH - 10) / 2,
      { lineBreak: false }
    );
  });
  doc.save();
  doc.lineWidth(0.5).strokeColor(AXIS_LINE).moveTo(plotLeft, plotBottom).lineTo(plotLeft + plotWidth, plotBottom).stroke();
  doc.restore();
  doc.y = startY + height + 8;
  doc.fillColor("#000000");
}
function drawGroupedBarChart(doc, opts) {
  const { title, labels, groups, valueUnit, height = 280 } = opts;
  const marginLeft = 56;
  const marginRight = 56;
  const x0 = marginLeft;
  const pageWidth = doc.page.width - marginLeft - marginRight;
  ensureSpace(doc, height + 20);
  const startY = doc.y;
  doc.font("bold").fontSize(11).fillColor(TITLE_COLOR).text(title, x0, startY, {
    width: pageWidth,
    align: "left"
  });
  const plotTop = startY + 18;
  const plotLeftPad = 40;
  const plotRightPad = 14;
  const plotBottomPad = 42;
  const plotWidth = pageWidth - plotLeftPad - plotRightPad;
  const plotHeight = height - 18 - plotBottomPad;
  const plotLeft = x0 + plotLeftPad;
  const plotRight = plotLeft + plotWidth;
  const plotBottom = plotTop + plotHeight;
  const allValues = [];
  groups.forEach((g) => g.data.forEach((v) => {
    if (Number.isFinite(v)) allValues.push(v);
  }));
  const vMin = Math.min(...allValues, 0);
  const vMax = Math.max(...allValues, 1);
  const pad3 = (vMax - vMin) * 0.1 || 0.5;
  const lo = vMin - pad3;
  const hi = vMax + pad3;
  const yFor = (v) => plotBottom - (v - lo) / (hi - lo || 1) * plotHeight;
  const yStep = niceStep(hi - lo, 5);
  const yStart = Math.ceil(lo / yStep) * yStep;
  doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
  for (let v = yStart; v <= hi; v += yStep) {
    const y = yFor(v);
    doc.save();
    doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(plotLeft, y).lineTo(plotRight, y).stroke();
    doc.restore();
    doc.fillColor(LABEL_COLOR).text(
      v.toFixed(Math.abs(yStep) < 1 ? 1 : 0),
      x0,
      y - 4,
      { width: plotLeftPad - 4, align: "right" }
    );
  }
  doc.save();
  doc.lineWidth(0.7).strokeColor(AXIS_LINE).rect(plotLeft, plotTop, plotWidth, plotHeight).stroke();
  doc.restore();
  const categoryCount = labels.length || 1;
  const groupCount = groups.length;
  const groupPad = 8;
  const groupSlot = (plotWidth - groupPad * (categoryCount + 1)) / categoryCount;
  const barWidth = Math.max(2, groupSlot / Math.max(groupCount, 1) - 1);
  labels.forEach((lbl, ci) => {
    const groupLeft = plotLeft + groupPad + ci * (groupSlot + groupPad);
    groups.forEach((g, gi) => {
      const val = g.data[ci];
      if (!Number.isFinite(val)) return;
      const yTop = yFor(val);
      const yBase = yFor(Math.max(lo, 0));
      const barX = groupLeft + gi * (barWidth + 1);
      const top = Math.min(yTop, yBase);
      const h = Math.abs(yBase - yTop);
      doc.save();
      doc.rect(barX, top, barWidth, Math.max(1, h)).fill(g.color);
      doc.restore();
    });
    doc.font("body").fontSize(8).fillColor(LABEL_COLOR).text(
      lbl,
      groupLeft - 4,
      plotBottom + 4,
      { width: groupSlot + 8, align: "center", lineBreak: false }
    );
  });
  const legendY = plotBottom + 22;
  let lx = plotLeft;
  doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
  for (const g of groups) {
    const label = `${g.label} (${valueUnit})`;
    const tw = doc.widthOfString(label);
    doc.save();
    doc.rect(lx, legendY + 1, 10, 6).fill(g.color);
    doc.restore();
    doc.fillColor(LABEL_COLOR).text(label, lx + 14, legendY - 1, { lineBreak: false });
    lx += 14 + tw + 14;
  }
  doc.y = startY + height + 8;
  doc.fillColor("#000000");
}
function drawOverviewChart(doc, series, rangeMin, rangeMax) {
  drawLineChart(doc, {
    title: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432",
    series,
    rangeMin,
    rangeMax,
    height: 220
  });
}
function drawExternalChart(doc, s, rangeMin, rangeMax) {
  drawLineChart(doc, {
    title: `\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \xAB${s.name}\xBB`,
    series: [{ ...s, color: "#475569" }],
    rangeMin,
    rangeMax,
    height: 190
  });
}
function drawHotChart(doc, s, rangeMin, rangeMax) {
  drawLineChart(doc, {
    title: `\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \xAB\u0433\u043E\u0440\u044F\u0447\u0438\u0439\xBB \u0434\u0430\u0442\u0447\u0438\u043A \u2014 ${s.name}`,
    series: [{ ...s, color: HOT_COLOR }],
    rangeMin,
    rangeMax,
    height: 190
  });
}
function drawColdChart(doc, s, rangeMin, rangeMax) {
  drawLineChart(doc, {
    title: `\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \xAB\u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0439\xBB \u0434\u0430\u0442\u0447\u0438\u043A \u2014 ${s.name}`,
    series: [{ ...s, color: COLD_COLOR }],
    rangeMin,
    rangeMax,
    height: 190
  });
}
function drawStatsBarChart(doc, rows) {
  drawGroupedBarChart(doc, {
    title: "Min / Avg / Max / MKT \u043F\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430\u043C",
    labels: rows.map((r) => r.name),
    groups: [
      { label: "Min", color: "#3b82f6", data: rows.map((r) => r.min) },
      { label: "Avg", color: "#10b981", data: rows.map((r) => r.avg) },
      { label: "Max", color: "#ef4444", data: rows.map((r) => r.max) },
      { label: "MKT", color: "#a855f7", data: rows.map((r) => r.mkt) }
    ],
    valueUnit: "\xB0C",
    height: 200
  });
}
function drawHeatmapChart(doc, rows, rangeMin, rangeMax) {
  const dataMin = Math.min(...rows.map((r) => r.avg));
  const dataMax = Math.max(...rows.map((r) => r.avg));
  const dataSpan = dataMax - dataMin;
  const margin = Math.max(0.5, dataSpan * 0.1);
  const effectiveMin = dataMin - margin;
  const effectiveMax = dataMax + margin;
  drawHorizontalBarChart(doc, {
    title: "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043A\u0430\u0440\u0442\u0430: \u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u043F\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430\u043C",
    rows: rows.map((r) => ({
      name: r.name,
      value: r.avg,
      color: colorForTemp(r.avg, effectiveMin, effectiveMax)
    })),
    valueUnit: "\xB0C",
    height: Math.max(120, 26 * rows.length + 50)
  });
}
function colorForTemp(t2, lo, hi) {
  const span = hi - lo;
  const norm = Math.max(0, Math.min(1, (t2 - lo) / (span || 1)));
  const stops = [
    { p: 0, c: [37, 99, 235] },
    { p: 0.5, c: [16, 185, 129] },
    { p: 1, c: [220, 38, 38] }
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (norm >= stops[i].p && norm <= stops[i + 1].p) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const range = upper.p - lower.p || 1;
  const k = (norm - lower.p) / range;
  const r = Math.round(lower.c[0] + (upper.c[0] - lower.c[0]) * k);
  const g = Math.round(lower.c[1] + (upper.c[1] - lower.c[1]) * k);
  const b = Math.round(lower.c[2] + (upper.c[2] - lower.c[2]) * k);
  const toHex = (v) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function drawExcursionChart(doc, series, rangeMin, rangeMax, eventMarkers) {
  drawLineChart(doc, {
    title: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u0432 \u0445\u043E\u0434\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435",
    series,
    rangeMin,
    rangeMax,
    height: 240,
    eventMarkers
  });
}
var SNAP_POS = {
  top: { x: 50, y: 20 },
  middle: { x: 50, y: 50 },
  bottom: { x: 50, y: 78 },
  door: { x: 88, y: 50 }
};
var BADGE_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be185d",
  "#65a30d"
];
function sensorBadgeColor(idx) {
  return BADGE_PALETTE[idx % BADGE_PALETTE.length];
}
function drawRefrigeratorDiagram(doc, sensors2, pageMargin, coolingUnitPos, doorPos) {
  const internals = sensors2.filter((s) => s.role === "internal");
  const externals = sensors2.filter((s) => s.role === "external");
  const diagH = 220;
  const cabW = 200;
  const cabH = diagH;
  const wallT = 10;
  const outerX = pageMargin;
  const outerY = doc.y;
  const outerW = cabW + wallT * 2;
  const outerH = cabH + wallT * 2;
  const cabX = outerX + wallT;
  const cabY = outerY + wallT;
  ensureSpace(doc, outerH + 20);
  const doorW = 36;
  const doorX = cabX + cabW - doorW;
  const shelf1Y = cabY + cabH * 0.33;
  const shelf2Y = cabY + cabH * 0.66;
  doc.save();
  doc.roundedRect(outerX, outerY, outerW, outerH, 6).fill("#e2e8f0");
  doc.roundedRect(outerX, outerY, outerW, outerH, 6).lineWidth(1.5).strokeColor("#64748b").stroke();
  doc.font("body").fontSize(6).fillColor("#94a3b8");
  doc.text("\u041A\u043E\u0440\u043F\u0443\u0441", outerX + 2, outerY + 2, { lineBreak: false });
  doc.restore();
  doc.save();
  doc.roundedRect(cabX, cabY, cabW, cabH, 4).fill("#f8fafc");
  doc.roundedRect(cabX, cabY, cabW, cabH, 4).lineWidth(1.2).strokeColor("#94a3b8").stroke();
  doc.rect(doorX, cabY, doorW, cabH).fill("#e2e8f0");
  doc.rect(doorX, cabY, doorW, cabH).lineWidth(0.8).strokeColor("#94a3b8").stroke();
  doc.roundedRect(doorX + doorW - 8, cabY + cabH * 0.35, 4, cabH * 0.3, 2).fill("#94a3b8");
  doc.lineWidth(1).strokeColor("#cbd5e1").dash(5, { space: 3 });
  doc.moveTo(cabX + 4, shelf1Y).lineTo(doorX - 4, shelf1Y).stroke();
  doc.moveTo(cabX + 4, shelf2Y).lineTo(doorX - 4, shelf2Y).stroke();
  doc.undash();
  doc.font("body").fontSize(7).fillColor("#94a3b8");
  doc.text("\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u043F\u043E\u043B\u043A\u0430", cabX + 5, shelf1Y - 10, { lineBreak: false });
  doc.text("\u041D\u0438\u0436\u043D\u044F\u044F \u043F\u043E\u043B\u043A\u0430", cabX + 5, shelf2Y - 10, { lineBreak: false });
  doc.fontSize(7).fillColor("#94a3b8");
  doc.text("\u0414\u0432\u0435\u0440\u044C", doorX + 2, cabY + cabH / 2 - 10, {
    width: doorW - 4,
    align: "center",
    lineBreak: true
  });
  doc.restore();
  const BADGE_W = 36;
  const BADGE_H = 20;
  internals.forEach((s, idx) => {
    const color = sensorBadgeColor(idx);
    const name = (s.customName || s.label).slice(0, 8);
    let pctX = 40;
    let pctY = 50;
    if (s.posX != null && s.posY != null) {
      pctX = Number(s.posX);
      pctY = Number(s.posY);
    } else if (s.position && SNAP_POS[s.position]) {
      pctX = SNAP_POS[s.position].x;
      pctY = SNAP_POS[s.position].y;
    } else {
      const total = internals.length;
      pctX = 40;
      pctY = total <= 1 ? 50 : 15 + idx / (total - 1) * 70;
    }
    const innerW = doorX - cabX - 8;
    const bx = cabX + pctX / 100 * innerW;
    const by = cabY + pctY / 100 * cabH;
    doc.save();
    doc.roundedRect(bx - BADGE_W / 2, by - BADGE_H / 2, BADGE_W, BADGE_H, 3).fill(color);
    doc.roundedRect(bx - BADGE_W / 2, by - BADGE_H / 2, BADGE_W, BADGE_H, 3).lineWidth(1.5).strokeColor("white").stroke();
    doc.font("bold").fontSize(8).fillColor("white");
    doc.text(name, bx - BADGE_W / 2, by - 5, {
      width: BADGE_W,
      align: "center",
      lineBreak: false
    });
    doc.restore();
  });
  const extStartX = cabX + cabW + 20;
  externals.forEach((s, idx) => {
    const color = sensorBadgeColor(internals.length + idx);
    const name = (s.customName || s.label).slice(0, 8);
    const ey = cabY + 30 + idx * 55;
    doc.save();
    doc.lineWidth(0.8).strokeColor(color).dash(3, { space: 2 });
    doc.moveTo(cabX + cabW + 2, ey).lineTo(extStartX + 8, ey).stroke();
    doc.undash();
    const badgeCx = extStartX + 8 + BADGE_W / 2;
    doc.roundedRect(badgeCx - BADGE_W / 2, ey - BADGE_H / 2, BADGE_W, BADGE_H, 3).fill(color);
    doc.roundedRect(badgeCx - BADGE_W / 2, ey - BADGE_H / 2, BADGE_W, BADGE_H, 3).lineWidth(1.5).strokeColor("white").stroke();
    doc.font("bold").fontSize(8).fillColor("white");
    doc.text(name, badgeCx - BADGE_W / 2, ey - 5, {
      width: BADGE_W,
      align: "center",
      lineBreak: false
    });
    doc.font("body").fontSize(6.5).fillColor("#64748b");
    doc.text("\u0412\u043D\u0435\u0448\u043D\u0438\u0439", badgeCx - BADGE_W / 2, ey + BADGE_H / 2 + 2, {
      width: BADGE_W,
      align: "center",
      lineBreak: false
    });
    doc.restore();
  });
  doc.y = outerY + outerH + 12;
  doc.fillColor("#000000");
}
var REEFER_SENSOR_POSITIONS = [
  // 8 corners
  { id: "C1", label: "\u041F\u0435\u0440\u0435\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043B\u0435\u0432\u044B\u0439 \u043D\u0438\u0436\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 0, y: 0, z: 0, group: "corner" },
  { id: "C2", label: "\u041F\u0435\u0440\u0435\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043F\u0440\u0430\u0432\u044B\u0439 \u043D\u0438\u0436\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 1, y: 0, z: 0, group: "corner" },
  { id: "C3", label: "\u0417\u0430\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043F\u0440\u0430\u0432\u044B\u0439 \u043D\u0438\u0436\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 1, y: 1, z: 0, group: "corner" },
  { id: "C4", label: "\u0417\u0430\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043B\u0435\u0432\u044B\u0439 \u043D\u0438\u0436\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 0, y: 1, z: 0, group: "corner" },
  { id: "C5", label: "\u041F\u0435\u0440\u0435\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043B\u0435\u0432\u044B\u0439 \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 0, y: 0, z: 1, group: "corner" },
  { id: "C6", label: "\u041F\u0435\u0440\u0435\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043F\u0440\u0430\u0432\u044B\u0439 \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 1, y: 0, z: 1, group: "corner" },
  { id: "C7", label: "\u0417\u0430\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043F\u0440\u0430\u0432\u044B\u0439 \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 1, y: 1, z: 1, group: "corner" },
  { id: "C8", label: "\u0417\u0430\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C, \u043B\u0435\u0432\u044B\u0439 \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0433\u043E\u043B", x: 0, y: 1, z: 1, group: "corner" },
  // 4 wall centres
  { id: "W1", label: "\u0426\u0435\u043D\u0442\u0440 \u043F\u0435\u0440\u0435\u0434\u043D\u0435\u0439 \u0441\u0442\u0435\u043D\u043A\u0438", x: 0.5, y: 0, z: 0.5, group: "wall" },
  { id: "W2", label: "\u0426\u0435\u043D\u0442\u0440 \u0437\u0430\u0434\u043D\u0435\u0439 \u0441\u0442\u0435\u043D\u043A\u0438", x: 0.5, y: 1, z: 0.5, group: "wall" },
  { id: "W3", label: "\u0426\u0435\u043D\u0442\u0440 \u043B\u0435\u0432\u043E\u0439 \u0441\u0442\u0435\u043D\u043A\u0438", x: 0, y: 0.5, z: 0.5, group: "wall" },
  { id: "W4", label: "\u0426\u0435\u043D\u0442\u0440 \u043F\u0440\u0430\u0432\u043E\u0439 \u0441\u0442\u0435\u043D\u043A\u0438", x: 1, y: 0.5, z: 0.5, group: "wall" },
  // 3 volume centres
  { id: "V1", label: "\u0426\u0435\u043D\u0442\u0440 \u043E\u0431\u044A\u0451\u043C\u0430, \u043D\u0438\u0436\u043D\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C", x: 0.5, y: 0.5, z: 0, group: "center" },
  { id: "V2", label: "\u0426\u0435\u043D\u0442\u0440 \u043E\u0431\u044A\u0451\u043C\u0430, \u0441\u0440\u0435\u0434\u043D\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C", x: 0.5, y: 0.5, z: 0.5, group: "center" },
  { id: "V3", label: "\u0426\u0435\u043D\u0442\u0440 \u043E\u0431\u044A\u0451\u043C\u0430, \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C", x: 0.5, y: 0.5, z: 1, group: "center" }
];
var REEFER_GROUP_COLORS = {
  corner: "#2563eb",
  wall: "#16a34a",
  center: "#dc2626"
};
function drawStar(doc, cx, cy, size, color) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? size : size * 0.4;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  doc.polygon(...points).fill(color).stroke();
}
function drawDiamond(doc, cx, cy, size, color) {
  const points = [
    [cx, cy - size],
    // top
    [cx + size, cy],
    // right
    [cx, cy + size],
    // bottom
    [cx - size, cy]
    // left
  ];
  doc.polygon(...points).fill(color).stroke();
}
function drawReeferTruckDiagram3D(doc, sensors2, pageMargin, coolingUnitPos, doorPos, labelOnly = false, title, hotLabel, coldLabel) {
  const BW = 1.6;
  const BD = 3.2;
  const BH = 1.4;
  const scale = 78;
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  const diagSpanX = (BW + BD) * cos30 * scale;
  const pageWidth = doc.page.width;
  const ox = pageMargin + BD * cos30 * scale + 10 + 57;
  const oy = doc.y + 20 + BH * scale + (BD + BW) * scale * 0.5;
  function isoXY(wx, wy, wz) {
    return [
      ox + (wx - wy) * cos30 * scale,
      oy - (wx + wy) * sin30 * scale - wz * scale
    ];
  }
  const diagH = (BH + (BW + BD) * sin30) * scale + 60;
  ensureSpace(doc, diagH + 20 + (title ? 20 : 0) + 85);
  if (title) {
    doc.font("bold").fontSize(11).fillColor("#1f2937");
    doc.text(title, pageMargin, doc.y, { lineBreak: false });
    doc.moveDown(0.4);
  }
  doc.y = doc.y + 43;
  const oyFinal = doc.y + 20 + BH * scale + (BD + BW) * scale * 0.5;
  function pt(wx, wy, wz) {
    return [
      ox + (wx - wy) * cos30 * scale,
      oyFinal - (wx + wy) * sin30 * scale - wz * scale
    ];
  }
  const b0 = pt(0, 0, 0);
  const b1 = pt(BW, 0, 0);
  const b2 = pt(BW, BD, 0);
  const b3 = pt(0, BD, 0);
  const t0 = pt(0, 0, BH);
  const t1 = pt(BW, 0, BH);
  const t2 = pt(BW, BD, BH);
  const t3 = pt(0, BD, BH);
  function ptsStr(arr) {
    return arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  }
  doc.save();
  doc.polygon(b3, b2, t2, t3).fill("#c8d8e8").stroke();
  doc.polygon(b3, b2, t2, t3).lineWidth(0.8).strokeColor("#7a9ab5").stroke();
  doc.polygon(b0, b3, t3, t0).fill("#d8e8f4").stroke();
  doc.polygon(b0, b3, t3, t0).lineWidth(0.8).strokeColor("#7a9ab5").stroke();
  doc.polygon(b1, b2, t2, t1).fill("#dce8f0").stroke();
  doc.polygon(b1, b2, t2, t1).lineWidth(0.8).strokeColor("#7a9ab5").stroke();
  doc.polygon(t0, t1, t2, t3).fill("#eef4fa").stroke();
  doc.polygon(t0, t1, t2, t3).lineWidth(0.8).strokeColor("#7a9ab5").stroke();
  doc.polygon(b0, b1, t1, t0).fill("#dbeafe").stroke();
  doc.polygon(b0, b1, t1, t0).lineWidth(0.8).strokeColor("#7a9ab5").stroke();
  const dm0 = pt(BW / 2, 0, 0);
  const dm1 = pt(BW / 2, 0, BH);
  doc.moveTo(dm0[0], dm0[1]).lineTo(dm1[0], dm1[1]).lineWidth(0.6).strokeColor("#93c5fd").dash(3, { space: 2 }).stroke();
  doc.undash();
  const dh0 = pt(BW * 0.54, 0.02, BH * 0.42);
  const dh1 = pt(BW * 0.54, 0.02, BH * 0.58);
  doc.moveTo(dh0[0], dh0[1]).lineTo(dh1[0], dh1[1]).lineWidth(2).strokeColor("#64748b").stroke();
  doc.lineWidth(1.2).strokeColor("#4a6a85");
  doc.moveTo(b0[0], b0[1]).lineTo(b1[0], b1[1]).stroke();
  doc.moveTo(b1[0], b1[1]).lineTo(b2[0], b2[1]).stroke();
  doc.moveTo(b2[0], b2[1]).lineTo(b3[0], b3[1]).stroke();
  doc.moveTo(b3[0], b3[1]).lineTo(b0[0], b0[1]).stroke();
  doc.moveTo(t0[0], t0[1]).lineTo(t1[0], t1[1]).stroke();
  doc.moveTo(t1[0], t1[1]).lineTo(t2[0], t2[1]).stroke();
  doc.moveTo(t2[0], t2[1]).lineTo(t3[0], t3[1]).stroke();
  doc.moveTo(t3[0], t3[1]).lineTo(t0[0], t0[1]).stroke();
  [[b0, t0], [b1, t1], [b2, t2], [b3, t3]].forEach(([a, b]) => {
    doc.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke();
  });
  const ruH = 0.2, ruD = 0.16;
  const ru_bl = pt(BW * 0.15, 0, BH);
  const ru_br = pt(BW * 0.85, 0, BH);
  const ru_tr = pt(BW * 0.85, 0, BH + ruH);
  const ru_tl = pt(BW * 0.15, 0, BH + ruH);
  const ru_blb = pt(BW * 0.15, ruD, BH);
  const ru_brb = pt(BW * 0.85, ruD, BH);
  const ru_trb = pt(BW * 0.85, ruD, BH + ruH);
  const ru_tlb = pt(BW * 0.15, ruD, BH + ruH);
  doc.polygon(ru_bl, ru_br, ru_tr, ru_tl).fill("#bfdbfe").stroke();
  doc.polygon(ru_bl, ru_br, ru_tr, ru_tl).lineWidth(0.6).strokeColor("#93c5fd").stroke();
  doc.polygon(ru_tl, ru_tr, ru_trb, ru_tlb).fill("#dbeafe").stroke();
  doc.polygon(ru_tl, ru_tr, ru_trb, ru_tlb).lineWidth(0.6).strokeColor("#93c5fd").stroke();
  doc.polygon(ru_blb, ru_brb, ru_trb, ru_tlb).fill("#eff6ff").stroke();
  doc.polygon(ru_blb, ru_brb, ru_trb, ru_tlb).lineWidth(0.6).strokeColor("#93c5fd").stroke();
  doc.restore();
  const SVG_ORIGIN_X = 330;
  const SVG_ORIGIN_Y = 380;
  const SVG_SCALE = 93.6;
  const pdfScale = scale;
  const scaleRatio = pdfScale / SVG_SCALE;
  function svgToPdf(svgX, svgY) {
    return [
      ox + (svgX - SVG_ORIGIN_X) * scaleRatio,
      oyFinal + (svgY - SVG_ORIGIN_Y) * scaleRatio
    ];
  }
  if (!labelOnly && coolingUnitPos) {
    const [cx, cy] = svgToPdf(coolingUnitPos.x, coolingUnitPos.y);
    doc.save();
    doc.ellipse(cx, cy + 14, 18, 4).fill("rgba(0,0,0,0.10)");
    doc.roundedRect(cx - 18, cy - 12, 36, 24, 4).fill("#1e40af").stroke();
    doc.roundedRect(cx - 18, cy - 12, 36, 24, 4).lineWidth(1).strokeColor("#1d4ed8").stroke();
    [-8, -3, 2, 7].forEach((lx) => {
      doc.moveTo(cx + lx, cy - 8).lineTo(cx + lx, cy + 8).lineWidth(1).strokeColor("#3b82f6").stroke();
    });
    doc.circle(cx + 12, cy, 7).fill("none").lineWidth(1).strokeColor("#93c5fd").stroke();
    doc.circle(cx + 12, cy, 2).fill("#93c5fd");
    doc.font("bold").fontSize(7).fillColor("#1e40af");
    doc.text("\u0410\u0433\u0440\u0435\u0433\u0430\u0442", cx - 20, cy + 14, { width: 40, align: "center", lineBreak: false });
    doc.restore();
  }
  if (!labelOnly && doorPos) {
    const [dx, dy] = svgToPdf(doorPos.x, doorPos.y);
    doc.save();
    doc.ellipse(dx, dy + 22, 14, 4).fill("rgba(0,0,0,0.10)");
    doc.roundedRect(dx - 12, dy - 22, 24, 44, 3).fill("#dbeafe").stroke();
    doc.roundedRect(dx - 12, dy - 22, 24, 44, 3).lineWidth(1.2).strokeColor("#3b82f6").stroke();
    doc.roundedRect(dx - 8, dy - 18, 16, 36, 2).fill("none").lineWidth(0.7).strokeColor("#93c5fd").stroke();
    doc.roundedRect(dx + 4, dy - 5, 3, 10, 1.5).fill("#3b82f6");
    doc.font("bold").fontSize(7).fillColor("#1d4ed8");
    doc.text("\u0414\u0432\u0435\u0440\u044C", dx - 14, dy + 24, { width: 28, align: "center", lineBreak: false });
    doc.restore();
  }
  const posMap = {};
  sensors2.forEach((s) => {
    if (s.position) posMap[s.position] = s;
  });
  const BX = 13;
  const BY = 8;
  const BRAD = 3;
  REEFER_SENSOR_POSITIONS.forEach((sp, idx) => {
    const wx = sp.x * BW;
    const wy = sp.y * BD;
    const wz = sp.z * BH;
    const [sx, sy] = pt(wx, wy, wz);
    const assigned = labelOnly ? void 0 : posMap[sp.id];
    const color = REEFER_GROUP_COLORS[sp.group];
    const isCriticalHot = hotLabel && assigned && assigned.label === hotLabel;
    const isCriticalCold = coldLabel && assigned && assigned.label === coldLabel;
    const isCritical = isCriticalHot || isCriticalCold;
    const label = assigned ? shortLabelStr(assigned.label) : sp.id;
    doc.save();
    if (isCritical) {
      const symbolColor = isCriticalHot ? "#ef4444" : "#3b82f6";
      const symbolSize = 10;
      if (isCriticalHot) {
        drawStar(doc, sx, sy - BY - 10, symbolSize, symbolColor);
      } else {
        drawDiamond(doc, sx, sy - BY - 10, symbolSize, symbolColor);
      }
    }
    doc.roundedRect(sx - BX - 2, sy - BY - 2, (BX + 2) * 2, (BY + 2) * 2, BRAD + 1).fill("white").stroke();
    const borderWidth = isCritical ? 2 : 1.2;
    doc.roundedRect(sx - BX - 2, sy - BY - 2, (BX + 2) * 2, (BY + 2) * 2, BRAD + 1).lineWidth(borderWidth).strokeColor(color).stroke();
    doc.roundedRect(sx - BX, sy - BY, BX * 2, BY * 2, BRAD).fill(color);
    doc.font("bold").fontSize(8).fillColor("white");
    doc.text(label, sx - BX, sy - BY + 1, { width: BX * 2, align: "center", lineBreak: false });
    doc.restore();
  });
  const externals = !labelOnly ? sensors2.filter((s) => s.role === "external") : [];
  if (externals.length > 0) {
    const [anchorX, anchorY] = pt(0, BD, BH * 0.5);
    const EXT_OFFSET_X = -28;
    const EXT_BADGE_W = 26;
    const EXT_BADGE_H = 9;
    const EXT_BRAD = 3;
    const EXT_SPACING = EXT_BADGE_H * 2 + 8;
    const totalExtH = externals.length * EXT_BADGE_H * 2 + (externals.length - 1) * 8;
    const extStartY = anchorY - totalExtH / 2;
    externals.forEach((s, idx) => {
      const bx = anchorX + EXT_OFFSET_X;
      const by = extStartY + idx * EXT_SPACING + EXT_BADGE_H;
      const color = "#475569";
      const label = shortLabelStr(s.label);
      doc.save();
      doc.moveTo(anchorX - 2, anchorY).lineTo(bx + EXT_BADGE_W + 4, by).lineWidth(0.8).strokeColor(color).dash(3, { space: 2 }).stroke();
      doc.undash();
      doc.roundedRect(bx - EXT_BADGE_W - 2, by - EXT_BADGE_H - 2, (EXT_BADGE_W + 2) * 2, (EXT_BADGE_H + 2) * 2, EXT_BRAD + 1).fill("white").stroke();
      doc.roundedRect(bx - EXT_BADGE_W - 2, by - EXT_BADGE_H - 2, (EXT_BADGE_W + 2) * 2, (EXT_BADGE_H + 2) * 2, EXT_BRAD + 1).lineWidth(1.2).strokeColor(color).stroke();
      doc.roundedRect(bx - EXT_BADGE_W, by - EXT_BADGE_H, EXT_BADGE_W * 2, EXT_BADGE_H * 2, EXT_BRAD).fill(color);
      doc.font("bold").fontSize(7).fillColor("white");
      doc.text(label, bx - EXT_BADGE_W, by - EXT_BADGE_H + 2, { width: EXT_BADGE_W * 2, align: "center", lineBreak: false });
      doc.font("body").fontSize(6).fillColor("#64748b");
      doc.text("\u0412\u041D", bx - EXT_BADGE_W, by + EXT_BADGE_H + 2, { width: EXT_BADGE_W * 2, align: "center", lineBreak: false });
      doc.restore();
    });
  }
  const legendY = oyFinal + (BW + BD) * sin30 * scale * 0.5 - 34;
  const legendItems = [
    { color: REEFER_GROUP_COLORS.corner, label: "\u0423\u0433\u043E\u043B (8 \u0448\u0442.)" },
    { color: REEFER_GROUP_COLORS.wall, label: "\u0426\u0435\u043D\u0442\u0440 \u0441\u0442\u0435\u043D\u043A\u0438 (4 \u0448\u0442.)" },
    { color: REEFER_GROUP_COLORS.center, label: "\u0426\u0435\u043D\u0442\u0440 \u043E\u0431\u044A\u0451\u043C\u0430 (3 \u0448\u0442.)" }
  ];
  legendItems.forEach((item, i) => {
    const lx = pageMargin + i * 145;
    const ly = legendY + 6;
    doc.save();
    doc.circle(lx + 5, ly, 5).fill(item.color);
    doc.font("body").fontSize(8).fillColor("#374151");
    doc.text(item.label, lx + 14, ly - 4, { lineBreak: false });
    doc.restore();
  });
  doc.save();
  const symbolLegendY = legendY + 18;
  drawDiamond(doc, pageMargin + 5, symbolLegendY, 4, "#3b82f6");
  doc.font("body").fontSize(8).fillColor("#374151");
  doc.text("\u0425\u043E\u043B\u043E\u0434\u043D\u0430\u044F \u0442\u043E\u0447\u043A\u0430", pageMargin + 14, symbolLegendY - 4, { lineBreak: false });
  drawStar(doc, pageMargin + 145 + 5, symbolLegendY, 4, "#ef4444");
  doc.text("\u0413\u043E\u0440\u044F\u0447\u0430\u044F \u0442\u043E\u0447\u043A\u0430", pageMargin + 145 + 14, symbolLegendY - 4, { lineBreak: false });
  doc.restore();
  doc.font("body").fontSize(7).fillColor("#94a3b8");
  doc.text("ISPE Good Practice Guide: Cold Chain Management", pageMargin, legendY + 32, {
    align: "right",
    width: doc.page.width - pageMargin * 2,
    lineBreak: false
  });
  if (!labelOnly) {
    const tableY = legendY + 46;
    doc.y = tableY;
    ensureSpace(doc, 150);
    const actualTableY = doc.y;
    const totalW = doc.page.width - pageMargin * 2;
    const posColW = totalW * 0.08;
    const descColW = totalW * 0.38;
    const serialColW = totalW * 0.35;
    const roleColW = totalW * 0.19;
    const rowH = 16;
    doc.rect(pageMargin, actualTableY, posColW, rowH).fill("#f3f4f6");
    doc.rect(pageMargin + posColW, actualTableY, descColW, rowH).fill("#f3f4f6");
    doc.rect(pageMargin + posColW + descColW, actualTableY, serialColW, rowH).fill("#f3f4f6");
    doc.rect(pageMargin + posColW + descColW + serialColW, actualTableY, roleColW, rowH).fill("#f3f4f6");
    doc.font("bold").fontSize(9).fillColor("#1f2937");
    doc.text("\u041F\u043E\u0437.", pageMargin + 4, actualTableY + 3, { width: posColW - 8, align: "left" });
    doc.text("\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", pageMargin + posColW + 4, actualTableY + 3, { width: descColW - 8, align: "left" });
    doc.text("\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440", pageMargin + posColW + descColW + 4, actualTableY + 3, { width: serialColW - 8, align: "left" });
    doc.text("\u0420\u043E\u043B\u044C", pageMargin + posColW + descColW + serialColW + 4, actualTableY + 3, { width: roleColW - 8, align: "left" });
    doc.font("body").fontSize(8).fillColor("#374151");
    let rowY = actualTableY + rowH;
    let rowIdx = 0;
    REEFER_SENSOR_POSITIONS.forEach((sp) => {
      const assigned = posMap[sp.id];
      if (assigned) {
        if (rowIdx % 2 === 1) {
          doc.rect(pageMargin, rowY, posColW, rowH).fill("#f9fafb");
          doc.rect(pageMargin + posColW, rowY, descColW, rowH).fill("#f9fafb");
          doc.rect(pageMargin + posColW + descColW, rowY, serialColW, rowH).fill("#f9fafb");
          doc.rect(pageMargin + posColW + descColW + serialColW, rowY, roleColW, rowH).fill("#f9fafb");
        }
        doc.lineWidth(0.5).strokeColor("#e5e7eb");
        doc.rect(pageMargin, rowY, posColW, rowH).stroke();
        doc.rect(pageMargin + posColW, rowY, descColW, rowH).stroke();
        doc.rect(pageMargin + posColW + descColW, rowY, serialColW, rowH).stroke();
        doc.rect(pageMargin + posColW + descColW + serialColW, rowY, roleColW, rowH).stroke();
        doc.fillColor("#374151");
        doc.text(sp.id, pageMargin + 4, rowY + 4, { width: posColW - 8, align: "left", lineBreak: false });
        doc.text(sp.label, pageMargin + posColW + 4, rowY + 4, { width: descColW - 8, align: "left", lineBreak: false });
        doc.text(assigned.label, pageMargin + posColW + descColW + 4, rowY + 4, { width: serialColW - 8, align: "left", lineBreak: false });
        doc.text(assigned.role === "internal" ? "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439" : "\u0412\u043D\u0435\u0448\u043D\u0438\u0439", pageMargin + posColW + descColW + serialColW + 4, rowY + 4, { width: roleColW - 8, align: "left", lineBreak: false });
        rowY += rowH;
        rowIdx++;
      }
    });
    doc.y = rowY + 10;
  } else {
    doc.y = legendY + 44;
  }
  doc.fillColor("#000000");
}
function shortLabelStr(label) {
  return label.length > 4 ? label.slice(-4) : label;
}

// server/operationalMetrics.ts
function calculateWarmupTime(logger, targetMin, targetMax) {
  if (!logger.series || logger.series.ts.length === 0) return null;
  const startTime = logger.series.ts[0];
  const twoHoursLater = startTime + 2 * 60 * 60 * 1e3;
  let firstInRangeIdx = -1;
  let consecutiveInRange = 0;
  const requiredConsecutive = 5;
  for (let i = 0; i < logger.series.ts.length; i++) {
    const t2 = logger.series.ts[i];
    if (t2 > twoHoursLater) break;
    const temp = logger.series.temp[i];
    if (temp >= targetMin && temp <= targetMax) {
      if (firstInRangeIdx === -1) firstInRangeIdx = i;
      consecutiveInRange++;
      if (consecutiveInRange >= requiredConsecutive) {
        const warmupMs = logger.series.ts[firstInRangeIdx] - startTime;
        return Math.round(warmupMs / (60 * 1e3));
      }
    } else {
      consecutiveInRange = 0;
      firstInRangeIdx = -1;
    }
  }
  return null;
}
function calculateDoorOpeningTime(logger, targetMax, tolerance = 3) {
  if (!logger.series || logger.series.ts.length < 10) return null;
  const stableData = logger.series.temp.slice(-50);
  if (stableData.length < 10) return null;
  const avgTemp = stableData.reduce((a, b) => a + b, 0) / stableData.length;
  const variance = stableData.reduce((sum, v) => sum + Math.abs(v - avgTemp), 0) / stableData.length;
  const heatLossRatePerMinute = 0.7;
  const allowedRise = tolerance;
  const maxDoorOpenMinutes = Math.round(allowedRise / heatLossRatePerMinute);
  return Math.max(5, Math.min(maxDoorOpenMinutes, 30));
}
function calculateThermalRetentionTime(logger, targetMin, targetMax) {
  if (!logger.series || logger.series.ts.length < 20) return null;
  const stableStartIdx = Math.floor(logger.series.ts.length * 0.7);
  const stableTemps = logger.series.temp.slice(stableStartIdx);
  if (stableTemps.length < 10) return null;
  const avgStableTemp = stableTemps.reduce((a, b) => a + b, 0) / stableTemps.length;
  const coolingRatePerMinute = 0.8;
  const tolerance = 3;
  const maxAllowedTemp = targetMax + tolerance;
  const tempRiseAllowed = maxAllowedTemp - avgStableTemp;
  const retentionMinutes = Math.round(tempRiseAllowed / coolingRatePerMinute);
  return Math.max(15, Math.min(retentionMinutes, 480));
}
function getSensorLocationDescription(sensorId, sensorPositions) {
  if (sensorId === null) return "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0430";
  const sensorIdStr = String(sensorId);
  if (sensorPositions && sensorPositions[sensorIdStr]) {
    return sensorPositions[sensorIdStr];
  }
  const idNum = typeof sensorId === "number" ? sensorId : parseInt(sensorIdStr, 10);
  if (isNaN(idNum)) return `\u0414\u0430\u0442\u0447\u0438\u043A ${sensorIdStr}`;
  const positions = {
    2021: "\u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u0446\u0435\u043D\u0442\u0440 (\u043F\u043E\u0442\u043E\u043B\u043E\u043A)",
    3706: "\u0446\u0435\u043D\u0442\u0440 \u043A\u0443\u0437\u043E\u0432\u0430",
    3709: "\u0432\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A",
    3712: "\u043F\u0440\u0430\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u0432\u0435\u0440\u0445)",
    3733: "\u043F\u0440\u0430\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0430)",
    3737: "\u0446\u0435\u043D\u0442\u0440 \u043A\u0443\u0437\u043E\u0432\u0430 (\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0430)",
    3741: "\u043B\u0435\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u0432\u0435\u0440\u0445)",
    3744: "\u0446\u0435\u043D\u0442\u0440 \u043A\u0443\u0437\u043E\u0432\u0430 (\u0432\u0435\u0440\u0445)",
    3746: "\u043B\u0435\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0430)",
    3759: "\u043F\u0440\u0430\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u043D\u0438\u0437)",
    3764: "\u043B\u0435\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u043D\u0438\u0437)",
    3787: "\u0446\u0435\u043D\u0442\u0440 \u043A\u0443\u0437\u043E\u0432\u0430 (\u043D\u0438\u0437)",
    3788: "\u043F\u0440\u0430\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u043D\u0438\u0437)",
    8701: "\u043F\u0440\u0430\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u0432\u0435\u0440\u0445)",
    9310: "\u043F\u0440\u0430\u0432\u0430\u044F \u0441\u0442\u0435\u043D\u0430 (\u043D\u0438\u0437)",
    9676: "\u043F\u043E\u043B \u043A\u0443\u0437\u043E\u0432\u0430 (\u0446\u0435\u043D\u0442\u0440)"
  };
  return positions[idNum] || `\u0414\u0430\u0442\u0447\u0438\u043A ${sensorIdStr}`;
}
function determineCriticalPointLocations(hotSensorId, coldSensorId, sensorPositions) {
  const hotLocation = hotSensorId ? getSensorLocationDescription(hotSensorId, sensorPositions) : "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0430";
  const coldLocation = coldSensorId ? getSensorLocationDescription(coldSensorId, sensorPositions) : "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0430";
  let analysis = "";
  if (hotSensorId && coldSensorId) {
    if (hotLocation.includes("\u0432\u0435\u0440\u0445") && coldLocation.includes("\u043D\u0438\u0437")) {
      analysis = "\u0412\u044B\u044F\u0432\u043B\u0435\u043D\u0430 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0440\u0430\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B: \u0431\u043E\u043B\u0435\u0435 \u0442\u0435\u043F\u043B\u044B\u0435 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u0432 \u0432\u0435\u0440\u0445\u043D\u0435\u0439 \u0447\u0430\u0441\u0442\u0438 \u043A\u0443\u0437\u043E\u0432\u0430, \u0431\u043E\u043B\u0435\u0435 \u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0435 \u2014 \u0432 \u043D\u0438\u0436\u043D\u0435\u0439 \u0447\u0430\u0441\u0442\u0438. \u042D\u0442\u043E \u0442\u0438\u043F\u0438\u0447\u043D\u043E \u0434\u043B\u044F \u0441\u0438\u0441\u0442\u0435\u043C \u0441 \u043D\u0438\u0436\u043D\u0435\u0439 \u043F\u043E\u0434\u0430\u0447\u0435\u0439 \u0445\u043E\u043B\u043E\u0434\u043D\u043E\u0433\u043E \u0432\u043E\u0437\u0434\u0443\u0445\u0430.";
    } else if (hotLocation.includes("\u043F\u0440\u0430\u0432\u043E") && coldLocation.includes("\u043B\u0435\u0432")) {
      analysis = "\u0412\u044B\u044F\u0432\u043B\u0435\u043D\u0430 \u0431\u043E\u043A\u043E\u0432\u0430\u044F \u0430\u0441\u0438\u043C\u043C\u0435\u0442\u0440\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043F\u043E\u043B\u044F: \u0431\u043E\u043B\u0435\u0435 \u0442\u0435\u043F\u043B\u044B\u0435 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u0441 \u043F\u0440\u0430\u0432\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u044B, \u0431\u043E\u043B\u0435\u0435 \u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0435 \u2014 \u0441 \u043B\u0435\u0432\u043E\u0439. \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0445\u043E\u043B\u043E\u0434\u043D\u043E\u0433\u043E \u0432\u043E\u0437\u0434\u0443\u0445\u0430.";
    } else if (hotLocation.includes("\u0446\u0435\u043D\u0442\u0440")) {
      analysis = "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0433\u043E\u0440\u044F\u0447\u0430\u044F \u0442\u043E\u0447\u043A\u0430 \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0430 \u0432 \u0446\u0435\u043D\u0442\u0440\u0435 \u043A\u0443\u0437\u043E\u0432\u0430, \u0447\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043D\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u0443\u044E \u0446\u0438\u0440\u043A\u0443\u043B\u044F\u0446\u0438\u044E \u0432\u043E\u0437\u0434\u0443\u0445\u0430 \u0432 \u044D\u0442\u043E\u0439 \u0437\u043E\u043D\u0435. \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0445\u043E\u043B\u043E\u0434\u043D\u043E\u0433\u043E \u0432\u043E\u0437\u0434\u0443\u0445\u0430.";
    } else {
      analysis = "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u043D\u0435\u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u043E\u0441\u0442\u0438, \u0442\u0440\u0435\u0431\u0443\u044E\u0449\u0438\u0435 \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u044F \u043A \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u0446\u0438\u0440\u043A\u0443\u043B\u044F\u0446\u0438\u0438 \u0432\u043E\u0437\u0434\u0443\u0445\u0430.";
    }
  }
  return { hotLocation, coldLocation, analysis };
}
function calculateAllOperationalMetrics(loggers, targetMin, targetMax, hotSensorId, coldSensorId, sensorPositions) {
  const primaryLogger = loggers.length > 0 ? loggers[0] : null;
  let warmupTimeMinutes = null;
  let doorOpeningTimeMinutes = null;
  let thermalRetentionMinutes = null;
  if (primaryLogger && primaryLogger.series) {
    warmupTimeMinutes = calculateWarmupTime(primaryLogger, targetMin, targetMax);
    doorOpeningTimeMinutes = calculateDoorOpeningTime(primaryLogger, targetMax);
    thermalRetentionMinutes = calculateThermalRetentionTime(primaryLogger, targetMin, targetMax);
  }
  const { hotLocation, coldLocation, analysis } = determineCriticalPointLocations(
    hotSensorId,
    coldSensorId,
    sensorPositions
  );
  return {
    warmupTimeMinutes,
    doorOpeningTimeMinutes,
    thermalRetentionMinutes,
    warmupDescription: warmupTimeMinutes !== null ? `\u0410\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u0430 ${warmupTimeMinutes} \u043C\u0438\u043D\u0443\u0442.` : "\u0412\u0440\u0435\u043C\u044F \u0432\u0445\u043E\u0434\u0430 \u0432 \u0440\u0435\u0436\u0438\u043C \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E.",
    doorOpeningDescription: doorOpeningTimeMinutes !== null ? `\u0414\u0432\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0434\u043E ${doorOpeningTimeMinutes} \u043C\u0438\u043D\u0443\u0442 \u0431\u0435\u0437 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430.` : "\u0412\u0440\u0435\u043C\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0434\u0432\u0435\u0440\u0438 \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E.",
    thermalRetentionDescription: thermalRetentionMinutes !== null ? `\u041F\u0440\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 \u043A\u0443\u0437\u043E\u0432 \u0441\u043F\u043E\u0441\u043E\u0431\u0435\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 ${thermalRetentionMinutes} \u043C\u0438\u043D\u0443\u0442.` : "\u0412\u0440\u0435\u043C\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430 \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E."
  };
}

// server/pdfReport.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
var PAGE_MARGIN = 56;
var ACCENT = "#0f172a";
var MUTED = "#64748b";
var BORDER = "#e2e8f0";
var SOFT_BG = "#f8fafc";
var TEMP_MODE_LABEL = {
  "2-8": "+2 \xB0C...+8 \xB0C",
  "8-15": "+8 \xB0C...+15 \xB0C",
  "15-25": "+15 \xB0C...+25 \xB0C"
};
var EQUIPMENT_LABEL = {
  refrigerator: "\u0425\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u0438\u043A",
  "auto-refrigerator": "\u0410\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440",
  // Note: for warehouse protocols, use getEquipmentName() which returns "помещение (зона) хранения"
  freezer: "\u041C\u043E\u0440\u043E\u0437\u0438\u043B\u044C\u043D\u0438\u043A",
  chamber: "\u0425\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u0430\u044F \u043A\u0430\u043C\u0435\u0440\u0430",
  warehouse: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 (\u0437\u043E\u043D\u0430) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F",
  // Note: use getEquipmentName() for proper display
  other: "\u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435"
};
var WAREHOUSE_STUDY_LABEL = {
  warehouse: "\u0421\u043A\u043B\u0430\u0434",
  controlled_env: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0441 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0435\u043C\u043E\u0439 \u0441\u0440\u0435\u0434\u043E\u0439",
  reception: "\u0417\u043E\u043D\u0430 \u043F\u0440\u0438\u0451\u043C\u043A\u0438",
  expedition: "\u0417\u043E\u043D\u0430 \u044D\u043A\u0441\u043F\u0435\u0434\u0438\u0446\u0438\u0438",
  cold_room: "\u0425\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u0430\u044F/\u043C\u043E\u0440\u043E\u0437\u0438\u043B\u044C\u043D\u0430\u044F \u043A\u0430\u043C\u0435\u0440\u0430 \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 \u0441 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0435\u043C\u043E\u0439 \u0441\u0440\u0435\u0434\u043E\u0439"
};
var WAREHOUSE_SEASON_LABEL = {
  summer: "\u041B\u0435\u0442\u043D\u0435\u0435 (\u0442\u0451\u043F\u043B\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434)",
  winter: "\u0417\u0438\u043C\u043D\u0435\u0435 (\u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434)",
  both: "\u041B\u0435\u0442\u043E + \u0437\u0438\u043C\u0430 (\u043F\u043E\u043B\u043D\u044B\u0439 \u0441\u0435\u0437\u043E\u043D\u043D\u044B\u0439 \u0446\u0438\u043A\u043B)",
  n_a: "\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E (\u043D\u0435\u0442 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430 \u0441 \u0432\u043D\u0435\u0448\u043D\u0435\u0439 \u0441\u0440\u0435\u0434\u043E\u0439)"
};
function getEquipmentName(input) {
  const type = input.protocol?.equipmentType;
  if (type === "other" && input.protocol?.customEquipmentName) {
    return input.protocol.customEquipmentName;
  }
  if (type === "warehouse") {
    return "\u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 (\u0437\u043E\u043D\u0430) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F";
  }
  return EQUIPMENT_LABEL[type || ""] || "\u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435";
}
var BASIS_LABEL = {
  primary: "\u041F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F",
  periodic: "\u041F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u0435\u0441\u043A\u0430\u044F",
  repeat: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F",
  changes: "\u041F\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F\u043C"
};
var ANSWER_LABEL = {
  yes: "\u0414\u0430",
  no: "\u041D\u0435\u0442",
  na: "\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E",
  unset: "\u2014"
};
function fmtDate(ms) {
  if (ms === null || ms === void 0) return "\u2014";
  const d = ms instanceof Date ? ms : new Date(ms);
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
function fmtDateOnly(ms) {
  if (ms === null || ms === void 0) return "\u2014";
  const d = ms instanceof Date ? ms : new Date(ms);
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function fmtDuration(ms) {
  const totalMin = Math.round(ms / 6e4);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} \u0447 ${m} \u043C\u0438\u043D`;
  return `${m} \u043C\u0438\u043D`;
}
function fmtTempValue(value) {
  if (value === null || value === void 0 || !Number.isFinite(value)) return "\u2014";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} \xB0C`;
}
function fmtTempRange(min, max) {
  return `${fmtTempValue(min)}...${fmtTempValue(max)}`;
}
function sensorAccuracyRows(pv) {
  if (pv.sensorAccuracy === void 0 || pv.sensorAccuracy === null) return [];
  const rawMin = pv.rawRangeMin ?? pv.rangeMin - pv.sensorAccuracy;
  const rawMax = pv.rawRangeMax ?? pv.rangeMax + pv.sensorAccuracy;
  return [
    ["\u041D\u043E\u043C\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D", fmtTempRange(rawMin, rawMax)],
    ["\u041F\u043E\u0433\u0440\u0435\u0448\u043D\u043E\u0441\u0442\u044C \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432, \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u043C\u0430\u044F \u0432 \u0440\u0430\u0441\u0447\u0451\u0442\u0430\u0445", `\xB1${pv.sensorAccuracy.toFixed(1)} \xB0C`],
    ["\u0420\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0441 \u0443\u0447\u0451\u0442\u043E\u043C \u043F\u043E\u0433\u0440\u0435\u0448\u043D\u043E\u0441\u0442\u0438", fmtTempRange(pv.rangeMin, pv.rangeMax)]
  ];
}
function coerceDate(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "\u2014") return null;
    const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoDateOnly) {
      const [, year, month, day] = isoDateOnly;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }
    const ruDateOnly = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*г\.?)?$/.exec(trimmed);
    if (ruDateOnly) {
      const [, day, month, year] = ruDateOnly;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function latestDate(values) {
  return values.map(coerceDate).filter((date) => date !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}
function fmtTraceDateWithFallback(value, fallback) {
  const date = coerceDate(value) ?? coerceDate(fallback);
  return date ? `${fmtDateOnly(date)} \u0433.` : "\u2014";
}
function getTraceablePerson(input) {
  return input.dataIntegrity?.preparedBy || input.org.responsible || input.signatoriesPart2?.find((s) => s.position === "composer")?.name || input.signatoriesPart1?.find((s) => s.position === "composer")?.name || input.signatoriesPart2?.[0]?.name || input.signatoriesPart1?.[0]?.name || "\u2014";
}
function getStageTrace(input, stage) {
  const existing = input.dataIntegrity?.stages.find((item) => item.stage === stage);
  if (existing) return existing;
  const preparedBy = getTraceablePerson(input);
  const fallbackDate = input.dataIntegrity?.generatedAt || input.reportDate || input.generalInfo?.validationDate || input.protocol.createdAt;
  if (stage === "IQ") {
    return {
      stage,
      label: "IQ \u2014 \u0432\u0432\u043E\u0434 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u043E\u043F\u0440\u043E\u0441\u043D\u0438\u043A \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u043C\u043E\u043D\u0442\u0430\u0436\u0430",
      completedBy: preparedBy,
      completedAt: latestDate(input.iq.items.map((item) => item.updatedAt)) ?? fallbackDate,
      source: "\u0417\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u043A-\u043B\u0438\u0441\u0442\u0430 IQ"
    };
  }
  if (stage === "OQ") {
    return {
      stage,
      label: "OQ \u2014 \u0432\u0432\u043E\u0434 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u043E\u043F\u0440\u043E\u0441\u043D\u0438\u043A \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
      completedBy: preparedBy,
      completedAt: latestDate(input.oq.items.map((item) => item.updatedAt)) ?? fallbackDate,
      source: "\u0417\u0430\u043F\u0438\u0441\u0438 \u0447\u0435\u043A-\u043B\u0438\u0441\u0442\u0430 OQ"
    };
  }
  return {
    stage,
    label: "PQ/PV \u2014 \u0432\u0432\u043E\u0434 \u0434\u0430\u043D\u043D\u044B\u0445 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438",
    completedBy: preparedBy,
    completedAt: latestDate([
      input.pv.updatedAt,
      ...input.pv.loggers.map((logger) => logger.createdAt)
    ]) ?? fallbackDate,
    source: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B PV \u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043B\u043E\u0433\u0433\u0435\u0440\u043E\u0432"
  };
}
function shortLabel(label, customName) {
  const short = label.length > 4 ? label.slice(-4) : label;
  return customName ? `${short}
${customName}` : short;
}
function findFontPath() {
  const cwd = process.cwd();
  const candidates = [
    ["regular", path3.resolve(__dirname, "fonts/DejaVuSans.ttf")],
    ["bold", path3.resolve(__dirname, "fonts/DejaVuSans-Bold.ttf")],
    ["regular", path3.join(cwd, "dist", "fonts", "DejaVuSans.ttf")],
    ["bold", path3.join(cwd, "dist", "fonts", "DejaVuSans-Bold.ttf")],
    ["regular", path3.join(cwd, "server", "fonts", "DejaVuSans.ttf")],
    ["bold", path3.join(cwd, "server", "fonts", "DejaVuSans-Bold.ttf")],
    // system fallbacks (dev sandbox)
    ["regular", "/usr/local/lib/python3.11/dist-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans.ttf"],
    ["bold", "/usr/local/lib/python3.11/dist-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans-Bold.ttf"],
    ["regular", "/opt/.manus/current/.venv/lib/python3.13/site-packages/cv2/qt/fonts/DejaVuSans.ttf"],
    ["bold", "/opt/.manus/current/.venv/lib/python3.13/site-packages/cv2/qt/fonts/DejaVuSans-Bold.ttf"]
  ];
  const found = {};
  for (const [kind, p] of candidates) {
    if (fs2.existsSync(p) && !found[kind]) found[kind] = p;
  }
  return found;
}
async function generateProtocolPdf(input) {
  const fonts = findFontPath();
  if (!fonts.regular) {
    throw new Error("DejaVu Sans font not found \u2014 required for Cyrillic PDF rendering");
  }
  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: {
      Title: `\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438 ${input.protocol.number}`,
      Author: input.org.name,
      Subject: "\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438/\u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F"
    }
  });
  doc.registerFont("body", fonts.regular);
  if (fonts.bold) doc.registerFont("bold", fonts.bold);
  else doc.registerFont("bold", fonts.regular);
  doc.font("body");
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  drawPartCover(doc, input, "part1");
  const isWarehouseDoc = (input.generalInfo?.equipmentType || input.protocol?.equipmentType) === "warehouse";
  if (isWarehouseDoc) {
    drawWarehouseProtocolPart1(doc, input);
  } else {
    doc.addPage();
    drawSectionTitle(doc, "1. \u041E\u0431\u0449\u0438\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0438");
    drawGeneralInfoTable(doc, input);
    drawRevisionHistorySection(doc, input);
    if (input.protocolSensors && input.protocolSensors.length > 0) {
      doc.addPage();
      drawSectionTitle(doc, "1.1. \u0414\u0430\u0442\u0447\u0438\u043A\u0438, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C\u044B\u0435 \u0434\u043B\u044F \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438");
      drawSensorTable(doc, input.protocolSensors, input.pv.sensorAccuracy);
    }
    doc.addPage();
    drawSectionTitle(doc, "2. \u041F\u043B\u0430\u043D IQ \u2014 \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043C\u043E\u043D\u0442\u0430\u0436\u0430");
    drawStageBlocks(doc, input.iq);
    drawChecklistPlan(doc, input.iq.items);
    doc.addPage();
    drawSectionTitle(doc, "3. \u041F\u043B\u0430\u043D OQ \u2014 \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
    drawStageBlocks(doc, input.oq);
    drawChecklistPlan(doc, input.oq.items);
    doc.addPage();
    drawSectionTitle(doc, "4. \u041F\u043B\u0430\u043D PV \u2014 \u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F");
    drawStageBlocks(doc, input.pv);
    drawPVPlan(doc, input.pv, input);
    doc.addPage();
    drawSectionTitle(doc, "5. \u041F\u043E\u0434\u043F\u0438\u0441\u0438 \u043A \u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0443");
    drawSignaturesBlock(doc, getSignatoriesPart1(input), "\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0440\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D \u0438 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D:");
  }
  doc.addPage();
  drawPartCover(doc, input, "part2");
  doc.addPage();
  drawSectionTitle(doc, "6. \u041F\u0435\u0440\u0438\u043E\u0434 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439");
  drawTestPeriod(doc, input);
  doc.addPage();
  drawSectionTitle(doc, "7. \u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B IQ \u2014 \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043C\u043E\u043D\u0442\u0430\u0436\u0430");
  drawStageDataEntryTable(doc, input, "IQ");
  drawChecklistTable(doc, input.iq.items);
  drawStageVerdict(doc, "IQ", input.iq.verdict, input.iq.items);
  doc.addPage();
  drawSectionTitle(doc, "8. \u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B OQ \u2014 \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
  drawStageDataEntryTable(doc, input, "OQ");
  drawChecklistTable(doc, input.oq.items);
  drawStageVerdict(doc, "OQ", input.oq.verdict, input.oq.items);
  doc.addPage();
  drawSectionTitle(doc, "9. \u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B PV \u2014 \u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F");
  drawStageDataEntryTable(doc, input, "PV");
  drawPVParams(doc, input.pv);
  if (input.pvLoggers && input.pvLoggers.length > 0) {
    const eqType = input.generalInfo?.equipmentType || input.protocol?.equipmentType || "";
    if (eqType === "warehouse") {
      drawWarehousePlanDiagram(doc, input, false, "\u0421\u0445\u0435\u043C\u0430. \u0420\u0430\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u043D\u0430 \u043F\u043B\u0430\u043D\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F");
    } else {
      if (eqType === "auto-refrigerator") {
        drawReeferTruckDiagram3D(doc, input.pvLoggers, PAGE_MARGIN, null, null, true, "\u0421\u0445\u0435\u043C\u0430 1. \u042D\u0442\u0430\u043B\u043E\u043D\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 ISPE (C1\u2013C8, W1\u2013W4, V1\u2013V3)");
      } else {
        drawSubTitle(doc, "\u0421\u0445\u0435\u043C\u0430 1. \u042D\u0442\u0430\u043B\u043E\u043D\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 ISPE (C1\u2013C8, W1\u2013W4, V1\u2013V3)");
        drawRefrigeratorDiagram(doc, input.pvLoggers, PAGE_MARGIN, null, null);
      }
      doc.addPage();
      if (eqType === "auto-refrigerator") {
        const hotLabel = input.pv.hotIdx !== null && input.pv.loggers[input.pv.hotIdx] ? input.pv.loggers[input.pv.hotIdx].label : null;
        const coldLabel = input.pv.coldIdx !== null && input.pv.loggers[input.pv.coldIdx] ? input.pv.loggers[input.pv.coldIdx].label : null;
        drawReeferTruckDiagram3D(doc, input.pvLoggers, PAGE_MARGIN, input.coolingUnitPos, input.doorPos, false, "\u0421\u0445\u0435\u043C\u0430 2. \u0420\u0430\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 (\u0441 \u0441\u0435\u0440\u0438\u0439\u043D\u044B\u043C\u0438 \u043D\u043E\u043C\u0435\u0440\u0430\u043C\u0438)", hotLabel, coldLabel);
      } else {
        drawSubTitle(doc, "\u0421\u0445\u0435\u043C\u0430 2. \u0420\u0430\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 (\u0441 \u0441\u0435\u0440\u0438\u0439\u043D\u044B\u043C\u0438 \u043D\u043E\u043C\u0435\u0440\u0430\u043C\u0438)");
        drawRefrigeratorDiagram(doc, input.pvLoggers, PAGE_MARGIN, input.coolingUnitPos, input.doorPos);
      }
    }
    drawSensorPlacementAnalysis(doc, input.pvLoggers, input);
    if (eqType === "warehouse") {
      drawWarehouseAnnex1(doc, input);
      drawWarehouseAnnex2(doc, input);
    }
  }
  drawSubTitle(doc, "\u0421\u0432\u043E\u0434\u043D\u0430\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u043F\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430\u043C");
  drawStatsTable(doc, input.pv.loggers, input.pv.hotIdx, input.pv.coldIdx, input.pv.extIndices);
  doc.addPage();
  drawSubTitle(doc, "\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439");
  drawMeasurementTable(doc, input.pv.loggers, input.pv.samplingStepMinutes);
  drawCharts(doc, input.pv, input);
  drawDeviationsSection(doc, input.pv);
  drawStagePVVerdict(doc, input.pv, input);
  if (input.excursion?.enabled) {
    doc.addPage();
    drawExcursionSection(doc, input.excursion, input.pv.rangeMin, input.pv.rangeMax, input.pv.sensorAccuracy);
  }
  doc.addPage();
  drawSectionTitle(doc, input.excursion?.enabled ? "11. \u041E\u0442\u0447\u0451\u0442 \u043E \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438" : "10. \u041E\u0442\u0447\u0451\u0442 \u043E \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438");
  drawFinalConclusion(doc, input);
  doc.addPage();
  drawSectionTitle(doc, input.excursion?.enabled ? "12. \u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F \u043E\u0442 \u043F\u043B\u0430\u043D\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430" : "11. \u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F \u043E\u0442 \u043F\u043B\u0430\u043D\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430");
  drawPlanDeviationsSection(doc, input);
  drawSectionTitle(doc, input.excursion?.enabled ? "13. \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438" : "12. \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438");
  drawRecommendationsSection(doc, input);
  doc.addPage();
  drawSectionTitle(doc, input.excursion?.enabled ? "14. \u041F\u043E\u0434\u043F\u0438\u0441\u0438 \u043A \u041E\u0442\u0447\u0451\u0442\u0443" : "13. \u041F\u043E\u0434\u043F\u0438\u0441\u0438 \u043A \u041E\u0442\u0447\u0451\u0442\u0443");
  drawSignaturesBlock(doc, getSignatoriesPart2(input), "\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u043E\u0442\u0447\u0451\u0442 \u043E \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0440\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D \u0438 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D:");
  drawSectionTitle(doc, input.excursion?.enabled ? "15. \u0421\u0440\u043E\u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430" : "14. \u0421\u0440\u043E\u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430");
  drawValiditySection(doc, input);
  doc.addPage();
  drawCalibrationPage(doc);
  addHeadersAndFooters(doc, input);
  doc.end();
  return done;
}
function drawPartCover(doc, input, part) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  doc.save();
  doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);
  doc.restore();
  let y = 80;
  if (input.org.logoBuffer) {
    try {
      doc.image(input.org.logoBuffer, left, y, { fit: [110, 70] });
    } catch {
    }
  }
  doc.fillColor(MUTED).font("body").fontSize(10).text(input.org.name.toUpperCase(), right - 280, y, { width: 280, align: "right" });
  y += 130;
  const partLabel = part === "part1" ? "\u0427\u0410\u0421\u0422\u042C I" : "\u0427\u0410\u0421\u0422\u042C II";
  const partTitle = part === "part1" ? "\u041F\u0420\u041E\u0422\u041E\u041A\u041E\u041B \u041A\u0412\u0410\u041B\u0418\u0424\u0418\u041A\u0410\u0426\u0418\u0418" : "\u041E\u0422\u0427\u0401\u0422 \u041E \u041A\u0412\u0410\u041B\u0418\u0424\u0418\u041A\u0410\u0426\u0418\u0418";
  const partSubtitle = part === "part1" ? "IQ \xB7 OQ \xB7 PQ/PV" : "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439 IQ \xB7 OQ \xB7 PQ/PV";
  doc.fillColor(MUTED).font("bold").fontSize(13).text(partLabel, left, y, { align: "center" });
  y += 22;
  doc.fillColor(ACCENT).font("bold").fontSize(26).text(partTitle, left, y, { align: "center" });
  y += 38;
  doc.fillColor(MUTED).font("body").fontSize(13).text(partSubtitle, left, y, { align: "center" });
  y += 24;
  const eqType = input.generalInfo?.equipmentType || input.protocol?.equipmentType || "";
  const equipmentTypeLabel = eqType === "auto-refrigerator" ? "\u0422\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442\u043D\u043E\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043E" : eqType === "warehouse" ? getEquipmentName(input) : "\u0425\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435";
  doc.fillColor(ACCENT).font("bold").fontSize(16).text(equipmentTypeLabel, left, y, { align: "center" });
  y += 50;
  const cardX = left + 40;
  const cardW = right - left - 80;
  const cardY = y;
  const rowH = 28;
  const baseRows = [
    ["\u041D\u043E\u043C\u0435\u0440 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430", input.protocol.number],
    ["\u0420\u0435\u0434\u0430\u043A\u0446\u0438\u044F", input.dataIntegrity?.revision || "01"],
    ["\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F", input.org.name],
    ["\u0411\u0418\u041D / \u0418\u041D\u041D", input.org.bin || "\u2014"],
    ["\u041E\u0431\u044A\u0435\u043A\u0442 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438", eqType === "warehouse" ? getEquipmentName(input) : `${EQUIPMENT_LABEL[input.generalInfo?.equipmentType || ""] || "\u2014"} \xB7 ${input.generalInfo?.manufacturer || ""} ${input.generalInfo?.model || ""}`.trim()],
    ["\u0410\u0434\u0440\u0435\u0441 \u043E\u0431\u044A\u0435\u043A\u0442\u0430", input.generalInfo?.location || "\u2014"],
    ["\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C", TEMP_MODE_LABEL[input.generalInfo?.tempMode || ""] || "\u2014"],
    ["\u0421\u0435\u0437\u043E\u043D", input.generalInfo?.season ? { warm: "\u0422\u0435\u043F\u043B\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", cold: "\u0425\u043E\u043B\u043E\u0434\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", interseasonal: "\u041C\u0435\u0436\u0441\u0435\u0437\u043E\u043D\u044C\u0435", none: "\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E" }[input.generalInfo.season] || "\u2014" : "\u2014"],
    ["\u0422\u0438\u043F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438", input.generalInfo?.qualificationType ? { primary: "\u041F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F", periodic: "\u041F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u0435\u0441\u043A\u0430\u044F", repeat: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0430\u044F" }[input.generalInfo.qualificationType] || "\u2014" : "\u2014"]
  ];
  const rows = part === "part1" ? [
    ...baseRows,
    ["\u0414\u0430\u0442\u0430 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430", fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === "string" ? new Date(input.protocol.createdAt) : input.protocol.createdAt)]
  ] : [
    // Перекрёстная ссылка на Протокол (Часть I)
    ["\u041E\u0442\u0447\u0451\u0442 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D \u043F\u043E \u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0443 \u2116", `${input.protocol.number} \u043E\u0442 ${fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === "string" ? new Date(input.protocol.createdAt) : input.protocol.createdAt)}`],
    ...baseRows,
    ["\u0414\u0430\u0442\u0430 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043E\u0442\u0447\u0451\u0442\u0430", input.reportDate && input.reportDate.trim() ? input.reportDate.trim() : fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === "string" ? new Date(input.protocol.createdAt) : input.protocol.createdAt)]
  ];
  const cardH = 28 + rows.length * rowH;
  doc.save();
  doc.lineWidth(0.7).strokeColor(BORDER).roundedRect(cardX, cardY, cardW, cardH, 8).stroke();
  doc.restore();
  rows.forEach(([k, v], idx) => {
    const ry = cardY + 14 + idx * rowH;
    doc.fillColor(MUTED).font("body").fontSize(9).text(k.toUpperCase(), cardX + 18, ry, {
      width: 170
    });
    doc.fillColor(ACCENT).font("bold").fontSize(11).text(v || "\u2014", cardX + 200, ry - 1, { width: cardW - 220 });
  });
  doc.fillColor(MUTED).font("body").fontSize(9).text(
    "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 GMP / GDP / GPP.",
    left,
    doc.page.height - 110,
    { width: right - left, align: "center" }
  );
}
function drawSectionTitle(doc, title) {
  ensureSpace2(doc, 70);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  doc.save();
  doc.rect(left, doc.y, 4, 30).fill(ACCENT);
  doc.restore();
  doc.fillColor(ACCENT).font("bold").fontSize(14).text(title, left + 14, doc.y + 7, { width: right - left - 18, lineBreak: false });
  doc.moveDown(0.7);
  doc.save();
  doc.strokeColor(BORDER).lineWidth(0.6).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.restore();
  doc.moveDown(0.7);
}
function drawSubTitle(doc, title) {
  ensureSpace2(doc, 50);
  doc.moveDown(0.6);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  doc.fillColor(ACCENT).font("bold").fontSize(12).text(title, left, doc.y, { width: right - left });
  doc.moveDown(0.4);
}
function formatLoadPercent(value) {
  if (value === null || value === void 0 || value === "") return "\u2014";
  const raw = String(value).trim();
  if (!raw) return "\u2014";
  const normalized = raw.replace("%", "").replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return raw.endsWith("%") ? raw : `${raw}%`;
  const rounded = Math.round(numeric * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}
function drawGeneralInfoTable(doc, input) {
  const gi = input.generalInfo;
  const isWarehouse = gi?.equipmentType === "warehouse";
  const loadPercentLabel = formatLoadPercent(gi?.loadPercent);
  let rows;
  if (isWarehouse) {
    const lengthM = gi?.whLengthM ? Number(gi.whLengthM).toFixed(2) : "\u2014";
    const widthM = gi?.whWidthM ? Number(gi.whWidthM).toFixed(2) : "\u2014";
    const heightM = gi?.whHeightM ? Number(gi.whHeightM).toFixed(2) : "\u2014";
    const dims = `${lengthM} \xD7 ${widthM} \xD7 ${heightM} \u043C (\u0414 \xD7 \u0428 \xD7 \u0412)`;
    const fillStatusLabel = gi?.fillStatus ? { empty: "\u041F\u0443\u0441\u0442\u043E\u0439", loaded: "\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0439" }[gi.fillStatus] : "\u2014";
    rows = [
      ["\u0422\u0438\u043F \u043E\u0431\u044A\u0435\u043A\u0442\u0430", gi?.equipmentType === "warehouse" ? getEquipmentName(input) : EQUIPMENT_LABEL[gi?.equipmentType || ""] || "\u2014"],
      ["\u0422\u0438\u043F \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F / \u0437\u043E\u043D\u044B", WAREHOUSE_STUDY_LABEL[gi?.whStudyType || ""] || "\u2014"],
      ["\u0410\u0434\u0440\u0435\u0441 \u043E\u0431\u044A\u0435\u043A\u0442\u0430", gi?.location || "\u2014"],
      ["\u0413\u0435\u043E\u043C\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u044B", dims],
      ["\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C", TEMP_MODE_LABEL[gi?.tempMode || ""] || "\u2014"],
      ["\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u0438", gi?.whHumidityControl ? `\u0414\u0430 (${gi?.whHumidityMin ?? "\u2014"} \u2013 ${gi?.whHumidityMax ?? "\u2014"} % \u043E.\u0432.)` : "\u041D\u0435 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0435\u0442\u0441\u044F"],
      ["\u0421\u0435\u0437\u043E\u043D \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F", gi?.season ? { warm: "\u0422\u0451\u043F\u043B\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", cold: "\u0425\u043E\u043B\u043E\u0434\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434", interseasonal: "\u041C\u0435\u0436\u0441\u0435\u0437\u043E\u043D\u044C\u0435", none: "\u041D\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u043C\u043E" }[gi.season] || WAREHOUSE_SEASON_LABEL[gi.season] || "\u2014" : "\u2014"],
      ["\u041A\u043E\u043D\u0442\u0430\u043A\u0442 \u0441 \u0432\u043D\u0435\u0448\u043D\u0435\u0439 \u0441\u0440\u0435\u0434\u043E\u0439", gi?.whExternalEnv ? "\u0418\u043C\u0435\u0435\u0442\u0441\u044F (\u0443\u0447\u0438\u0442\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0441\u0435\u0437\u043E\u043D\u043D\u044B\u0435 \u043A\u043E\u043B\u0435\u0431\u0430\u043D\u0438\u044F)" : "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442"],
      ["\u0417\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442\u0430", fillStatusLabel],
      ["\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u043E\u0431\u044A\u0435\u043A\u0442\u0430", loadPercentLabel],
      ["\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 / \u0445\u0440\u0430\u043D\u0438\u043C\u0430\u044F \u043F\u0440\u043E\u0434\u0443\u043A\u0446\u0438\u044F", gi?.purpose || "\u2014"],
      ["\u041E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438", BASIS_LABEL[gi?.basis || ""] || "\u2014"],
      ["\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F", input.org.name],
      ["\u0411\u0418\u041D / \u0418\u041D\u041D", input.org.bin || "\u2014"],
      ["\u0410\u0434\u0440\u0435\u0441 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438", input.org.addressFact || "\u2014"],
      ["\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u043B\u0438\u0446\u043E", input.org.responsible || "\u2014"],
      ["\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B", input.org.phone || "\u2014"]
    ];
    if (gi?.whLayoutNotes) {
      rows.push(["\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u044F \u043A \u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u043A\u0435", gi.whLayoutNotes]);
    }
  } else {
    rows = [
      ["\u0422\u0438\u043F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F", gi?.equipmentType === "warehouse" ? getEquipmentName(input) : EQUIPMENT_LABEL[gi?.equipmentType || ""] || "\u2014"],
      ["\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C", gi?.manufacturer || "\u2014"],
      ["\u041C\u043E\u0434\u0435\u043B\u044C", gi?.model || "\u2014"],
      ["\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440", gi?.serial || "\u2014"],
      ["\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C", TEMP_MODE_LABEL[gi?.tempMode || ""] || "\u2014"],
      ["\u041C\u0435\u0441\u0442\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438", gi?.location || "\u2014"],
      ["\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 / \u0445\u0440\u0430\u043D\u0438\u043C\u0430\u044F \u043F\u0440\u043E\u0434\u0443\u043A\u0446\u0438\u044F", gi?.purpose || "\u2014"],
      ["\u041E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438", BASIS_LABEL[gi?.basis || ""] || "\u2014"],
      ["\u041E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F", input.org.name],
      ["\u0411\u0418\u041D / \u0418\u041D\u041D", input.org.bin || "\u2014"],
      ["\u0410\u0434\u0440\u0435\u0441", input.org.addressFact || "\u2014"],
      ["\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u043B\u0438\u0446\u043E", input.org.responsible || "\u2014"],
      ["\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B", input.org.phone || "\u2014"],
      ["\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u043E\u0431\u044A\u0435\u043A\u0442\u0430", loadPercentLabel]
    ];
  }
  drawKVTable(doc, rows);
}
function drawKVTable(doc, rows, keyColW = 220) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalWidth = right - left;
  let maxKeyWidth = 0;
  doc.font("body").fontSize(9);
  rows.forEach(([k]) => {
    const width = doc.widthOfString(k);
    maxKeyWidth = Math.max(maxKeyWidth, width);
  });
  doc.fontSize(10);
  const padding = 10;
  const calculatedKeyColW = Math.min(Math.max(maxKeyWidth + padding * 3, 150), totalWidth * 0.5);
  const colKey = keyColW > 0 ? keyColW : calculatedKeyColW;
  rows.forEach(([k, v], idx) => {
    const padding2 = 10;
    const keyWidth = colKey - padding2 * 2;
    const valWidth = right - left - colKey - padding2;
    doc.font("body").fontSize(10);
    const keyHeight = doc.heightOfString(k, { width: keyWidth });
    const valHeight = doc.heightOfString(v || "\u2014", { width: valWidth });
    const rowH = Math.max(28, Math.max(keyHeight, valHeight) + padding2 * 2);
    ensureSpace2(doc, rowH);
    const y = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, y, right - left, rowH).fill();
      doc.restore();
    }
    doc.fillColor(MUTED).font("body").fontSize(9).text(k, left + padding2, y + padding2, { width: keyWidth });
    doc.fillColor(ACCENT).font("body").fontSize(10).text(v || "\u2014", left + colKey + padding2, y + padding2, { width: valWidth });
    doc.y = y + rowH;
  });
  doc.moveDown(0.6);
}
function drawSimpleTable(doc, headers, rows, colFractions) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalW = right - left;
  const colW = colFractions.map((fraction) => fraction * totalW);
  const padding = 6;
  ensureSpace2(doc, 28);
  let y = doc.y;
  const headerH = 24;
  doc.save();
  doc.rect(left, y, totalW, headerH).fill(ACCENT);
  doc.restore();
  let cx = left;
  doc.fillColor("white").font("bold").fontSize(9);
  headers.forEach((header, index2) => {
    doc.text(header, cx + padding, y + 7, { width: colW[index2] - padding * 2, lineBreak: false });
    cx += colW[index2];
  });
  doc.y = y + headerH;
  rows.forEach((cells, rowIndex) => {
    doc.font("body").fontSize(9);
    const rowH = Math.max(
      26,
      ...cells.map(
        (cell, index2) => doc.heightOfString(cell || "\u2014", { width: colW[index2] - padding * 2 }) + padding * 2
      )
    );
    ensureSpace2(doc, rowH);
    y = doc.y;
    if (rowIndex % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, y, totalW, rowH).fill();
      doc.restore();
    }
    doc.save();
    doc.strokeColor(BORDER).lineWidth(0.5).rect(left, y, totalW, rowH).stroke();
    doc.restore();
    cx = left;
    cells.forEach((cell, index2) => {
      if (index2 > 0) {
        doc.save();
        doc.strokeColor(BORDER).lineWidth(0.5).moveTo(cx, y).lineTo(cx, y + rowH).stroke();
        doc.restore();
      }
      doc.fillColor(ACCENT).font("body").fontSize(9).text(cell || "\u2014", cx + padding, y + padding, { width: colW[index2] - padding * 2 });
      cx += colW[index2];
    });
    doc.y = y + rowH;
  });
  doc.moveDown(0.7);
}
function drawRevisionHistorySection(doc, input) {
  drawSubTitle(doc, "\u0420\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439");
  const revision = input.dataIntegrity?.revision || "01";
  drawKVTable(doc, [
    ["\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u044F", revision],
    ["\u0421\u0442\u0430\u0442\u0443\u0441 \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u0438", "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0430\u044F"]
  ], 180);
  const author = getTraceablePerson(input);
  const defaultDate = input.generalInfo?.validationDate || input.reportDate || input.protocol.createdAt || input.dataIntegrity?.generatedAt;
  const rows = (input.dataIntegrity?.revisionHistory?.length ? input.dataIntegrity.revisionHistory : [{
    revision,
    date: defaultDate,
    change: "\u041F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 \u0438 \u043E\u0442\u0447\u0451\u0442\u0430 \u043E \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438.",
    author
  }]).map((item) => [
    item.revision,
    fmtTraceDateWithFallback(item.date, defaultDate),
    item.change,
    item.author
  ]);
  drawSimpleTable(
    doc,
    ["\u0420\u0435\u0434.", "\u0414\u0430\u0442\u0430", "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F", "\u0412\u043D\u0435\u0441 / \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u043B"],
    rows,
    [0.1, 0.2, 0.45, 0.25]
  );
}
function drawStageDataEntryTable(doc, input, stage) {
  const trace = getStageTrace(input, stage);
  drawSubTitle(doc, `\u0417\u0430\u043F\u0438\u0441\u044C \u0432\u0432\u043E\u0434\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 ${stage === "PV" ? "PQ/PV" : stage}`);
  drawSimpleTable(
    doc,
    ["\u0420\u0430\u0437\u0434\u0435\u043B \u0434\u0430\u043D\u043D\u044B\u0445", "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u043B (\u0424\u0418\u041E)", "\u0414\u0430\u0442\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044F", "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u0437\u0430\u043F\u0438\u0441\u0438"],
    [[trace.label, " ", " ", trace.source]],
    [0.3, 0.22, 0.24, 0.24]
  );
}
function drawStageBlocks(doc, stage) {
  const blocks = [
    ["\u0426\u0435\u043B\u044C \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F", stage.purpose],
    ["\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F", stage.description],
    ["\u041A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438", stage.criteria]
  ];
  blocks.forEach(([k, v]) => {
    ensureSpace2(doc, 60);
    doc.fillColor(ACCENT).font("bold").fontSize(11).text(k);
    doc.moveDown(0.3);
    doc.fillColor("#1f2937").font("body").fontSize(10).text(v, { align: "justify" });
    doc.moveDown(0.7);
  });
}
function drawChecklistTable(doc, items) {
  drawSubTitle(doc, "\u041E\u043F\u0440\u043E\u0441\u043D\u0438\u043A");
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const numW = 30;
  const ansW = 90;
  const qW = right - left - numW - ansW;
  ensureSpace2(doc, 26);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, right - left, 22).fill(ACCENT);
  doc.restore();
  doc.fillColor("white").font("bold").fontSize(10);
  doc.text("\u2116", left + 6, y + 6, { width: numW - 6 });
  doc.text("\u0412\u043E\u043F\u0440\u043E\u0441 / \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439", left + numW + 6, y + 6, { width: qW - 12 });
  doc.text("\u041E\u0442\u0432\u0435\u0442", left + numW + qW + 6, y + 6, { width: ansW - 12 });
  doc.y = y + 22;
  items.forEach((it, idx) => {
    const padding = 6;
    doc.font("body").fontSize(10);
    const qText = it.questionText + (it.comment ? `
\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439: ${it.comment}` : "");
    const qH = doc.heightOfString(qText, { width: qW - 12 });
    const rowH = Math.max(22, qH + padding * 2);
    ensureSpace2(doc, rowH);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, right - left, rowH).fill();
      doc.restore();
    }
    doc.save();
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(left, ry + rowH).lineTo(right, ry + rowH).stroke();
    doc.restore();
    doc.fillColor(ACCENT).font("body").fontSize(10).text(String(idx + 1), left + 6, ry + padding, { width: numW - 6 });
    doc.fillColor("#1f2937").font("body").fontSize(10).text(qText, left + numW + 6, ry + padding, { width: qW - 12 });
    const ansLabel = ANSWER_LABEL[it.answer] || "\u2014";
    let ansColor = MUTED;
    if (it.answer === "yes") ansColor = "#15803d";
    else if (it.answer === "no") ansColor = "#b91c1c";
    else if (it.answer === "na") ansColor = "#475569";
    doc.fillColor(ansColor).font("bold").fontSize(10).text(ansLabel, left + numW + qW + 6, ry + padding, { width: ansW - 12 });
    doc.y = ry + rowH;
  });
  doc.moveDown(0.4);
}
function drawStageVerdict(doc, name, verdict, items) {
  const noItems = items.filter((i) => i.answer === "no");
  doc.moveDown(0.5);
  doc.font("bold").fontSize(12);
  const titleH = doc.heightOfString("\u0417\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u044D\u0442\u0430\u043F\u0443") + 4;
  doc.font("body").fontSize(10);
  const longestSample = "\u0412\u0441\u0435 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B. \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043C\u043E\u043D\u0442\u0430\u0436\u0430 (IQ) \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E. \u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E, \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0438 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439, \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u043E\u0439 \u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438.";
  const sampleH = Math.max(60, doc.heightOfString(longestSample, { width: doc.page.width - PAGE_MARGIN * 2 - 28 }) + 28);
  ensureSpace2(doc, titleH + 8 + sampleH);
  doc.fillColor(ACCENT).font("bold").fontSize(12).text("\u0417\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u044D\u0442\u0430\u043F\u0443", PAGE_MARGIN, doc.y, { lineBreak: false });
  doc.moveDown(0.3);
  doc.y += 42.5;
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  let bg = "#f1f5f9";
  let bd = BORDER;
  let fg = ACCENT;
  let text2 = "\u0417\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u2014 \u044D\u0442\u0430\u043F \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D.";
  if (verdict === "pass") {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    if (name === "IQ") {
      text2 = "\u0412\u0441\u0435 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B. \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043C\u043E\u043D\u0442\u0430\u0436\u0430 (IQ) \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E. \u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E, \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0438 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439, \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u043E\u0439 \u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438.";
    } else if (name === "OQ") {
      text2 = "\u0412\u0441\u0435 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B. \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F (OQ) \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E. \u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u0443\u0435\u0442 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u043C\u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430\u043C\u0438 \u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F.";
    } else {
      text2 = `\u0412\u0441\u0435 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B. \u042D\u0442\u0430\u043F ${name} \u043F\u0440\u043E\u0439\u0434\u0435\u043D \u0443\u0441\u043F\u0435\u0448\u043D\u043E.`;
    }
  } else if (verdict === "fail") {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    const list = noItems.map((it, i) => `${i + 1}. ${it.questionText}${it.comment ? ` (${it.comment})` : ""}`).join("\n");
    text2 = `\u042D\u0442\u0430\u043F ${name} \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D. \u0412\u044B\u044F\u0432\u043B\u0435\u043D\u044B \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F:
${list || "\u2014"}`;
  }
  const padding = 14;
  doc.font("body").fontSize(10);
  const h = Math.max(50, doc.heightOfString(text2, { width: w - padding * 2 }) + padding * 2);
  const y = doc.y;
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(10).text(text2, left + padding, y + padding, {
    width: w - padding * 2
  });
  doc.y = y + h;
  doc.moveDown(0.6);
}
function drawPVParams(doc, pv) {
  const durationMs = pv.startAt && pv.endAt ? pv.endAt - pv.startAt : 0;
  const rows = [
    ["\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C", TEMP_MODE_LABEL[pv.tempMode] || pv.tempMode],
    ...sensorAccuracyRows(pv),
    ["\u041D\u0430\u0447\u0430\u043B\u043E \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F", pv.startAt ? fmtDate(pv.startAt) : "\u2014"],
    ["\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F", pv.endAt ? fmtDate(pv.endAt) : "\u2014"],
    ["\u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C", durationMs ? fmtDuration(durationMs) : "\u2014"],
    ["\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E)", `${pv.minDurationHours} \u0447`],
    ["\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 (\u043F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E)", String(pv.minSensorCount)],
    ["\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432", String(pv.loggers.length)],
    ["\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432", String(pv.loggers.filter((l) => l.role === "internal").length)],
    ["\u0412\u043D\u0435\u0448\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432", String(pv.loggers.filter((l) => l.role === "external").length)]
  ];
  drawKVTable(doc, rows);
}
function drawStatsTable(doc, loggers, hotIdx, coldIdx, extIndices) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const cols = [
    { label: "\u0414\u0430\u0442\u0447\u0438\u043A", w: 0.14 },
    { label: "\u0420\u043E\u043B\u044C", w: 0.14 },
    { label: "Min, \xB0C", w: 0.1 },
    { label: "Max, \xB0C", w: 0.1 },
    { label: "Avg, \xB0C", w: 0.11 },
    { label: "STD", w: 0.08 },
    { label: "MKT, \xB0C", w: 0.11 },
    { label: "\u0422\u043E\u0447\u0435\u043A", w: 0.1 },
    { label: "\u041E\u0442\u043A\u043B.", w: 0.08 }
  ];
  const ROW_H = 26;
  const HEADER_H = 24;
  ensureSpace2(doc, HEADER_H + 2);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, w, HEADER_H).fill(ACCENT);
  doc.restore();
  let cx = left;
  doc.fillColor("white").font("bold").fontSize(9);
  cols.forEach((c) => {
    const cw = c.w * w;
    doc.text(c.label, cx + 4, y + 5, { width: cw - 8, lineBreak: false });
    cx += cw;
  });
  doc.y = y + HEADER_H;
  loggers.forEach((l, idx) => {
    ensureSpace2(doc, ROW_H);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, w, ROW_H).fill();
      doc.restore();
    }
    let role = l.role === "external" ? "\u0432\u043D\u0435\u0448." : "\u0432\u043D\u0443\u0442\u0440.";
    if (idx === hotIdx) role = "\u0432\u043D\u0443\u0442\u0440. \u0433\u043E\u0440.";
    if (idx === coldIdx) role = "\u0432\u043D\u0443\u0442\u0440. \u0445\u043E\u043B.";
    const rawLabel = l.label.length > 4 ? l.label.slice(-4) : l.label;
    const name = l.customName ? `${rawLabel} \xB7 ${l.customName}` : rawLabel;
    const cells = [
      name,
      role,
      l.min.toFixed(2),
      l.max.toFixed(2),
      l.avg.toFixed(2),
      l.std.toFixed(2),
      l.mkt.toFixed(2),
      String(l.pointCount),
      String(l.deviations.length)
    ];
    let cx2 = left;
    doc.font("body").fontSize(9).fillColor(ACCENT);
    cells.forEach((val, i) => {
      const cw = cols[i].w * w;
      doc.text(val, cx2 + 4, ry + 8, { width: cw - 8, lineBreak: false });
      cx2 += cw;
    });
    doc.y = ry + ROW_H;
  });
  doc.moveDown(0.4);
}
function drawCharts(doc, pv, input) {
  const eqName = input ? getEquipmentName(input) : "\u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F";
  const eqGen = eqName.toLowerCase();
  const internal = pv.loggers.map((l, i) => ({ ...l, idx: i })).filter((l) => l.role === "internal");
  if (internal.length > 0) {
    drawOverviewChart(
      doc,
      internal.map((l) => ({
        name: shortLabel(l.label, l.customName),
        ts: l.series.ts,
        temp: l.series.temp
      })),
      pv.rangeMin,
      pv.rangeMax
    );
    drawChartExplanation(
      doc,
      "\u041E\u0431\u0437\u043E\u0440\u043D\u044B\u0439 \u0433\u0440\u0430\u0444\u0438\u043A \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0435 \u043A\u0440\u0438\u0432\u044B\u0435 \u0432\u0441\u0435\u0445 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u043D\u0430 \u043E\u0434\u043D\u043E\u0439 \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u0435. \u0417\u0435\u043B\u0451\u043D\u0430\u044F \u043F\u043E\u043B\u043E\u0441\u0430 \u043E\u0431\u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 (" + (pv.rangeMin > 0 ? "+" : "") + pv.rangeMin + "\u2026" + (pv.rangeMax > 0 ? "+" : "") + pv.rangeMax + " \xB0C). \u0415\u0441\u043B\u0438 \u0432\u0441\u0435 \u043A\u0440\u0438\u0432\u044B\u0435 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u043F\u043E\u043B\u043E\u0441\u044B, \u044D\u0442\u043E \u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0443\u0435\u0442 \u043E \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F. \u041F\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043D\u0438\u0435 \u043A\u0440\u0438\u0432\u043E\u0439 \u0437\u0430 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435, \u0442\u0440\u0435\u0431\u0443\u044E\u0449\u0435\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430."
    );
  }
  for (const idx of pv.extIndices) {
    const l = pv.loggers[idx];
    if (!l) continue;
    drawExternalChart(
      doc,
      {
        name: shortLabel(l.label, l.customName),
        ts: l.series.ts,
        temp: l.series.temp
      },
      pv.rangeMin,
      pv.rangeMax
    );
    const externalChartText = input?.protocol?.equipmentType === "warehouse" ? `\u0413\u0440\u0430\u0444\u0438\u043A \u0432\u043D\u0435\u0448\u043D\u0435\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u0432\u043D\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F. \u042D\u0442\u043E\u0442 \u0434\u0430\u0442\u0447\u0438\u043A \u043D\u0435 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0435\u0432 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 PV, \u043D\u043E \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u043E\u0446\u0435\u043D\u0438\u0442\u044C \u0432\u043B\u0438\u044F\u043D\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u0443 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F. \u0410\u043D\u0430\u043B\u0438\u0437 \u044D\u0442\u043E\u0433\u043E \u0433\u0440\u0430\u0444\u0438\u043A\u0430 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043E\u0442\u043B\u0438\u0447\u0438\u0442\u044C \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0432\u044B\u0437\u0432\u0430\u043D\u043D\u044B\u0435 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C\u044E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043E\u0442 \u043A\u043E\u043B\u0435\u0431\u0430\u043D\u0438\u0439, \u043E\u0431\u0443\u0441\u043B\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F\u043C\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u0435.` : `\u0413\u0440\u0430\u0444\u0438\u043A \u0432\u043D\u0435\u0448\u043D\u0435\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u0432\u043D\u0435 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430. \u042D\u0442\u043E\u0442 \u0434\u0430\u0442\u0447\u0438\u043A \u043D\u0435 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0435\u0432 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 PV, \u043D\u043E \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u043E\u0446\u0435\u043D\u0438\u0442\u044C \u0432\u043B\u0438\u044F\u043D\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u0443 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F. \u0410\u043D\u0430\u043B\u0438\u0437 \u044D\u0442\u043E\u0433\u043E \u0433\u0440\u0430\u0444\u0438\u043A\u0430 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043E\u0442\u043B\u0438\u0447\u0438\u0442\u044C \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0432\u044B\u0437\u0432\u0430\u043D\u043D\u044B\u0435 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C\u044E \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430, \u043E\u0442 \u043A\u043E\u043B\u0435\u0431\u0430\u043D\u0438\u0439, \u043E\u0431\u0443\u0441\u043B\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F\u043C\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u0435.`;
    drawChartExplanation(doc, externalChartText);
  }
  if (pv.hotIdx !== null && pv.loggers[pv.hotIdx]) {
    const l = pv.loggers[pv.hotIdx];
    drawHotChart(
      doc,
      {
        name: shortLabel(l.label, l.customName),
        ts: l.series.ts,
        temp: l.series.temp
      },
      pv.rangeMin,
      pv.rangeMax
    );
    drawChartExplanation(
      doc,
      input?.protocol?.equipmentType === "warehouse" ? "\u0413\u0440\u0430\u0444\u0438\u043A \u0441\u0430\u043C\u043E\u0433\u043E \u0442\u0451\u043F\u043B\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 (\u0441 \u043D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0438\u043C \u0441\u0440\u0435\u0434\u043D\u0438\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B). \u042D\u0442\u043E\u0442 \u0434\u0430\u0442\u0447\u0438\u043A \u043E\u0431\u044B\u0447\u043D\u043E \u0440\u0430\u0441\u043F\u043E\u043B\u0430\u0433\u0430\u0435\u0442\u0441\u044F \u0432 \u0437\u043E\u043D\u0435 \u0441 \u043D\u0430\u0438\u043C\u0435\u043D\u0435\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u043C \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u0438 \u0441\u043B\u0443\u0436\u0438\u0442 \u0434\u043B\u044F \u043E\u0446\u0435\u043D\u043A\u0438 \u043D\u0430\u0438\u0445\u0443\u0434\u0448\u0438\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438. \u0414\u0430\u043D\u043D\u044B\u0435 \u044D\u0442\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u0434\u043B\u044F \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430 MKT (\u0441\u0440\u0435\u0434\u043D\u044F\u044F \u043A\u0438\u043D\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430)." : "\u0413\u0440\u0430\u0444\u0438\u043A \u0441\u0430\u043C\u043E\u0433\u043E \u0442\u0451\u043F\u043B\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 (\u0441 \u043D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0438\u043C \u0441\u0440\u0435\u0434\u043D\u0438\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B). \u042D\u0442\u043E\u0442 \u0434\u0430\u0442\u0447\u0438\u043A \u043E\u0431\u044B\u0447\u043D\u043E \u0440\u0430\u0441\u043F\u043E\u043B\u0430\u0433\u0430\u0435\u0442\u0441\u044F \u0432 \u0437\u043E\u043D\u0435 \u0441 \u043D\u0430\u0438\u043C\u0435\u043D\u0435\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u043C \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u0438 \u0441\u043B\u0443\u0436\u0438\u0442 \u0434\u043B\u044F \u043E\u0446\u0435\u043D\u043A\u0438 \u043D\u0430\u0438\u0445\u0443\u0434\u0448\u0438\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0432 \u043A\u0443\u0437\u043E\u0432\u0435. \u0414\u0430\u043D\u043D\u044B\u0435 \u044D\u0442\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u0434\u043B\u044F \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430 MKT (\u0441\u0440\u0435\u0434\u043D\u044F\u044F \u043A\u0438\u043D\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430)."
    );
  }
  if (pv.coldIdx !== null && pv.loggers[pv.coldIdx]) {
    const l = pv.loggers[pv.coldIdx];
    drawColdChart(
      doc,
      {
        name: shortLabel(l.label, l.customName),
        ts: l.series.ts,
        temp: l.series.temp
      },
      pv.rangeMin,
      pv.rangeMax
    );
    drawChartExplanation(
      doc,
      input?.protocol?.equipmentType === "warehouse" ? "\u0413\u0440\u0430\u0444\u0438\u043A \u0441\u0430\u043C\u043E\u0433\u043E \u0445\u043E\u043B\u043E\u0434\u043D\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 (\u0441 \u043D\u0430\u0438\u043C\u0435\u043D\u044C\u0448\u0438\u043C \u0441\u0440\u0435\u0434\u043D\u0438\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B). \u042D\u0442\u043E\u0442 \u0434\u0430\u0442\u0447\u0438\u043A \u0440\u0430\u0441\u043F\u043E\u043B\u0430\u0433\u0430\u0435\u0442\u0441\u044F \u0432 \u0437\u043E\u043D\u0435 \u0441 \u043D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u043C \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u0438 \u0441\u043B\u0443\u0436\u0438\u0442 \u0434\u043B\u044F \u043E\u0446\u0435\u043D\u043A\u0438 \u043D\u0430\u0438\u043B\u0443\u0447\u0448\u0438\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438. \u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u044D\u0442\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442, \u0447\u0442\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0445\u043E\u043B\u043E\u0434\u043D\u043E \u0438 \u043D\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u044F\u0435\u0442 \u0432\u0440\u0435\u0434 \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0430\u043C." : "\u0413\u0440\u0430\u0444\u0438\u043A \u0441\u0430\u043C\u043E\u0433\u043E \u0445\u043E\u043B\u043E\u0434\u043D\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 (\u0441 \u043D\u0430\u0438\u043C\u0435\u043D\u044C\u0448\u0438\u043C \u0441\u0440\u0435\u0434\u043D\u0438\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B). \u042D\u0442\u043E\u0442 \u0434\u0430\u0442\u0447\u0438\u043A \u0440\u0430\u0441\u043F\u043E\u043B\u0430\u0433\u0430\u0435\u0442\u0441\u044F \u0432 \u0437\u043E\u043D\u0435 \u0441 \u043D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u044B\u043C \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u0438 \u0441\u043B\u0443\u0436\u0438\u0442 \u0434\u043B\u044F \u043E\u0446\u0435\u043D\u043A\u0438 \u043D\u0430\u0438\u043B\u0443\u0447\u0448\u0438\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0432 \u043A\u0443\u0437\u043E\u0432\u0435. \u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u044D\u0442\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442, \u0447\u0442\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0445\u043E\u043B\u043E\u0434\u043D\u043E \u0438 \u043D\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u044F\u0435\u0442 \u0432\u0440\u0435\u0434 \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0430\u043C."
    );
  }
  if (internal.length > 0) {
    drawHeatmapChart(
      doc,
      internal.map((l) => ({
        name: shortLabel(l.label, l.customName),
        avg: l.avg
      })),
      pv.rangeMin,
      pv.rangeMax
    );
    drawChartExplanation(
      doc,
      input?.protocol?.equipmentType === "warehouse" ? "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0441\u0440\u0435\u0434\u043D\u0438\u0445 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 \u043F\u043E \u0432\u0441\u0435\u043C \u0434\u0430\u0442\u0447\u0438\u043A\u0430\u043C. \u041A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u044B\u0435 \u0441\u0442\u043E\u043B\u0431\u0446\u044B \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442 \u043D\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0441 \u0431\u043E\u043B\u0435\u0435 \u0432\u044B\u0441\u043E\u043A\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043E\u0439, \u0433\u043E\u043B\u0443\u0431\u044B\u0435 \u2014 \u043D\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0441 \u0431\u043E\u043B\u0435\u0435 \u043D\u0438\u0437\u043A\u043E\u0439, \u0430 \u0437\u0435\u043B\u0435\u043D\u044B\u0435 - \u043C\u0435\u0436\u0434\u0443 \u043D\u0438\u043C\u0438. \u042D\u0442\u043E \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E \u0432\u044B\u044F\u0432\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0435 \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u044B \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 (\u0437\u043E\u043D\u0435) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F." : "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0441\u0440\u0435\u0434\u043D\u0438\u0445 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440 \u043F\u043E \u0432\u0441\u0435\u043C \u0434\u0430\u0442\u0447\u0438\u043A\u0430\u043C. \u041A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u044B\u0435 \u0441\u0442\u043E\u043B\u0431\u0446\u044B \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442 \u043D\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0441 \u0431\u043E\u043B\u0435\u0435 \u0432\u044B\u0441\u043E\u043A\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043E\u0439, \u0433\u043E\u043B\u0443\u0431\u044B\u0435 \u2014 \u043D\u0430 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0441 \u0431\u043E\u043B\u0435\u0435 \u043D\u0438\u0437\u043A\u043E\u0439, \u0430 \u0437\u0435\u043B\u0435\u043D\u044B\u0435 - \u043C\u0435\u0436\u0434\u0443 \u043D\u0438\u043C\u0438. \u042D\u0442\u043E \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E \u0432\u044B\u044F\u0432\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0435 \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u044B \u0432 \u043A\u0443\u0437\u043E\u0432\u0435 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430."
    );
    drawStatsBarChart(
      doc,
      internal.map((l) => ({
        name: shortLabel(l.label, l.customName),
        min: l.min,
        avg: l.avg,
        max: l.max,
        mkt: l.mkt
      }))
    );
    drawChartExplanation(
      doc,
      "\u0413\u0440\u0430\u0444\u0438\u043A \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0438 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430: \u041C\u0438\u043D. (\u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0437\u0430 \u0432\u0441\u0435 \u0432\u0440\u0435\u043C\u044F \u0442\u0435\u0441\u0442\u0430), \u0421\u0440\u0435\u0434. (\u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430), \u041C\u0430\u043A\u0441. (\u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430). \u041C\u041A\u0422 (\u0441\u0440\u0435\u0434\u043D\u044F\u044F \u043A\u0438\u043D\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430) \u2014 \u044D\u0442\u043E \u0432\u0435\u0441\u043E\u0432\u0430\u044F \u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u043A\u043E\u0442\u043E\u0440\u0430\u044F \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0445\u0438\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0440\u0435\u0430\u043A\u0446\u0438\u0439 \u0434\u0435\u0433\u0440\u0430\u0434\u0430\u0446\u0438\u0438 \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u043E\u0432. \u041C\u041A\u0422 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u043C \u0434\u043B\u044F \u0444\u0430\u0440\u043C\u0430\u0446\u0435\u0432\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0438 \u0434\u043E\u043B\u0436\u0435\u043D \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u043C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435 \u0434\u043B\u044F \u0443\u0441\u043F\u0435\u0448\u043D\u043E\u0433\u043E \u043F\u0440\u043E\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F \u044D\u0442\u0430\u043F\u0430 \u041F\u0412."
    );
  }
}
function drawDeviationsSection(doc, pv) {
  const internal = pv.loggers.map((l, i) => ({ ...l, idx: i })).filter((l, i) => l.role === "internal");
  const all = internal.flatMap(
    (l) => l.deviations.map((d) => ({
      label: l.customName ? `${l.label} \xB7 ${l.customName}` : l.label,
      ...d
    }))
  );
  ensureSpace2(doc, 60);
  doc.moveDown(0.5);
  doc.fillColor(ACCENT).font("bold").fontSize(12).text("\u0417\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F");
  doc.moveDown(0.3);
  if (all.length === 0) {
    doc.fillColor(MUTED).font("body").fontSize(10).text("\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0439 \u0437\u0430 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0440\u0435\u0436\u0438\u043C\u0430 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043D\u0435 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043E.");
    doc.moveDown(0.4);
    return;
  }
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const cols = [
    { label: "\u0414\u0430\u0442\u0447\u0438\u043A", w: 0.2 },
    { label: "\u0422\u0438\u043F", w: 0.12 },
    { label: "\u041D\u0430\u0447\u0430\u043B\u043E", w: 0.22 },
    { label: "\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435", w: 0.22 },
    { label: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C", w: 0.14 },
    { label: "\u042D\u043A\u0441\u0442\u0440\u0435\u043C\u0443\u043C, \xB0C", w: 0.1 }
  ];
  ensureSpace2(doc, 26);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, w, 22).fill(ACCENT);
  doc.restore();
  let cx = left;
  doc.fillColor("white").font("bold").fontSize(9);
  cols.forEach((c) => {
    const cw = c.w * w;
    doc.text(c.label, cx + 4, y + 6, { width: cw - 8 });
    cx += cw;
  });
  doc.y = y + 22;
  all.forEach((d, idx) => {
    ensureSpace2(doc, 22);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
      doc.restore();
    }
    const cells = [
      d.label,
      d.type === "high" ? "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u0438\u0435" : "\u041F\u043E\u043D\u0438\u0436\u0435\u043D\u0438\u0435",
      fmtDate(d.start),
      fmtDate(d.end),
      fmtDuration(d.durationMs),
      d.value.toFixed(2)
    ];
    let cx2 = left;
    doc.font("body").fontSize(9).fillColor(d.type === "high" ? "#b91c1c" : "#1d4ed8");
    cells.forEach((val, i) => {
      const cw = cols[i].w * w;
      doc.text(val, cx2 + 4, ry + 6, { width: cw - 8 });
      cx2 += cw;
    });
    doc.y = ry + 22;
  });
  doc.moveDown(0.4);
}
function drawStagePVVerdict(doc, pv, input) {
  ensureSpace2(doc, 120);
  doc.moveDown(0.5);
  doc.fillColor(ACCENT).font("bold").fontSize(12).text("\u0417\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u044D\u0442\u0430\u043F\u0443 PV");
  doc.moveDown(0.3);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  let text2 = "\u0417\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u2014 \u044D\u0442\u0430\u043F \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D.";
  let bg = "#f1f5f9";
  let bd = BORDER;
  let fg = ACCENT;
  if (pv.verdict === "pass") {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    if (input?.protocol?.equipmentType === "warehouse") {
      const hotSensor = pv.hotIdx !== null ? pv.loggers[pv.hotIdx] : null;
      const coldSensor = pv.coldIdx !== null ? pv.loggers[pv.coldIdx] : null;
      const hotLabel = hotSensor ? `\u0434\u0430\u0442\u0447\u0438\u043A "${hotSensor.customName || hotSensor.label}"` : "\u0434\u0430\u0442\u0447\u0438\u043A";
      const coldLabel = coldSensor ? `\u0434\u0430\u0442\u0447\u0438\u043A "${coldSensor.customName || coldSensor.label}"` : "\u0434\u0430\u0442\u0447\u0438\u043A";
      const internalCount = pv.loggers.filter((l) => l.role === "internal").length;
      text2 = `\u0412\u0441\u0435 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B. \u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F (PV) \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E. \u0410\u043D\u0430\u043B\u0438\u0437 \u0434\u0430\u043D\u043D\u044B\u0445 ${internalCount} \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u043F\u043E\u043A\u0430\u0437\u0430\u043B \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043F\u043E \u0432\u0441\u0435\u043C\u0443 \u043E\u0431\u044A\u0451\u043C\u0443 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F. ` + (hotSensor ? `\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u0430 ${hotLabel} (\u0433\u043E\u0440\u044F\u0447\u0430\u044F \u0442\u043E\u0447\u043A\u0430). ` : "") + (coldSensor ? `\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u0430 ${coldLabel} (\u0445\u043E\u043B\u043E\u0434\u043D\u0430\u044F \u0442\u043E\u0447\u043A\u0430). ` : "") + "\u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u043A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F/\u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u0443\u0435\u0442 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435, \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u044F \u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0438 \u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0449\u0438\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0434\u043B\u044F \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 GDP/GSP.";
    } else {
      text2 = "\u0412\u0441\u0435 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u044B. \u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F (PV) \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E. \u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u0437\u043D\u0430\u043D\u043E \u043F\u0440\u0438\u0433\u043E\u0434\u043D\u044B\u043C \u0434\u043B\u044F \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0432 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435.";
    }
  } else if (pv.verdict === "fail") {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    text2 = "\u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F (PV) \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430. \u0417\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F:\n" + pv.failureReasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
  }
  const padding = 14;
  doc.font("body").fontSize(10);
  const h = Math.max(50, doc.heightOfString(text2, { width: w - padding * 2 }) + padding * 2);
  ensureSpace2(doc, h);
  const y = doc.y;
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(10).text(text2, left + padding, y + padding, {
    width: w - padding * 2
  });
  doc.y = y + h;
  doc.moveDown(0.6);
}
function drawSensorPlacementAnalysis(doc, sensors2, input) {
  const eqName = input ? getEquipmentName(input) : "\u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F";
  const eqGen = eqName.toLowerCase();
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  ensureSpace2(doc, 100);
  doc.moveDown(0.3);
  doc.fillColor(ACCENT).font("bold").fontSize(11).text("\u0410\u043D\u0430\u043B\u0438\u0437 \u0440\u0430\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u0438 \u043E\u0446\u0435\u043D\u043A\u0430 \u0440\u0438\u0441\u043A\u043E\u0432", left, doc.y, { width: w });
  doc.moveDown(0.2);
  const internals = sensors2.filter((s) => s.role === "internal");
  const externals = sensors2.filter((s) => s.role === "external");
  let analysisText = "";
  if (internals.length >= 2) {
    let hasTop = internals.some((s) => s.position === "top");
    let hasMiddle = internals.some((s) => s.position === "middle");
    let hasBottom = internals.some((s) => s.position === "bottom");
    let hasDoor = internals.some((s) => s.position === "door");
    internals.forEach((s) => {
      if ((s.position === "unset" || !s.position) && s.posY != null) {
        const pctY = Number(s.posY);
        if (pctY < 35) hasTop = true;
        else if (pctY > 65) hasBottom = true;
        else hasMiddle = true;
      }
    });
    analysisText += `\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u044B \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u043F\u043E\u0437\u0438\u0446\u0438\u044F\u0445 ${input?.protocol?.equipmentType === "warehouse" ? "\u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F" : "\u043A\u0443\u0437\u043E\u0432\u0430 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430"}: `;
    const positions = [];
    if (hasTop) positions.push("\u0432\u0435\u0440\u0445\u043D\u044F\u044F \u043F\u043E\u043B\u043A\u0430");
    if (hasMiddle) positions.push("\u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0447\u0430\u0441\u0442\u044C");
    if (hasBottom) positions.push("\u043D\u0438\u0436\u043D\u044F\u044F \u043F\u043E\u043B\u043A\u0430");
    if (hasDoor) positions.push("\u0434\u0432\u0435\u0440\u043D\u0430\u044F \u0437\u043E\u043D\u0430");
    analysisText += positions.join(", ") + ".\n\n";
    if (input?.protocol?.equipmentType === "warehouse") {
      analysisText += `\u0422\u0430\u043A\u0430\u044F \u043C\u043D\u043E\u0433\u043E\u0442\u043E\u0447\u0435\u0447\u043D\u0430\u044F \u0440\u0430\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0432\u044B\u044F\u0432\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0435 \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u044B \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0438 \u043E\u0446\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043F\u043E \u0432\u0441\u0435\u043C\u0443 \u043E\u0431\u044A\u0451\u043C\u0443 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F. \u0414\u0430\u0442\u0447\u0438\u043A\u0438 \u043D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u0439 \u0438 \u043D\u0438\u0436\u043D\u0435\u0439 \u043F\u043E\u043B\u043A\u0430\u0445 \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u044E\u0442 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u043E\u043D\u044B \u0440\u0438\u0441\u043A\u0430, \u0433\u0434\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u043E\u0437\u043D\u0438\u043A\u043D\u0443\u0442\u044C \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043E\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430. \u042D\u0442\u043E \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0432\u0430\u0436\u043D\u043E \u0434\u043B\u044F \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u044F \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0438 \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u0435\u0439 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0438\u043B\u0438 \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u043D\u0430 \u0440\u0430\u043D\u043D\u0438\u0445 \u044D\u0442\u0430\u043F\u0430\u0445.

`;
    } else {
      analysisText += `\u0422\u0430\u043A\u0430\u044F \u043C\u043D\u043E\u0433\u043E\u0442\u043E\u0447\u0435\u0447\u043D\u0430\u044F \u0440\u0430\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0432\u044B\u044F\u0432\u0438\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0435 \u0433\u0440\u0430\u0434\u0438\u0435\u043D\u0442\u044B \u0432\u043D\u0443\u0442\u0440\u0438 \u043A\u0443\u0437\u043E\u0432\u0430 \u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430 \u0438 \u043E\u0446\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u043E\u0441\u0442\u044C \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0445\u043E\u043B\u043E\u0434\u0430 \u043F\u043E \u0432\u0441\u0435\u043C\u0443 \u043E\u0431\u044A\u0451\u043C\u0443 \u043E\u0431\u044A\u0435\u043A\u0442\u0430. \u0414\u0430\u0442\u0447\u0438\u043A\u0438 \u043D\u0430 \u0432\u0435\u0440\u0445\u043D\u0435\u0439 \u0438 \u043D\u0438\u0436\u043D\u0435\u0439 \u043F\u043E\u043B\u043A\u0430\u0445 \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u044E\u0442 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0435 \u0437\u043E\u043D\u044B \u0440\u0438\u0441\u043A\u0430, \u0433\u0434\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u043E\u0437\u043D\u0438\u043A\u043D\u0443\u0442\u044C \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043E\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430. \u042D\u0442\u043E \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0432\u0430\u0436\u043D\u043E \u0434\u043B\u044F \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u044F \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0438 \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u0435\u0439 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043E\u0445\u043B\u0430\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0430 \u0440\u0430\u043D\u043D\u0438\u0445 \u044D\u0442\u0430\u043F\u0430\u0445.

`;
    }
  }
  if (externals.length > 0) {
    if (input?.protocol?.equipmentType === "warehouse") {
      analysisText += "\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A (\u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0439 \u0432\u043D\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u0437\u043E\u043D\u044B) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F) \u0441\u043B\u0443\u0436\u0438\u0442 \u0434\u043B\u044F \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u0438 \u043D\u0435 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0445 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0435\u0432 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u044D\u0442\u0430\u043F\u0430 PV. \u0414\u0430\u043D\u043D\u044B\u0435 \u0432\u043D\u0435\u0448\u043D\u0435\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0432\u043B\u0438\u044F\u043D\u0438\u044F \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u0443 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0438 \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u043F\u043E\u043B\u0435\u0437\u043D\u044B \u043F\u0440\u0438 \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0439. \u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u043E\u0442\u043B\u0438\u0447\u0438\u0442\u044C \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0432\u044B\u0437\u0432\u0430\u043D\u043D\u044B\u0435 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C\u044E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043E\u0442 \u043A\u043E\u043B\u0435\u0431\u0430\u043D\u0438\u0439, \u043E\u0431\u0443\u0441\u043B\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F\u043C\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u0435.";
    } else {
      analysisText += "\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A (\u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0439 \u0432\u043D\u0435 \u043A\u0443\u0437\u043E\u0432\u0430 \u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440\u0430) \u0441\u043B\u0443\u0436\u0438\u0442 \u0434\u043B\u044F \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u043E\u0432 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u0438 \u043D\u0435 \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043E\u0441\u043D\u043E\u0432\u043D\u044B\u0445 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u0435\u0432 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u044D\u0442\u0430\u043F\u0430 PV. \u0414\u0430\u043D\u043D\u044B\u0435 \u0432\u043D\u0435\u0448\u043D\u0435\u0433\u043E \u0434\u0430\u0442\u0447\u0438\u043A\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442\u0441\u044F \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0432\u043B\u0438\u044F\u043D\u0438\u044F \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044B \u043D\u0430 \u0440\u0430\u0431\u043E\u0442\u0443 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0438 \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u043F\u043E\u043B\u0435\u0437\u043D\u044B \u043F\u0440\u0438 \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0439. \u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u043E\u0442\u043B\u0438\u0447\u0438\u0442\u044C \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0432\u044B\u0437\u0432\u0430\u043D\u043D\u044B\u0435 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C\u044E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043E\u0442 \u043A\u043E\u043B\u0435\u0431\u0430\u043D\u0438\u0439, \u043E\u0431\u0443\u0441\u043B\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F\u043C\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u0435.";
    }
  }
  doc.font("body").fontSize(10).fillColor(ACCENT);
  doc.text(analysisText, left, doc.y, {
    width: w,
    align: "left",
    lineGap: 2
  });
  doc.moveDown(0.5);
}
function drawFinalConclusion(doc, input) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const all = [input.iq.verdict, input.oq.verdict, input.pv.verdict];
  const allPass = all.every((v) => v === "pass");
  const anyFail = all.some((v) => v === "fail");
  const lines = [
    ["\u042D\u0442\u0430\u043F IQ \u2014 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043C\u043E\u043D\u0442\u0430\u0436\u0430", verdictLabel(input.iq.verdict)],
    ["\u042D\u0442\u0430\u043F OQ \u2014 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F", verdictLabel(input.oq.verdict)],
    ["\u042D\u0442\u0430\u043F PV \u2014 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F", verdictLabel(input.pv.verdict)]
  ];
  if (input.excursion?.enabled) {
    const excVerdict = excursionVerdictLabel(input.excursion);
    lines.push(["\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 (Excursion Study)", excVerdict]);
  }
  drawKVTable(doc, lines, 280);
  let metrics = calculateAllOperationalMetrics(
    (input.pv.loggers || []).map((l) => ({ series: l.series })),
    input.pv.rangeMin,
    input.pv.rangeMax,
    input.pv.hotIdx,
    input.pv.coldIdx
  );
  if (input.excursion?.enabled) {
    const warmupMinutes = input.excursion.t1DurationSec ? Math.round(input.excursion.t1DurationSec / 60) : null;
    const doorOpeningMinutes = input.excursion.t2DurationSec ? Math.round(input.excursion.t2DurationSec / 60) : null;
    const thermalRetentionMinutes = input.excursion.t3DurationSec ? Math.round(input.excursion.t3DurationSec / 60) : null;
    metrics = {
      warmupTimeMinutes: warmupMinutes,
      doorOpeningTimeMinutes: doorOpeningMinutes,
      thermalRetentionMinutes,
      warmupDescription: warmupMinutes !== null ? `${input?.protocol?.equipmentType === "warehouse" ? "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F" : "\u0410\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440"} \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u0430 ${warmupMinutes} \u043C\u0438\u043D\u0443\u0442.` : "\u0412\u0440\u0435\u043C\u044F \u0432\u0445\u043E\u0434\u0430 \u0432 \u0440\u0435\u0436\u0438\u043C \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E.",
      doorOpeningDescription: doorOpeningMinutes !== null ? `\u0414\u0432\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u043D\u0430 \u0432\u0440\u0435\u043C\u044F \u0434\u043E ${doorOpeningMinutes} \u043C\u0438\u043D\u0443\u0442 \u0431\u0435\u0437 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430.` : "\u0412\u0440\u0435\u043C\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0434\u0432\u0435\u0440\u0438 \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E.",
      thermalRetentionDescription: thermalRetentionMinutes !== null ? `\u041F\u0440\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 ${input?.protocol?.equipmentType === "warehouse" ? "\u043E\u0431\u044A\u0435\u043A\u0442" : "\u043A\u0443\u0437\u043E\u0432"} \u0441\u043F\u043E\u0441\u043E\u0431\u0435\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 ${thermalRetentionMinutes} \u043C\u0438\u043D\u0443\u0442.` : "\u0412\u0440\u0435\u043C\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430 \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E."
    };
  }
  if (allPass) {
    doc.moveDown(0.3);
    doc.font("body").fontSize(10).fillColor(MUTED);
    doc.text("\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438:", { underline: true });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#1e293b");
    const paramTexts = [];
    if (metrics.warmupTimeMinutes !== null) {
      paramTexts.push(metrics.warmupDescription);
    }
    if (metrics.doorOpeningTimeMinutes !== null) {
      paramTexts.push(metrics.doorOpeningDescription);
    }
    if (metrics.thermalRetentionMinutes !== null) {
      paramTexts.push(metrics.thermalRetentionDescription);
    }
    if (paramTexts.length > 0) {
      const combinedText = paramTexts.join(" ");
      const left2 = PAGE_MARGIN;
      const right2 = doc.page.width - PAGE_MARGIN;
      const width = right2 - left2;
      doc.text(combinedText, left2, doc.y, { width, align: "justify" });
    }
    doc.moveDown(1.5);
  }
  let bg = "#f1f5f9";
  let bd = BORDER;
  let fg = ACCENT;
  let text2 = "\u0412\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u044F \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u041D\u0435 \u0432\u0441\u0435 \u044D\u0442\u0430\u043F\u044B \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u044B \u0443\u0441\u043F\u0435\u0448\u043D\u043E.";
  if (allPass) {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    const excNote = input.excursion?.enabled ? ` \u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u044B \u0438 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 10 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0433\u043E \u043E\u0442\u0447\u0451\u0442\u0430.` : "";
    text2 = `\u041D\u0430 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 IQ, OQ \u0438 PV \u043A\u043E\u043C\u0438\u0441\u0441\u0438\u044F \u043F\u0440\u0438\u0437\u043D\u0430\u0451\u0442 ${input.protocol?.equipmentType === "warehouse" ? "\u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 (\u0437\u043E\u043D\u0443) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F" : `\u0430\u0432\u0442\u043E\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043E\u0440 \u0441 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435\u043C \xAB${input.generalInfo?.manufacturer || ""} ${input.generalInfo?.model || ""}\xBB (\u0441\u0435\u0440. \u2116 ${input.generalInfo?.serial || "\u2014"})`} \u043F\u0440\u0438\u0433\u043E\u0434\u043D\u044B\u043C \u0434\u043B\u044F \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0432 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435 ${TEMP_MODE_LABEL[input.pv.tempMode || ""] || "\u2014"} \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 GDP / GPP. ` + (input.protocol?.equipmentType === "warehouse" ? `\u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u043A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F/\u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u043F\u043E \u0432\u0441\u0435\u043C\u0443 \u043E\u0431\u044A\u0451\u043C\u0443 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F. ` : "") + `\u0412\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430 \u0441 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0437\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C.${excNote}`;
  } else if (anyFail) {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    text2 = "\u0412\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430 \u0441 \u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0437\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C. \u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0434\u043E\u043F\u0443\u0449\u0435\u043D\u043E \u043A \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u0434\u043E \u0443\u0441\u0442\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0439 \u0438 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0445 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439.";
  }
  const padding = 14;
  doc.font("body").fontSize(11);
  const h = Math.max(70, doc.heightOfString(text2, { width: w - padding * 2 }) + padding * 2);
  ensureSpace2(doc, h);
  const y = doc.y;
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(11).text(text2, left + padding, y + padding, {
    width: w - padding * 2,
    align: "justify"
  });
  doc.y = y + h;
}
function excursionVerdictLabel(exc) {
  const tests = [
    exc.test1Enabled ? exc.t1TStableAt !== null : null,
    exc.test2Enabled ? true : null,
    // Test 2 pass = noBreak or break recorded
    exc.test3Enabled ? true : null
    // Test 3 pass = noBreak or break recorded
  ].filter((v) => v !== null);
  if (tests.length === 0) return "\u041D\u0435 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u043B\u0438\u0441\u044C";
  const t1Done = !exc.test1Enabled || exc.t1TStableAt !== null;
  const t2Done = !exc.test2Enabled || exc.t2DoorOpenAt !== null;
  const t3Done = !exc.test3Enabled || exc.t3PowerOffAt !== null;
  if (t1Done && t2Done && t3Done) return "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u044B";
  return "\u0427\u0430\u0441\u0442\u0438\u0447\u043D\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u044B";
}
function verdictLabel(v) {
  if (v === "pass") return "\u041F\u0440\u043E\u0439\u0434\u0435\u043D";
  if (v === "fail") return "\u041D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D";
  return "\u041D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D";
}
function defaultSignatories(prefix) {
  const suffix = prefix === "part1" ? "\u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430" : "\u043E\u0442\u0447\u0451\u0442\u0430";
  return [
    { role: `\u0421\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043B\u044C ${suffix}`, name: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440 \u043F\u043E \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438", position: "composer" },
    { role: `\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E\u0449\u0438\u0439 ${suffix}`, name: "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C \u043E\u0442\u0434\u0435\u043B\u0430 \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0430", position: "reviewer" },
    { role: `\u0423\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044E\u0449\u0438\u0439 ${suffix}`, name: "\u0413\u0435\u043D\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u0439 \u0434\u0438\u0440\u0435\u043A\u0442\u043E\u0440", position: "approver" }
  ];
}
function membersToSignatories(members, prefix) {
  if (!members || members.length === 0) return defaultSignatories(prefix);
  return members.map((m) => ({ role: m.role, name: m.name }));
}
function getSignatoriesPart1(input) {
  if (input.signatoriesPart1 && input.signatoriesPart1.length > 0) return input.signatoriesPart1;
  return membersToSignatories(input.generalInfo?.commissionMembers, "part1");
}
function getSignatoriesPart2(input) {
  if (input.signatoriesPart2 && input.signatoriesPart2.length > 0) return input.signatoriesPart2;
  return membersToSignatories(input.generalInfo?.commissionMembers, "part2");
}
function drawSignaturesBlock(doc, signatories, intro) {
  doc.fillColor("#1f2937").font("body").fontSize(10).text(intro, { align: "left" });
  doc.moveDown(1);
  const BLOCK_H = 120;
  signatories.forEach((m) => {
    const left = PAGE_MARGIN;
    const right = doc.page.width - PAGE_MARGIN;
    if (doc.y + BLOCK_H > doc.page.height - PAGE_MARGIN - 40) {
      doc.addPage();
      doc.y = HEADER_CONTENT_TOP;
    }
    const y = doc.y;
    doc.fillColor(MUTED).font("body").fontSize(9).text(m.role, left, y);
    doc.fillColor(ACCENT).font("bold").fontSize(11).text(m.name, left, y + 12);
    if (m.company) {
      doc.fillColor(MUTED).font("body").fontSize(9).text(m.company, left, y + 26);
    }
    doc.strokeColor(BORDER).lineWidth(0.6).moveTo(right - 220, y + 45).lineTo(right, y + 45).stroke();
    doc.fillColor(MUTED).font("body").fontSize(9).text("\u041F\u043E\u0434\u043F\u0438\u0441\u044C", right - 220, y + 48);
    doc.strokeColor(BORDER).lineWidth(0.6).moveTo(left, y + 65).lineTo(left + 160, y + 65).stroke();
    doc.fillColor(MUTED).fontSize(9).text("\u0414\u0430\u0442\u0430", left, y + 68);
    doc.y = y + BLOCK_H;
  });
}
function drawChecklistPlan(doc, items) {
  drawSubTitle(doc, "\u041F\u0435\u0440\u0435\u0447\u0435\u043D\u044C \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432");
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const numW = 30;
  const qW = right - left - numW;
  ensureSpace2(doc, 26);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, right - left, 22).fill(ACCENT);
  doc.restore();
  doc.fillColor("white").font("bold").fontSize(10);
  doc.text("\u2116", left + 6, y + 6, { width: numW - 6 });
  doc.text("\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u044B\u0439 \u0432\u043E\u043F\u0440\u043E\u0441", left + numW + 6, y + 6, { width: qW - 12 });
  doc.y = y + 22;
  items.forEach((it, idx) => {
    const padding = 6;
    doc.font("body").fontSize(10);
    const qH = doc.heightOfString(it.questionText, { width: qW - 12 });
    const rowH = Math.max(22, qH + padding * 2);
    ensureSpace2(doc, rowH);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, right - left, rowH).fill();
      doc.restore();
    }
    doc.save();
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(left, ry + rowH).lineTo(right, ry + rowH).stroke();
    doc.restore();
    doc.fillColor(ACCENT).font("body").fontSize(10).text(String(idx + 1), left + 6, ry + padding, { width: numW - 6 });
    doc.fillColor("#1f2937").font("body").fontSize(10).text(it.questionText, left + numW + 6, ry + padding, { width: qW - 12 });
    doc.y = ry + rowH;
  });
  doc.moveDown(0.4);
}
function drawPVPlan(doc, pv, input) {
  const rows = [
    ["\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C", TEMP_MODE_LABEL[pv.tempMode] || pv.tempMode],
    ...sensorAccuracyRows(pv),
    ["\u0422\u0440\u0435\u0431\u0443\u0435\u043C\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F", `\u043D\u0435 \u043C\u0435\u043D\u0435\u0435 ${pv.minDurationHours} \u0447`],
    ["\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432", String(pv.minSensorCount)],
    [
      "\u041C\u0435\u0441\u0442\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432",
      pv.sensorPlacement || (input?.protocol?.equipmentType === "warehouse" ? "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u044B \u0434\u0430\u043D\u043D\u044B\u0445 \u0441\u043B\u0435\u0434\u0443\u0435\u0442 \u0440\u0430\u0441\u043F\u043E\u043B\u0430\u0433\u0430\u0442\u044C \u0432 \u0444\u043E\u0440\u043C\u0435 \u0441\u0435\u0442\u043A\u0438 \u0438 \u0442\u0430\u043A\u0438\u043C \u043E\u0431\u0440\u0430\u0437\u043E\u043C, \u0447\u0442\u043E\u0431\u044B \u043E\u043D\u0438 \u043F\u043E\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u0437\u043E\u043D\u0443 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043F\u043E \u0432\u0441\u0435\u0439 \u0435\u0435 \u0434\u043B\u0438\u043D\u0435 \u0438 \u0448\u0438\u0440\u0438\u043D\u0435, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0432\u044B\u0441\u043E\u0442\u0435. \u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u044B \u0434\u0430\u043D\u043D\u044B\u0445 \u0440\u0430\u0437\u043C\u0435\u0449\u0430\u044E\u0442\u0441\u044F \u043F\u043E \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0441 \u0440\u0430\u0432\u043D\u044B\u043C\u0438 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u0430\u043C\u0438. \u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u2014 \u0434\u043B\u044F \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432\u043D\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F." : "\u0414\u0430\u0442\u0447\u0438\u043A\u0438 \u0440\u0430\u0441\u043F\u043E\u043B\u0430\u0433\u0430\u044E\u0442\u0441\u044F \u0432 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u044B\u0445 \u0442\u043E\u0447\u043A\u0430\u0445 \u043E\u0431\u044A\u0451\u043C\u0430 \u043A\u0443\u0437\u043E\u0432\u0430: \u043F\u043E \u0441\u0442\u0435\u043D\u0430\u043C \u0438 \u043F\u043E \u0446\u0435\u043D\u0442\u0440\u0443 \u043E\u0431\u044A\u0435\u043A\u0442\u0430. \u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u2014 \u0434\u043B\u044F \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u043E\u043A\u0440\u0443\u0436\u0430\u044E\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u0435.")
    ]
  ];
  drawKVTable(doc, rows);
}
function drawTestPeriod(doc, input) {
  const pv = input.pv;
  const durationMs = pv.startAt && pv.endAt ? pv.endAt - pv.startAt : 0;
  const rows = [
    ["\u041D\u0430\u0447\u0430\u043B\u043E \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439 (PV)", pv.startAt ? fmtDate(pv.startAt) : "\u2014"],
    ["\u041E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439 (PV)", pv.endAt ? fmtDate(pv.endAt) : "\u2014"],
    ["\u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C", durationMs ? fmtDuration(durationMs) : "\u2014"]
  ];
  drawKVTable(doc, rows);
}
function drawPlanDeviationsSection(doc, input) {
  const text2 = input.planDeviations && input.planDeviations.trim() || "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0439 \u043E\u0442 \u043F\u043B\u0430\u043D\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 \u043D\u0435 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043E. \u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u044B \u0432 \u043F\u043E\u043B\u043D\u043E\u043C \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u043C \u043F\u043B\u0430\u043D\u043E\u043C \u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 (\u0427\u0430\u0441\u0442\u044C I).";
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text2, { align: "justify" });
  doc.moveDown(0.6);
}
function drawRecommendationsSection(doc, input) {
  const all = [input.iq.verdict, input.oq.verdict, input.pv.verdict];
  const anyFail = all.some((v) => v === "fail");
  let text2 = input.recommendations && input.recommendations.trim() || "";
  if (!text2) {
    text2 = anyFail ? "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u0443\u0441\u0442\u0440\u0430\u043D\u0438\u0442\u044C \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F, \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u0443\u044E\u0449\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0438 \u043F\u0440\u043E\u0432\u0435\u0441\u0442\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0443\u044E \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044E \u043F\u043E \u044D\u0442\u0430\u043F\u0430\u043C, \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0432\u0448\u0438\u043C\u0441\u044F \u0441 \u043E\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0437\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C. \u0414\u043E \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u043B\u044F \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F." : "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u044C \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u0443\u044E \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044E \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u043C\u0438 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430\u043C\u0438 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438, \u0430 \u0442\u0430\u043A\u0436\u0435 \u043F\u0440\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438, \u0440\u0435\u043C\u043E\u043D\u0442\u0435 \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u043C\u0435\u0449\u0435\u043D\u0438\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F.";
  }
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text2, { align: "justify" });
  doc.moveDown(0.6);
}
function declenseYears(num) {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return "\u043B\u0435\u0442";
  if (lastDigit === 1) return "\u0433\u043E\u0434\u0430";
  if (lastDigit >= 2 && lastDigit <= 4) return "\u0433\u043E\u0434\u0430";
  return "\u043B\u0435\u0442";
}
function drawValiditySection(doc, input) {
  ensureSpace2(doc, 60);
  let period = input.documentValidityPeriod && input.documentValidityPeriod.trim() ? input.documentValidityPeriod.trim() : "1 \u0433\u043E\u0434\u0430";
  const numMatch = period.match(/^(\d+)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    period = `${num} ${declenseYears(num)}`;
  }
  const storedNumMatch = period.match(/^(\d+)\s+(?:год|года|лет)$/);
  if (storedNumMatch) {
    const num = parseInt(storedNumMatch[1], 10);
    period = `${num} ${declenseYears(num)}`;
  }
  const text2 = `\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u0435\u043D \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 ${period} \u0441 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u0438\u044F. \u041F\u043E \u0438\u0441\u0442\u0435\u0447\u0435\u043D\u0438\u0438 \u0441\u0440\u043E\u043A\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0439 \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u043C\u0438 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430\u043C\u0438 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438.`;
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text2, { align: "justify" });
  doc.moveDown(0.6);
}
var HEADER_CONTENT_TOP = 60;
function ensureSpace2(doc, needed) {
  const bottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + needed > bottom) {
    doc.addPage();
    doc.y = HEADER_CONTENT_TOP;
  }
}
function drawMeasurementTable(doc, loggers, samplingStepMinutes) {
  if (!loggers || loggers.length === 0) return;
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const tsSet = /* @__PURE__ */ new Set();
  for (const l of loggers) {
    for (const t2 of l.series.ts) tsSet.add(t2);
  }
  let allTs = Array.from(tsSet).sort((a, b) => a - b);
  const stepMinutes = samplingStepMinutes && samplingStepMinutes > 0 ? samplingStepMinutes : 10;
  const stepMs = stepMinutes * 6e4;
  if (allTs.length > 0) {
    const firstTs = allTs[0];
    const gridPoints = /* @__PURE__ */ new Set();
    gridPoints.add(firstTs);
    for (let i = 1; i < allTs.length; i++) {
      const offset = allTs[i] - firstTs;
      const remainder = offset % stepMs;
      if (remainder < 500 || remainder > stepMs - 500) {
        gridPoints.add(allTs[i]);
      }
    }
    allTs = Array.from(gridPoints).sort((a, b) => a - b);
  }
  if (allTs.length === 0) {
    doc.font("body").fontSize(9).fillColor(MUTED).text("\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439.");
    return;
  }
  const maps = loggers.map((l) => {
    const m = /* @__PURE__ */ new Map();
    l.series.ts.forEach((t2, i) => m.set(t2, l.series.temp[i]));
    return m;
  });
  function getInterpolatedValue(loggerIdx, ts) {
    const m = maps[loggerIdx];
    const v = m.get(ts);
    if (v !== void 0) return v;
    const logger = loggers[loggerIdx];
    let before = null;
    let after = null;
    for (let i = 0; i < logger.series.ts.length; i++) {
      const t2 = logger.series.ts[i];
      const temp = logger.series.temp[i];
      if (t2 <= ts) {
        before = { ts: t2, temp };
      } else if (t2 > ts && !after) {
        after = { ts: t2, temp };
        break;
      }
    }
    if (before && after) {
      const ratio = (ts - before.ts) / (after.ts - before.ts);
      return before.temp + (after.temp - before.temp) * ratio;
    }
    if (before) return before.temp;
    if (after) return after.temp;
    return void 0;
  }
  const tsColW = 0.18;
  const sensorColW = (1 - tsColW) / loggers.length;
  const cols = [
    { label: "\u0414\u0430\u0442\u0430 / \u0412\u0440\u0435\u043C\u044F", w: tsColW },
    ...loggers.map((l) => ({
      label: shortLabel(l.label, l.customName),
      w: sensorColW
    }))
  ];
  const ROW_H = 18;
  const HEADER_H = 26;
  function drawHeader() {
    ensureSpace2(doc, HEADER_H + ROW_H);
    const y = doc.y;
    doc.save();
    doc.rect(left, y, w, HEADER_H).fillColor(ACCENT).fill();
    doc.restore();
    let cx = left;
    doc.fillColor("white").font("bold").fontSize(6.5);
    cols.forEach((c) => {
      const cw = c.w * w;
      doc.text(c.label, cx + 3, y + 5, { width: cw - 6, lineBreak: true });
      cx += cw;
    });
    doc.y = y + HEADER_H;
  }
  drawHeader();
  const MAX_ROWS = 2e3;
  let rows = allTs;
  if (rows.length > MAX_ROWS) {
    const step = rows.length / MAX_ROWS;
    rows = Array.from({ length: MAX_ROWS }, (_, i) => rows[Math.round(i * step)]);
  }
  let rowIdx = 0;
  let pageRowCount = 0;
  const PAGE_ROWS_BEFORE_REHEADER = Math.floor((doc.page.height - doc.y - PAGE_MARGIN) / ROW_H);
  for (const ts of rows) {
    if (pageRowCount > 0 && pageRowCount % PAGE_ROWS_BEFORE_REHEADER === 0) {
      doc.addPage();
      doc.y = HEADER_CONTENT_TOP;
      drawHeader();
      pageRowCount = 0;
    }
    ensureSpace2(doc, ROW_H);
    const ry = doc.y;
    if (rowIdx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, w, ROW_H).fill();
      doc.restore();
    }
    const cells = [
      fmtDate(ts),
      ...loggers.map((_, idx) => {
        const v = getInterpolatedValue(idx, ts);
        if (v === void 0) return "\u2014";
        return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
      })
    ];
    let cx2 = left;
    doc.font("body").fontSize(7.6).fillColor(ACCENT);
    cells.forEach((val, i) => {
      const cw = cols[i].w * w;
      doc.text(val, cx2 + 3, ry + 5, { width: cw - 6, lineBreak: false });
      cx2 += cw;
    });
    doc.y = ry + ROW_H;
    rowIdx++;
    pageRowCount++;
  }
  doc.moveDown(0.5);
  if (allTs.length > MAX_ROWS) {
    doc.font("body").fontSize(7.6).fillColor(MUTED).text(`\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E ${MAX_ROWS} \u0438\u0437 ${allTs.length} \u0441\u0442\u0440\u043E\u043A (\u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u0430\u044F \u0432\u044B\u0431\u043E\u0440\u043A\u0430).`, { align: "right" });
  }
}
function drawExcursionSection(doc, excursion, rangeMin, rangeMax, sensorAccuracy) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const TIMING_LABELS = {
    before_pv: "\u0414\u043E \u044D\u0442\u0430\u043F\u0430 PV",
    after_pv: "\u041F\u043E\u0441\u043B\u0435 \u044D\u0442\u0430\u043F\u0430 PV",
    independent: "\u041D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E"
  };
  drawSectionTitle(doc, "10. \u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 (Temperature Excursion Study)");
  const enabledTests = [];
  if (excursion.test1Enabled) enabledTests.push("\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F (\u0432\u044B\u0445\u043E\u0434 \u043D\u0430 \u0440\u0435\u0436\u0438\u043C)");
  if (excursion.test2Enabled) enabledTests.push("\u041E\u0442\u043A\u0440\u044B\u0442\u0438\u0435 \u0434\u0432\u0435\u0440\u0438 (\u0432\u0440\u0435\u043C\u044F \u0434\u043E \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430)");
  if (excursion.test3Enabled) enabledTests.push("\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u0438\u0442\u0430\u043D\u0438\u044F (\u0432\u0440\u0435\u043C\u044F \u0434\u043E \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430)");
  const paramRows = [
    ["\u041E\u043A\u043D\u043E \u0437\u0430\u043F\u0438\u0441\u0438", `${excursion.recordStartAt ? fmtDate(excursion.recordStartAt) : "\u2014"} \u2013 ${excursion.recordEndAt ? fmtDate(excursion.recordEndAt) : "\u2014"}`],
    ["\u0421\u0440\u043E\u043A \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u043E PV", TIMING_LABELS[excursion.timingVsPv || ""] || excursion.timingVsPv || "\u2014"],
    ["\u041F\u0440\u043E\u0432\u043E\u0434\u0438\u043C\u044B\u0435 \u0442\u0435\u0441\u0442\u044B", enabledTests.join(", ") || "\u2014"],
    ...sensorAccuracy !== void 0 && sensorAccuracy !== null ? [
      ["\u041F\u043E\u0433\u0440\u0435\u0448\u043D\u043E\u0441\u0442\u044C \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432, \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u043C\u0430\u044F \u0432 \u0440\u0430\u0441\u0447\u0451\u0442\u0430\u0445", `\xB1${sensorAccuracy.toFixed(1)} \xB0C`],
      ["\u0420\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0430\u0432\u0430\u0440\u0438\u0439\u043D\u044B\u0445 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0439", fmtTempRange(rangeMin, rangeMax)]
    ] : []
  ];
  drawKVTable(doc, paramRows);
  if (excursion.test1Enabled) {
    ensureSpace2(doc, 80);
    doc.moveDown(0.5);
    drawSubTitle(doc, "\u0422\u0435\u0441\u0442 \u2014 \u0412\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F (\u0432\u044B\u0445\u043E\u0434 \u043D\u0430 \u0440\u0435\u0436\u0438\u043C)");
    const t1Rows = [
      ["\u041C\u043E\u043C\u0435\u043D\u0442 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F (\u0422_on)", excursion.t1PowerOnAt ? fmtDate(excursion.t1PowerOnAt) : "\u2014"],
      ["\u041C\u043E\u043C\u0435\u043D\u0442 \u0441\u0442\u0430\u0431\u0438\u043B\u0438\u0437\u0430\u0446\u0438\u0438 (\u0422_stable)", excursion.t1TStableAt ? fmtDate(excursion.t1TStableAt) : "\u2014"],
      ["\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432\u044B\u0445\u043E\u0434\u0430 \u043D\u0430 \u0440\u0435\u0436\u0438\u043C", excursion.t1DurationSec !== null ? formatDurationSec(excursion.t1DurationSec) : "\u2014"],
      ["\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A (\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u043C \u0432\u043E\u0448\u0451\u0434\u0448\u0438\u0439 \u0432 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D)", excursion.t1CriticalSensor || "\u2014"]
    ];
    drawKVTable(doc, t1Rows);
    if (excursion.t1SensorEntries && excursion.t1SensorEntries.length > 0) {
      ensureSpace2(doc, 50);
      doc.moveDown(0.3);
      doc.fillColor(MUTED).font("body").fontSize(9).text("\u0412\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u0432 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D:");
      doc.moveDown(0.2);
      const eCols = [
        { label: "\u0414\u0430\u0442\u0447\u0438\u043A", w: 0.3 },
        { label: "\u0422 \u043F\u0440\u0438 \u0432\u043A\u043B., \xB0C", w: 0.2 },
        { label: "\u0412\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u0432 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D", w: 0.3 },
        { label: "\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C", w: 0.2 }
      ];
      ensureSpace2(doc, 26);
      let ey = doc.y;
      doc.save();
      doc.rect(left, ey, w, 22).fillColor(ACCENT).fill();
      doc.restore();
      let ecx = left;
      doc.fillColor("white").font("bold").fontSize(9);
      eCols.forEach((c) => {
        doc.text(c.label, ecx + 4, ey + 6, { width: c.w * w - 8 });
        ecx += c.w * w;
      });
      doc.y = ey + 22;
      excursion.t1SensorEntries.forEach((e, idx) => {
        ensureSpace2(doc, 22);
        const ry = doc.y;
        if (idx % 2 === 0) {
          doc.save();
          doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
          doc.restore();
        }
        const cells = [
          e.label,
          e.tempAtOn.toFixed(2),
          e.entryAt ? fmtDate(e.entryAt) : "\u041D\u0435 \u0432\u043E\u0448\u0451\u043B",
          e.durationSec !== null ? formatDurationSec(e.durationSec) : "\u2014"
        ];
        let ecx2 = left;
        doc.font("body").fontSize(9).fillColor(ACCENT);
        cells.forEach((val, i) => {
          doc.text(val, ecx2 + 4, ry + 6, { width: eCols[i].w * w - 8 });
          ecx2 += eCols[i].w * w;
        });
        doc.y = ry + 22;
      });
      doc.moveDown(0.4);
    }
    drawExcursionTestVerdict(
      doc,
      excursion.t1TStableAt !== null,
      excursion.t1TStableAt !== null ? `\u0422\u0435\u0441\u0442 \u043F\u0440\u043E\u0439\u0434\u0435\u043D \u0443\u0441\u043F\u0435\u0448\u043D\u043E. \u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u044B\u0448\u043B\u043E \u043D\u0430 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u0430 ${formatDurationSec(excursion.t1DurationSec)} \u043F\u043E\u0441\u043B\u0435 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F. \u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A (\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u043C \u0432\u043E\u0448\u0435\u0434\u0448\u0438\u0439 \u0432 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D): ${excursion.t1CriticalSensor || "\u2014"}.` : `\u0422\u0435\u0441\u0442 \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \u043D\u0435 \u0432\u0441\u0435 \u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0432\u043E\u0448\u043B\u0438 \u0432 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u0437\u0430\u043F\u0438\u0441\u0438.`
    );
  }
  if (excursion.test2Enabled) {
    ensureSpace2(doc, 80);
    doc.moveDown(0.5);
    drawSubTitle(doc, "\u0422\u0435\u0441\u0442 \u2014 \u041E\u0442\u043A\u0440\u044B\u0442\u0438\u0435 \u0434\u0432\u0435\u0440\u0438 (\u0432\u0440\u0435\u043C\u044F \u0434\u043E \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430)");
    const t2Rows = [
      ["\u041E\u0442\u043A\u0440\u044B\u0442\u0438\u0435 \u0434\u0432\u0435\u0440\u0438", excursion.t2DoorOpenAt ? fmtDate(excursion.t2DoorOpenAt) : "\u2014"],
      ["\u0417\u0430\u043A\u0440\u044B\u0442\u0438\u0435 \u0434\u0432\u0435\u0440\u0438", excursion.t2DoorCloseAt ? fmtDate(excursion.t2DoorCloseAt) : "\u2014"],
      ["\u041C\u043E\u043C\u0435\u043D\u0442 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430 (\u043F\u0435\u0440\u0432\u044B\u0439 \u0434\u0430\u0442\u0447\u0438\u043A)", excursion.t2NoBreak ? "\u041D\u0435 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043E" : excursion.t2TBreakAt ? fmtDate(excursion.t2TBreakAt) : "\u2014"],
      ["\u0412\u0440\u0435\u043C\u044F \u0434\u043E \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430 (\u043F\u0435\u0440\u0432\u044B\u0439 \u0434\u0430\u0442\u0447\u0438\u043A)", excursion.t2NoBreak ? "\u0420\u0435\u0436\u0438\u043C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D" : excursion.t2DurationSec !== null ? formatDurationSec(excursion.t2DurationSec) : "\u2014"],
      ["\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A (\u043F\u0435\u0440\u0432\u044B\u043C \u0432\u044B\u0448\u0435\u0434\u0448\u0438\u0439 \u0438\u0437 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430)", excursion.t2NoBreak ? "\u2014" : excursion.t2CriticalSensor || "\u2014"]
    ];
    drawKVTable(doc, t2Rows);
    if (!excursion.t2NoBreak && excursion.t2SensorBreaks && excursion.t2SensorBreaks.length > 0) {
      ensureSpace2(doc, 50);
      doc.moveDown(0.3);
      doc.fillColor(MUTED).font("body").fontSize(9).text("\u0412\u044B\u0445\u043E\u0434 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 (\u043F\u043E \u043A\u0430\u0436\u0434\u043E\u043C\u0443 \u0434\u0430\u0442\u0447\u0438\u043A\u0443):");
      doc.moveDown(0.2);
      const bCols2 = [
        { label: "\u0414\u0430\u0442\u0447\u0438\u043A", w: 0.3 },
        { label: "\u041C\u043E\u043C\u0435\u043D\u0442 \u0432\u044B\u0445\u043E\u0434\u0430", w: 0.4 },
        { label: "\u0412\u0440\u0435\u043C\u044F \u0434\u043E \u0432\u044B\u0445\u043E\u0434\u0430", w: 0.3 }
      ];
      ensureSpace2(doc, 26);
      let by2 = doc.y;
      doc.save();
      doc.rect(left, by2, w, 22).fillColor(ACCENT).fill();
      doc.restore();
      let bcx2 = left;
      doc.fillColor("white").font("bold").fontSize(9);
      bCols2.forEach((c) => {
        doc.text(c.label, bcx2 + 4, by2 + 6, { width: c.w * w - 8 });
        bcx2 += c.w * w;
      });
      doc.y = by2 + 22;
      excursion.t2SensorBreaks.forEach((sb, idx) => {
        ensureSpace2(doc, 22);
        const ry = doc.y;
        if (idx % 2 === 0) {
          doc.save();
          doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
          doc.restore();
        }
        const cells2 = [
          sb.label,
          sb.tBreakAt ? fmtDate(sb.tBreakAt) : "\u041D\u0435 \u0432\u044B\u0448\u0435\u043B",
          sb.durationSec !== null ? formatDurationSec(sb.durationSec) : "\u2014"
        ];
        let bcx3 = left;
        doc.font("body").fontSize(9).fillColor(ACCENT);
        cells2.forEach((val, i) => {
          doc.text(val, bcx3 + 4, ry + 6, { width: bCols2[i].w * w - 8 });
          bcx3 += bCols2[i].w * w;
        });
        doc.y = ry + 22;
      });
      doc.moveDown(0.4);
    }
    const t2Message = excursion.t2NoBreak ? (() => {
      const doorDurationSec = (excursion.t2DoorCloseAt ?? 0) - (excursion.t2DoorOpenAt ?? 0);
      const doorDurationMin = Math.round(doorDurationSec / 1e3 / 60);
      return `\u0422\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439 \u0434\u0432\u0435\u0440\u0438 (${doorDurationMin} \u043C\u0438\u043D).`;
    })() : `\u0422\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \u043F\u0435\u0440\u0432\u044B\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u0432\u044B\u0448\u0435\u043B \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u0447\u0435\u0440\u0435\u0437 ${formatDurationSec(excursion.t2DurationSec)} \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F \u0434\u0432\u0435\u0440\u0438. \u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A: ${excursion.t2CriticalSensor || "\u2014"}.`;
    drawExcursionTestVerdict(
      doc,
      true,
      // Test 2 always has a result (either break or no-break)
      t2Message
    );
  }
  if (excursion.test3Enabled) {
    ensureSpace2(doc, 80);
    doc.moveDown(0.5);
    drawSubTitle(doc, "\u0422\u0435\u0441\u0442 \u2014 \u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u0438\u0442\u0430\u043D\u0438\u044F (\u0432\u0440\u0435\u043C\u044F \u0434\u043E \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430)");
    const t3Rows = [
      ["\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043F\u0438\u0442\u0430\u043D\u0438\u044F", excursion.t3PowerOffAt ? fmtDate(excursion.t3PowerOffAt) : "\u2014"],
      ["\u041C\u043E\u043C\u0435\u043D\u0442 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430 (\u043F\u0435\u0440\u0432\u044B\u0439 \u0434\u0430\u0442\u0447\u0438\u043A)", excursion.t3NoBreak ? "\u041D\u0435 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043E" : excursion.t3TBreakAt ? fmtDate(excursion.t3TBreakAt) : "\u2014"],
      ["\u0412\u0440\u0435\u043C\u044F \u0434\u043E \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0440\u0435\u0436\u0438\u043C\u0430 (\u043F\u0435\u0440\u0432\u044B\u0439 \u0434\u0430\u0442\u0447\u0438\u043A)", excursion.t3NoBreak ? "\u0420\u0435\u0436\u0438\u043C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D" : excursion.t3DurationSec !== null ? formatDurationSec(excursion.t3DurationSec) : "\u2014"],
      ["\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A (\u043F\u0435\u0440\u0432\u044B\u043C \u0432\u044B\u0448\u0435\u0434\u0448\u0438\u0439 \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B)", excursion.t3NoBreak ? "\u2014" : excursion.t3CriticalSensor || "\u2014"]
    ];
    drawKVTable(doc, t3Rows);
    if (!excursion.t3NoBreak && excursion.t3SensorBreaks && excursion.t3SensorBreaks.length > 0) {
      ensureSpace2(doc, 50);
      doc.moveDown(0.3);
      doc.fillColor(MUTED).font("body").fontSize(9).text("\u0412\u044B\u0445\u043E\u0434 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 (\u043F\u043E \u043A\u0430\u0436\u0434\u043E\u043C\u0443 \u0434\u0430\u0442\u0447\u0438\u043A\u0443):");
      doc.moveDown(0.2);
      const bCols3 = [
        { label: "\u0414\u0430\u0442\u0447\u0438\u043A", w: 0.3 },
        { label: "\u041C\u043E\u043C\u0435\u043D\u0442 \u0432\u044B\u0445\u043E\u0434\u0430", w: 0.4 },
        { label: "\u0412\u0440\u0435\u043C\u044F \u0434\u043E \u0432\u044B\u0445\u043E\u0434\u0430", w: 0.3 }
      ];
      ensureSpace2(doc, 26);
      let by3 = doc.y;
      doc.save();
      doc.rect(left, by3, w, 22).fillColor(ACCENT).fill();
      doc.restore();
      let bcx3h = left;
      doc.fillColor("white").font("bold").fontSize(9);
      bCols3.forEach((c) => {
        doc.text(c.label, bcx3h + 4, by3 + 6, { width: c.w * w - 8 });
        bcx3h += c.w * w;
      });
      doc.y = by3 + 22;
      excursion.t3SensorBreaks.forEach((sb, idx) => {
        ensureSpace2(doc, 22);
        const ry = doc.y;
        if (idx % 2 === 0) {
          doc.save();
          doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
          doc.restore();
        }
        const cells3 = [
          sb.label,
          sb.tBreakAt ? fmtDate(sb.tBreakAt) : "\u041D\u0435 \u0432\u044B\u0448\u0435\u043B",
          sb.durationSec !== null ? formatDurationSec(sb.durationSec) : "\u2014"
        ];
        let bcx3v = left;
        doc.font("body").fontSize(9).fillColor(ACCENT);
        cells3.forEach((val, i) => {
          doc.text(val, bcx3v + 4, ry + 6, { width: bCols3[i].w * w - 8 });
          bcx3v += bCols3[i].w * w;
        });
        doc.y = ry + 22;
      });
      doc.moveDown(0.4);
    }
    const t3Message = excursion.t3NoBreak ? (() => {
      const endTs = excursion.t3TestEndAt ?? excursion.recordEndAt;
      if (excursion.t3PowerOffAt != null && endTs != null) {
        const observationDurationMin = Math.round((endTs - excursion.t3PowerOffAt) / 1e3 / 60);
        return `\u0422\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043F\u0438\u0442\u0430\u043D\u0438\u044F (${observationDurationMin} \u043C\u0438\u043D).`;
      }
      return "\u0422\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043F\u0438\u0442\u0430\u043D\u0438\u044F \u0434\u043E \u043A\u043E\u043D\u0446\u0430 \u043E\u043A\u043D\u0430 \u0437\u0430\u043F\u0438\u0441\u0438.";
    })() : `\u0422\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D: \u043F\u0435\u0440\u0432\u044B\u0439 \u0434\u0430\u0442\u0447\u0438\u043A \u0432\u044B\u0448\u0435\u043B \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 \u0447\u0435\u0440\u0435\u0437 ${formatDurationSec(excursion.t3DurationSec)} \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u043F\u0438\u0442\u0430\u043D\u0438\u044F. \u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043A: ${excursion.t3CriticalSensor || "\u2014"}.`;
    drawExcursionTestVerdict(
      doc,
      true,
      t3Message
    );
  }
  if (excursion.loggers.length > 0) {
    ensureSpace2(doc, 60);
    doc.moveDown(0.5);
    drawSubTitle(doc, "\u0413\u0440\u0430\u0444\u0438\u043A \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B");
    const recStart = excursion.recordStartAt;
    const recEnd = excursion.recordEndAt;
    const chartSeries = excursion.loggers.map((l) => {
      if (recStart === null && recEnd === null) {
        return { name: shortLabel(l.label), ts: l.series.ts, temp: l.series.temp };
      }
      const filteredTs = [];
      const filteredTemp = [];
      l.series.ts.forEach((t2, i) => {
        if ((recStart === null || t2 >= recStart) && (recEnd === null || t2 <= recEnd)) {
          filteredTs.push(t2);
          filteredTemp.push(l.series.temp[i]);
        }
      });
      return { name: shortLabel(l.label), ts: filteredTs, temp: filteredTemp };
    });
    const markers = [];
    if (excursion.test1Enabled && excursion.t1PowerOnAt) {
      markers.push({ ts: excursion.t1PowerOnAt, label: "\u0412\u043A\u043B.", color: "#16a34a" });
    }
    if (excursion.test1Enabled && excursion.t1TStableAt) {
      markers.push({ ts: excursion.t1TStableAt, label: "\u0421\u0442\u0430\u0431.", color: "#15803d" });
    }
    if (excursion.test2Enabled && excursion.t2DoorOpenAt) {
      markers.push({ ts: excursion.t2DoorOpenAt, label: "\u0414\u0432\u0435\u0440\u044C\u2197", color: "#d97706" });
    }
    if (excursion.test2Enabled && excursion.t2DoorCloseAt) {
      markers.push({ ts: excursion.t2DoorCloseAt, label: "\u0414\u0432\u0435\u0440\u044C\u2198", color: "#92400e" });
    }
    if (excursion.test3Enabled && excursion.t3PowerOffAt) {
      markers.push({ ts: excursion.t3PowerOffAt, label: "\u041E\u0442\u043A\u043B.", color: "#dc2626" });
    }
    drawExcursionChart(doc, chartSeries, rangeMin, rangeMax, markers);
  }
  const realWarnings = (excursion.warnings ?? []).filter((w2) => !w2.startsWith("[INFO]"));
  if (realWarnings.length > 0) {
    ensureSpace2(doc, 60);
    doc.moveDown(0.5);
    doc.fillColor(ACCENT).font("bold").fontSize(11).text("\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F");
    doc.moveDown(0.3);
    const padding = 14;
    const warnText = realWarnings.map((warn, i) => `${i + 1}. ${warn}`).join("\n");
    doc.font("body").fontSize(10);
    const warnH = Math.max(50, doc.heightOfString(warnText, { width: w - padding * 2 }) + padding * 2);
    ensureSpace2(doc, warnH);
    const wy = doc.y;
    doc.save();
    doc.lineWidth(0.7).fillColor("#fffbeb").strokeColor("#fcd34d").roundedRect(left, wy, w, warnH, 6).fillAndStroke();
    doc.restore();
    doc.fillColor("#92400e").font("body").fontSize(10).text(warnText, left + padding, wy + padding, { width: w - padding * 2 });
    doc.y = wy + warnH;
    doc.moveDown(0.6);
  }
  const allLoggers = excursion.loggers;
  if (allLoggers.length > 0) {
    const startMs = excursion.recordStartAt;
    const endMs = excursion.recordEndAt;
    const floorToMin = (ms) => Math.floor(ms / 6e4) * 6e4;
    const minuteMaps = allLoggers.map((l) => {
      const m = /* @__PURE__ */ new Map();
      l.series.ts.forEach((t2, i) => {
        if ((startMs === null || t2 >= startMs) && (endMs === null || t2 <= endMs)) {
          m.set(floorToMin(t2), l.series.temp[i]);
        }
      });
      return m;
    });
    const minuteSet = /* @__PURE__ */ new Set();
    allLoggers.forEach((l) => {
      l.series.ts.forEach((t2) => {
        if ((startMs === null || t2 >= startMs) && (endMs === null || t2 <= endMs)) {
          minuteSet.add(floorToMin(t2));
        }
      });
    });
    const sortedMinutes = Array.from(minuteSet).sort((a, b) => a - b);
    if (sortedMinutes.length > 0) {
      ensureSpace2(doc, 80);
      doc.moveDown(1.5);
      doc.x = left;
      drawSubTitle(doc, "\u0422\u0430\u0431\u043B\u0438\u0447\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B");
      doc.x = left;
      doc.fillColor(MUTED).font("body").fontSize(9).text(`\u041F\u0435\u0440\u0438\u043E\u0434: ${startMs ? fmtDate(startMs) : "\u2014"} \u2013 ${endMs ? fmtDate(endMs) : "\u2014"}  |  \u0422\u043E\u0447\u0435\u043A: ${sortedMinutes.length}  |  \u0414\u0430\u0442\u0447\u0438\u043A\u043E\u0432: ${allLoggers.length}`, { width: w });
      doc.moveDown(0.3);
      const tsColFrac = 0.18;
      const sensorColFrac = (1 - tsColFrac) / allLoggers.length;
      const exCols = [
        { label: "\u0414\u0430\u0442\u0430 / \u0412\u0440\u0435\u043C\u044F", frac: tsColFrac },
        ...allLoggers.map((l) => ({ label: shortLabel(l.label), frac: sensorColFrac }))
      ];
      const ROW_H = 18;
      const HEADER_H = 26;
      const drawExHeader = () => {
        ensureSpace2(doc, HEADER_H + ROW_H);
        const hy = doc.y;
        doc.save();
        doc.rect(left, hy, w, HEADER_H).fillColor(ACCENT).fill();
        doc.restore();
        let cx = left;
        doc.fillColor("white").font("bold").fontSize(6.5);
        exCols.forEach((c) => {
          const cw = c.frac * w;
          doc.text(c.label, cx + 3, hy + 5, { width: cw - 6, lineBreak: true });
          cx += cw;
        });
        doc.y = hy + HEADER_H;
      };
      drawExHeader();
      const getExcursionInterpolatedValue = (loggerIdx, ts) => {
        const logger = allLoggers[loggerIdx];
        const m = minuteMaps[loggerIdx];
        const v = m.get(ts);
        if (v !== void 0) return v;
        let before = null;
        let after = null;
        for (let i = 0; i < logger.series.ts.length; i++) {
          const t2 = logger.series.ts[i];
          const temp = logger.series.temp[i];
          if ((startMs === null || t2 >= startMs) && (endMs === null || t2 <= endMs)) {
            if (t2 <= ts) {
              before = { ts: t2, temp };
            } else if (t2 > ts && !after) {
              after = { ts: t2, temp };
              break;
            }
          }
        }
        if (before && after) {
          const ratio = (ts - before.ts) / (after.ts - before.ts);
          return before.temp + (after.temp - before.temp) * ratio;
        }
        if (before) return before.temp;
        if (after) return after.temp;
        return void 0;
      };
      const MAX_ROWS = 2e3;
      let rows = sortedMinutes;
      if (rows.length > MAX_ROWS) {
        const step = rows.length / MAX_ROWS;
        rows = Array.from({ length: MAX_ROWS }, (_, i) => rows[Math.round(i * step)]);
      }
      let rowIdx = 0;
      for (const ts of rows) {
        const bottom = doc.page.height - PAGE_MARGIN;
        if (doc.y + ROW_H > bottom) {
          doc.addPage();
          doc.y = HEADER_CONTENT_TOP;
          drawExHeader();
        }
        const ry = doc.y;
        if (rowIdx % 2 === 0) {
          doc.save();
          doc.fillColor(SOFT_BG).rect(left, ry, w, ROW_H).fill();
          doc.restore();
        }
        const cells = [
          fmtDate(ts),
          ...allLoggers.map((_, idx) => {
            const v = getExcursionInterpolatedValue(idx, ts);
            if (v === void 0) return "\u2014";
            return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
          })
        ];
        let cx2 = left;
        doc.font("body").fontSize(7.6).fillColor(ACCENT);
        cells.forEach((val, i) => {
          const cw = exCols[i].frac * w;
          doc.text(val, cx2 + 3, ry + 5, { width: cw - 6, lineBreak: false });
          cx2 += cw;
        });
        doc.y = ry + ROW_H;
        rowIdx++;
      }
      doc.moveDown(0.5);
      if (sortedMinutes.length > MAX_ROWS) {
        doc.font("body").fontSize(7.6).fillColor(MUTED).text(`\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u043E ${MAX_ROWS} \u0438\u0437 ${sortedMinutes.length} \u0441\u0442\u0440\u043E\u043A (\u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u0430\u044F \u0432\u044B\u0431\u043E\u0440\u043A\u0430).`, { align: "right" });
      }
    }
  }
}
function formatDurationSec(sec) {
  if (sec === null || sec === void 0) return "\u2014";
  const totalMinutes = Math.floor(sec / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h} \u0447 ${m} \u043C\u0438\u043D`;
  return `${m} \u043C\u0438\u043D`;
}
function drawExcursionTestVerdict(doc, passed, text2) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const padding = 12;
  doc.font("body").fontSize(10);
  const h = Math.max(44, doc.heightOfString(text2, { width: w - padding * 2 }) + padding * 2);
  ensureSpace2(doc, h + 8);
  doc.moveDown(0.3);
  const y = doc.y;
  const bg = passed ? "#ecfdf5" : "#fef2f2";
  const bd = passed ? "#a7f3d0" : "#fecaca";
  const fg = passed ? "#065f46" : "#991b1b";
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(10).text(text2, left + padding, y + padding, { width: w - padding * 2 });
  doc.y = y + h;
  doc.moveDown(0.5);
}
function drawChartExplanation(doc, text2) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const padding = 10;
  ensureSpace2(doc, 40);
  doc.moveDown(0.2);
  doc.font("body").fontSize(9).fillColor(MUTED);
  doc.text(text2, left, doc.y, {
    width: w,
    align: "left",
    lineGap: 1.5
  });
  doc.moveDown(0.3);
}
function drawCalibrationPage(doc) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const contentW = right - left;
  drawSectionTitle(doc, "16. \u041F\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439");
  const y0 = doc.y + 8;
  doc.font("body").fontSize(10).fillColor(ACCENT).text(
    "\u0421\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439 (\u0434\u0430\u0442\u0447\u0438\u043A\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B), \u043F\u0440\u0438\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u0440\u0438 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0438 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438, \u043F\u0440\u043E\u0448\u043B\u0438 \u043C\u0435\u0442\u0440\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u043F\u043E\u0432\u0435\u0440\u043A\u0443 (\u043A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u043A\u0443) \u0432 \u0430\u043A\u043A\u0440\u0435\u0434\u0438\u0442\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u043B\u0430\u0431\u043E\u0440\u0430\u0442\u043E\u0440\u0438\u0438. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u043E\u0432\u0435\u0440\u043A\u0435 \u0438 \u0434\u0430\u0442\u0435 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u043F\u043E\u0432\u0435\u0440\u043A\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u043F\u043E QR-\u043A\u043E\u0434\u0443, \u0440\u0430\u0437\u043C\u0435\u0449\u0451\u043D\u043D\u043E\u043C\u0443 \u043D\u0438\u0436\u0435.",
    left,
    y0,
    { width: contentW, align: "justify" }
  );
  doc.moveDown(1.2);
  const qrSize = 130;
  const qrX = doc.page.width / 2 - qrSize / 2;
  const qrY = doc.y;
  const assetCandidates = [
    path3.resolve(__dirname, "assets/qr_calibration.png"),
    path3.join(process.cwd(), "dist", "assets", "qr_calibration.png"),
    path3.join(process.cwd(), "server", "assets", "qr_calibration.png")
  ];
  let qrLoaded = false;
  for (const p of assetCandidates) {
    if (fs2.existsSync(p)) {
      try {
        doc.image(p, qrX, qrY, { width: qrSize, height: qrSize });
        qrLoaded = true;
        break;
      } catch (_) {
      }
    }
  }
  if (!qrLoaded) {
    doc.rect(qrX, qrY, qrSize, qrSize).strokeColor(BORDER).lineWidth(1).stroke();
    doc.font("body").fontSize(8).fillColor(MUTED).text("QR-\u043A\u043E\u0434", qrX, qrY + qrSize / 2 - 5, { width: qrSize, align: "center" });
  }
  doc.moveDown(0.5);
  const afterQr = qrY + qrSize + 8;
  doc.font("body").fontSize(8).fillColor(MUTED).text(
    "\u041E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 QR-\u043A\u043E\u0434 \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u044B\u0445 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u0439 \u043E \u043F\u043E\u0432\u0435\u0440\u043A\u0435 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432",
    left,
    afterQr,
    { width: contentW, align: "center" }
  );
  doc.moveDown(2);
  const boxY = doc.y;
  const boxH = 130;
  doc.roundedRect(left, boxY, contentW, boxH, 6).fillColor("#F0F7FF").fill();
  doc.roundedRect(left, boxY, contentW, boxH, 6).strokeColor(ACCENT).lineWidth(0.8).stroke();
  const boxPad = 40;
  doc.font("bold").fontSize(9).fillColor(ACCENT).text("\u0417\u0430\u043F\u0440\u043E\u0441 \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0432 \u043A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u043A\u0438 / \u043F\u043E\u0432\u0435\u0440\u043A\u0438", left + boxPad, boxY + boxPad, {
    width: contentW - boxPad * 2
  });
  doc.moveDown(0.4);
  doc.font("body").fontSize(9).fillColor(ACCENT).text(
    "\u0414\u043B\u044F \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u043E\u0440\u0438\u0433\u0438\u043D\u0430\u043B\u043E\u0432 \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0432 \u043A\u0430\u043B\u0438\u0431\u0440\u043E\u0432\u043A\u0438 \u0438\u043B\u0438 \u043F\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E \u043D\u0430\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u043F\u043E \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443:",
    left + boxPad,
    doc.y,
    { width: contentW - boxPad * 2 }
  );
  doc.moveDown(0.3);
  doc.font("bold").fontSize(10).fillColor(ACCENT).text("+7 (700) 935-15-15", left + boxPad, doc.y, {
    width: contentW - boxPad * 2,
    align: "center"
  });
  doc.font("body").fontSize(8).fillColor(MUTED).text("\u0422\u041E\u041E \xABGxP Training\xBB \xB7 www.gxp.kz \xB7 info@gxp.kz", left + boxPad, doc.y + 2, {
    width: contentW - boxPad * 2,
    align: "center"
  });
}
function addHeadersAndFooters(doc, input) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  doc.switchToPage(range.start + total - 1);
  doc.font("body").fontSize(8);
  const protocolLabel = `\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B ${input.protocol.number}`;
  const encodeForPage = (text2) => {
    const glyphs = doc._font.encode(text2)[0];
    return "<" + glyphs.join("") + ">";
  };
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    doc.font("body").fontSize(8);
    const page = doc.page;
    const left = PAGE_MARGIN;
    const right = doc.page.width - PAGE_MARGIN;
    const pageH = doc.page.height;
    const fontName = doc._font.id;
    const writeText = (text2, x, pdfY) => {
      if (!fontName) return;
      page.write("BT");
      page.write("/" + fontName + " 8 Tf");
      page.write("0.392 0.455 0.545 rg");
      page.write("1 0 0 -1 " + x.toFixed(2) + " " + pdfY.toFixed(2) + " Tm");
      page.write(encodeForPage(text2) + " Tj");
      page.write("ET");
    };
    if (i > 0) {
      const headerLineY = pageH - 38;
      page.write("q");
      page.write("0.886 0.910 0.941 RG");
      page.write("0.4 w");
      page.write(left.toFixed(2) + " " + headerLineY.toFixed(2) + " m");
      page.write(right.toFixed(2) + " " + headerLineY.toFixed(2) + " l");
      page.write("S");
      page.write("Q");
      writeText(input.org.name, left, 24);
      const protoW = doc.widthOfString(protocolLabel);
      writeText(protocolLabel, right - protoW, 24);
    }
    page.write("q");
    page.write("0.886 0.910 0.941 RG");
    page.write("0.4 w");
    page.write(left.toFixed(2) + " 36 m");
    page.write(right.toFixed(2) + " 36 l");
    page.write("S");
    page.write("Q");
    const pageLabel = `\u0421\u0442\u0440. ${i + 1} \u0438\u0437 ${total}`;
    const pageLabelW = doc.widthOfString(pageLabel);
    const centerX = left + (right - left) / 2 - pageLabelW / 2;
    writeText(pageLabel, centerX, pageH - 24);
  }
}
function drawWarehousePlanDiagram(doc, input, template, title) {
  const gi = input.generalInfo;
  const lengthM = input.pvRoomLengthM ?? (gi?.whLengthM ? Number(gi.whLengthM) : 0);
  const widthM = input.pvRoomWidthM ?? (gi?.whWidthM ? Number(gi.whWidthM) : 0);
  const heightM = input.pvRoomHeightM ?? (gi?.whHeightM ? Number(gi.whHeightM) : 0);
  const calc = computeWarehouseSensorCount({
    lengthM,
    widthM,
    heightM,
    externalEnv: !!gi?.whExternalEnv
  });
  drawSubTitle(doc, title);
  if (input.planImageUrl) {
    const pageLeft2 = PAGE_MARGIN;
    const usableW2 = doc.page.width - PAGE_MARGIN * 2;
    const imgMaxH = 448;
    ensureSpace2(doc, imgMaxH + 20);
    try {
      const imgY = doc.y + 8;
      doc.image(input.planImageUrl, pageLeft2, imgY, {
        fit: [usableW2, imgMaxH],
        align: "center"
      });
      doc.y = imgY + imgMaxH + 12;
    } catch (_e) {
      doc.fillColor(MUTED).font("body").fontSize(9).text("[\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u0445\u0435\u043C\u044B \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u2014 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0432\u0435\u043A\u0442\u043E\u0440\u043D\u044B\u0439 \u0440\u0438\u0441\u0443\u043D\u043E\u043A]");
      doc.moveDown(0.3);
    }
    {
      const floorObjs2 = input.floorPlanObjects ?? [];
      const sensorRows2 = [];
      for (const obj of floorObjs2) {
        const sensors2 = (obj.sensors ?? []).filter((s) => s.sensorId && s.sensorId.trim());
        for (const s of sensors2) {
          sensorRows2.push({
            objLabel: obj.label || obj.type,
            sensorId: s.sensorId.trim(),
            heightFromFloor: s.heightFromFloor > 0 ? s.heightFromFloor.toFixed(2) : "\u2014"
          });
        }
      }
      if (sensorRows2.length > 0) {
        ensureSpace2(doc, sensorRows2.length * 16 + 50);
        doc.moveDown(0.5);
        doc.fillColor(ACCENT).font("bold").fontSize(9).text("\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432", { align: "left" });
        doc.moveDown(0.3);
        const tL2 = PAGE_MARGIN;
        const cW2 = [200, 180, 150];
        const tR2 = tL2 + cW2.reduce((a, b) => a + b, 0);
        const rH2 = 16;
        let ty2 = doc.y;
        doc.save();
        doc.fillColor("#f1f5f9").rect(tL2, ty2, tR2 - tL2, rH2).fill();
        doc.strokeColor("#cbd5e1").lineWidth(0.5).rect(tL2, ty2, tR2 - tL2, rH2).stroke();
        let tx2 = tL2;
        ["\u041E\u0431\u044A\u0435\u043A\u0442 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F", "ID \u0434\u0430\u0442\u0447\u0438\u043A\u0430", "\u0412\u044B\u0441\u043E\u0442\u0430 \u043E\u0442 \u043F\u043E\u043B\u0430, \u043C"].forEach((h, i) => {
          doc.fillColor(ACCENT).font("bold").fontSize(8).text(h, tx2 + 4, ty2 + 4, { width: cW2[i] - 8, align: "left" });
          tx2 += cW2[i];
        });
        ty2 += rH2;
        sensorRows2.forEach((row, ri) => {
          const bg = ri % 2 === 0 ? "white" : "#f8fafc";
          doc.save();
          doc.fillColor(bg).rect(tL2, ty2, tR2 - tL2, rH2).fill();
          doc.strokeColor("#e2e8f0").lineWidth(0.4).rect(tL2, ty2, tR2 - tL2, rH2).stroke();
          doc.restore();
          [row.objLabel, row.sensorId, row.heightFromFloor].forEach((cell, i) => {
            doc.fillColor(ACCENT).font("body").fontSize(8).text(cell, tL2 + cW2.slice(0, i).reduce((a, b) => a + b, 0) + 4, ty2 + 4, { width: cW2[i] - 8, align: i === 2 ? "center" : "left" });
          });
          ty2 += rH2;
        });
        doc.restore();
        doc.y = ty2 + 6;
      }
    }
    return;
  }
  if (calc.total === 0) {
    doc.fillColor(MUTED).font("body").fontSize(10).text(
      "\u0420\u0430\u0437\u043C\u0435\u0440\u044B \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u044B \u2014 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u0430\u044F \u0441\u0435\u0442\u043A\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u043F. 16\u0434 \u0420\u0435\u043A. \u0415\u0410\u042D\u041A \u21168 \u043D\u0435 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0430. \u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0434\u043B\u0438\u043D\u0443, \u0448\u0438\u0440\u0438\u043D\u0443 \u0438 \u0432\u044B\u0441\u043E\u0442\u0443 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u0421\u0445\u0435\u043C\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\xBB.",
      { align: "justify" }
    );
    doc.moveDown(0.5);
    return;
  }
  const pageLeft = PAGE_MARGIN;
  const pageRight = doc.page.width - PAGE_MARGIN;
  const usableW = pageRight - pageLeft;
  const planMaxH = 320;
  const aspect = (widthM || 1) / (lengthM || 1);
  let drawW = usableW;
  let drawH = drawW * aspect;
  if (drawH > planMaxH) {
    drawH = planMaxH;
    drawW = drawH / aspect;
  }
  ensureSpace2(doc, drawH + 90);
  const planX = pageLeft + (usableW - drawW) / 2;
  const planY = doc.y + 10;
  doc.save();
  doc.lineWidth(1.2).strokeColor(ACCENT).rect(planX, planY, drawW, drawH).stroke();
  doc.restore();
  const lengthLabel = lengthM > 0 ? `${lengthM.toFixed(1)} \u043C (\u0434\u043B\u0438\u043D\u0430)` : "\u2014 \u043C (\u0434\u043B\u0438\u043D\u0430 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430)";
  const widthLabel = widthM > 0 ? `${widthM.toFixed(1)} \u043C (\u0448\u0438\u0440\u0438\u043D\u0430)` : "\u2014 \u043C (\u0448\u0438\u0440\u0438\u043D\u0430 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u0430)";
  doc.fillColor(MUTED).font("body").fontSize(8).text(lengthLabel, planX, planY - 12, { width: drawW, align: "center" });
  doc.save();
  doc.rotate(-90, { origin: [planX - 14, planY + drawH / 2] });
  doc.text(widthLabel, planX - 60, planY + drawH / 2 - 4, { width: 80, align: "center" });
  doc.restore();
  doc.save();
  doc.strokeColor("#e2e8f0").lineWidth(0.6).dash(3, { space: 3 });
  for (let i = 0; i < calc.nL; i++) {
    const y = planY + (calc.nL === 1 ? 0.5 : i / (calc.nL - 1)) * drawH;
    doc.moveTo(planX, y).lineTo(planX + drawW, y).stroke();
  }
  for (let j = 0; j < calc.nW; j++) {
    const x = planX + (calc.nW === 1 ? 0.5 : j / (calc.nW - 1)) * drawW;
    doc.moveTo(x, planY).lineTo(x, planY + drawH).stroke();
  }
  doc.undash();
  doc.restore();
  const allFloorObjs = input.floorPlanObjects ?? [];
  const floorObjs = allFloorObjs.filter((o) => o.type !== "sensor_point");
  const sensorPointObjs = allFloorObjs.filter((o) => o.type === "sensor_point");
  if (floorObjs.length > 0) {
    const OBJ_STYLES = {
      shelf: { fill: "#dbeafe", stroke: "#1d4ed8", text: "#1e3a8a" },
      pallet: { fill: "#fef3c7", stroke: "#b45309", text: "#78350f" },
      cabinet: { fill: "#e0e7ff", stroke: "#4338ca", text: "#312e81" },
      display_case: { fill: "#cffafe", stroke: "#0e7490", text: "#164e63" },
      refrigerator: { fill: "#bae6fd", stroke: "#0369a1", text: "#0c4a6e" },
      table: { fill: "#d1fae5", stroke: "#059669", text: "#064e3b" },
      window: { fill: "#e0f2fe", stroke: "#0284c7", text: "#0c4a6e" },
      radiator: { fill: "#fee2e2", stroke: "#dc2626", text: "#7f1d1d" },
      vent: { fill: "#f3e8ff", stroke: "#7c3aed", text: "#4c1d95" },
      door_obj: { fill: "#fde68a", stroke: "#b45309", text: "#78350f" },
      cooling_unit: { fill: "#a5f3fc", stroke: "#0891b2", text: "#164e63" }
    };
    for (const obj of floorObjs) {
      doc.save();
      const style = OBJ_STYLES[obj.type] ?? { fill: "#f1f5f9", stroke: "#64748b", text: "#1e293b" };
      const ox = planX + obj.xPct / 100 * drawW;
      const oy = planY + obj.yPct / 100 * drawH;
      const ow = Math.max(4, obj.widthPct / 100 * drawW);
      const oh = Math.max(4, obj.heightPct / 100 * drawH);
      const cx = ox + ow / 2;
      const cy = oy + oh / 2;
      if (obj.rotation !== 0) {
        doc.translate(cx, cy).rotate(obj.rotation).translate(-cx, -cy);
      }
      doc.fillColor(style.fill).strokeColor(style.stroke).lineWidth(0.8).roundedRect(ox, oy, ow, oh, 2).fillAndStroke();
      if (obj.type === "shelf" && ow > 20) {
        const nLines = Math.max(1, Math.floor(ow / 15));
        doc.strokeColor(style.stroke).lineWidth(0.5).opacity(0.4);
        for (let i = 1; i <= nLines; i++) {
          const lx = ox + i / (nLines + 1) * ow;
          doc.moveTo(lx, oy + 1).lineTo(lx, oy + oh - 1).stroke();
        }
        doc.opacity(1);
      }
      if (obj.type === "vent") {
        doc.strokeColor(style.stroke).lineWidth(0.6).opacity(0.5);
        doc.moveTo(ox + 3, oy + 3).lineTo(ox + ow - 3, oy + oh - 3).stroke();
        doc.moveTo(ox + ow - 3, oy + 3).lineTo(ox + 3, oy + oh - 3).stroke();
        doc.opacity(1);
      }
      const fontSize = Math.max(5, Math.min(8, Math.min(ow, oh) * 0.3));
      doc.fillColor(style.text).font("body").fontSize(fontSize).text(obj.label.slice(0, 14), ox, cy - fontSize / 2, { width: ow, align: "center" });
      const dimFontSize = Math.max(4, Math.min(6, Math.min(ow, oh) * 0.2));
      const wM = lengthM > 0 ? (obj.widthPct / 100 * lengthM).toFixed(1) : obj.widthPct.toFixed(0) + "%";
      const hM = widthM > 0 ? (obj.heightPct / 100 * widthM).toFixed(1) : obj.heightPct.toFixed(0) + "%";
      const htStr = obj.heightM && obj.heightM > 0 ? `\xD7${obj.heightM.toFixed(1)}\u043C` : "";
      const dimStr = `${wM}\u043C\xD7${hM}\u043C${htStr}`;
      const dimY = oh > 20 ? cy + fontSize / 2 + 2 : oy + oh + 3;
      doc.fillColor(style.text).font("body").fontSize(dimFontSize).opacity(0.7).text(dimStr, ox, dimY, { width: ow, align: "center" });
      doc.opacity(1);
      doc.restore();
    }
  }
  if (input.doorPos) {
    const dx = planX + input.doorPos.x / 100 * drawW;
    const dy = planY + input.doorPos.y / 100 * drawH;
    doc.save();
    doc.fillColor("#fde68a").strokeColor("#b45309").lineWidth(0.8).roundedRect(dx - 16, dy - 8, 32, 16, 3).fillAndStroke();
    doc.fillColor("#92400e").font("body").fontSize(7).text("\u0414\u0432\u0435\u0440\u044C", dx - 16, dy - 4, { width: 32, align: "center" });
    doc.restore();
  }
  if (input.coolingUnitPos) {
    const cx = planX + input.coolingUnitPos.x / 100 * drawW;
    const cy = planY + input.coolingUnitPos.y / 100 * drawH;
    doc.save();
    doc.fillColor("#bae6fd").strokeColor("#0369a1").lineWidth(0.8).roundedRect(cx - 22, cy - 8, 44, 16, 3).fillAndStroke();
    doc.fillColor("#075985").font("body").fontSize(7).text("\u0410\u0433\u0440\u0435\u0433\u0430\u0442", cx - 22, cy - 4, { width: 44, align: "center" });
    doc.restore();
  }
  const internals = (input.pvLoggers ?? []).filter((l) => l.role === "internal");
  const placedById = /* @__PURE__ */ new Map();
  internals.forEach((l) => {
    if (l.position && l.position.startsWith("L")) placedById.set(l.position, l);
  });
  const margin = 0.08;
  const span = 1 - margin * 2;
  for (let r = 1; r <= calc.nL; r++) {
    for (let c = 1; c <= calc.nW; c++) {
      const xPct = calc.nW === 1 ? 0.5 : margin + (c - 1) / (calc.nW - 1) * span;
      const yPct = calc.nL === 1 ? 0.5 : margin + (r - 1) / (calc.nL - 1) * span;
      const px = planX + xPct * drawW;
      const py = planY + yPct * drawH;
      let label = `${r}-${c}`;
      if (!template) {
        const matches = [];
        for (let t2 = 1; t2 <= calc.nV; t2++) {
          const id = `L${r}-c${c}-t${t2}`;
          const placed = placedById.get(id);
          if (placed) matches.push(placed.customName || placed.label);
        }
        if (matches.length) label = matches.slice(0, 2).join("/");
      }
      const filled = !template && /[A-Za-zА-Яа-я0-9]/.test(label) && label !== `${r}-${c}`;
      doc.save();
      doc.fillColor(filled ? "#10b981" : "#e2e8f0").strokeColor(filled ? "#047857" : "#64748b").lineWidth(1).circle(px, py, 12).fillAndStroke();
      doc.fillColor(filled ? "white" : "#1f2937").font("bold").fontSize(7).text(label.slice(0, 8), px - 12, py - 3, { width: 24, align: "center" });
      doc.restore();
    }
  }
  for (const sp of sensorPointObjs) {
    const spX = planX + sp.xPct / 100 * drawW;
    const spY = planY + sp.yPct / 100 * drawH;
    const spR = Math.min(sp.widthPct / 100 * drawW, sp.heightPct / 100 * drawH) / 2;
    const r = Math.max(8, Math.min(16, spR));
    doc.save();
    doc.fillColor("#7dd3fc").strokeColor("#0369a1").lineWidth(1.5).circle(spX, spY, r).fillAndStroke();
    const shortId = (sp.label || "D").slice(0, 6);
    doc.fillColor("#0c4a6e").font("bold").fontSize(Math.max(5, Math.min(8, r * 0.7))).text(shortId, spX - r, spY - 4, { width: r * 2, align: "center" });
    doc.restore();
  }
  doc.y = planY + drawH + 12;
  {
    const sensorRows = [];
    for (const sp of sensorPointObjs) {
      sensorRows.push({
        objLabel: "\u0414\u0430\u0442\u0447\u0438\u043A \u043D\u0430 \u043F\u043B\u0430\u043D\u0435",
        sensorId: sp.label || "\u0414\u0430\u0442\u0447\u0438\u043A",
        heightFromFloor: (sp.heightM ?? 0) > 0 ? sp.heightM.toFixed(2) : "\u2014"
      });
    }
    for (const obj of floorObjs) {
      const sensors2 = (obj.sensors ?? []).filter((s) => s.sensorId && s.sensorId.trim());
      for (const s of sensors2) {
        sensorRows.push({
          objLabel: obj.label || obj.type,
          sensorId: s.sensorId.trim(),
          heightFromFloor: s.heightFromFloor > 0 ? s.heightFromFloor.toFixed(2) : "\u2014"
        });
      }
    }
    if (sensorRows.length > 0) {
      ensureSpace2(doc, sensorRows.length * 16 + 50);
      doc.moveDown(0.5);
      doc.fillColor(ACCENT).font("bold").fontSize(9).text("\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432", { align: "left" });
      doc.moveDown(0.3);
      const tLeft = pageLeft;
      const colW = [200, 180, 150];
      const tRight = tLeft + colW.reduce((a, b) => a + b, 0);
      const rowH = 16;
      let ty = doc.y;
      doc.save();
      doc.fillColor("#f1f5f9").rect(tLeft, ty, tRight - tLeft, rowH).fill();
      doc.strokeColor("#cbd5e1").lineWidth(0.5).rect(tLeft, ty, tRight - tLeft, rowH).stroke();
      let tx = tLeft;
      ["\u041E\u0431\u044A\u0435\u043A\u0442 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F", "ID \u0434\u0430\u0442\u0447\u0438\u043A\u0430", "\u0412\u044B\u0441\u043E\u0442\u0430 \u043E\u0442 \u043F\u043E\u043B\u0430, \u043C"].forEach((h, i) => {
        doc.fillColor(ACCENT).font("bold").fontSize(8).text(h, tx + 4, ty + 4, { width: colW[i] - 8, align: "left" });
        tx += colW[i];
      });
      ty += rowH;
      sensorRows.forEach((row, ri) => {
        const bg = ri % 2 === 0 ? "white" : "#f8fafc";
        doc.save();
        doc.fillColor(bg).rect(tLeft, ty, tRight - tLeft, rowH).fill();
        doc.strokeColor("#e2e8f0").lineWidth(0.4).rect(tLeft, ty, tRight - tLeft, rowH).stroke();
        doc.restore();
        let cx2 = tLeft;
        [row.objLabel, row.sensorId, row.heightFromFloor].forEach((cell, i) => {
          doc.fillColor(ACCENT).font("body").fontSize(8).text(cell, cx2 + 4, ty + 4, { width: colW[i] - 8, align: i === 2 ? "center" : "left" });
          cx2 += colW[i];
        });
        ty += rowH;
      });
      doc.restore();
      doc.y = ty + 6;
    }
  }
  doc.fillColor(MUTED).font("body").fontSize(9).text(
    `\u0420\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u043E ${calc.nL} \xD7 ${calc.nW} \u0442\u043E\u0447\u0435\u043A \u043D\u0430 ${calc.nV} \u044F\u0440\u0443\u0441(\u0430), \u0432\u0441\u0435\u0433\u043E ${calc.base} \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432` + (calc.external ? `; +${calc.external} \u0432\u043D\u0435\u0448\u043D\u0438\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 (\u043A\u043E\u043D\u0442\u0430\u043A\u0442 \u0441 \u0432\u043D\u0435\u0448\u043D\u0435\u0439 \u0441\u0440\u0435\u0434\u043E\u0439)` : "") + ".",
    { align: "center" }
  );
  doc.moveDown(0.4);
  doc.fillColor(MUTED).font("body").fontSize(8).text(
    "\u0421\u0435\u0442\u043A\u0430 \u043F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u0430 \u043F\u043E \u0442\u0430\u0431\u043B\u0438\u0446\u0430\u043C \u043F. 16\u0434 \u0420\u0435\u043A. \u0415\u0410\u042D\u041A \u21168 (\u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C: 2/3/4/5 \u0442\u043E\u0447\u0435\u043A \u043F\u0440\u0438 \u226410/40/60/>60 \u043C; \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C: 1/2/3 \u0442\u043E\u0447\u043A\u0438 \u043F\u0440\u0438 \u22641.5 / <5 / \u22655 \u043C).",
    { align: "justify" }
  );
  doc.moveDown(0.3);
  if (!template) {
    const pvLoggers2 = input.pvLoggers ?? [];
    const internals2 = pvLoggers2.filter((l) => l.role === "internal");
    const externals = pvLoggers2.filter((l) => l.role === "external");
    if (pvLoggers2.length > 0) {
      const pageLeft2 = PAGE_MARGIN;
      const pageRight2 = doc.page.width - PAGE_MARGIN;
      const totalW2 = pageRight2 - pageLeft2;
      ensureSpace2(doc, internals2.length * 18 + 80);
      doc.moveDown(0.5);
      doc.fillColor(ACCENT).font("bold").fontSize(9).text("\u0422\u0430\u0431\u043B\u0438\u0446\u0430 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u0434\u0430\u043D\u043D\u044B\u0445", { align: "left" });
      doc.moveDown(0.3);
      const sColW = [28, 50, 90, 90, 70, totalW2 - (28 + 50 + 90 + 90 + 70)];
      const sHeaders = ["\u2116", "ID", "\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u2116", "\u041F\u043E\u0437\u0438\u0446\u0438\u044F", "\u0412\u044B\u0441\u043E\u0442\u0430, \u043C", "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435"];
      let sy = doc.y;
      const sRowH = 16;
      doc.save();
      doc.fillColor("#f1f5f9").rect(pageLeft2, sy, totalW2, sRowH).fill();
      doc.strokeColor("#cbd5e1").lineWidth(0.5).rect(pageLeft2, sy, totalW2, sRowH).stroke();
      let scx = pageLeft2;
      sHeaders.forEach((h, i) => {
        doc.fillColor(ACCENT).font("bold").fontSize(8).text(h, scx + 3, sy + 4, { width: sColW[i] - 6, align: i >= 4 ? "center" : "left" });
        scx += sColW[i];
      });
      sy += sRowH;
      doc.restore();
      const allSensorRows = [
        ...internals2.map((l, idx) => ({ l, idx, isExt: false })),
        ...externals.map((l, idx) => ({ l, idx: internals2.length + idx, isExt: true }))
      ];
      allSensorRows.forEach(({ l, idx, isExt }) => {
        ensureSpace2(doc, sRowH);
        const bg = idx % 2 === 0 ? "white" : "#f8fafc";
        doc.save();
        doc.fillColor(bg).rect(pageLeft2, sy, totalW2, sRowH).fill();
        doc.strokeColor("#e2e8f0").lineWidth(0.4).rect(pageLeft2, sy, totalW2, sRowH).stroke();
        doc.restore();
        const shortId = l.label.length > 4 ? l.label.slice(-4) : l.label;
        const posLabel = l.position ?? (isExt ? "\u0412\u043D\u0435\u0448\u043D\u0438\u0439" : "\u2014");
        let heightStr = "\u2014";
        if (l.position && l.position.startsWith("L")) {
          const tierMatch = l.position.match(/t(\d+)$/);
          if (tierMatch && calc.nV > 0 && heightM > 0) {
            const tier = parseInt(tierMatch[1], 10);
            const h = (heightM / Math.max(calc.nV, 1) * (tier - 0.5)).toFixed(2);
            heightStr = `${h} \u043C`;
          }
        }
        const cells = [
          String(idx + 1),
          shortId,
          l.label,
          posLabel,
          heightStr,
          isExt ? "\u0412\u043D\u0435\u0448\u043D\u0438\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440" : ""
        ];
        let scx2 = pageLeft2;
        cells.forEach((cell, ci) => {
          doc.fillColor(isExt ? "#92400e" : ACCENT).font("body").fontSize(8).text(cell, scx2 + 3, sy + 4, { width: sColW[ci] - 6, align: ci >= 4 ? "center" : "left" });
          scx2 += sColW[ci];
        });
        sy += sRowH;
      });
      doc.y = sy + 6;
      doc.fillColor(MUTED).font("body").fontSize(7).text(
        "ID \u2014 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 4 \u0446\u0438\u0444\u0440\u044B \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0433\u043E \u043D\u043E\u043C\u0435\u0440\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430. \u0412\u044B\u0441\u043E\u0442\u0430 \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E \u044F\u0440\u0443\u0441\u0443 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F.",
        { align: "left" }
      );
      doc.moveDown(0.4);
    }
  }
}
function drawWarehouseAnnex1(doc, input) {
  const gi = input.generalInfo;
  const lengthM = input.pvRoomLengthM ?? (gi?.whLengthM ? Number(gi.whLengthM) : null);
  const widthM = input.pvRoomWidthM ?? (gi?.whWidthM ? Number(gi.whWidthM) : null);
  const heightM = input.pvRoomHeightM ?? (gi?.whHeightM ? Number(gi.whHeightM) : null);
  const calc = computeWarehouseSensorCount({
    lengthM,
    widthM,
    heightM,
    externalEnv: !!gi?.whExternalEnv
  });
  const hasLoggers = (input.pv?.loggers ?? []).length > 0;
  if (!calc.total && !hasLoggers) return;
  doc.addPage();
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalW = right - left;
  doc.fillColor(ACCENT).font("body").fontSize(9).text("\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 N 1", left, doc.y, { width: totalW, align: "right" });
  doc.fillColor(MUTED).font("body").fontSize(9).text("\u043A \u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u0443 \u043F\u043E \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044E", { width: totalW, align: "right" }).text("\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u043E\u043D", { width: totalW, align: "right" }).text("\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432", { width: totalW, align: "right" });
  doc.moveDown(0.4);
  doc.fillColor(MUTED).font("body").fontSize(9).text("(\u0444\u043E\u0440\u043C\u0430)", { width: totalW, align: "right" });
  doc.moveDown(1);
  doc.fillColor(ACCENT).font("bold").fontSize(11).text("\u0418\u041D\u0424\u041E\u0420\u041C\u0410\u0426\u0418\u042F", { width: totalW, align: "center" });
  doc.fillColor(ACCENT).font("body").fontSize(10).text("\u043E \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u0434\u0430\u043D\u043D\u044B\u0445", { width: totalW, align: "center" });
  doc.moveDown(1);
  const internals = (input.pvLoggers ?? []).filter((l) => l.role === "internal");
  const externals = (input.pvLoggers ?? []).filter((l) => l.role === "external");
  const placedById = /* @__PURE__ */ new Map();
  internals.forEach((l) => {
    if (l.position && l.position.startsWith("L")) placedById.set(l.position, l);
  });
  const sensorHeightMap = /* @__PURE__ */ new Map();
  (input.floorPlanObjects ?? []).forEach((obj) => {
    if (obj.type === "sensor_point" && obj.label && obj.heightM != null && obj.heightM > 0) {
      const lbl = obj.label.trim();
      sensorHeightMap.set(lbl, obj.heightM);
      if (lbl.length > 4) sensorHeightMap.set(lbl.slice(-4), obj.heightM);
    }
    (obj.sensors ?? []).forEach((s) => {
      if (s.sensorId && s.heightFromFloor != null) {
        const sid = s.sensorId.trim();
        sensorHeightMap.set(sid, s.heightFromFloor);
        if (sid.length > 4) sensorHeightMap.set(sid.slice(-4), s.heightFromFloor);
      }
    });
  });
  const getHeight = (label) => {
    if (!label) return void 0;
    const direct = sensorHeightMap.get(label);
    if (direct != null) return direct;
    const last4 = label.length >= 4 ? label.slice(-4) : label;
    return sensorHeightMap.get(last4);
  };
  const colW = [110, 110, 100, 100, totalW - (110 + 110 + 100 + 100)];
  const headers = [
    "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 (ID)\n\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0434\u0430\u043D\u043D\u044B\u0445",
    "\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440\n\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0434\u0430\u043D\u043D\u044B\u0445*",
    "\u041D\u043E\u043C\u0435\u0440 \u043D\u0430 \u0441\u0445\u0435\u043C\u0435\n\u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F",
    "\u0412\u044B\u0441\u043E\u0442\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438\n\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0434\u0430\u043D\u043D\u044B\u0445, \u043C",
    "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435"
  ];
  let y = doc.y;
  const headerH = 48;
  ensureSpace2(doc, headerH + 4);
  doc.save();
  doc.fillColor(SOFT_BG).rect(left, y, totalW, headerH).fill();
  doc.lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, headerH).stroke();
  doc.restore();
  let cx = left;
  doc.fillColor(ACCENT).font("bold").fontSize(8);
  headers.forEach((h, i) => {
    if (i > 0) {
      doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + headerH).stroke().restore();
    }
    doc.text(h, cx + 4, y + 5, { width: colW[i] - 8, align: "center" });
    cx += colW[i];
  });
  y += headerH;
  let idx = 1;
  doc.font("body").fontSize(9);
  const rowH = 22;
  const drawRow = (cells, bgColor, isExt) => {
    ensureSpace2(doc, rowH);
    if (bgColor) {
      doc.save().fillColor(bgColor).rect(left, y, totalW, rowH).fill().restore();
    }
    doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, rowH).stroke().restore();
    cx = left;
    cells.forEach((v, i) => {
      if (i > 0) {
        doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + rowH).stroke().restore();
      }
      doc.fillColor(isExt ? "#92400e" : ACCENT).font("body").fontSize(9).text(v, cx + 4, y + 6, { width: colW[i] - 8, align: "center" });
      cx += colW[i];
    });
    y += rowH;
    idx++;
  };
  const internalPvLoggers = (input.pv?.loggers ?? []).filter((pvLogger) => {
    const pvL = (input.pvLoggers ?? []).find((p) => p.label === pvLogger.label);
    return !pvL || pvL.role !== "external";
  });
  internalPvLoggers.forEach((pvLogger, i) => {
    const pvL = (input.pvLoggers ?? []).find((p) => p.label === pvLogger.label);
    const rawLabel = pvLogger.label || "";
    const last4 = rawLabel.length >= 4 ? rawLabel.slice(-4) : rawLabel;
    const idDisplay = last4 || "\u2014";
    const serialNum = pvLogger.label || "\u2014";
    const schemeNum = last4 || "\u2014";
    const sensorHeight = getHeight(pvLogger.label);
    const heightDisplay = sensorHeight != null ? sensorHeight.toFixed(2) : "\u2014";
    const bg = i % 2 === 0 ? "#f1f5f9" : void 0;
    drawRow([idDisplay, serialNum, schemeNum, heightDisplay, ""], bg);
  });
  externals.forEach((ext, ei) => {
    const rawLabel = ext.label || "";
    const last4 = rawLabel.length >= 4 ? rawLabel.slice(-4) : rawLabel;
    const extId = last4 || "\u2014";
    const serialNum = ext.label || "\u2014";
    const schemeNum = last4 || "\u2014";
    const sensorHeight = ext.label ? getHeight(ext.label) : void 0;
    const heightDisplay = sensorHeight != null ? sensorHeight.toFixed(2) : "\u2014";
    drawRow([extId, serialNum, schemeNum, heightDisplay, "\u0412\u043D\u0435\u0448\u043D\u0438\u0439"], "#fef3c7", true);
  });
  if (idx === 1) {
    drawRow(["", "", "", "", ""]);
    drawRow(["", "", "", "", ""]);
  }
  doc.y = y + 8;
  doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(left, doc.y).lineTo(right, doc.y).stroke().restore();
  doc.moveDown(0.3);
  doc.fillColor(MUTED).font("body").fontSize(8).text("* \u0417\u0430\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0432 \u0441\u043B\u0443\u0447\u0430\u0435 \u043E\u0442\u043B\u0438\u0447\u0438\u044F \u0441\u0435\u0440\u0438\u0439\u043D\u043E\u0433\u043E \u043D\u043E\u043C\u0435\u0440\u0430 \u043E\u0442 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0433\u043E \u043D\u043E\u043C\u0435\u0440\u0430 (ID)", left, doc.y, { width: totalW });
}
function drawWarehouseAnnex2(doc, input) {
  if (!input.pv?.loggers?.length) return;
  doc.addPage();
  drawSectionTitle(doc, "\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u21162. \u0421\u0432\u043E\u0434\u043D\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0438\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432");
  doc.fillColor(MUTED).font("body").fontSize(9).text(
    `\u0421\u0432\u043E\u0434\u043D\u044B\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u043E\u043D\u044B \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 ${formatDateRange(input.pv.startAt, input.pv.endAt)}; \u0440\u0435\u0436\u0438\u043C ${input.pv.rangeMin.toFixed(1)} \u2026 ${input.pv.rangeMax.toFixed(1)} \xB0C.`,
    { align: "justify" }
  );
  doc.moveDown(0.6);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalW = right - left;
  const colW = [110, 110, 60, 60, 60, Math.floor((totalW - (110 + 110 + 60 + 60 + 60)) / 2), Math.ceil((totalW - (110 + 110 + 60 + 60 + 60)) / 2)];
  const headers = [
    "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 (ID)\n\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0434\u0430\u043D\u043D\u044B\u0445",
    "\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440\n\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0434\u0430\u043D\u043D\u044B\u0445*",
    "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F\n\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \xB0C",
    "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F\n\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \xB0C",
    "\u0421\u0440\u0435\u0434\u043D\u044F\u044F\n\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \xB0C",
    "\u0434\u0430",
    "\u043D\u0435\u0442"
  ];
  const headerH1 = 44;
  const headerH2 = 20;
  let y = doc.y;
  ensureSpace2(doc, headerH1 + headerH2 + 4);
  doc.save();
  doc.fillColor(SOFT_BG).rect(left, y, totalW, headerH1).fill();
  doc.lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, headerH1).stroke();
  doc.restore();
  let cx = left;
  doc.fillColor(ACCENT).font("bold").fontSize(8);
  const mainCols = headers.slice(0, 5);
  mainCols.forEach((h, i) => {
    if (i > 0) {
      doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + headerH1 + headerH2).stroke().restore();
    }
    doc.text(h, cx + 4, y + 4, { width: colW[i] - 8, align: "center" });
    cx += colW[i];
  });
  const complianceX = cx;
  const complianceW = colW[5] + colW[6];
  doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + headerH1 + headerH2).stroke().restore();
  doc.text("\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u043C\u0443 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0443", complianceX + 4, y + 8, { width: complianceW - 8, align: "center" });
  y += headerH1;
  doc.save();
  doc.fillColor(SOFT_BG).rect(left, y, totalW, headerH2).fill();
  doc.lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, headerH2).stroke();
  doc.restore();
  cx = left;
  for (let i = 0; i < 5; i++) {
    if (i > 0) {
      doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + headerH2).stroke().restore();
    }
    cx += colW[i];
  }
  doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + headerH2).stroke().restore();
  doc.fillColor(ACCENT).font("bold").fontSize(8).text("\u0434\u0430", cx + 4, y + 5, { width: colW[5] - 8, align: "center" });
  cx += colW[5];
  doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + headerH2).stroke().restore();
  doc.fillColor(ACCENT).font("bold").fontSize(8).text("\u043D\u0435\u0442", cx + 4, y + 5, { width: colW[6] - 8, align: "center" });
  y += headerH2;
  const rowH = 20;
  doc.font("body").fontSize(9);
  const internalLoggers = input.pv.loggers.filter((l) => {
    const pvL = (input.pvLoggers ?? []).find((p) => p.label === l.label);
    return !pvL || pvL.role !== "external";
  });
  internalLoggers.forEach((l, i) => {
    const inRange2 = (v) => {
      if (v == null || !Number.isFinite(v)) return true;
      return v >= input.pv.rangeMin && v <= input.pv.rangeMax;
    };
    const ok = inRange2(l.min) && inRange2(l.max) && inRange2(l.mkt);
    const pvLogger = (input.pvLoggers ?? []).find((p) => p.label === l.label);
    const rawLabel = l.label || "";
    const last4 = rawLabel.length >= 4 ? rawLabel.slice(-4) : rawLabel;
    const positionId = pvLogger?.position && pvLogger.position !== "unset" ? pvLogger.position : last4 || "\u2014";
    const fmt = (n) => n != null && Number.isFinite(n) ? n.toFixed(2) : "\u2014";
    const cells = [
      positionId,
      l.customName ? `${l.customName} (${l.label})` : l.label,
      fmt(l.min),
      fmt(l.max),
      fmt(l.avg),
      ok ? "\u2713" : "",
      ok ? "" : "\u2713"
    ];
    ensureSpace2(doc, rowH);
    if (i % 2 === 0) {
      doc.save().fillColor("#f1f5f9").rect(left, y, totalW, rowH).fill().restore();
    }
    doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, rowH).stroke().restore();
    cx = left;
    cells.forEach((v, j) => {
      if (j > 0) {
        doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(cx, y).lineTo(cx, y + rowH).stroke().restore();
      }
      const isYes = j === 5;
      const isNo = j === 6;
      doc.fillColor(isYes && ok ? "#047857" : isNo && !ok ? "#b91c1c" : ACCENT).font(isYes || isNo ? "bold" : "body").fontSize(isYes || isNo ? 11 : 9).text(v, cx + 4, y + 4, { width: colW[j] - 8, align: "center" });
      cx += colW[j];
    });
    y += rowH;
  });
  if (!internalLoggers.length) {
    for (let e = 0; e < 2; e++) {
      doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, rowH).stroke().restore();
      y += rowH;
    }
  }
  const timeRowH = 28;
  for (const label of ["\u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F \u043D\u0430\u0447\u0430\u043B\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F:", "\u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F:"]) {
    ensureSpace2(doc, timeRowH);
    doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, timeRowH).stroke().restore();
    doc.fillColor(ACCENT).font("body").fontSize(9).text(label, left + 6, y + 8, { width: totalW - 12 });
    y += timeRowH;
  }
  doc.y = y + 6;
  doc.save().lineWidth(0.5).strokeColor(BORDER).moveTo(left, doc.y).lineTo(left + 120, doc.y).stroke().restore();
  doc.moveDown(0.3);
  doc.fillColor(MUTED).font("body").fontSize(8).text("* \u0417\u0430\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0432 \u0441\u043B\u0443\u0447\u0430\u0435 \u043E\u0442\u043B\u0438\u0447\u0438\u044F \u0441\u0435\u0440\u0438\u0439\u043D\u043E\u0433\u043E \u043D\u043E\u043C\u0435\u0440\u0430 \u043E\u0442 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u043E\u043D\u043D\u043E\u0433\u043E \u043D\u043E\u043C\u0435\u0440\u0430 ID.");
}
function formatDateRange(startMs, endMs) {
  if (!startMs || !endMs) return "\u2014";
  const fmt = (ms) => {
    const d = new Date(ms);
    const pad3 = (n) => String(n).padStart(2, "0");
    return `${pad3(d.getUTCDate())}.${pad3(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad3(d.getUTCHours())}:${pad3(d.getUTCMinutes())} UTC`;
  };
  return `${fmt(startMs)} \u2014 ${fmt(endMs)}`;
}
var WAREHOUSE_DEFAULT_SECTIONS = {
  "1.1": `\u0415\u0410\u042D\u0421 \u2014 \u0415\u0432\u0440\u0430\u0437\u0438\u0439\u0441\u043A\u0438\u0439 \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u043E\u044E\u0437
\u0415\u042D\u041A \u2014 \u0415\u0432\u0440\u0430\u0437\u0438\u0439\u0441\u043A\u0430\u044F \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043A\u043E\u043C\u0438\u0441\u0441\u0438\u044F
\u041B\u0421 \u2014 \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430
GDP (Good Distribution Practice) \u2014 \u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0449\u0435\u0439 \u0434\u0438\u0441\u0442\u0440\u0438\u0431\u044C\u044E\u0442\u043E\u0440\u0441\u043A\u043E\u0439 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0438
GPP (Good Pharmacy Practice) \u2014 \u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0449\u0435\u0439 \u0430\u043F\u0442\u0435\u0447\u043D\u043E\u0439 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0438
GMP (Good Manufacturing Practice) \u2014 \u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0449\u0435\u0439 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0438
\u0421\u041E\u041F \u2014 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430
IQ (Installation Qualification) \u2014 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043C\u043E\u043D\u0442\u0430\u0436\u0430
OQ (Operational Qualification) \u2014 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F
PV / PQ (Performance Validation / Qualification) \u2014 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F / \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u044F
\u0422 \u2014 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430
MKT (Mean Kinetic Temperature) \u2014 \u0441\u0440\u0435\u0434\u043D\u0435\u043A\u0438\u043D\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430`,
  "1.2": `\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u2014 \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0435 \u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u0437\u043E\u043D\u044B \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0441 \u0446\u0435\u043B\u044C\u044E \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u0438\u044F \xAB\u0433\u043E\u0440\u044F\u0447\u0438\u0445\xBB \u0438 \xAB\u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0445\xBB \u0442\u043E\u0447\u0435\u043A, \u043E\u0446\u0435\u043D\u043A\u0438 \u043E\u0434\u043D\u043E\u0440\u043E\u0434\u043D\u043E\u0441\u0442\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043F\u043E\u043B\u044F \u0438 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043E\u043F\u0442\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0445 \u043C\u0435\u0441\u0442 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430.

\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 \u0434\u0430\u043D\u043D\u044B\u0445 (\u043B\u043E\u0433\u0433\u0435\u0440) \u2014 \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E, \u043D\u0435\u043F\u0440\u0435\u0440\u044B\u0432\u043D\u043E \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u044E\u0449\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B (\u0438, \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438, \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u0438) \u0441 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u043C \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B\u043E\u043C \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0449\u0435\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0432\u043E \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0439 \u043F\u0430\u043C\u044F\u0442\u0438.

\u041A\u0440\u0438\u0442\u0435\u0440\u0438\u0439 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438 \u2014 \u0437\u0430\u0440\u0430\u043D\u0435\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u0435\u043B, \u0441 \u043A\u043E\u0442\u043E\u0440\u044B\u043C \u0441\u0440\u0430\u0432\u043D\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439 \u0434\u043B\u044F \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u044F \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u043E \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 / \u043D\u0435\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438.

\u0417\u043E\u043D\u0430 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u2014 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u0430\u044F \u0447\u0430\u0441\u0442\u044C \u0441\u043A\u043B\u0430\u0434\u0430 \u0438\u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F, \u043F\u0440\u0435\u0434\u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u0430\u044F \u0434\u043B\u044F \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0432 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u044B\u0445 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445.`,
  "2.1": `\u041E\u0431\u044A\u0435\u043A\u0442 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F: \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 (\u0437\u043E\u043D\u0430) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432.
\u0410\u0434\u0440\u0435\u0441: [\u0443\u043A\u0430\u0437\u0430\u0442\u044C \u0430\u0434\u0440\u0435\u0441 \u043E\u0431\u044A\u0435\u043A\u0442\u0430]
\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0432 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u0445 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0438\u0440\u0443\u0435\u043C\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0439 \u0441\u0440\u0435\u0434\u044B.`,
  "2.2.1": `\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0435 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441:
\u2022 \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0435\u0439 \u041A\u043E\u043B\u043B\u0435\u0433\u0438\u0438 \u0415\u042D\u041A \u2116 8 \u043E\u0442 20.04.2021 \xAB\u041E \u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u0435 \u043F\u043E \u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0449\u0435\u0439 \u043F\u0440\u0430\u043A\u0442\u0438\u043A\u0435 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432 \u0434\u043B\u044F \u043C\u0435\u0434\u0438\u0446\u0438\u043D\u0441\u043A\u043E\u0433\u043E \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F\xBB;
\u2022 \u0422\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 GDP/GPP/GMP \u0432 \u0447\u0430\u0441\u0442\u0438 \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u044F \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432;
\u2022 \u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u043C\u0438 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u043C\u0438 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u043C\u0438 \u043F\u0440\u043E\u0446\u0435\u0434\u0443\u0440\u0430\u043C\u0438 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438.`,
  "2.2.2": `\u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0434\u0430\u043D\u043D\u043E\u0433\u043E \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F:
\u2022 \u041F\u0435\u0440\u0432\u0438\u0447\u043D\u043E\u0435 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0434 \u0432\u0432\u043E\u0434\u043E\u043C \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0432 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u044E / \u043F\u043E\u0441\u043B\u0435 \u0440\u0435\u043C\u043E\u043D\u0442\u0430;
\u2022 \u041F\u043B\u0430\u043D\u043E\u0432\u043E\u0435 \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 (\u0435\u0436\u0435\u0433\u043E\u0434\u043D\u043E\u0435 / \u0441\u0435\u0437\u043E\u043D\u043D\u043E\u0435);
\u2022 \u041A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u0441\u043B\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 \u0438\u043B\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u0445 \u043A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F.`,
  "3": `\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0440\u0430\u0441\u043F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 (\u0437\u043E\u043D\u0443) \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432, \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0435 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 2.1. \u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0434\u043B\u044F:
\u2022 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0445 \u0443\u0441\u043B\u043E\u0432\u0438\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u043C \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C;
\u2022 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u043C\u0435\u0441\u0442 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430;
\u2022 \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439 \u043F\u043E \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u043C\u0443 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044E \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432.`,
  "4": `\u0426\u0435\u043B\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F:
\u0430) \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0435 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u043C \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043D\u0430 \u043F\u0440\u043E\u0442\u044F\u0436\u0435\u043D\u0438\u0438 \u0432\u0441\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F;
\u0431) \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u0438\u0435 \xAB\u0433\u043E\u0440\u044F\u0447\u0438\u0445\xBB \u0438 \xAB\u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0445\xBB \u0442\u043E\u0447\u0435\u043A, \u0430 \u0442\u0430\u043A\u0436\u0435 \u0437\u043E\u043D \u0441 \u043D\u0435\u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u044B\u043C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u043C \u0440\u0435\u0436\u0438\u043C\u043E\u043C;
\u0432) \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u0444\u0438\u043A\u0441\u0430\u0446\u0438\u044F \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u043A\u043E\u043B\u0435\u0431\u0430\u043D\u0438\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B;
\u0433) \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439 \u043F\u043E \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0433\u043E \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043B\u0435\u043A\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0441\u0440\u0435\u0434\u0441\u0442\u0432;
\u0434) \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 (\u0443\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u0435) \u043C\u0435\u0441\u0442 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B.`,
  "6.1": `\u0422\u0438\u043F \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u0434\u0430\u043D\u043D\u044B\u0445: [\u0443\u043A\u0430\u0437\u0430\u0442\u044C \u043C\u0430\u0440\u043A\u0443/\u043C\u043E\u0434\u0435\u043B\u044C]
\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439: [\u0443\u043A\u0430\u0437\u0430\u0442\u044C]
\u0422\u043E\u0447\u043D\u043E\u0441\u0442\u044C: \xB1[\u0443\u043A\u0430\u0437\u0430\u0442\u044C] \xB0C
\u0418\u043D\u0442\u0435\u0440\u0432\u0430\u043B \u0437\u0430\u043F\u0438\u0441\u0438: [\u0443\u043A\u0430\u0437\u0430\u0442\u044C] \u043C\u0438\u043D\u0443\u0442
\u0414\u0430\u0442\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0439 \u043F\u043E\u0432\u0435\u0440\u043A\u0438: [\u0443\u043A\u0430\u0437\u0430\u0442\u044C]
\u0421\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E \u043E \u043F\u043E\u0432\u0435\u0440\u043A\u0435 \u2116: [\u0443\u043A\u0430\u0437\u0430\u0442\u044C]`,
  "6.2": `\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0437\u0430 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F: [\u0424\u0418\u041E, \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C]
\u0418\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u0438: [\u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u0438\u0442\u044C \u0424\u0418\u041E \u0438 \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u0438]`,
  "6.3": `\u0425\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u044B \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u041E\u0431\u0449\u0438\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F\xBB (\u0440\u0430\u0437\u0434\u0435\u043B 5).`,
  "6.4": `\u041A\u0440\u0438\u0442\u0435\u0440\u0438\u0438 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438:
\u2022 \u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u043E \u0432\u0441\u0435\u0445 \u0442\u043E\u0447\u043A\u0430\u0445 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.
\u2022 MKT \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0442\u044C \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u043F\u0440\u0435\u0434\u0435\u043B \u0440\u0435\u0436\u0438\u043C\u0430 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.
\u2022 \u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u043A\u0440\u0430\u0442\u043A\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F: \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 [\u0443\u043A\u0430\u0437\u0430\u0442\u044C] \xB0C \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 [\u0443\u043A\u0430\u0437\u0430\u0442\u044C] \u043C\u0438\u043D\u0443\u0442.`,
  "6.5": `\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0438 \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0442\u043E\u0447\u0435\u043A \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u043F. 16\u0434 \u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438 \u0415\u042D\u041A \u2116 8 \u0441 \u0443\u0447\u0451\u0442\u043E\u043C \u043E\u0431\u044A\u0451\u043C\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F. \u0420\u0430\u0441\u0447\u0451\u0442 \u043F\u0440\u0438\u0432\u0435\u0434\u0451\u043D \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u041E\u0431\u0449\u0438\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F\xBB.`,
  "6.6": `\u0422\u043E\u0447\u043A\u0438 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u043D\u0430 \u0441\u0445\u0435\u043C\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F (\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u2116 1). \u041A\u0430\u0436\u0434\u043E\u0439 \u0442\u043E\u0447\u043A\u0435 \u043F\u0440\u0438\u0441\u0432\u043E\u0435\u043D \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440.`,
  "6.7": `\u0412\u0441\u0435 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u044B \u0437\u0430\u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u043D\u0430 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u044B\u0439 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B \u0437\u0430\u043F\u0438\u0441\u0438. \u0414\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u043F\u0435\u0440\u0435\u0434 \u043D\u0430\u0447\u0430\u043B\u043E\u043C \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F. \u041C\u0430\u0440\u043A\u0438\u0440\u043E\u0432\u043A\u0430 \u043D\u0430\u043D\u0435\u0441\u0435\u043D\u0430 \u043D\u0430 \u043A\u043E\u0440\u043F\u0443\u0441 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430.`,
  "6.8": `\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u044B \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u044B \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441\u043E \u0441\u0445\u0435\u043C\u043E\u0439 (\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u2116 1). \u0420\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E \u0434\u043E \u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438.`,
  "6.9": `\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u044B \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u044B \u043F\u043E \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0438 \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438. \u0414\u0430\u043D\u043D\u044B\u0435 \u0432\u044B\u0433\u0440\u0443\u0436\u0435\u043D\u044B \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 [\u0443\u043A\u0430\u0437\u0430\u0442\u044C] \u0447\u0430\u0441\u043E\u0432 \u043F\u043E\u0441\u043B\u0435 \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u044F.`,
  "6.10": `\u0414\u0430\u043D\u043D\u044B\u0435 \u0441 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0432\u044B\u0433\u0440\u0443\u0436\u0435\u043D\u044B \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E [\u0443\u043A\u0430\u0437\u0430\u0442\u044C \u041F\u041E]. \u0424\u0430\u0439\u043B\u044B \u0434\u0430\u043D\u043D\u044B\u0445 \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0435\u043D\u044B \u0434\u043B\u044F \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u043D\u043E\u0433\u043E \u0430\u043D\u0430\u043B\u0438\u0437\u0430. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0432 \u0430\u0440\u0445\u0438\u0432\u0435.`
};
function drawWarehouseProtocolPart1(doc, input) {
  const sec = (key) => {
    const custom = input.warehouseSections?.[key];
    return custom !== void 0 && custom.trim() !== "" ? custom : WAREHOUSE_DEFAULT_SECTIONS[key] ?? "";
  };
  doc.addPage();
  drawSectionTitle(doc, "1. \u0421\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u0438\u044F \u0438 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F");
  drawSubTitle(doc, "1.1. \u0421\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u0438\u044F");
  const abbrevText = sec("1.1");
  abbrevText.split("\n").forEach((line) => {
    if (!line.trim()) {
      doc.moveDown(0.3);
      return;
    }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "left" });
  });
  doc.moveDown(0.8);
  drawSubTitle(doc, "1.2. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F");
  const defText = sec("1.2");
  defText.split("\n").forEach((line) => {
    if (!line.trim()) {
      doc.moveDown(0.3);
      return;
    }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "justify" });
  });
  doc.addPage();
  drawSectionTitle(doc, "2. \u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0438 \u043E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435");
  drawSubTitle(doc, "2.1. \u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
  renderTextBlock(doc, sec("2.1"));
  drawSubTitle(doc, "2.2. \u041E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
  drawSubTitle2(doc, "2.2.1. \u041D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u044B\u0435 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F");
  renderTextBlock(doc, sec("2.2.1"));
  drawSubTitle2(doc, "2.2.2. \u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F");
  renderTextBlock(doc, sec("2.2.2"));
  doc.addPage();
  drawSectionTitle(doc, "3. \u041E\u0431\u043B\u0430\u0441\u0442\u044C \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F");
  renderTextBlock(doc, sec("3"));
  drawSectionTitle(doc, "4. \u0426\u0435\u043B\u0438 \u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
  renderTextBlock(doc, sec("4"));
  doc.addPage();
  drawSectionTitle(doc, "5. \u041E\u0431\u0449\u0438\u0435 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u043E\u0431\u044A\u0435\u043A\u0442\u0435 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438");
  drawGeneralInfoTable(doc, input);
  drawRevisionHistorySection(doc, input);
  const eqList = input.warehouseEquipment ?? [];
  if (eqList.length > 0) {
    doc.moveDown(0.8);
    drawSubTitle(doc, "5.1. \u041F\u0435\u0440\u0435\u0447\u0435\u043D\u044C \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u043E\u043D\u044B \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F");
    eqList.forEach((eq2, idx) => {
      ensureSpace2(doc, 60);
      doc.font("bold").fontSize(10).fillColor(ACCENT).text(`\u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 ${idx + 1}: ${eq2.name}`, { underline: false });
      const rows = [
        ["\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C", eq2.manufacturer ?? "\u2014"],
        ["\u041C\u043E\u0434\u0435\u043B\u044C", eq2.model ?? "\u2014"],
        ["\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440", eq2.serial ?? "\u2014"],
        ["\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", eq2.purpose ?? "\u2014"]
      ];
      rows.forEach(([label, value]) => {
        doc.font("body").fontSize(10).fillColor(MUTED).text(`${label}: `, { continued: true }).fillColor(ACCENT).text(value);
      });
      doc.moveDown(0.5);
    });
  }
  doc.addPage();
  drawSectionTitle(doc, "6. \u041C\u0435\u0442\u043E\u0434\u043E\u043B\u043E\u0433\u0438\u044F \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0433\u043E \u043A\u0430\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
  const methodSubs = [
    ["6.1. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0432\u044B\u0431\u043E\u0440\u0435 \u0442\u0438\u043F\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430 \u0434\u0430\u043D\u043D\u044B\u0445", "6.1"],
    ["6.2. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044F\u0445", "6.2"],
    ["6.3. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u043E\u0431\u044A\u0435\u043A\u0442\u0435 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F", "6.3"],
    ["6.4. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u044F\u0445 \u043F\u0440\u0438\u0435\u043C\u043B\u0435\u043C\u043E\u0441\u0442\u0438", "6.4"],
    ["6.5. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0438 \u0442\u043E\u0447\u0435\u043A \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F", "6.5"],
    ["6.6. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u0442\u043E\u0447\u0435\u043A \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F", "6.6"],
    ["6.7. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043C\u0430\u0440\u043A\u0438\u0440\u043E\u0432\u043A\u0435 \u0438 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0438", "6.7"],
    ["6.8. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432", "6.8"],
    ["6.9. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E\u0431 \u0438\u0437\u0432\u043B\u0435\u0447\u0435\u043D\u0438\u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u0432", "6.9"],
    ["6.10. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0435 \u0438 \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0438 \u0434\u0430\u043D\u043D\u044B\u0445", "6.10"]
  ];
  methodSubs.forEach(([title, key]) => {
    ensureSpace2(doc, 80);
    drawSubTitle(doc, title);
    renderTextBlock(doc, sec(key));
  });
  doc.addPage();
  drawSubTitle(doc, "6.11. \u041F\u043B\u0430\u043D IQ \u2014 \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043C\u043E\u043D\u0442\u0430\u0436\u0430");
  drawStageBlocks(doc, input.iq);
  drawChecklistPlan(doc, input.iq.items);
  doc.addPage();
  drawSubTitle(doc, "6.12. \u041F\u043B\u0430\u043D OQ \u2014 \u041A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
  drawStageBlocks(doc, input.oq);
  drawChecklistPlan(doc, input.oq.items);
  doc.addPage();
  drawSubTitle(doc, "6.13. \u041F\u043B\u0430\u043D PV \u2014 \u042D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F");
  drawStageBlocks(doc, input.pv);
  drawPVPlan(doc, input.pv, input);
  doc.addPage();
  drawSectionTitle(doc, "7. \u041F\u043E\u0434\u043F\u0438\u0441\u0438 \u043A \u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0443");
  drawSignaturesBlock(
    doc,
    getSignatoriesPart1(input),
    "\u041D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0440\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D \u0438 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D:"
  );
}
function renderTextBlock(doc, text2) {
  if (!text2 || !text2.trim()) {
    doc.font("body").fontSize(10).fillColor(MUTED).text("(\u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E)");
    doc.moveDown(0.5);
    return;
  }
  text2.split("\n").forEach((line) => {
    if (!line.trim()) {
      doc.moveDown(0.3);
      return;
    }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "justify" });
  });
  doc.moveDown(0.8);
}
function drawSubTitle2(doc, title) {
  ensureSpace2(doc, 40);
  doc.font("bold").fontSize(10).fillColor(ACCENT).text(title, { underline: false });
  doc.moveDown(0.4);
}
function drawSensorTable(doc, sensors2, sensorAccuracy = 0.2) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalWidth = right - left;
  const colWidths = {
    number: totalWidth * 0.28,
    calibrationDate: totalWidth * 0.2,
    nextCalibrationDate: totalWidth * 0.2,
    status: totalWidth * 0.16,
    accuracy: totalWidth * 0.16
  };
  const headers = ["\u041D\u043E\u043C\u0435\u0440 \u0434\u0430\u0442\u0447\u0438\u043A\u0430", "\u0414\u0430\u0442\u0430 \u043F\u043E\u0432\u0435\u0440\u043A\u0438", "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u043F\u043E\u0432\u0435\u0440\u043A\u0430", "\u0421\u0442\u0430\u0442\u0443\u0441", "\u041F\u043E\u0433\u0440\u0435\u0448\u043D\u043E\u0441\u0442\u044C (\xB1 \xB0C)"];
  const headerY = doc.y;
  doc.font("bold").fontSize(9).fillColor(ACCENT);
  let x = left;
  headers.forEach((header, idx) => {
    const colW = Object.values(colWidths)[idx];
    doc.text(header, x, headerY, { width: colW, align: "left", lineBreak: true });
    x += colW;
  });
  doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.3);
  doc.font("body").fontSize(9).fillColor(ACCENT);
  const accuracyText = `\xB1${sensorAccuracy.toFixed(2)}`;
  const now = Date.now();
  sensors2.forEach((sensor) => {
    ensureSpace2(doc, 28);
    const rowY = doc.y;
    const calibDate = sensor.calibrationDate ? new Date(sensor.calibrationDate).toLocaleDateString("ru-RU") : "\u2014";
    const nextDate = sensor.nextCalibrationDate ? new Date(sensor.nextCalibrationDate).toLocaleDateString("ru-RU") : "\u2014";
    const nextTime = sensor.nextCalibrationDate ? new Date(sensor.nextCalibrationDate).getTime() : NaN;
    const computedStatus = Number.isFinite(nextTime) && nextTime < now ? "expired" : Number.isFinite(nextTime) && nextTime - now <= 30 * 24 * 60 * 60 * 1e3 ? "expiring_soon" : sensor.status;
    sensor.status = computedStatus;
    let statusText = sensor.status || "\u2014";
    let statusColor = ACCENT;
    if (sensor.status === "expired") {
      statusText = "\u041F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u0430";
      statusColor = "#d32f2f";
    } else if (sensor.status === "expiring_soon") {
      statusText = "\u0418\u0441\u0442\u0435\u043A\u0430\u0435\u0442";
      statusColor = "#f57c00";
    } else if (sensor.status === "active") {
      statusText = "\u0410\u043A\u0442\u0438\u0432\u043D\u0430";
      statusColor = "#388e3c";
    }
    const rowData = [sensor.number, calibDate, nextDate, statusText, accuracyText];
    x = left;
    Object.values(colWidths).forEach((colW, idx) => {
      doc.fillColor(idx === 3 ? statusColor : ACCENT);
      doc.text(rowData[idx], x, rowY, { width: colW, align: "left", lineBreak: true });
      x += colW;
    });
    doc.moveDown(1.2);
  });
  doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.5);
}

// server/warehouseQuestions.ts
var COMMON_IQ = [
  "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0442\u0430\u0431\u043B\u0438\u0447\u043A\u043E\u0439 \u0438\u043B\u0438 \u0432\u044B\u0432\u0435\u0441\u043A\u043E\u0439?",
  "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u043D\u0430 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u0430\u0441\u043F\u043E\u0440\u0442?",
  "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0430\u0434\u0440\u0435\u0441 \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0430\u0434\u0440\u0435\u0441\u0443, \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u043C\u0443 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u043A \u043B\u0438\u0446\u0435\u043D\u0437\u0438\u0438?",
  "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u043E \u043B\u0438 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435 \u0446\u0435\u043D\u0442\u0440\u0430\u043B\u044C\u043D\u044B\u043C \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u0435\u043C?",
  "\u041F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E \u043B\u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043F\u0438\u0442\u0430\u043D\u0438\u0435 (\u0418\u0411\u041F/\u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440) \u0434\u043B\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0449\u0435\u0433\u043E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C?",
  "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u043B\u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B (\u0438 \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u0438 \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438) \u0432 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0438?",
  "\u0420\u0435\u0430\u043B\u0438\u0437\u043E\u0432\u0430\u043D \u043B\u0438 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u0432 \u0437\u043E\u043D\u0443 (\u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043D\u0435\u0443\u043F\u043E\u043B\u043D\u043E\u043C\u043E\u0447\u0435\u043D\u043D\u044B\u0445 \u043B\u0438\u0446)?",
  "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043E\u0442\u0434\u0435\u043B\u043A\u0430 \u0438 \u0441\u0430\u043D\u0438\u0442\u0430\u0440\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u0421\u0430\u043D\u041F\u0438\u041D?"
];
var COMMON_OQ = [
  "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0432\u0441\u0451 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u043E\u043D\u044B (\u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u044B\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438, \u043A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D\u0435\u0440\u044B, \u043E\u0431\u043E\u0433\u0440\u0435\u0432\u0430\u0442\u0435\u043B\u0438) \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u043F\u0443\u043B\u044C\u0442\u044B \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0438 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u044B \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u043E\u043D\u044B?",
  "\u0420\u0435\u0430\u0433\u0438\u0440\u0443\u0435\u0442 \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u0432\u043A\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0445 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u043E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 (\u0438 \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C) \u043D\u0430 \u0438\u043D\u0434\u0438\u043A\u0430\u0442\u043E\u0440\u0430\u0445 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0438 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430?",
  "\u0421\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u043B\u0438 \u0441\u0438\u0433\u043D\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F (\u0437\u0432\u0443\u043A\u043E\u0432\u0430\u044F/\u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u0430\u044F/\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F) \u043F\u0440\u0438 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0437\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u0433\u0440\u0430\u043D\u0438\u0446\u044B?",
  "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0440\u0430\u0432\u043D\u043E\u043C\u0435\u0440\u043D\u043E\u0435 \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043F\u043E \u043E\u0431\u044A\u0451\u043C\u0443 \u0437\u043E\u043D\u044B (\u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440\u044B, \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u0432\u043E\u0434\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0448\u0442\u0430\u0442\u043D\u043E)?",
  "\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0432 \u043F\u0443\u0441\u0442\u043E\u0439 \u0437\u043E\u043D\u0435 \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430?",
  "\u0413\u043E\u0442\u043E\u0432\u043E \u043B\u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043A \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044E \u043F\u0440\u0438 \u0432\u044B\u0445\u043E\u0434\u0435 \u0438\u0437 \u0441\u0442\u0440\u043E\u044F \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0433\u043E (\u0435\u0441\u043B\u0438 \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E)?",
  "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u043B\u043E\u0433\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u0438 \u0430\u0440\u0445\u0438\u0432\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B (\u0438 \u0432\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u0438)?",
  "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438, \u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u043E \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044F\u0445 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0437\u043E\u043D\u044B?"
];
var KIND_IQ = {
  conditioner: [
    "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u0446\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0431\u0438\u0440\u043A\u043E\u0439 (\u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u043D\u044B\u0439/\u0441\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440)?",
    "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F / \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0432 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435?",
    "\u0418\u0434\u0435\u043D\u0442\u0438\u0447\u043D\u0430 \u043B\u0438 \u043C\u043E\u0434\u0435\u043B\u044C \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0438\u0440\u0443\u0435\u043C\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u0430\u043D\u043D\u044B\u043C \u0432 \u0441\u043E\u043F\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0445 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0445?",
    "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043A \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0435\u0442\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u0432\u0438\u0434\u0438\u043C\u044B\u0435 \u043F\u0440\u0438\u0437\u043D\u0430\u043A\u0438 \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0439 \u0438\u043B\u0438 \u0434\u0435\u0444\u0435\u043A\u0442\u043E\u0432 \u043C\u043E\u043D\u0442\u0430\u0436\u0430?"
  ],
  ventilation: [
    "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u043F\u0430\u0441\u043F\u043E\u0440\u0442/\u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0430 \u043F\u0440\u0438\u0442\u043E\u0447\u043D\u043E-\u0432\u044B\u0442\u044F\u0436\u043D\u0443\u044E \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u043E\u043D\u043D\u0443\u044E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443?",
    "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438?",
    "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D \u043B\u0438 \u043C\u043E\u043D\u0442\u0430\u0436 \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u0432\u043E\u0434\u043E\u0432 \u0438 \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u043E\u043D\u043D\u044B\u0445 \u0440\u0435\u0448\u0451\u0442\u043E\u043A \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0441\u0445\u0435\u043C\u0435?",
    "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u043B\u0438 \u0444\u0438\u043B\u044C\u0442\u0440\u044B \u0432\u043E\u0437\u0434\u0443\u0445\u0430 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 GxP \u0434\u043B\u044F \u0434\u0430\u043D\u043D\u043E\u0439 \u0437\u043E\u043D\u044B?",
    "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u043B\u0438 \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043A \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0435\u0442\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430 \u043B\u0438 \u0431\u0430\u043B\u0430\u043D\u0441\u0438\u0440\u043E\u0432\u043A\u0430 \u0432\u043E\u0437\u0434\u0443\u0448\u043D\u044B\u0445 \u043F\u043E\u0442\u043E\u043A\u043E\u0432 \u0441 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430?",
    "\u0417\u0430\u043D\u0435\u0441\u0435\u043D\u0430 \u043B\u0438 \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u0432\u043B\u0438\u044F\u044E\u0449\u0435\u0433\u043E \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u043E\u043D\u044B?"
  ],
  heat_curtain: [
    "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u043F\u0430\u0441\u043F\u043E\u0440\u0442/\u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0430 \u0442\u0435\u043F\u043B\u043E\u0432\u0443\u044E \u0437\u0430\u0432\u0435\u0441\u0443?",
    "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u043C\u0435\u0441\u0442\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0437\u0430\u0432\u0435\u0441\u044B \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u043B\u0438 \u0442\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u0437\u0430\u0432\u0435\u0441\u0430 \u043A \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0435\u0442\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u043B\u0438 \u0442\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u0437\u0430\u0432\u0435\u0441\u0430 \u043F\u043E\u043B\u043D\u043E\u0435 \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0442\u0438\u0435 \u043F\u0440\u043E\u0451\u043C\u0430?",
    "\u0417\u0430\u043D\u0435\u0441\u0435\u043D\u0430 \u043B\u0438 \u0442\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u0437\u0430\u0432\u0435\u0441\u0430 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u0432\u043B\u0438\u044F\u044E\u0449\u0435\u0433\u043E \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u043E\u043D\u044B?"
  ],
  chiller: [
    "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u043F\u0430\u0441\u043F\u043E\u0440\u0442/\u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0430 \u0447\u0438\u043B\u043B\u0435\u0440?",
    "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u043C\u0435\u0441\u0442\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0447\u0438\u043B\u043B\u0435\u0440\u0430 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D \u043B\u0438 \u043C\u043E\u043D\u0442\u0430\u0436 \u0447\u0438\u043B\u043B\u0435\u0440\u0430 \u0438 \u0442\u0440\u0443\u0431\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u043E\u0432 \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u043C \u0441\u043F\u0435\u0446\u0438\u0430\u043B\u0438\u0441\u0442\u043E\u043C?",
    "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D \u043B\u0438 \u0447\u0438\u043B\u043B\u0435\u0440 \u043A \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0435\u0442\u0438 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u0417\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D \u043B\u0438 \u0445\u043E\u043B\u043E\u0434\u0438\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0443\u0440 \u0447\u0438\u043B\u043B\u0435\u0440\u0430 \u0445\u043B\u0430\u0434\u0430\u0433\u0435\u043D\u0442\u043E\u043C \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u043D\u044B\u043C\u0438 \u0434\u0430\u043D\u043D\u044B\u043C\u0438?",
    "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430 \u043B\u0438 \u043F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F \u043F\u0443\u0441\u043A\u043E\u043D\u0430\u043B\u0430\u0434\u043A\u0430 \u0447\u0438\u043B\u043B\u0435\u0440\u0430 \u0441 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0430\u043A\u0442\u0430?",
    "\u0417\u0430\u043D\u0435\u0441\u0451\u043D \u043B\u0438 \u0447\u0438\u043B\u043B\u0435\u0440 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u0432\u043B\u0438\u044F\u044E\u0449\u0435\u0433\u043E \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u043E\u043D\u044B?"
  ],
  fan_coil: [
    "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u043F\u0430\u0441\u043F\u043E\u0440\u0442/\u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0430 \u0444\u0430\u043D\u043A\u043E\u0439\u043B?",
    "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u043C\u0435\u0441\u0442\u043E \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438 \u0444\u0430\u043D\u043A\u043E\u0439\u043B\u0430 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D \u043B\u0438 \u0444\u0430\u043D\u043A\u043E\u0439\u043B \u043A \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u0442\u0440\u0443\u0431\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u043E\u0432 \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0435\u0439?",
    "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D \u043B\u0438 \u0444\u0430\u043D\u043A\u043E\u0439\u043B \u043A \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u0441\u0435\u0442\u0438 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u041F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0430 \u043B\u0438 \u043F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F \u043F\u0443\u0441\u043A\u043E\u043D\u0430\u043B\u0430\u0434\u043A\u0430 \u0444\u0430\u043D\u043A\u043E\u0439\u043B\u0430 \u0441 \u0441\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0430\u043A\u0442\u0430?",
    "\u0417\u0430\u043D\u0435\u0441\u0451\u043D \u043B\u0438 \u0444\u0430\u043D\u043A\u043E\u0439\u043B \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u0432\u043B\u0438\u044F\u044E\u0449\u0435\u0433\u043E \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u043E\u043D\u044B?"
  ],
  other: [
    "\u0418\u043C\u0435\u0435\u0442\u0441\u044F \u043B\u0438 \u043F\u0430\u0441\u043F\u043E\u0440\u0442/\u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u0438 \u043D\u0430 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435?",
    "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D \u043B\u0438 \u043C\u043E\u043D\u0442\u0430\u0436 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F?",
    "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043A \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u044B\u043C \u0441\u0435\u0442\u044F\u043C \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438?",
    "\u0417\u0430\u043D\u0435\u0441\u0435\u043D\u043E \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F, \u0432\u043B\u0438\u044F\u044E\u0449\u0435\u0433\u043E \u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C \u0437\u043E\u043D\u044B?"
  ]
};
var KIND_OQ = {
  conditioner: [
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0438\u043D\u0434\u0438\u043A\u0430\u0446\u0438\u044F \u043D\u0430 \u0434\u0438\u0441\u043F\u043B\u0435\u0435 (\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u0440\u0435\u0436\u0438\u043C\u044B)?",
    "\u041E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442\u0441\u044F \u0438 \u0438\u0437\u0434\u0430\u0435\u0442 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u0440\u0430\u0431\u043E\u0442\u044B \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440\u0430, \u043A\u043E\u043C\u043F\u0440\u0435\u0441\u0441\u043E\u0440\u0430?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0438\u043D\u0434\u0438\u043A\u0430\u0446\u0438\u044F \u043D\u0430 \u0434\u0438\u0441\u043F\u043B\u0435\u0435 (\u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u0440\u0435\u0436\u0438\u043C\u044B)?",
    "\u0420\u0435\u0430\u0433\u0438\u0440\u0443\u044E\u0442 \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u0432\u043A\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B?",
    "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B / \u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438, \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0449\u0438\u0435 \u043D\u0430 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u044C?"
  ],
  ventilation: [
    "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
    "\u0421\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043B\u0438 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u043D\u044B\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u043C?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0440\u0435\u0433\u0443\u043B\u044F\u0442\u043E\u0440\u044B \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0442\u043E\u0440\u043E\u0432?",
    "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0439 \u0432\u043E\u0437\u0434\u0443\u0445\u043E\u043E\u0431\u043C\u0435\u043D \u0432 \u0437\u043E\u043D\u0435?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u043A\u0430 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u0435\u0439?",
    "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435 \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u043E\u043D\u043D\u043E\u0439 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0438?"
  ],
  heat_curtain: [
    "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0442\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u0437\u0430\u0432\u0435\u0441\u0430 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0437\u0430\u0432\u0435\u0441\u043E\u0439?",
    "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u043B\u0438 \u0442\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u0437\u0430\u0432\u0435\u0441\u0430 \u044D\u0444\u0444\u0435\u043A\u0442\u0438\u0432\u043D\u043E\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0445 \u0437\u043E\u043D \u043F\u0440\u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u0432\u043E\u0440\u043E\u0442\u0430\u0445/\u0434\u0432\u0435\u0440\u044F\u0445?",
    "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u0437\u0430\u0432\u0435\u0441\u044B?"
  ],
  chiller: [
    "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0447\u0438\u043B\u043B\u0435\u0440 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0447\u0438\u043B\u043B\u0435\u0440\u043E\u043C?",
    "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u043B\u0438 \u0447\u0438\u043B\u043B\u0435\u0440 \u0437\u0430\u0434\u0430\u043D\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u0442\u0435\u043F\u043B\u043E\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044F \u043D\u0430 \u0432\u044B\u0445\u043E\u0434\u0435?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0437\u0430\u0449\u0438\u0442\u0430 \u0447\u0438\u043B\u043B\u0435\u0440\u0430?",
    "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435 \u0447\u0438\u043B\u043B\u0435\u0440\u0430?"
  ],
  fan_coil: [
    "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u0444\u0430\u043D\u043A\u043E\u0439\u043B \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0444\u0430\u043D\u043A\u043E\u0439\u043B\u043E\u043C?",
    "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u043B\u0438 \u0444\u0430\u043D\u043A\u043E\u0439\u043B \u0437\u0430\u0434\u0430\u043D\u043D\u0443\u044E \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u0432\u043E\u0437\u0434\u0443\u0445\u0430 \u0432 \u0437\u043E\u043D\u0435?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0434\u0440\u0435\u043D\u0430\u0436\u043D\u0430\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0444\u0430\u043D\u043A\u043E\u0439\u043B\u0430?",
    "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435 \u0444\u0430\u043D\u043A\u043E\u0439\u043B\u0430?"
  ],
  other: [
    "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0432 \u0448\u0442\u0430\u0442\u043D\u043E\u043C \u0440\u0435\u0436\u0438\u043C\u0435?",
    "\u041A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E \u043B\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435\u043C?",
    "\u041E\u0431\u0435\u0441\u043F\u0435\u0447\u0438\u0432\u0430\u0435\u0442 \u043B\u0438 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0432 \u0437\u043E\u043D\u0435?",
    "\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043B\u0438 \u043F\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0448\u0443\u043C\u044B/\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u0438 \u0432 \u0440\u0430\u0431\u043E\u0442\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F?"
  ]
};
var EQUIPMENT_KIND_LABELS = {
  conditioner: "\u041A\u043E\u043D\u0434\u0438\u0446\u0438\u043E\u043D\u0435\u0440",
  ventilation: "\u041F\u0440\u0438\u0442\u043E\u0447\u043D\u043E-\u0432\u044B\u0442\u044F\u0436\u043D\u0430\u044F \u0432\u0435\u043D\u0442\u0438\u043B\u044F\u0446\u0438\u044F",
  heat_curtain: "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u0437\u0430\u0432\u0435\u0441\u0430",
  chiller: "\u0427\u0438\u043B\u043B\u0435\u0440",
  fan_coil: "\u0424\u0430\u043D\u043A\u043E\u0439\u043B",
  other: "\u0414\u0440\u0443\u0433\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435"
};
function buildWarehouseQuestions(equipment, stage) {
  const common = stage === "iq" ? COMMON_IQ : COMMON_OQ;
  const kindMap = stage === "iq" ? KIND_IQ : KIND_OQ;
  const seenKindsSet = [];
  const seen = /* @__PURE__ */ new Set();
  for (const eq2 of equipment) {
    const k = eq2.kind ?? "other";
    if (!seen.has(k)) {
      seen.add(k);
      seenKindsSet.push(k);
    }
  }
  const result = [...common];
  for (const kind of seenKindsSet) {
    const label = EQUIPMENT_KIND_LABELS[kind] ?? kind;
    const kindQuestions = kindMap[kind] ?? kindMap.other;
    for (const question of kindQuestions) {
      result.push(`[${label}] ${question}`);
    }
  }
  return result;
}

// server/routers.ts
var TEMP_MODE_SCHEMA = z2.enum(["2-8", "8-15", "15-25"]);
function rangeFor(tempMode, customMin, customMax) {
  const mode = TEMP_MODES.find((m) => m.id === tempMode);
  const rawMin = customMin ?? mode?.min ?? 2;
  const rawMax = customMax ?? mode?.max ?? 8;
  return applySensorAccuracyGuardBand(rawMin, rawMax, DEFAULT_SENSOR_ACCURACY_C);
}
function defaultQuestionsFor(stage, equipmentType) {
  if (equipmentType === "warehouse") {
    return stage === "iq" ? DEFAULT_IQ_QUESTIONS_WAREHOUSE : DEFAULT_OQ_QUESTIONS_WAREHOUSE;
  }
  if (equipmentType === "auto-refrigerator") {
    return stage === "iq" ? DEFAULT_IQ_QUESTIONS_AUTO_REFRIGERATOR : DEFAULT_OQ_QUESTIONS_AUTO_REFRIGERATOR;
  }
  return stage === "iq" ? DEFAULT_IQ_QUESTIONS : DEFAULT_OQ_QUESTIONS;
}
function normalizeReportActorName(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed === "\u0421\u0430\u0444\u0438\u0443\u043B\u043B\u0438\u043D \u0410.") return "\u0421\u0430\u0444\u0438\u0443\u043B\u043B\u0438\u043D \u0410.\u0412.";
  return trimmed;
}
function nonBlankString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
function pickReportActorFromGeneralInfo(gi) {
  const groups = [gi?.signatoriesPart2, gi?.signatoriesPart1, gi?.commissionMembers];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    const preferred = group.find((person) => /валидац|подготов|состав/i.test(String(person?.role ?? ""))) ?? group.find((person) => normalizeReportActorName(person?.name));
    const name = normalizeReportActorName(preferred?.name);
    if (name) return name;
  }
  return null;
}
async function ownProtocol(userId, protocolId) {
  let p = await getProtocol(userId, protocolId);
  if (!p) {
    const userCompanies = await getUserCompanies(userId);
    if (userCompanies.length > 0) {
      p = await getProtocolByCompany(userCompanies[0].id, protocolId);
    }
    if (!p) {
      const adminCompanies = await listCompanies(userId);
      if (adminCompanies.length > 0) {
        p = await getProtocolByCompany(adminCompanies[0].id, protocolId);
      }
    }
  }
  if (!p) throw new TRPCError3({ code: "NOT_FOUND", message: "\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
  return p;
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  /* -------------------------------------------------------------- */
  /* Organizations                                                  */
  /* -------------------------------------------------------------- */
  organizations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        const adminCompanies = await listCompanies(ctx.user.id);
        if (adminCompanies.length > 0) {
          return listOrganizationsByCompany(adminCompanies[0].id);
        }
        return listOrganizations(ctx.user.id);
      }
      const userCompanies = await getUserCompanies(ctx.user.id);
      if (userCompanies.length > 0) {
        return listOrganizationsByCompany(userCompanies[0].id);
      }
      return listOrganizations(ctx.user.id);
    }),
    get: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ ctx, input }) => {
      let org = await getOrganization(ctx.user.id, input.id);
      if (!org) {
        const userCompanies = await getUserCompanies(ctx.user.id);
        if (userCompanies.length > 0) org = await getOrganizationByCompany(userCompanies[0].id, input.id);
        if (!org) {
          const adminCompanies = await listCompanies(ctx.user.id);
          if (adminCompanies.length > 0) org = await getOrganizationByCompany(adminCompanies[0].id, input.id);
        }
      }
      return org;
    }),
    create: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        bin: z2.string().optional().nullable(),
        addressLegal: z2.string().optional().nullable(),
        addressFact: z2.string().optional().nullable(),
        responsible: z2.string().optional().nullable(),
        phone: z2.string().optional().nullable(),
        email: z2.string().optional().nullable()
      })
    ).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const userCompanies = await getUserCompanies(ctx.user.id);
        if (userCompanies.length === 0) {
          throw new TRPCError3({
            code: "FORBIDDEN",
            message: "\u0412\u0430\u0448\u0430 \u0443\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0438\u044F \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430. \u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u043E\u0440\u0433\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u0439 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E."
          });
        }
        const companyId2 = userCompanies[0].id;
        return insertOrganization({ ...input, userId: ctx.user.id, companyId: companyId2 });
      }
      const adminCompanies = await listCompanies(ctx.user.id);
      const companyId = adminCompanies.length > 0 ? adminCompanies[0].id : void 0;
      return insertOrganization({ ...input, userId: ctx.user.id, companyId });
    }),
    update: protectedProcedure.input(
      z2.object({
        id: z2.number(),
        name: z2.string().min(1),
        bin: z2.string().optional().nullable(),
        addressLegal: z2.string().optional().nullable(),
        addressFact: z2.string().optional().nullable(),
        responsible: z2.string().optional().nullable(),
        phone: z2.string().optional().nullable(),
        email: z2.string().optional().nullable()
      })
    ).mutation(({ ctx, input }) => updateOrganization(ctx.user.id, input.id, input)),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      await deleteOrganization(ctx.user.id, input.id);
      return { success: true };
    }),
    uploadLogo: protectedProcedure.input(
      z2.object({
        id: z2.number(),
        fileName: z2.string(),
        contentType: z2.string(),
        base64: z2.string()
      })
    ).mutation(async ({ ctx, input }) => {
      let org = await getOrganization(ctx.user.id, input.id);
      if (!org) {
        const userCompanies = await getUserCompanies(ctx.user.id);
        if (userCompanies.length > 0) org = await getOrganizationByCompany(userCompanies[0].id, input.id);
        if (!org) {
          const adminCompanies = await listCompanies(ctx.user.id);
          if (adminCompanies.length > 0) org = await getOrganizationByCompany(adminCompanies[0].id, input.id);
        }
      }
      if (!org) throw new TRPCError3({ code: "NOT_FOUND" });
      const buf = Buffer.from(input.base64, "base64");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const { key, url } = await storagePut(
        `org-${input.id}/logo-${safeName}`,
        buf,
        input.contentType
      );
      return updateOrganization(ctx.user.id, input.id, { logoKey: key, logoUrl: url });
    })
  }),
  /* -------------------------------------------------------------- */
  /* Protocols                                                      */
  /* -------------------------------------------------------------- */
  protocols: router({
    listForOrg: protectedProcedure.input(z2.object({ organizationId: z2.number() })).query(({ ctx, input }) => listProtocolsForOrg(ctx.user.id, input.organizationId)),
    listAll: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        const adminCompanies = await listCompanies(ctx.user.id);
        if (adminCompanies.length > 0) return listAllProtocolsByCompany(adminCompanies[0].id);
        return listAllProtocols(ctx.user.id);
      }
      const userCompanies = await getUserCompanies(ctx.user.id);
      if (userCompanies.length > 0) return listAllProtocolsByCompany(userCompanies[0].id);
      return listAllProtocols(ctx.user.id);
    }),
    get: protectedProcedure.input(z2.object({ id: z2.number() })).query(({ ctx, input }) => ownProtocol(ctx.user.id, input.id)),
    create: protectedProcedure.input(z2.object({ organizationId: z2.number(), companyId: z2.number().optional(), equipmentType: z2.enum(["refrigerator", "auto-refrigerator", "warehouse", "other"]).optional(), customEquipmentName: z2.string().optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const userCompanies = await getUserCompanies(ctx.user.id);
        if (userCompanies.length === 0) {
          throw new TRPCError3({
            code: "FORBIDDEN",
            message: "\u0412\u0430\u0448\u0430 \u0443\u0447\u0451\u0442\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u0438\u044F \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430. \u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u043E\u0432 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E."
          });
        }
      }
      let org = await getOrganization(ctx.user.id, input.organizationId);
      if (!org) {
        const userCompanies = await getUserCompanies(ctx.user.id);
        if (userCompanies.length > 0) {
          org = await getOrganizationByCompany(userCompanies[0].id, input.organizationId);
        }
        if (!org) {
          const adminCompanies = await listCompanies(ctx.user.id);
          if (adminCompanies.length > 0) {
            org = await getOrganizationByCompany(adminCompanies[0].id, input.organizationId);
          }
        }
      }
      if (!org) throw new TRPCError3({ code: "NOT_FOUND" });
      const year = (/* @__PURE__ */ new Date()).getFullYear();
      const number = await nextProtocolNumber(input.organizationId, year);
      const companyId = input.companyId ?? org.companyId ?? 0;
      return insertProtocol({
        organizationId: input.organizationId,
        companyId,
        userId: ctx.user.id,
        number,
        equipmentType: input.equipmentType ?? "refrigerator",
        customEquipmentName: input.customEquipmentName ?? null
      });
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      const p = await ownProtocol(ctx.user.id, input.id);
      await deleteProtocolCascade(p.userId, input.id);
      return { success: true };
    }),
    clone: protectedProcedure.input(z2.object({ sourceProtocolId: z2.number(), organizationId: z2.number() })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.sourceProtocolId);
      const newProto = await cloneProtocol(ctx.user.id, input.sourceProtocolId, input.organizationId);
      return newProto;
    })
  }),
  /* -------------------------------------------------------------- */
  /* General info                                                   */
  /* -------------------------------------------------------------- */
  generalInfo: router({
    get: protectedProcedure.input(z2.object({ protocolId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return getGeneralInfo(input.protocolId);
    }),
    save: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        equipmentType: z2.string().optional().nullable(),
        manufacturer: z2.string().optional().nullable(),
        model: z2.string().optional().nullable(),
        serial: z2.string().optional().nullable(),
        inventory: z2.string().optional().nullable(),
        year: z2.number().int().optional().nullable(),
        tempMode: z2.string().optional().nullable(),
        location: z2.string().optional().nullable(),
        purpose: z2.string().optional().nullable(),
        validationDate: z2.string().optional().nullable(),
        basis: z2.string().optional().nullable(),
        qualificationType: z2.string().optional().nullable(),
        season: z2.string().optional().nullable(),
        commissionMembers: z2.array(z2.object({ name: z2.string(), role: z2.string(), company: z2.string().optional().nullable() })).optional().nullable(),
        signatoriesPart1: z2.array(z2.object({ name: z2.string(), role: z2.string(), company: z2.string().optional().nullable() })).optional().nullable(),
        signatoriesPart2: z2.array(z2.object({ name: z2.string(), role: z2.string(), company: z2.string().optional().nullable() })).optional().nullable(),
        planDeviations: z2.string().optional().nullable(),
        recommendations: z2.string().optional().nullable(),
        reportDate: z2.string().optional().nullable(),
        documentValidityPeriod: z2.string().optional().nullable(),
        // ── Warehouse / storage zone (EAEU Рек. №8) ──
        whLengthM: z2.union([z2.number(), z2.string()]).optional().nullable(),
        whWidthM: z2.union([z2.number(), z2.string()]).optional().nullable(),
        whHeightM: z2.union([z2.number(), z2.string()]).optional().nullable(),
        whHumidityControl: z2.number().int().optional().nullable(),
        whHumidityMin: z2.union([z2.number(), z2.string()]).optional().nullable(),
        whHumidityMax: z2.union([z2.number(), z2.string()]).optional().nullable(),
        whSeason: z2.string().optional().nullable(),
        whStudyType: z2.string().optional().nullable(),
        whExternalEnv: z2.number().int().optional().nullable(),
        whLayoutNotes: z2.string().optional().nullable(),
        fillStatus: z2.enum(["empty", "loaded"]).optional().nullable(),
        loadPercent: z2.union([z2.number(), z2.string()]).optional().nullable()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      if (input.validationDate) {
        const loggers = await listLoggers(input.protocolId);
        const earliestSensorTs = loggers.reduce((min, l) => {
          const ts = l.firstTs;
          if (!ts) return min;
          return min === null ? ts : Math.min(min, ts);
        }, null);
        if (earliestSensorTs !== null) {
          const validationMs = (/* @__PURE__ */ new Date(input.validationDate + "T00:00:00")).getTime();
          if (validationMs > earliestSensorTs) {
            const earliestDate = new Date(earliestSensorTs).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });
            throw new TRPCError3({
              code: "BAD_REQUEST",
              message: `\u0414\u0430\u0442\u0430 \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u043E\u0437\u0436\u0435 \u0434\u0430\u0442\u044B \u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u043F\u0438\u0441\u0438 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432 (${earliestDate}). \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u0434\u0430\u0442\u0443 \u043D\u0435 \u043F\u043E\u0437\u0434\u043D\u0435\u0435 ${earliestDate}.`
            });
          }
        }
      }
      const { protocolId, ...patch } = input;
      const decimalKeys = [
        "whLengthM",
        "whWidthM",
        "whHeightM",
        "whHumidityMin",
        "whHumidityMax",
        "loadPercent"
      ];
      const coerced = { ...patch };
      for (const k of decimalKeys) {
        if (!(k in coerced)) continue;
        const v = coerced[k];
        if (v === void 0 || v === null || v === "") {
          coerced[k] = null;
        } else {
          coerced[k] = String(v);
        }
      }
      if ("loadPercent" in coerced && coerced.loadPercent !== null) {
        const loadPercent = Number(coerced.loadPercent);
        if (!Number.isFinite(loadPercent) || loadPercent < 0 || loadPercent > 100) {
          throw new TRPCError3({
            code: "BAD_REQUEST",
            message: "\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0442 0 \u0434\u043E 100."
          });
        }
      }
      return upsertGeneralInfo(protocolId, coerced);
    })
  }),
  /* -------------------------------------------------------------- */
  /* Stage templates                                                */
  /* -------------------------------------------------------------- */
  templates: router({
    questions: publicProcedure.input(z2.object({ stage: z2.enum(["iq", "oq"]), equipmentType: z2.string().optional() })).query(async ({ input }) => {
      if (input.equipmentType) {
        const dbTemplates = await listQuestionTemplates(input.stage, input.equipmentType);
        if (dbTemplates.length > 0) {
          return dbTemplates.map((t2) => t2.text);
        }
        if (input.equipmentType === "warehouse" || input.equipmentType === "auto-refrigerator") {
          return defaultQuestionsFor(input.stage, input.equipmentType);
        }
        const genericTemplates = await listQuestionTemplates(input.stage);
        if (genericTemplates.length > 0) {
          return genericTemplates.map((t2) => t2.text);
        }
      } else {
        const dbTemplates = await listQuestionTemplates(input.stage);
        if (dbTemplates.length > 0) {
          return dbTemplates.map((t2) => t2.text);
        }
      }
      return defaultQuestionsFor(input.stage, input.equipmentType);
    }),
    stageBlocks: publicProcedure.input(z2.object({ stage: z2.enum(["iq", "oq", "pv"]) })).query(({ input }) => STAGE_TEMPLATES[input.stage])
  }),
  /* -------------------------------------------------------------- */
  /* IQ / OQ checklist                                              */
  /* -------------------------------------------------------------- */
  checklist: router({
    get: protectedProcedure.input(z2.object({
      protocolId: z2.number(),
      stage: z2.enum(["iq", "oq"]),
      /** For warehouse protocols: which equipment's checklist to load */
      warehouseEquipmentId: z2.number().nullable().optional()
    })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return listChecklist(input.protocolId, input.stage, input.warehouseEquipmentId);
    }),
    save: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        stage: z2.enum(["iq", "oq"]),
        /** For warehouse protocols: which equipment's checklist to save */
        warehouseEquipmentId: z2.number().nullable().optional(),
        items: z2.array(
          z2.object({
            questionIndex: z2.number(),
            questionText: z2.string(),
            answer: z2.enum(["yes", "no", "na", "unset"]),
            comment: z2.string().nullable()
          })
        )
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      await saveChecklist(input.protocolId, input.stage, input.items, input.warehouseEquipmentId);
      const hasUnset = input.items.some((i) => i.answer === "unset");
      const hasNo = input.items.some((i) => i.answer === "no");
      let verdict = "none";
      if (input.items.length > 0 && !hasUnset) verdict = hasNo ? "fail" : "pass";
      const patch = {};
      if (input.stage === "iq") {
        patch.iqVerdict = verdict;
        if (verdict === "pass") patch.status = "iq_done";
      } else {
        patch.oqVerdict = verdict;
        if (verdict === "pass") patch.status = "oq_done";
      }
      await updateProtocolStatus(ctx.user.id, input.protocolId, patch);
      return { success: true, verdict };
    })
  }),
  /* -------------------------------------------------------------- */
  /* PV — performance qualification                                 */
  /* -------------------------------------------------------------- */
  pv: router({
    get: protectedProcedure.input(z2.object({ protocolId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const session = await getPVSession(input.protocolId);
      const loggers = await listLoggers(input.protocolId);
      const earliestSensorTs = loggers.reduce((min, l) => {
        const ts = l.firstTs;
        if (!ts) return min;
        return min === null ? ts : Math.min(min, ts);
      }, null);
      return {
        session,
        loggers: loggers.map((l) => ({ ...l, series: void 0 })),
        earliestSensorTs
      };
    }),
    getLoggerSeries: protectedProcedure.input(z2.object({ protocolId: z2.number(), loggerId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const all = await listLoggers(input.protocolId);
      const l = all.find((x) => x.id === input.loggerId);
      if (!l) throw new TRPCError3({ code: "NOT_FOUND" });
      return l.series;
    }),
    saveSession: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        tempMode: TEMP_MODE_SCHEMA.optional(),
        startAt: z2.number().nullable().optional(),
        endAt: z2.number().nullable().optional(),
        minDurationHours: z2.number().int().positive().optional(),
        minSensorCount: z2.number().int().positive().optional(),
        samplingStepMinutes: z2.number().int().nonnegative().nullable().optional(),
        customMin: z2.number().nullable().optional(),
        customMax: z2.number().nullable().optional(),
        coolingUnitPos: z2.object({ x: z2.number(), y: z2.number() }).nullable().optional(),
        doorPos: z2.object({ x: z2.number(), y: z2.number() }).nullable().optional(),
        floorPlanObjects: z2.array(z2.object({
          id: z2.string(),
          type: z2.string(),
          xPct: z2.number(),
          yPct: z2.number(),
          widthPct: z2.number(),
          heightPct: z2.number(),
          heightM: z2.number().optional().default(0),
          rotation: z2.number(),
          label: z2.string(),
          sensors: z2.array(z2.object({
            sensorId: z2.string(),
            heightFromFloor: z2.number()
          })).optional()
        })).nullable().optional(),
        // Room dimensions saved alongside the plan (warehouse only)
        roomLengthM: z2.union([z2.number(), z2.string()]).nullable().optional(),
        roomWidthM: z2.union([z2.number(), z2.string()]).nullable().optional(),
        roomHeightM: z2.union([z2.number(), z2.string()]).nullable().optional(),
        // Plan screenshot stored in S3
        planImageKey: z2.string().nullable().optional(),
        planImageUrl: z2.string().nullable().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const { protocolId, customMin, customMax, samplingStepMinutes, coolingUnitPos, doorPos, floorPlanObjects, roomLengthM, roomWidthM, roomHeightM, planImageKey, planImageUrl, ...rest } = input;
      const patch = { ...rest };
      if (customMin !== void 0) patch.customMin = customMin === null ? null : String(customMin);
      if (customMax !== void 0) patch.customMax = customMax === null ? null : String(customMax);
      if (samplingStepMinutes !== void 0) {
        patch.samplingStepMinutes = samplingStepMinutes === null || samplingStepMinutes === 0 ? null : samplingStepMinutes;
      }
      if (coolingUnitPos !== void 0) patch.coolingUnitPos = coolingUnitPos;
      if (doorPos !== void 0) patch.doorPos = doorPos;
      if (floorPlanObjects !== void 0) patch.floorPlanObjects = floorPlanObjects;
      const coerceDec = (v) => v === void 0 ? void 0 : v === null || v === "" ? null : String(v);
      const cL = coerceDec(roomLengthM);
      const cW = coerceDec(roomWidthM);
      const cH = coerceDec(roomHeightM);
      if (cL !== void 0) patch.roomLengthM = cL;
      if (cW !== void 0) patch.roomWidthM = cW;
      if (cH !== void 0) patch.roomHeightM = cH;
      if (planImageKey !== void 0) patch.planImageKey = planImageKey;
      if (planImageUrl !== void 0) patch.planImageUrl = planImageUrl;
      await updatePVSession(protocolId, patch);
      const session = await getPVSession(protocolId);
      if (session) {
        const gi = await getGeneralInfo(protocolId);
        const { min, max } = rangeFor(
          session.tempMode || gi?.tempMode || "2-8",
          session.customMin ? Number(session.customMin) : null,
          session.customMax ? Number(session.customMax) : null
        );
        const loggers = await listLoggers(protocolId);
        for (const l of loggers) {
          const series = l.series;
          if (!series || !series.ts) continue;
          const clipped = clipSeries(series, session.startAt, session.endAt);
          const resampled = resampleSeries(clipped, session.samplingStepMinutes);
          const stats = computeStats(resampled.temp);
          const deviations = l.role === "internal" ? findDeviations(resampled.ts, resampled.temp, min, max) : [];
          await updateLogger(l.id, {
            pointCount: resampled.temp.length,
            minVal: stats ? String(stats.min) : null,
            maxVal: stats ? String(stats.max) : null,
            avgVal: stats ? String(stats.avg) : null,
            stdVal: stats ? String(stats.std) : null,
            mktVal: stats ? String(stats.mkt) : null,
            deviations
          });
        }
      }
      return { success: true };
    }),
    savePlanImage: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        // PNG data URL (data:image/png;base64,...) or raw base64 string
        dataUrl: z2.string()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const session = await getPVSession(input.protocolId);
      if (!session) throw new TRPCError3({ code: "NOT_FOUND", message: "PV session missing" });
      const m = input.dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
      const base64 = m ? m[2] : input.dataUrl;
      const ext = m && (m[1] === "jpeg" || m[1] === "jpg") ? "jpg" : "png";
      const ct = ext === "png" ? "image/png" : "image/jpeg";
      const buf = Buffer.from(base64, "base64");
      const fileKey = `protocol-${input.protocolId}/plan-${Date.now()}.${ext}`;
      const { key, url } = await storagePut(fileKey, buf, ct);
      await updatePVSession(input.protocolId, { planImageKey: key, planImageUrl: url });
      return { key, url };
    }),
    uploadLogger: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        fileName: z2.string(),
        contentType: z2.string().optional(),
        base64: z2.string()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const session = await getPVSession(input.protocolId);
      if (!session) throw new TRPCError3({ code: "NOT_FOUND", message: "PV session missing" });
      const buf = Buffer.from(input.base64, "base64");
      const series = parseLoggerBuffer(buf, input.fileName);
      if (series.ts.length === 0) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043B\u043E\u0433\u0433\u0435\u0440\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0444\u043E\u0440\u043C\u0430\u0442 \u0444\u0430\u0439\u043B\u0430 (\u0442\u0440\u0435\u0431\u0443\u044E\u0442\u0441\u044F \u0441\u0442\u043E\u043B\u0431\u0446\u044B: \u043C\u0435\u0442\u043A\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430)."
        });
      }
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const { key, url } = await storagePut(
        `protocol-${input.protocolId}/loggers/${safeName}`,
        buf,
        input.contentType || "application/octet-stream"
      );
      const existing = await listLoggers(input.protocolId);
      const fallbackLabel = `D${existing.length + 1}`;
      const label = series.sensorName ? series.sensorName.slice(0, 64) : fallbackLabel;
      const clipped = clipSeries(series, session.startAt, session.endAt);
      const resampled = resampleSeries(clipped, session.samplingStepMinutes);
      const stats = computeStats(resampled.temp);
      const firstTs = series.ts.length > 0 ? series.ts[0] : null;
      const logger = await insertLogger({
        pvSessionId: session.id,
        protocolId: input.protocolId,
        fileKey: key,
        fileUrl: url,
        fileName: input.fileName,
        label,
        customName: null,
        role: "internal",
        pointCount: series.temp.length,
        firstTs,
        minVal: stats ? String(stats.min) : null,
        maxVal: stats ? String(stats.max) : null,
        avgVal: stats ? String(stats.avg) : null,
        stdVal: stats ? String(stats.std) : null,
        mktVal: stats ? String(stats.mkt) : null,
        series,
        deviations: []
      });
      if (series.sensorName) {
        try {
          const sensors2 = await listSensors();
          const matchingSensor = sensors2.find((s) => s.number.toLowerCase() === series.sensorName?.toLowerCase());
          if (matchingSensor) {
            await addSensorToProtocol(input.protocolId, matchingSensor.id);
          }
        } catch (err) {
        }
      }
      return logger;
    }),
    updateLogger: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        loggerId: z2.number(),
        customName: z2.string().nullable().optional(),
        role: z2.enum(["internal", "external"]).optional(),
        position: z2.string().max(32).nullable().optional(),
        // accepts legacy (top/middle/bottom/door/external/unset), ISPE IDs (C1-C8, W1-W4, V1-V3) and warehouse cell IDs (L{row}-c{col}-t{tier})
        posX: z2.number().nullable().optional(),
        posY: z2.number().nullable().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const patch = {};
      if (input.customName !== void 0) patch.customName = input.customName;
      if (input.role !== void 0) patch.role = input.role;
      if (input.position !== void 0) patch.position = input.position === null ? "unset" : input.position;
      if (input.posX !== void 0) patch.posX = input.posX;
      if (input.posY !== void 0) patch.posY = input.posY;
      return updateLogger(input.loggerId, patch);
    }),
    deleteLogger: protectedProcedure.input(z2.object({ protocolId: z2.number(), loggerId: z2.number() })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      await deleteLogger(input.loggerId);
      return { success: true };
    }),
    autoDetectExternal: protectedProcedure.input(z2.object({ protocolId: z2.number() })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const session = await getPVSession(input.protocolId);
      if (!session) throw new TRPCError3({ code: "NOT_FOUND" });
      const loggers = await listLoggers(input.protocolId);
      const gi0 = await getGeneralInfo(input.protocolId);
      const { min, max } = rangeFor(
        session.tempMode || gi0?.tempMode || "2-8",
        session.customMin ? Number(session.customMin) : null,
        session.customMax ? Number(session.customMax) : null
      );
      const externals = detectExternalSensors(
        loggers.map((l) => ({ avg: Number(l.avgVal || 0) })),
        min,
        max
      );
      for (let i = 0; i < loggers.length; i++) {
        const role = externals.includes(i) ? "external" : "internal";
        if (loggers[i].role !== role) {
          await updateLogger(loggers[i].id, { role });
        }
      }
      return { externals };
    }),
    analyze: protectedProcedure.input(z2.object({ protocolId: z2.number() })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const session = await getPVSession(input.protocolId);
      if (!session) throw new TRPCError3({ code: "NOT_FOUND" });
      const loggers = await listLoggers(input.protocolId);
      const gi1 = await getGeneralInfo(input.protocolId);
      const { min, max } = rangeFor(
        session.tempMode || gi1?.tempMode || "2-8",
        session.customMin ? Number(session.customMin) : null,
        session.customMax ? Number(session.customMax) : null
      );
      for (const l of loggers) {
        const series = l.series;
        if (!series || !series.ts) continue;
        const clipped = clipSeries(series, session.startAt, session.endAt);
        const resampled = resampleSeries(clipped, session.samplingStepMinutes);
        const stats = computeStats(resampled.temp);
        const deviations = l.role === "internal" ? findDeviations(resampled.ts, resampled.temp, min, max) : [];
        await updateLogger(l.id, {
          pointCount: resampled.temp.length,
          minVal: stats ? String(stats.min) : null,
          maxVal: stats ? String(stats.max) : null,
          avgVal: stats ? String(stats.avg) : null,
          stdVal: stats ? String(stats.std) : null,
          mktVal: stats ? String(stats.mkt) : null,
          deviations
        });
      }
      const updated = await listLoggers(input.protocolId);
      const internals = updated.filter((l) => l.role === "internal");
      const failureReasons = [];
      for (const l of internals) {
        const devCount = (l.deviations || []).length;
        if (devCount > 0) {
          failureReasons.push(
            `\u0414\u0430\u0442\u0447\u0438\u043A ${l.label}${l.customName ? " (\xAB" + l.customName + "\xBB)" : ""}: ${devCount} \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0439 \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0440\u0435\u0436\u0438\u043C\u0430 ${min}\u2026${max} \xB0C.`
          );
        }
        const mkt = Number(l.mktVal || 0);
        if (mkt < min || mkt > max) {
          failureReasons.push(
            `\u0414\u0430\u0442\u0447\u0438\u043A ${l.label}${l.customName ? " (\xAB" + l.customName + "\xBB)" : ""}: MKT ${mkt.toFixed(2)} \xB0C \u0432\u043D\u0435 \u0440\u0435\u0436\u0438\u043C\u0430 ${min}\u2026${max} \xB0C.`
          );
        }
      }
      const durationHours = session.startAt && session.endAt ? (session.endAt - session.startAt) / 36e5 : 0;
      if (durationHours < session.minDurationHours) {
        failureReasons.push(
          `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F ${durationHours.toFixed(1)} \u0447 \u043C\u0435\u043D\u044C\u0448\u0435 \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0439 (${session.minDurationHours} \u0447).`
        );
      }
      if (internals.length < session.minSensorCount) {
        failureReasons.push(
          `\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E ${internals.length} \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432, \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 ${session.minSensorCount}.`
        );
      }
      const verdict = failureReasons.length === 0 && internals.length > 0 ? "pass" : "fail";
      await updatePVSession(input.protocolId, {
        verdict,
        stats: { min, max, internalCount: internals.length, durationHours },
        deviations: failureReasons
      });
      await updateProtocolStatus(ctx.user.id, input.protocolId, {
        pvVerdict: verdict,
        status: verdict === "pass" ? "completed" : "pv_done"
      });
      return { verdict, failureReasons };
    }),
    /**
     * Sliding-window analysis: finds the best contiguous time window of
     * `durationHours` length across all uploaded loggers.
     * Scoring per window (lower = better):
     *   - gaps: missing data points across all sensors (weight 1000 each)
     *   - out-of-range points (weight 100 each)
     *   - std deviation across all sensors in window (weight 1)
     * Returns the window with the lowest score plus a human-readable explanation.
     */
    findOptimalWindow: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        durationHours: z2.number().positive()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const loggers = await listLoggers(input.protocolId);
      const internals = loggers.filter((l) => l.role === "internal");
      if (internals.length === 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u041D\u0435\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0445 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432" });
      }
      const session = await getPVSession(input.protocolId);
      const gi = await getGeneralInfo(input.protocolId);
      const { min: rangeMin, max: rangeMax } = rangeFor(
        session?.tempMode || gi?.tempMode || "2-8",
        session?.customMin ? Number(session.customMin) : null,
        session?.customMax ? Number(session.customMax) : null
      );
      const allSeries = [];
      for (const l of internals) {
        const s = l.series;
        if (s && s.ts && s.ts.length > 0) allSeries.push(s);
      }
      if (allSeries.length === 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445 \u0432 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u0430\u0445" });
      }
      const globalStart = Math.max(...allSeries.map((s) => s.ts[0]));
      const globalEnd = Math.min(...allSeries.map((s) => s.ts[s.ts.length - 1]));
      const durationMs = input.durationHours * 36e5;
      if (globalEnd - globalStart < durationMs) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: `\u041E\u0431\u0449\u0438\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0434\u0430\u043D\u043D\u044B\u0445 (${((globalEnd - globalStart) / 36e5).toFixed(1)} \u0447) \u043C\u0435\u043D\u044C\u0448\u0435 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u043D\u043E\u0433\u043E \u043E\u043A\u043D\u0430 (${input.durationHours} \u0447)`
        });
      }
      const allGaps = [];
      for (const s of allSeries) {
        for (let i = 1; i < Math.min(s.ts.length, 200); i++) {
          allGaps.push(s.ts[i] - s.ts[i - 1]);
        }
      }
      allGaps.sort((a, b) => a - b);
      const stepMs = allGaps[Math.floor(allGaps.length / 2)] || 6e5;
      const slideStepMs = stepMs;
      const expectedPoints = Math.round(durationMs / stepMs);
      let bestScore = Infinity;
      let bestStart = globalStart;
      let bestEnd = globalStart + durationMs;
      let bestGaps = 0;
      let bestOutOfRange = 0;
      let bestStd = 0;
      for (let wStart = globalStart; wStart + durationMs <= globalEnd; wStart += slideStepMs) {
        const wEnd = wStart + durationMs;
        let totalGaps = 0;
        let totalOutOfRange = 0;
        const allTemps = [];
        for (const s of allSeries) {
          const clipped = clipSeries(s, wStart, wEnd);
          const gaps = Math.max(0, expectedPoints - clipped.temp.length);
          totalGaps += gaps;
          for (const t2 of clipped.temp) {
            if (t2 < rangeMin || t2 > rangeMax) totalOutOfRange++;
            allTemps.push(t2);
          }
        }
        let std = 0;
        if (allTemps.length > 1) {
          const mean = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
          std = Math.sqrt(allTemps.reduce((a, b) => a + (b - mean) ** 2, 0) / allTemps.length);
        }
        const score = totalGaps * 1e3 + totalOutOfRange * 100 + std;
        if (score < bestScore) {
          bestScore = score;
          bestStart = wStart;
          bestEnd = wEnd;
          bestGaps = totalGaps;
          bestOutOfRange = totalOutOfRange;
          bestStd = std;
        }
      }
      const parts = [];
      if (bestGaps === 0) {
        parts.push("\u043F\u0440\u043E\u043F\u0443\u0441\u043A\u043E\u0432 \u043D\u0435\u0442");
      } else {
        parts.push(`\u043F\u0440\u043E\u043F\u0443\u0441\u043A\u043E\u0432: ${bestGaps}`);
      }
      if (bestOutOfRange === 0) {
        parts.push("\u0432\u0441\u0435 \u0442\u043E\u0447\u043A\u0438 \u0432 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u043C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0435");
      } else {
        parts.push(`${bestOutOfRange} \u0442\u043E\u0447\u0435\u043A \u0432\u043D\u0435 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430 ${rangeMin}\u2026${rangeMax} \xB0C`);
      }
      parts.push(`\u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u044C \xB1${bestStd.toFixed(2)} \xB0C`);
      return {
        startAt: bestStart,
        endAt: bestEnd,
        explanation: parts.join(" \xB7 "),
        gapCount: bestGaps,
        outOfRangeCount: bestOutOfRange,
        stdDev: bestStd
      };
    })
  }),
  /* -------------------------------------------------------------- */
  /* PDF generation                                                 */
  /* -------------------------------------------------------------- */
  report: router({
    generate: protectedProcedure.input(z2.object({ protocolId: z2.number() })).mutation(async ({ ctx, input }) => {
      const protocol = await ownProtocol(ctx.user.id, input.protocolId);
      let org = await getOrganization(ctx.user.id, protocol.organizationId);
      if (!org) {
        const userCompanies = await getUserCompanies(ctx.user.id);
        if (userCompanies.length > 0) org = await getOrganizationByCompany(userCompanies[0].id, protocol.organizationId);
        if (!org) {
          const adminCompanies = await listCompanies(ctx.user.id);
          if (adminCompanies.length > 0) org = await getOrganizationByCompany(adminCompanies[0].id, protocol.organizationId);
        }
      }
      if (!org) throw new TRPCError3({ code: "NOT_FOUND" });
      const gi = await getGeneralInfo(input.protocolId);
      const iqItems = await listChecklist(input.protocolId, "iq");
      const oqItems = await listChecklist(input.protocolId, "oq");
      const session = await getPVSession(input.protocolId);
      const loggers = await listLoggers(input.protocolId);
      const tempMode = session?.tempMode || gi?.tempMode || "2-8";
      const guardedRange = rangeFor(
        tempMode,
        session?.customMin ? Number(session.customMin) : null,
        session?.customMax ? Number(session.customMax) : null
      );
      const { min, max } = guardedRange;
      const preparedLoggers = loggers.map((l) => {
        const raw = l.series || { ts: [], temp: [] };
        const clipped = clipSeries(raw, session?.startAt ?? null, session?.endAt ?? null);
        const resampled = resampleSeries(clipped, session?.samplingStepMinutes);
        const stats = computeStats(resampled.temp);
        const deviations = l.role === "internal" ? findDeviations(resampled.ts, resampled.temp, min, max) : [];
        return { logger: l, series: resampled, stats, deviations };
      });
      const internalIdx = [];
      loggers.forEach((l, i) => {
        if (l.role === "internal") internalIdx.push(i);
      });
      let hotIdx = null;
      let coldIdx = null;
      let hotMax = -Infinity;
      let coldMin = Infinity;
      for (const i of internalIdx) {
        const stats = preparedLoggers[i]?.stats;
        const avg = stats?.avg ?? Number(loggers[i].avgVal || 0);
        if (avg > hotMax) {
          hotMax = avg;
          hotIdx = i;
        }
        const minVal = stats?.min ?? Number(loggers[i].minVal || 0);
        if (minVal < coldMin) {
          coldMin = minVal;
          coldIdx = i;
        }
      }
      const extIndices = [];
      loggers.forEach((l, i) => {
        if (l.role === "external") extIndices.push(i);
      });
      const reportFailureReasons = [];
      const reportInternalLoggers = preparedLoggers.filter((l) => l.logger.role === "internal");
      const hasPVData = preparedLoggers.some((l) => l.series.temp.length > 0);
      const isWarehouseProtocol = protocol.equipmentType === "warehouse";
      if (hasPVData) {
        for (const item of reportInternalLoggers) {
          const l = item.logger;
          const devCount = item.deviations.length;
          if (devCount > 0) {
            reportFailureReasons.push(
              `\u0414\u0430\u0442\u0447\u0438\u043A ${l.label}${l.customName ? " (\xAB" + l.customName + "\xBB)" : ""}: ${devCount} \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0439 \u0437\u0430 \u043F\u0440\u0435\u0434\u0435\u043B\u044B \u0440\u0435\u0436\u0438\u043C\u0430 ${min}\u2026${max} \xB0C.`
            );
          }
          const mkt = item.stats?.mkt ?? Number(l.mktVal || 0);
          if (mkt < min || mkt > max) {
            reportFailureReasons.push(
              `\u0414\u0430\u0442\u0447\u0438\u043A ${l.label}${l.customName ? " (\xAB" + l.customName + "\xBB)" : ""}: MKT ${mkt.toFixed(2)} \xB0C \u0432\u043D\u0435 \u0440\u0435\u0436\u0438\u043C\u0430 ${min}\u2026${max} \xB0C.`
            );
          }
        }
        const durationHours = session?.startAt && session?.endAt ? (session.endAt - session.startAt) / 36e5 : 0;
        const minDurationHours = session?.minDurationHours ?? (isWarehouseProtocol ? 168 : 72);
        const minSensorCount = session?.minSensorCount ?? (isWarehouseProtocol ? 8 : 9);
        if (durationHours < minDurationHours) {
          reportFailureReasons.push(
            `\u0414\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F ${durationHours.toFixed(1)} \u0447 \u043C\u0435\u043D\u044C\u0448\u0435 \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0439 (${minDurationHours} \u0447).`
          );
        }
        if (reportInternalLoggers.length < minSensorCount) {
          reportFailureReasons.push(
            `\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E ${reportInternalLoggers.length} \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0445 \u0434\u0430\u0442\u0447\u0438\u043A\u043E\u0432, \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 ${minSensorCount}.`
          );
        }
      }
      const reportPVVerdict = hasPVData ? reportFailureReasons.length === 0 && reportInternalLoggers.length > 0 ? "pass" : "fail" : protocol.pvVerdict;
      const reportPVFailureReasons = hasPVData ? reportFailureReasons : session?.deviations || [];
      let logoBuffer = null;
      if (org.logoKey) {
        try {
          logoBuffer = (await storageReadBuffer(org.logoKey)).data;
        } catch (e) {
          console.warn("Logo fetch failed:", e);
        }
      }
      let planImageBuffer = null;
      const planImgKey = session?.planImageKey ?? null;
      if (planImgKey) {
        try {
          planImageBuffer = (await storageReadBuffer(planImgKey)).data;
        } catch (e) {
          console.warn("Plan image fetch failed:", e);
        }
      }
      const excursionSession = await getExcursionSession(input.protocolId);
      const excursionLoggers2 = excursionSession?.enabled ? await listExcursionLoggers(input.protocolId) : [];
      const warehouseSectionsMap = isWarehouseProtocol ? await getWarehouseSections(input.protocolId) : {};
      const warehouseEquipmentList = isWarehouseProtocol ? await listWarehouseEquipment(input.protocolId) : [];
      const reportActor = pickReportActorFromGeneralInfo(gi) || normalizeReportActorName(org.responsible) || normalizeReportActorName(ctx.user.name) || normalizeReportActorName(ctx.user.email) || "\u2014";
      const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const revisionDate = nonBlankString(gi?.validationDate) || nonBlankString(gi?.reportDate) || generatedAt;
      const reportInput = {
        org: {
          name: org.name,
          bin: org.bin,
          addressLegal: org.addressLegal,
          addressFact: org.addressFact,
          responsible: org.responsible,
          phone: org.phone,
          email: org.email,
          logoBuffer
        },
        protocol: {
          number: protocol.number,
          createdAt: protocol.createdAt,
          equipmentType: protocol.equipmentType ?? null,
          customEquipmentName: protocol.customEquipmentName ?? null
        },
        generalInfo: gi ? {
          ...gi,
          commissionMembers: gi.commissionMembers || null
        } : null,
        signatoriesPart1: gi?.signatoriesPart1 || null,
        signatoriesPart2: gi?.signatoriesPart2 || null,
        planDeviations: gi?.planDeviations || void 0,
        recommendations: gi?.recommendations || void 0,
        reportDate: gi?.reportDate || null,
        documentValidityPeriod: gi?.documentValidityPeriod || null,
        dataIntegrity: {
          revision: "01",
          preparedBy: reportActor,
          generatedBy: reportActor,
          generatedAt,
          stages: [],
          revisionHistory: [
            {
              revision: "01",
              date: revisionDate,
              change: "\u041F\u0435\u0440\u0432\u0438\u0447\u043D\u0430\u044F \u0440\u0435\u0434\u0430\u043A\u0446\u0438\u044F \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 \u0438 \u043E\u0442\u0447\u0451\u0442\u0430 \u043E \u043A\u0432\u0430\u043B\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438.",
              author: reportActor
            }
          ]
        },
        iq: {
          ...isWarehouseProtocol ? WAREHOUSE_STAGE_TEMPLATES.iq : STAGE_TEMPLATES.iq,
          items: iqItems.map((i) => ({
            questionIndex: i.questionIndex,
            questionText: i.questionText,
            answer: i.answer,
            comment: i.comment,
            updatedAt: i.updatedAt
          })).sort((a, b) => a.questionIndex - b.questionIndex),
          verdict: protocol.iqVerdict
        },
        oq: {
          ...isWarehouseProtocol ? WAREHOUSE_STAGE_TEMPLATES.oq : STAGE_TEMPLATES.oq,
          items: oqItems.map((i) => ({
            questionIndex: i.questionIndex,
            questionText: i.questionText,
            answer: i.answer,
            comment: i.comment,
            updatedAt: i.updatedAt
          })).sort((a, b) => a.questionIndex - b.questionIndex),
          verdict: protocol.oqVerdict
        },
        pv: {
          ...isWarehouseProtocol ? WAREHOUSE_STAGE_TEMPLATES.pv : STAGE_TEMPLATES.pv,
          tempMode,
          rawRangeMin: guardedRange.rawMin,
          rawRangeMax: guardedRange.rawMax,
          sensorAccuracy: guardedRange.sensorAccuracy,
          rangeMin: min,
          rangeMax: max,
          startAt: session?.startAt ?? null,
          endAt: session?.endAt ?? null,
          minDurationHours: session?.minDurationHours ?? (isWarehouseProtocol ? 168 : 72),
          minSensorCount: session?.minSensorCount ?? (isWarehouseProtocol ? 8 : 9),
          loggers: preparedLoggers.map(({ logger: l, series, stats, deviations }) => ({
            id: l.id,
            label: l.label,
            customName: l.customName,
            role: l.role,
            pointCount: series.temp.length || l.pointCount,
            min: stats?.min ?? Number(l.minVal || 0),
            max: stats?.max ?? Number(l.maxVal || 0),
            avg: stats?.avg ?? Number(l.avgVal || 0),
            std: stats?.std ?? Number(l.stdVal || 0),
            mkt: stats?.mkt ?? Number(l.mktVal || 0),
            createdAt: l.createdAt,
            series,
            deviations
          })),
          verdict: reportPVVerdict,
          failureReasons: reportPVFailureReasons,
          hotIdx,
          coldIdx,
          extIndices,
          samplingStepMinutes: session?.samplingStepMinutes ?? null,
          updatedAt: session?.updatedAt ?? null
        },
        pvLoggers: loggers.map((l) => ({
          id: l.id,
          label: l.label,
          customName: l.customName,
          role: l.role,
          position: l.position,
          posX: l.posX != null ? Number(l.posX) : null,
          posY: l.posY != null ? Number(l.posY) : null
        })),
        coolingUnitPos: session?.coolingUnitPos,
        doorPos: session?.doorPos,
        floorPlanObjects: session?.floorPlanObjects,
        // Saved plan screenshot (preferred over vector drawing in PDF) — pass as Buffer for PDFKit
        planImageUrl: planImageBuffer,
        // Room dims from pvSession (preferred over generalInfo.whXxx)
        pvRoomLengthM: session?.roomLengthM ? Number(session.roomLengthM) : null,
        pvRoomWidthM: session?.roomWidthM ? Number(session.roomWidthM) : null,
        pvRoomHeightM: session?.roomHeightM ? Number(session.roomHeightM) : null,
        excursion: excursionSession?.enabled ? {
          enabled: !!excursionSession.enabled,
          timingVsPv: excursionSession.timingVsPv ?? null,
          test1Enabled: !!excursionSession.test1Enabled,
          test2Enabled: !!excursionSession.test2Enabled,
          test3Enabled: !!excursionSession.test3Enabled,
          recordStartAt: excursionSession.recordStartAt ?? null,
          recordEndAt: excursionSession.recordEndAt ?? null,
          t1PowerOnAt: excursionSession.t1PowerOnAt ?? null,
          t1TStableAt: excursionSession.t1TStableAt ?? null,
          t1DurationSec: excursionSession.t1DurationSec ?? null,
          t1CriticalSensor: excursionSession.t1CriticalSensor ?? null,
          t1SensorEntries: excursionSession.t1SensorEntries ?? null,
          t2DoorOpenAt: excursionSession.t2DoorOpenAt ?? null,
          t2DoorCloseAt: excursionSession.t2DoorCloseAt ?? null,
          t2TBreakAt: excursionSession.t2TBreakAt ?? null,
          t2DurationSec: excursionSession.t2DurationSec ?? null,
          t2CriticalSensor: excursionSession.t2CriticalSensor ?? null,
          t2NoBreak: !!excursionSession.t2NoBreak,
          t2SensorBreaks: excursionSession.t2SensorBreaks ?? null,
          t3PowerOffAt: excursionSession.t3PowerOffAt ?? null,
          t3TestEndAt: excursionSession.t3TestEndAt ?? null,
          t3TBreakAt: excursionSession.t3TBreakAt ?? null,
          t3DurationSec: excursionSession.t3DurationSec ?? null,
          t3CriticalSensor: excursionSession.t3CriticalSensor ?? null,
          t3NoBreak: !!excursionSession.t3NoBreak,
          t3SensorBreaks: excursionSession.t3SensorBreaks ?? null,
          warnings: excursionSession.warnings ?? [],
          loggers: excursionLoggers2.map((l) => ({
            label: l.label,
            role: l.role,
            series: l.series ?? { ts: [], temp: [] }
          }))
        } : null,
        warehouseSections: Object.keys(warehouseSectionsMap).length > 0 ? warehouseSectionsMap : void 0,
        warehouseEquipment: warehouseEquipmentList.length > 0 ? warehouseEquipmentList.map((e) => ({
          name: e.name,
          manufacturer: e.manufacturer,
          model: e.model,
          serial: e.serial,
          inventory: e.inventory,
          purpose: e.purpose
        })) : void 0
      };
      try {
        const protocolSensors2 = await getProtocolSensors(input.protocolId);
        if (protocolSensors2 && protocolSensors2.length > 0) {
          reportInput.protocolSensors = protocolSensors2.map((ps) => ({
            id: ps.id,
            number: ps.number,
            calibrationDate: ps.calibrationDate,
            nextCalibrationDate: ps.nextCalibrationDate,
            status: ps.status
          }));
        }
      } catch (err) {
      }
      const buffer = await generateProtocolPdf(reportInput);
      const { key, url } = await storagePut(
        `protocol-${input.protocolId}/report-${protocol.number}-${Date.now()}.pdf`,
        buffer,
        "application/pdf"
      );
      return { key, url, size: buffer.length };
    })
  }),
  /* -------------------------------------------------------------- */
  /* Question Templates                                             */
  /* -------------------------------------------------------------- */
  questionTemplates: router({
    list: protectedProcedure.input(z2.object({
      equipmentType: z2.string().optional(),
      /** For warehouse: filter by equipment kind. Pass null for general warehouse questions, a kind string for kind-specific. */
      equipmentKind: z2.string().nullable().optional()
    }).optional()).query(({ input }) => listAllQuestionTemplates(input?.equipmentType, input?.equipmentKind)),
    create: protectedProcedure.input(
      z2.object({
        stage: z2.enum(["iq", "oq"]),
        text: z2.string().min(1),
        equipmentType: z2.enum(["refrigerator", "auto-refrigerator", "warehouse", "other"]).optional(),
        /** For warehouse: which equipment kind these questions apply to */
        equipmentKind: z2.enum(["conditioner", "ventilation", "heat_curtain", "chiller", "fan_coil", "other"]).nullable().optional()
      })
    ).mutation(async ({ input }) => {
      const eqType = input.equipmentType || "refrigerator";
      const eqKind = input.equipmentKind ?? null;
      const all = await listAllQuestionTemplates(eqType, eqKind);
      const stageItems = all.filter((q) => q.stage === input.stage);
      const maxOrd = stageItems.length > 0 ? Math.max(...stageItems.map((q) => q.ord)) : 0;
      return insertQuestionTemplate({ stage: input.stage, text: input.text, ord: maxOrd + 10, equipmentType: eqType, equipmentKind: eqKind });
    }),
    update: protectedProcedure.input(
      z2.object({
        id: z2.number(),
        text: z2.string().min(1).optional(),
        ord: z2.number().optional()
      })
    ).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateQuestionTemplate(id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ input }) => deleteQuestionTemplate(input.id)),
    reorder: protectedProcedure.input(
      z2.object({
        // Array of { id, ord } pairs representing the new order
        items: z2.array(z2.object({ id: z2.number(), ord: z2.number() }))
      })
    ).mutation(async ({ input }) => {
      await Promise.all(
        input.items.map((item) => updateQuestionTemplate(item.id, { ord: item.ord }))
      );
      return { success: true };
    }),
    seedDefaults: protectedProcedure.input(z2.object({
      equipmentType: z2.enum(["refrigerator", "auto-refrigerator", "warehouse", "other"]),
      overwrite: z2.boolean().optional()
    })).mutation(async ({ input }) => {
      const existing = await listAllQuestionTemplates(input.equipmentType);
      if (existing.length > 0 && !input.overwrite) {
        return { inserted: 0, skipped: existing.length };
      }
      if (input.overwrite && existing.length > 0) {
        await Promise.all(existing.map((q) => deleteQuestionTemplate(q.id)));
      }
      const iqQuestions = defaultQuestionsFor("iq", input.equipmentType);
      const oqQuestions = defaultQuestionsFor("oq", input.equipmentType);
      const inserts = [];
      iqQuestions.forEach((text2, i) => {
        inserts.push(insertQuestionTemplate({ stage: "iq", text: text2, ord: (i + 1) * 10, equipmentType: input.equipmentType }));
      });
      oqQuestions.forEach((text2, i) => {
        inserts.push(insertQuestionTemplate({ stage: "oq", text: text2, ord: (i + 1) * 10, equipmentType: input.equipmentType }));
      });
      await Promise.all(inserts);
      return { inserted: iqQuestions.length + oqQuestions.length, skipped: 0 };
    })
  }),
  /* -------------------------------------------------------------- */
  /* Excursion Study                                                */
  /* -------------------------------------------------------------- */
  excursion: router({
    getSession: protectedProcedure.input(z2.object({ protocolId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return getExcursionSession(input.protocolId);
    }),
    saveSession: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        enabled: z2.boolean().optional(),
        timingVsPv: z2.enum(["before_pv", "after_pv", "independent"]).optional(),
        test1Enabled: z2.boolean().optional(),
        test2Enabled: z2.boolean().optional(),
        test3Enabled: z2.boolean().optional(),
        recordStartAt: z2.number().nullable().optional(),
        recordEndAt: z2.number().nullable().optional(),
        t1PowerOnAt: z2.number().nullable().optional(),
        t1StabilizationThresholdMinutes: z2.number().optional(),
        t2DoorOpenAt: z2.number().nullable().optional(),
        t2DoorCloseAt: z2.number().nullable().optional(),
        t3PowerOffAt: z2.number().nullable().optional(),
        t3TestEndAt: z2.number().nullable().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const { protocolId, ...rest } = input;
      const boolToInt = (v) => v === void 0 ? void 0 : v ? 1 : 0;
      return upsertExcursionSession(protocolId, {
        ...rest,
        enabled: boolToInt(rest.enabled),
        test1Enabled: boolToInt(rest.test1Enabled),
        test2Enabled: boolToInt(rest.test2Enabled),
        test3Enabled: boolToInt(rest.test3Enabled)
      });
    }),
    listLoggers: protectedProcedure.input(z2.object({ protocolId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return listExcursionLoggers(input.protocolId);
    }),
    uploadLogger: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        fileName: z2.string(),
        contentType: z2.string().optional(),
        base64: z2.string()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      let session = await getExcursionSession(input.protocolId);
      if (!session) {
        session = await upsertExcursionSession(input.protocolId, { enabled: 1 });
      }
      if (!session) throw new TRPCError3({ code: "NOT_FOUND", message: "Excursion session missing" });
      const buf = Buffer.from(input.base64, "base64");
      const series = parseLoggerBuffer(buf, input.fileName);
      if (series.ts.length === 0) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u043B\u043E\u0433\u0433\u0435\u0440\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0444\u043E\u0440\u043C\u0430\u0442 \u0444\u0430\u0439\u043B\u0430."
        });
      }
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const { key, url } = await storagePut(
        `protocol-${input.protocolId}/excursion/${safeName}`,
        buf,
        input.contentType || "application/octet-stream"
      );
      const existing = await listExcursionLoggers(input.protocolId);
      const fallbackLabel = `D${existing.length + 1}`;
      const label = series.sensorName ? series.sensorName.slice(0, 64) : fallbackLabel;
      const logger = await insertExcursionLogger({
        excursionSessionId: session.id,
        protocolId: input.protocolId,
        fileKey: key,
        fileUrl: url,
        fileName: input.fileName,
        label,
        customName: void 0,
        role: "internal",
        pointCount: series.ts.length,
        series
      });
      if (series.sensorName) {
        try {
          const sensors2 = await listSensors();
          const matchingSensor = sensors2.find((s) => s.number.toLowerCase() === series.sensorName?.toLowerCase());
          if (matchingSensor) {
            await addSensorToProtocol(input.protocolId, matchingSensor.id);
          }
        } catch (err) {
        }
      }
      return logger;
    }),
    updateLogger: protectedProcedure.input(
      z2.object({
        id: z2.number(),
        protocolId: z2.number(),
        customName: z2.string().optional(),
        role: z2.enum(["internal", "external"]).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return updateExcursionLogger(input.id, { customName: input.customName, role: input.role });
    }),
    deleteLogger: protectedProcedure.input(z2.object({ id: z2.number(), protocolId: z2.number() })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      await deleteExcursionLogger(input.id);
      return { success: true };
    }),
    runCalculations: protectedProcedure.input(z2.object({ protocolId: z2.number() })).mutation(async ({ ctx, input }) => {
      const protocol = await ownProtocol(ctx.user.id, input.protocolId);
      const session = await getExcursionSession(input.protocolId);
      if (!session) throw new TRPCError3({ code: "NOT_FOUND", message: "Excursion session missing" });
      const loggers = await listExcursionLoggers(input.protocolId);
      if (!loggers.length) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u041D\u0435\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432" });
      const gi = await getGeneralInfo(input.protocolId);
      const tempMode = gi?.tempMode ?? "2-8";
      const guardedRange = rangeFor(tempMode);
      const tempRange2 = [guardedRange.min, guardedRange.max];
      const sensors2 = loggers.map((l) => ({
        label: l.customName || l.label,
        ts: l.series?.ts ?? [],
        temp: l.series?.temp ?? [],
        role: l.role
      }));
      const allWarnings = [];
      const updates = {};
      if (session.test1Enabled && session.t1PowerOnAt) {
        const t1StableUntilAt = session.t2DoorOpenAt ?? session.t3PowerOffAt ?? session.recordEndAt ?? void 0;
        const r = calcTest1(
          sensors2,
          session.t1PowerOnAt,
          session.t1StabilizationThresholdMinutes ?? 15,
          tempRange2,
          t1StableUntilAt
        );
        updates.t1TStableAt = r.tStableAt;
        updates.t1DurationSec = r.durationSec;
        updates.t1CriticalSensor = r.criticalSensor;
        updates.t1SensorEntries = r.sensorEntries;
        allWarnings.push(...r.warnings);
      }
      if (session.test2Enabled && session.t2DoorOpenAt && session.t2DoorCloseAt) {
        const r = calcTest2(
          sensors2,
          session.t2DoorOpenAt,
          session.t2DoorCloseAt,
          tempRange2
        );
        updates.t2TBreakAt = r.tBreakAt;
        updates.t2DurationSec = r.durationSec;
        updates.t2CriticalSensor = r.criticalSensor;
        updates.t2NoBreak = r.noBreak ? 1 : 0;
        updates.t2SensorBreaks = r.sensorBreaks;
        allWarnings.push(...r.warnings);
      }
      if (session.test3Enabled && session.t3PowerOffAt) {
        const r = calcTest3(
          sensors2,
          session.t3PowerOffAt,
          session.recordEndAt ?? Date.now(),
          tempRange2,
          session.t3TestEndAt ?? void 0
        );
        updates.t3TBreakAt = r.tBreakAt;
        updates.t3DurationSec = r.durationSec;
        updates.t3CriticalSensor = r.criticalSensor;
        updates.t3NoBreak = r.noBreak ? 1 : 0;
        updates.t3SensorBreaks = r.sensorBreaks;
        allWarnings.push(...r.warnings);
      }
      updates.warnings = allWarnings;
      return upsertExcursionSession(input.protocolId, updates);
    })
  }),
  /* -------------------------------------------------------------- */
  /* Company management (admin + user)                              */
  /* -------------------------------------------------------------- */
  companies: router({
    // Admin: create a new company
    create: protectedProcedure.input(z2.object({ name: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      return createCompany({ name: input.name, createdByAdminId: ctx.user.id });
    }),
    // Admin: list all companies they created
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      return listCompanies(ctx.user.id);
    }),
    // Admin: get company details
    get: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const c = await getCompany(input.id);
      if (!c) throw new TRPCError3({ code: "NOT_FOUND" });
      return c;
    }),
    // Admin: list members of a company
    listMembers: protectedProcedure.input(z2.object({ companyId: z2.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      return listCompanyMembers(input.companyId);
    }),
    // Admin: invite a user by openId to a company
    inviteUser: protectedProcedure.input(z2.object({ companyId: z2.number(), openId: z2.string() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const db = await Promise.resolve().then(() => (init_db(), db_exports));
      const targetUser = await db.getUserByOpenId(input.openId);
      if (!targetUser) throw new TRPCError3({ code: "NOT_FOUND", message: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
      const existing = await getCompanyMember(targetUser.id, input.companyId);
      if (existing) throw new TRPCError3({ code: "CONFLICT", message: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0443\u0436\u0435 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0451\u043D" });
      return inviteUserToCompany({ userId: targetUser.id, companyId: input.companyId });
    }),
    // Admin: invite by email
    inviteByEmail: protectedProcedure.input(z2.object({ companyId: z2.number(), email: z2.string().email() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const db = await Promise.resolve().then(() => (init_db(), db_exports));
      const targetUser = await db.getUserByEmail(input.email);
      if (!targetUser) throw new TRPCError3({ code: "NOT_FOUND", message: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0441 \u0442\u0430\u043A\u0438\u043C email \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u041F\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u0435\u0433\u043E \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u043E\u0439\u0442\u0438 \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0443." });
      const existing = await getCompanyMember(targetUser.id, input.companyId);
      if (existing) throw new TRPCError3({ code: "CONFLICT", message: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0443\u0436\u0435 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0451\u043D" });
      return inviteUserToCompany({ userId: targetUser.id, companyId: input.companyId });
    }),
    // Admin: approve a pending member
    approveMember: protectedProcedure.input(z2.object({ memberId: z2.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      await approveCompanyMember(input.memberId, ctx.user.id);
      return { success: true };
    }),
    // Admin: reject a pending member
    rejectMember: protectedProcedure.input(z2.object({ memberId: z2.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      await rejectCompanyMember(input.memberId, ctx.user.id);
      return { success: true };
    }),
    // Admin: remove a member from company
    removeMember: protectedProcedure.input(z2.object({ memberId: z2.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      await removeCompanyMember(input.memberId);
      return { success: true };
    }),
    // Admin: list all protocols across all companies
    allProtocols: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      return listAllProtocolsForAdmin();
    }),
    // Admin: list protocols for a specific company
    protocolsByCompany: protectedProcedure.input(z2.object({ companyId: z2.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      return listProtocolsByCompany(input.companyId);
    }),
    // User: get their own companies
    myCompanies: protectedProcedure.query(async ({ ctx }) => {
      return getUserCompanies(ctx.user.id);
    }),
    myMembershipStatus: protectedProcedure.query(async ({ ctx }) => {
      const approved = await getUserCompanies(ctx.user.id);
      const pending = await getUserPendingMemberships(ctx.user.id);
      return {
        isApproved: approved.length > 0,
        isPending: pending.length > 0,
        pendingCompanies: pending.map((p) => p.companyName),
        approvedCompanies: approved.map((c) => c.name)
      };
    })
  }),
  /* ---------------------------------------------------------------- */
  /* Warehouse Protocol Sections (ЕАЭК Рек. №8 — разделы 1–7)        */
  /* ---------------------------------------------------------------- */
  warehouseSections: router({
    /** Get all section texts for a protocol, returns map {sectionKey: content} */
    get: protectedProcedure.input(z2.object({ protocolId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return getWarehouseSections(input.protocolId);
    }),
    /** Save (upsert) map of {sectionKey: content} */
    save: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        sections: z2.record(z2.string(), z2.string())
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      await saveWarehouseSections(input.protocolId, input.sections);
      return { success: true };
    })
  }),
  /* ---------------------------------------------------------------- */
  /* Warehouse Equipment — Section 5 (multiple items per protocol)    */
  /* ---------------------------------------------------------------- */
  warehouseEquipment: router({
    list: protectedProcedure.input(z2.object({ protocolId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return listWarehouseEquipment(input.protocolId);
    }),
    create: protectedProcedure.input(
      z2.object({
        protocolId: z2.number(),
        kind: z2.enum(["conditioner", "ventilation", "heat_curtain", "chiller", "fan_coil", "other"]).optional().default("other"),
        name: z2.string().min(1),
        manufacturer: z2.string().optional().nullable(),
        model: z2.string().optional().nullable(),
        serial: z2.string().optional().nullable(),
        inventory: z2.string().optional().nullable(),
        purpose: z2.string().optional().nullable(),
        ord: z2.number().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return createWarehouseEquipment({
        protocolId: input.protocolId,
        kind: input.kind,
        name: input.name,
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        serial: input.serial ?? null,
        inventory: input.inventory ?? null,
        purpose: input.purpose ?? null,
        ord: input.ord ?? 0
      });
    }),
    update: protectedProcedure.input(
      z2.object({
        id: z2.number(),
        kind: z2.enum(["conditioner", "ventilation", "heat_curtain", "chiller", "fan_coil", "other"]).optional(),
        name: z2.string().min(1).optional(),
        manufacturer: z2.string().optional().nullable(),
        model: z2.string().optional().nullable(),
        serial: z2.string().optional().nullable(),
        inventory: z2.string().optional().nullable(),
        purpose: z2.string().optional().nullable(),
        ord: z2.number().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateWarehouseEquipment(id, data);
      return { success: true };
    }),
    /** Returns auto-generated IQ/OQ questions based on equipment kinds in the object.
     * Uses DB templates when available, falls back to static defaults. */
    autoQuestions: protectedProcedure.input(z2.object({ protocolId: z2.number(), stage: z2.enum(["iq", "oq"]) })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      const equipment = await listWarehouseEquipment(input.protocolId);
      const commonDbTemplates = await listAllQuestionTemplates("warehouse", null);
      const commonQuestions = commonDbTemplates.filter((t2) => t2.stage === input.stage).sort((a, b) => a.ord - b.ord).map((t2) => t2.text);
      const seenKinds = [];
      const seen = /* @__PURE__ */ new Set();
      for (const eq2 of equipment) {
        const k = eq2.kind ?? "other";
        if (!seen.has(k)) {
          seen.add(k);
          seenKinds.push(k);
        }
      }
      const kindQuestions = [];
      for (const kind of seenKinds) {
        const kindDbTemplates = await listAllQuestionTemplates("warehouse", kind);
        const kindStageTemplates = kindDbTemplates.filter((t2) => t2.stage === input.stage).sort((a, b) => a.ord - b.ord).map((t2) => t2.text);
        if (kindStageTemplates.length > 0) {
          kindQuestions.push(...kindStageTemplates);
        } else {
          const staticQuestions = buildWarehouseQuestions([{ kind }], input.stage);
          const staticCommon = buildWarehouseQuestions([], input.stage);
          const kindOnly = staticQuestions.slice(staticCommon.length);
          kindQuestions.push(...kindOnly);
        }
      }
      if (commonQuestions.length === 0 && kindQuestions.length === 0) {
        return buildWarehouseQuestions(equipment, input.stage);
      }
      const finalCommon = commonQuestions.length > 0 ? commonQuestions : buildWarehouseQuestions([], input.stage);
      return [...finalCommon, ...kindQuestions];
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      await deleteWarehouseEquipment(input.id);
      return { success: true };
    })
  }),
  /* -------------------------------------------------------------- */
  /* Sensors (Calibration Tracking)                                  */
  /* -------------------------------------------------------------- */
  sensors: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listSensors();
    }),
    create: protectedProcedure.input(z2.object({
      number: z2.string().min(1),
      calibrationDate: z2.string(),
      nextCalibrationDate: z2.string()
    })).mutation(async ({ ctx, input }) => {
      return createSensor({
        number: input.number,
        calibrationDate: input.calibrationDate,
        nextCalibrationDate: input.nextCalibrationDate,
        status: "active"
      });
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      number: z2.string().optional(),
      calibrationDate: z2.string().optional(),
      nextCalibrationDate: z2.string().optional(),
      status: z2.enum(["active", "expiring_soon", "expired"]).optional()
    })).mutation(async ({ ctx, input }) => {
      const sensor = await getSensor(input.id);
      if (!sensor) throw new TRPCError3({ code: "NOT_FOUND" });
      return updateSensor(input.id, {
        number: input.number,
        calibrationDate: input.calibrationDate,
        nextCalibrationDate: input.nextCalibrationDate,
        status: input.status
      });
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      const sensor = await getSensor(input.id);
      if (!sensor) throw new TRPCError3({ code: "NOT_FOUND" });
      await deleteSensor(input.id);
      return { success: true };
    }),
    expiringIn30Days: protectedProcedure.query(async ({ ctx }) => {
      return getSensorsExpiringIn30Days();
    }),
    bulkCreate: protectedProcedure.input(z2.array(z2.object({
      number: z2.string().min(1),
      calibrationDate: z2.string(),
      nextCalibrationDate: z2.string()
    }))).mutation(async ({ ctx, input }) => {
      return bulkCreateSensors(input);
    })
  }),
  protocolSensors: router({
    list: protectedProcedure.input(z2.object({ protocolId: z2.number() })).query(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return getProtocolSensors(input.protocolId);
    }),
    add: protectedProcedure.input(z2.object({
      protocolId: z2.number(),
      sensorId: z2.number()
    })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      return addSensorToProtocol(input.protocolId, input.sensorId);
    }),
    remove: protectedProcedure.input(z2.object({
      protocolId: z2.number(),
      sensorId: z2.number()
    })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      await removeProtocolSensor(input.protocolId, input.sensorId);
      return { success: true };
    }),
    clear: protectedProcedure.input(z2.object({ protocolId: z2.number() })).mutation(async ({ ctx, input }) => {
      await ownProtocol(ctx.user.id, input.protocolId);
      await clearProtocolSensors(input.protocolId);
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createApp() {
  const app2 = express();
  app2.set("trust proxy", true);
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app2;
}

// server/_core/vercelHandler.ts
var app = createApp();
function normalizeRewrittenUrl(req) {
  const rawUrl = req.url || "/";
  const parsed = new URL(rawUrl, "http://localhost");
  const proxyPath = parsed.searchParams.get("__path");
  if (!proxyPath) return;
  parsed.searchParams.delete("__path");
  const query = parsed.searchParams.toString();
  req.url = `${proxyPath}${query ? `?${query}` : ""}`;
}
function handler(req, res) {
  normalizeRewrittenUrl(req);
  return app(req, res);
}
export {
  handler as default
};
