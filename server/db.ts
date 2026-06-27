import { and, desc, eq, isNull, sql, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  checklistAnswers,
  companies,
  companyMembers,
  Company,
  CompanyMember,
  excursionLoggers,
  excursionStudySessions,
  generalInfo,
  InsertCompany,
  InsertCompanyMember,
  InsertOrganization,
  InsertProtocol,
  InsertUser,
  Organization,
  organizations,
  Protocol,
  protocols,
  protocolSensors,
  pvLoggers,
  pvSessions,
  questionTemplates,
  sensors,
  Sensor,
  InsertSensor,
  ProtocolSensor,
  InsertProtocolSensor,
  User,
  users,
  warehouseProtocolSections,
  warehouseEquipment,
  type WarehouseEquipment,
  type InsertWarehouseEquipment,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
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

type LocalDevDb = {
  counters: {
    companies: number;
    companyMembers: number;
    organizations: number;
    protocols: number;
    pvSessions: number;
    pvLoggers: number;
    excursionStudySessions: number;
    excursionLoggers: number;
    sensors: number;
    protocolSensors: number;
    users: number;
    questionTemplates: number;
  };
  companies: Company[];
  companyMembers: CompanyMember[];
  organizations: Organization[];
  protocols: Protocol[];
  pvSessions: Array<typeof pvSessions.$inferSelect>;
  generalInfo: Array<typeof generalInfo.$inferSelect>;
  checklistAnswers: Array<typeof checklistAnswers.$inferSelect>;
  pvLoggers: Array<typeof pvLoggers.$inferSelect>;
  excursionStudySessions: Array<typeof excursionStudySessions.$inferSelect>;
  excursionLoggers: Array<typeof excursionLoggers.$inferSelect>;
  sensors: Sensor[];
  protocolSensors: ProtocolSensor[];
  users: User[];
  questionTemplates: Array<typeof questionTemplates.$inferSelect>;
};

const localDevAdminUser = (): User => ({
  id: 1,
  openId: "local-dev-admin",
  name: "Local Dev Admin",
  email: "dev@local.test",
  loginMethod: "local-dev",
  passwordHash: null,
  role: "admin",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  lastSignedIn: new Date().toISOString(),
} as User);

function shouldUseLocalDevDb() {
  return !ENV.isProduction && !process.env.DATABASE_URL;
}

function localDevDbPath() {
  return path.resolve(process.cwd(), ENV.storageLocalRoot || ".storage", "dev-db.json");
}

function createEmptyLocalDevDb(): LocalDevDb {
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
      questionTemplates: 0,
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
    questionTemplates: [],
  };
}

async function readLocalDevDb(): Promise<LocalDevDb> {
  try {
    const raw = await readFile(localDevDbPath(), "utf8");
    const parsed = JSON.parse(raw) as LocalDevDb;
    const hasAdmin = parsed.users.some(user => user.id === 1);
    return {
      counters: {
        companies: parsed.counters?.companies ?? parsed.companies.length,
        companyMembers: parsed.counters?.companyMembers ?? parsed.companyMembers.length,
        organizations: parsed.counters?.organizations ?? (parsed.organizations ?? []).length,
        protocols: parsed.counters?.protocols ?? (parsed.protocols ?? []).length,
        pvSessions: parsed.counters?.pvSessions ?? (parsed.pvSessions ?? []).length,
        pvLoggers: parsed.counters?.pvLoggers ?? (parsed.pvLoggers ?? []).length,
        excursionStudySessions:
          parsed.counters?.excursionStudySessions ?? (parsed.excursionStudySessions ?? []).length,
        excursionLoggers: parsed.counters?.excursionLoggers ?? (parsed.excursionLoggers ?? []).length,
        sensors: parsed.counters?.sensors ?? (parsed.sensors ?? []).length,
        protocolSensors: parsed.counters?.protocolSensors ?? (parsed.protocolSensors ?? []).length,
        users: parsed.counters?.users ?? Math.max(1, ...parsed.users.map(user => user.id)),
        questionTemplates: parsed.counters?.questionTemplates ?? (parsed.questionTemplates ?? []).length,
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
      users: hasAdmin ? parsed.users : [localDevAdminUser(), ...(parsed.users ?? [])],
      questionTemplates: parsed.questionTemplates ?? [],
    };
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.warn("[LocalDevDb] Failed to read local store; starting empty:", error);
    }
    return createEmptyLocalDevDb();
  }
}

async function writeLocalDevDb(data: LocalDevDb) {
  const filePath = localDevDbPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function updateLocalDevDb<T>(updater: (data: LocalDevDb) => T | Promise<T>) {
  const data = await readLocalDevDb();
  const result = await updater(data);
  await writeLocalDevDb(data);
  return result;
}

function companyMemberWithUser(
  member: CompanyMember,
  user: User | undefined
): CompanyMember & { user: User } {
  return {
    ...member,
    user: user ?? localDevAdminUser(),
  };
}

type ProtocolSummary = Protocol & {
  organizationName: string | null;
  equipmentModel: string | null;
  serialNumber: string | null;
  userName: string | null;
  userEmail: string | null;
};

function protocolSummary(data: LocalDevDb, protocol: Protocol): ProtocolSummary {
  const org = data.organizations.find(item => item.id === protocol.organizationId);
  const gi = data.generalInfo.find(item => item.protocolId === protocol.id);
  const user = data.users.find(item => item.id === protocol.userId);

  return {
    ...protocol,
    organizationName: org?.name ?? null,
    equipmentModel: gi?.model ?? null,
    serialNumber: gi?.serial ?? null,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
  };
}

function sortByCreatedDesc<T extends { createdAt: unknown }>(items: T[]) {
  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return;
    await updateLocalDevDb(data => {
      const existing = data.users.find(localUser => localUser.openId === user.openId);
      const now = new Date().toISOString();

      if (existing) {
        if (user.name !== undefined) existing.name = user.name ?? null;
        if (user.email !== undefined) existing.email = user.email ?? null;
        if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
        if (user.passwordHash !== undefined) existing.passwordHash = user.passwordHash ?? null;
        if (user.role !== undefined) existing.role = user.role;
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
        passwordHash: user.passwordHash ?? null,
        role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      } as User);
    });
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) values.lastSignedIn = new Date().toISOString();

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date().toISOString();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.users.find(user => user.openId === openId);
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */

export async function listOrganizations(userId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.organizations
      .filter(org => org.userId === userId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  return db
    .select()
    .from(organizations)
    .where(eq(organizations.userId, userId))
    .orderBy(desc(organizations.updatedAt));
}

/**
 * Returns all organizations belonging to a company (shared client base).
 */
export async function listOrganizationsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.organizations
      .filter(org => org.companyId === companyId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  return db
    .select()
    .from(organizations)
    .where(eq(organizations.companyId, companyId))
    .orderBy(desc(organizations.updatedAt));
}

export async function getOrganization(userId: number, orgId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.organizations.find(org => org.id === orgId && org.userId === userId);
  }
  const rows = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function insertOrganization(data: InsertOrganization) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const now = new Date().toISOString();
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
        companyId: data.companyId ?? null,
      } as Organization;

      localData.organizations.push(organization);
      return organization;
    });
  }
  const res = await db.insert(organizations).values(data);
  const [row] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, (res as any)[0].insertId))
    .limit(1);
  return row;
}

export async function updateOrganization(
  userId: number,
  orgId: number,
  data: Partial<InsertOrganization>,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const organization = localData.organizations.find(
        org => org.id === orgId && org.userId === userId
      );
      if (!organization) return undefined;

      const updates = data as Partial<Organization>;
      if (updates.name !== undefined) organization.name = updates.name;
      if (updates.bin !== undefined) organization.bin = updates.bin ?? null;
      if (updates.addressLegal !== undefined) organization.addressLegal = updates.addressLegal ?? null;
      if (updates.addressFact !== undefined) organization.addressFact = updates.addressFact ?? null;
      if (updates.responsible !== undefined) organization.responsible = updates.responsible ?? null;
      if (updates.phone !== undefined) organization.phone = updates.phone ?? null;
      if (updates.email !== undefined) organization.email = updates.email ?? null;
      if (updates.logoUrl !== undefined) organization.logoUrl = updates.logoUrl ?? null;
      if (updates.logoKey !== undefined) organization.logoKey = updates.logoKey ?? null;
      if (updates.companyId !== undefined) organization.companyId = updates.companyId ?? null;
      organization.updatedAt = new Date().toISOString();

      return organization;
    });
  }
  await db
    .update(organizations)
    .set(data)
    .where(and(eq(organizations.id, orgId), eq(organizations.userId, userId)));
  return getOrganization(userId, orgId);
}

export async function deleteOrganization(userId: number, orgId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(data => {
      data.organizations = data.organizations.filter(
        org => !(org.id === orgId && org.userId === userId)
      );
    });
    return;
  }
  // Cascade delete dependent rows
  const orgProtocols = await db
    .select({ id: protocols.id })
    .from(protocols)
    .where(and(eq(protocols.organizationId, orgId), eq(protocols.userId, userId)));
  for (const p of orgProtocols) {
    await deleteProtocolCascade(userId, p.id);
  }
  await db
    .delete(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.userId, userId)));
}

/* ------------------------------------------------------------------ */
/* Protocols                                                           */
/* ------------------------------------------------------------------ */

export async function listProtocolsForOrg(userId: number, orgId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return sortByCreatedDesc(
      data.protocols
        .filter(protocol => protocol.organizationId === orgId && protocol.userId === userId)
        .map(protocol => protocolSummary(data, protocol))
    );
  }
  return db
    .select({
      protocol: protocols,
      userName: users.name,
      userEmail: users.email,
    })
    .from(protocols)
    .leftJoin(users, eq(protocols.userId, users.id))
    .where(and(eq(protocols.organizationId, orgId), eq(protocols.userId, userId)))
    .orderBy(desc(protocols.createdAt))
    .then(rows => rows.map(r => ({
      ...r.protocol,
      userName: r.userName,
      userEmail: r.userEmail,
    })));
}

export async function listAllProtocols(userId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) {
      return [] as Array<
        typeof protocols.$inferSelect & {
          organizationName: string | null;
          equipmentModel: string | null;
          serialNumber: string | null;
          userName: string | null;
          userEmail: string | null;
        }
      >;
    }
    const data = await readLocalDevDb();
    return sortByCreatedDesc(
      data.protocols
        .filter(protocol => protocol.userId === userId)
        .map(protocol => protocolSummary(data, protocol))
    );
  }
  return db
    .select({
      protocol: protocols,
      organizationName: organizations.name,
      equipmentModel: generalInfo.model,
      serialNumber: generalInfo.serial,
      userName: users.name,
      userEmail: users.email,
    })
    .from(protocols)
    .leftJoin(organizations, eq(organizations.id, protocols.organizationId))
    .leftJoin(generalInfo, eq(generalInfo.protocolId, protocols.id))
    .leftJoin(users, eq(protocols.userId, users.id))
    .where(eq(protocols.userId, userId))
    .orderBy(desc(protocols.createdAt))
    .then(rows => rows.map(r => ({
      ...r.protocol,
      organizationName: r.organizationName,
      equipmentModel: r.equipmentModel,
      serialNumber: r.serialNumber,
      userName: r.userName,
      userEmail: r.userEmail,
    })));
}

/**
 * Returns all protocols for a company with org name + equipment info (same shape as listAllProtocols).
 */
export async function listAllProtocolsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) {
      return [] as Array<
        typeof protocols.$inferSelect & {
          organizationName: string | null;
          equipmentModel: string | null;
          serialNumber: string | null;
          userName: string | null;
          userEmail: string | null;
        }
      >;
    }
    const data = await readLocalDevDb();
    return sortByCreatedDesc(
      data.protocols
        .filter(protocol => protocol.companyId === companyId)
        .map(protocol => protocolSummary(data, protocol))
    );
  }
  const rows = await db
    .select({
      protocol: protocols,
      organizationName: organizations.name,
      equipmentModel: generalInfo.model,
      serialNumber: generalInfo.serial,
      userName: users.name,
      userEmail: users.email,
    })
    .from(protocols)
    .leftJoin(organizations, eq(organizations.id, protocols.organizationId))
    .leftJoin(generalInfo, eq(generalInfo.protocolId, protocols.id))
    .leftJoin(users, eq(protocols.userId, users.id))
    .where(eq(protocols.companyId, companyId))
    .orderBy(desc(protocols.createdAt));
  return rows.map(r => ({
    ...r.protocol,
    organizationName: r.organizationName,
    equipmentModel: r.equipmentModel,
    serialNumber: r.serialNumber,
    userName: r.userName,
    userEmail: r.userEmail,
  }));
}

/**
 * Get an organization by id, allowing access if the org belongs to the given company.
 */
export async function getOrganizationByCompany(companyId: number, orgId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.organizations.find(org => org.id === orgId && org.companyId === companyId);
  }
  const rows = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.companyId, companyId)))
    .limit(1);
  return rows[0];
}

/**
 * Get a protocol by id, allowing access if the protocol belongs to the given company.
 */
export async function getProtocolByCompany(companyId: number, protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.protocols.find(protocol => protocol.id === protocolId && protocol.companyId === companyId);
  }
  const rows = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.id, protocolId), eq(protocols.companyId, companyId)))
    .limit(1);
  return rows[0];
}

export async function getProtocol(userId: number, protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.protocols.find(protocol => protocol.id === protocolId && protocol.userId === userId);
  }
  const rows = await db
    .select()
    .from(protocols)
    .where(and(eq(protocols.id, protocolId), eq(protocols.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function nextProtocolNumber(orgId: number, year: number): Promise<string> {
  const db = await getDb();
  const prefix = `VAL-${year}-`;

  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    let max = 0;
    for (const protocol of data.protocols) {
      if (protocol.organizationId !== orgId || !protocol.number.startsWith(prefix)) continue;
      const m = protocol.number.match(/-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    const next = (max + 1).toString().padStart(4, "0");
    return `${prefix}${next}`;
  }

  const rows = await db
    .select({ number: protocols.number })
    .from(protocols)
    .where(and(eq(protocols.organizationId, orgId), sql`${protocols.number} LIKE ${prefix + "%"}`));
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

export async function nextProtocolNumberForCompany(companyId: number, year: number): Promise<string> {
  const db = await getDb();
  const prefix = "VAL-" + year + "-";

  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    let max = 0;
    for (const protocol of data.protocols) {
      if (protocol.companyId !== companyId || !protocol.number.startsWith(prefix)) continue;
      const m = protocol.number.match(/-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    const next = (max + 1).toString().padStart(4, "0");
    return prefix + next;
  }

  const rows = await db
    .select({ number: protocols.number })
    .from(protocols)
    .where(eq(protocols.companyId, companyId));
  let max = 0;
  for (const r of rows) {
    if (!r.number.startsWith(prefix)) continue;
    const m = r.number.match(/-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = (max + 1).toString().padStart(4, "0");
  return prefix + next;
}

export async function insertProtocol(data: InsertProtocol) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const now = new Date().toISOString();
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
        customEquipmentName: data.customEquipmentName ?? null,
      } as Protocol;

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
        planImageUrl: null,
      } as typeof pvSessions.$inferSelect);

      return protocol;
    });
  }
  const res = await db.insert(protocols).values(data);
  const [row] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.id, (res as any)[0].insertId))
    .limit(1);
  // Initialize empty PV session
  await db.insert(pvSessions).values({
    protocolId: row.id,
    minDurationHours: 72,
    minSensorCount: 9,
  });
  return row;
}

export async function updateProtocolStatus(
  userId: number,
  protocolId: number,
  patch: Partial<InsertProtocol>,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(data => {
      const protocol = data.protocols.find(item => item.id === protocolId && item.userId === userId);
      if (!protocol) return;
      Object.assign(protocol, patch);
      protocol.updatedAt = new Date().toISOString();
    });
    return;
  }
  await db
    .update(protocols)
    .set(patch)
    .where(and(eq(protocols.id, protocolId), eq(protocols.userId, userId)));
}

export async function deleteProtocolCascade(userId: number, protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(data => {
      const owned = data.protocols.some(protocol => protocol.id === protocolId && protocol.userId === userId);
      if (!owned) return;
      data.checklistAnswers = data.checklistAnswers.filter(item => item.protocolId !== protocolId);
      data.generalInfo = data.generalInfo.filter(item => item.protocolId !== protocolId);
      data.pvLoggers = data.pvLoggers.filter(item => item.protocolId !== protocolId);
      data.pvSessions = data.pvSessions.filter(item => item.protocolId !== protocolId);
      data.protocols = data.protocols.filter(item => item.id !== protocolId);
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

/* ------------------------------------------------------------------ */
/* General Info                                                        */
/* ------------------------------------------------------------------ */

export async function getGeneralInfo(protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.generalInfo.find(item => item.protocolId === protocolId);
  }
  const rows = await db
    .select()
    .from(generalInfo)
    .where(eq(generalInfo.protocolId, protocolId))
    .limit(1);
  return rows[0];
}

export async function upsertGeneralInfo(
  protocolId: number,
  data: Partial<typeof generalInfo.$inferInsert>,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const existing = localData.generalInfo.find(item => item.protocolId === protocolId);
      const now = new Date().toISOString();
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
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
        ...data,
      } as typeof generalInfo.$inferSelect);
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

/* ------------------------------------------------------------------ */
/* Checklists                                                          */
/* ------------------------------------------------------------------ */

export async function listChecklist(
  protocolId: number,
  stage: "iq" | "oq",
  warehouseEquipmentId?: number | null,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.checklistAnswers.filter(item => {
      const sameEquipment = warehouseEquipmentId != null
        ? item.warehouseEquipmentId === warehouseEquipmentId
        : item.warehouseEquipmentId == null;
      return item.protocolId === protocolId && item.stage === stage && sameEquipment;
    });
  }
  const conditions = [
    eq(checklistAnswers.protocolId, protocolId),
    eq(checklistAnswers.stage, stage),
  ];
  if (warehouseEquipmentId != null) {
    conditions.push(eq(checklistAnswers.warehouseEquipmentId, warehouseEquipmentId));
  } else {
    // For non-warehouse protocols, also return rows where warehouseEquipmentId is null
    conditions.push(isNull(checklistAnswers.warehouseEquipmentId));
  }
  return db.select().from(checklistAnswers).where(and(...conditions));
}
export async function saveChecklist(
  protocolId: number,
  stage: "iq" | "oq",
  items: Array<{ questionIndex: number; questionText: string; answer: "yes" | "no" | "na" | "unset"; comment: string | null }>,
  warehouseEquipmentId?: number | null,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(data => {
      data.checklistAnswers = data.checklistAnswers.filter(item => {
        const sameEquipment = warehouseEquipmentId != null
          ? item.warehouseEquipmentId === warehouseEquipmentId
          : item.warehouseEquipmentId == null;
        return !(item.protocolId === protocolId && item.stage === stage && sameEquipment);
      });
      const now = new Date().toISOString();
      data.checklistAnswers.push(...items.map((item, index) => ({
        id: data.checklistAnswers.length + index + 1,
        protocolId,
        stage,
        questionIndex: item.questionIndex,
        questionText: item.questionText,
        answer: item.answer,
        comment: item.comment,
        updatedAt: now,
        warehouseEquipmentId: warehouseEquipmentId ?? null,
      } as typeof checklistAnswers.$inferSelect)));
    });
    return;
  }
  // Delete only the rows for this specific equipment (or null for non-warehouse)
  const delConditions = [
    eq(checklistAnswers.protocolId, protocolId),
    eq(checklistAnswers.stage, stage),
  ];
  if (warehouseEquipmentId != null) {
    delConditions.push(eq(checklistAnswers.warehouseEquipmentId, warehouseEquipmentId));
  } else {
    delConditions.push(isNull(checklistAnswers.warehouseEquipmentId));
  }
  await db.delete(checklistAnswers).where(and(...delConditions));
  if (items.length === 0) return;
  await db.insert(checklistAnswers).values(
    items.map(it => ({
      protocolId,
      stage,
      warehouseEquipmentId: warehouseEquipmentId ?? null,
      questionIndex: it.questionIndex,
      questionText: it.questionText,
      answer: it.answer,
      comment: it.comment,
    })),
  );
}

/* ------------------------------------------------------------------ */
/* PV                                                                  */
/* ------------------------------------------------------------------ */

export async function getPVSession(protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.pvSessions.find(item => item.protocolId === protocolId);
  }
  const rows = await db
    .select()
    .from(pvSessions)
    .where(eq(pvSessions.protocolId, protocolId))
    .limit(1);
  return rows[0];
}

export async function updatePVSession(
  protocolId: number,
  data: Partial<typeof pvSessions.$inferInsert>,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const existing = localData.pvSessions.find(item => item.protocolId === protocolId);
      const now = new Date().toISOString();
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
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
        ...data,
      } as typeof pvSessions.$inferSelect);
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

export async function listLoggers(protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.pvLoggers
      .filter(logger => logger.protocolId === protocolId)
      .sort((a, b) => a.id - b.id);
  }
  return db
    .select()
    .from(pvLoggers)
    .where(eq(pvLoggers.protocolId, protocolId))
    .orderBy(pvLoggers.id);
}

export async function insertLogger(data: typeof pvLoggers.$inferInsert) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      localData.counters.pvLoggers += 1;
      const row = {
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
        createdAt: new Date().toISOString(),
        position: data.position ?? "unset",
        posX: data.posX ?? null,
        posY: data.posY ?? null,
        firstTs: data.firstTs ?? null,
      } as typeof pvLoggers.$inferSelect;
      localData.pvLoggers.push(row);
      return row;
    });
  }
  const res = await db.insert(pvLoggers).values(data);
  const [row] = await db
    .select()
    .from(pvLoggers)
    .where(eq(pvLoggers.id, (res as any)[0].insertId))
    .limit(1);
  return row;
}

export async function updateLogger(
  loggerId: number,
  data: Partial<typeof pvLoggers.$inferInsert>,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const logger = localData.pvLoggers.find(item => item.id === loggerId);
      if (!logger) return undefined;
      Object.assign(logger, data);
      return logger;
    });
  }
  await db.update(pvLoggers).set(data).where(eq(pvLoggers.id, loggerId));
  const [row] = await db.select().from(pvLoggers).where(eq(pvLoggers.id, loggerId)).limit(1);
  return row;
}

export async function deleteLogger(loggerId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(localData => {
      localData.pvLoggers = localData.pvLoggers.filter(item => item.id !== loggerId);
    });
    return;
  }
  await db.delete(pvLoggers).where(eq(pvLoggers.id, loggerId));
}

/* ------------------------------------------------------------------ */
/* Question Templates                                                  */
/* ------------------------------------------------------------------ */

let chamberQuestionTemplateSchemaPromise: Promise<void> | null = null;

export async function ensureChamberQuestionTemplateStorage(
  iqQuestions: string[],
  oqQuestions: string[],
) {
  const db = await getDb();
  if (!db) return;
  if (chamberQuestionTemplateSchemaPromise) return chamberQuestionTemplateSchemaPromise;

  chamberQuestionTemplateSchemaPromise = (async () => {
    const result = await db.execute(sql.raw(
      "SHOW COLUMNS FROM questionTemplates LIKE 'equipmentType'",
    ));
    const rows = (result as unknown as [Array<Record<string, unknown>>, unknown])[0] ?? [];
    const columnType = String(rows?.[0]?.Type ?? rows?.[0]?.type ?? "");
    if (columnType.includes("'chamber'")) return;

    await db.execute(sql.raw(
      "ALTER TABLE questionTemplates MODIFY COLUMN equipmentType " +
      "enum('refrigerator','auto-refrigerator','chamber','warehouse','other') " +
      "NOT NULL DEFAULT 'refrigerator'",
    ));

    for (const [stage, questions] of [
      ["iq", iqQuestions],
      ["oq", oqQuestions],
    ] as const) {
      for (const [index, text] of questions.entries()) {
        await db.execute(sql`
          INSERT INTO questionTemplates
            (stage, ord, text, isDefault, companyId, equipmentType, equipmentKind)
          SELECT
            ${stage}, ${(index + 1) * 10}, ${text}, 1, NULL, 'chamber', NULL
          WHERE NOT EXISTS (
            SELECT 1 FROM questionTemplates
            WHERE stage = ${stage} AND equipmentType = 'chamber' AND text = ${text}
          )
        `);
      }
    }
  })().catch(error => {
    chamberQuestionTemplateSchemaPromise = null;
    throw error;
  });

  return chamberQuestionTemplateSchemaPromise;
}

export async function listQuestionTemplates(stage: "iq" | "oq", equipmentType?: string) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.questionTemplates
      .filter(item => item.stage === stage && (!equipmentType || item.equipmentType === equipmentType))
      .sort((a, b) => a.ord - b.ord);
  }
  const conditions = [eq(questionTemplates.stage, stage)];
  if (equipmentType) {
    conditions.push(eq(questionTemplates.equipmentType, equipmentType as any));
  }
  return db
    .select()
    .from(questionTemplates)
    .where(and(...conditions))
    .orderBy(questionTemplates.ord);
}
export async function listAllQuestionTemplates(equipmentType?: string, equipmentKind?: string | null) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.questionTemplates
      .filter(item => {
        if (equipmentType && item.equipmentType !== equipmentType) return false;
        if (equipmentKind !== undefined) {
          if (equipmentKind === null && item.equipmentKind !== null) return false;
          if (equipmentKind !== null && item.equipmentKind !== equipmentKind) return false;
        }
        return true;
      })
      .sort((a, b) => a.stage.localeCompare(b.stage) || a.ord - b.ord);
  }
  const conditions: any[] = [];
  if (equipmentType) {
    conditions.push(eq(questionTemplates.equipmentType, equipmentType as any));
  }
  if (equipmentKind !== undefined) {
    // null means "general" (no kind), a string means a specific kind
    if (equipmentKind === null) {
      conditions.push(isNull(questionTemplates.equipmentKind));
    } else {
      conditions.push(eq(questionTemplates.equipmentKind, equipmentKind as any));
    }
  }
  const query = db
    .select()
    .from(questionTemplates)
    .orderBy(questionTemplates.stage, questionTemplates.ord);
  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}
export async function insertQuestionTemplate(data: {
  stage: "iq" | "oq";
  text: string;
  ord: number;
  equipmentType?: string;
  equipmentKind?: string | null;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const id = (localData.counters.questionTemplates ?? localData.questionTemplates.length) + 1;
      localData.counters.questionTemplates = id;
      const row = {
        id,
        stage: data.stage,
        ord: data.ord,
        text: data.text,
        isDefault: 0,
        companyId: data.companyId ?? null,
        equipmentType: (data.equipmentType as any) ?? "refrigerator",
        equipmentKind: (data.equipmentKind as any) ?? null,
      } as typeof questionTemplates.$inferSelect;
      localData.questionTemplates.push(row);
      return row;
    });
  }
  const [result] = await db.insert(questionTemplates).values({
    ...data,
    isDefault: 0,
    equipmentType: (data.equipmentType as any) ?? "refrigerator",
    equipmentKind: (data.equipmentKind as any) ?? null,
  });
  const [row] = await db
    .select()
    .from(questionTemplates)
    .where(eq(questionTemplates.id, (result as any).insertId))
    .limit(1);
  return row;
}

export async function updateQuestionTemplate(id: number, data: { text?: string; ord?: number }) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const row = localData.questionTemplates.find(item => item.id === id);
      if (!row) throw new Error("Question template not found");
      if (data.text !== undefined) row.text = data.text;
      if (data.ord !== undefined) row.ord = data.ord;
      return row;
    });
  }
  await db.update(questionTemplates).set(data).where(eq(questionTemplates.id, id));
  const [row] = await db
    .select()
    .from(questionTemplates)
    .where(eq(questionTemplates.id, id))
    .limit(1);
  return row;
}

export async function deleteQuestionTemplate(id: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(localData => {
      localData.questionTemplates = localData.questionTemplates.filter(item => item.id !== id);
    });
    return;
  }
  await db.delete(questionTemplates).where(eq(questionTemplates.id, id));
}

/* ------------------------------------------------------------------ */
/* Excursion Study helpers                                             */
/* ------------------------------------------------------------------ */

export async function getExcursionSession(protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.excursionStudySessions.find(item => item.protocolId === protocolId) ?? null;
  }
  const [row] = await db
    .select()
    .from(excursionStudySessions)
    .where(eq(excursionStudySessions.protocolId, protocolId))
    .limit(1);
  return row ?? null;
}

export async function upsertExcursionSession(
  protocolId: number,
  data: Partial<Omit<typeof excursionStudySessions.$inferInsert, "id" | "protocolId" | "updatedAt">>,
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const now = new Date().toISOString();
      const existing = localData.excursionStudySessions.find(item => item.protocolId === protocolId);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
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
        t3TestEndAt: data.t3TestEndAt ?? null,
      } as typeof excursionStudySessions.$inferSelect;
      localData.excursionStudySessions.push(row);
      return row;
    });
  }
  const existing = await getExcursionSession(protocolId);
  if (existing) {
    await db
      .update(excursionStudySessions)
      .set(data)
      .where(eq(excursionStudySessions.protocolId, protocolId));
  } else {
    await db.insert(excursionStudySessions).values({ protocolId, ...data });
  }
  return getExcursionSession(protocolId);
}

export async function listExcursionLoggers(protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.excursionLoggers
      .filter(logger => logger.protocolId === protocolId)
      .sort((a, b) => a.id - b.id);
  }
  return db
    .select()
    .from(excursionLoggers)
    .where(eq(excursionLoggers.protocolId, protocolId))
    .orderBy(excursionLoggers.id);
}

export async function insertExcursionLogger(data: {
  excursionSessionId: number;
  protocolId: number;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  label: string;
  customName?: string;
  role?: "internal" | "external";
  pointCount?: number;
  series?: unknown;
}) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      localData.counters.excursionLoggers += 1;
      const row = {
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
        createdAt: new Date().toISOString(),
      } as typeof excursionLoggers.$inferSelect;
      localData.excursionLoggers.push(row);
      return row;
    });
  }
  const [result] = await db.insert(excursionLoggers).values({
    ...data,
    role: data.role ?? "internal",
    pointCount: data.pointCount ?? 0,
  });
  const [row] = await db
    .select()
    .from(excursionLoggers)
    .where(eq(excursionLoggers.id, (result as any).insertId))
    .limit(1);
  return row;
}

export async function updateExcursionLogger(
  id: number,
  data: { customName?: string; role?: "internal" | "external" },
) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const logger = localData.excursionLoggers.find(item => item.id === id);
      if (!logger) return undefined;
      Object.assign(logger, data);
      return logger;
    });
  }
  await db.update(excursionLoggers).set(data).where(eq(excursionLoggers.id, id));
  const [row] = await db
    .select()
    .from(excursionLoggers)
    .where(eq(excursionLoggers.id, id))
    .limit(1);
  return row;
}

export async function deleteExcursionLogger(id: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(localData => {
      localData.excursionLoggers = localData.excursionLoggers.filter(item => item.id !== id);
    });
    return;
  }
  await db.delete(excursionLoggers).where(eq(excursionLoggers.id, id));
}

export async function deleteAllExcursionLoggers(protocolId: number) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(localData => {
      localData.excursionLoggers = localData.excursionLoggers.filter(item => item.protocolId !== protocolId);
    });
    return;
  }
  await db.delete(excursionLoggers).where(eq(excursionLoggers.protocolId, protocolId));
}


/* ------------------------------------------------------------------ */
/* Company Management                                                 */
/* ------------------------------------------------------------------ */

export async function createCompany(input: InsertCompany): Promise<Company> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(data => {
      const now = new Date().toISOString();
      data.counters.companies += 1;

      const company = {
        id: data.counters.companies,
        name: input.name,
        createdByAdminId: input.createdByAdminId,
        createdAt: now,
        updatedAt: now,
      } as Company;

      data.companies.push(company);

      const existingOwnerMember = data.companyMembers.find(
        member => member.companyId === company.id && member.userId === input.createdByAdminId
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
          updatedAt: now,
        } as CompanyMember);
      }

      return company;
    });
  }
  const result = await db.insert(companies).values(input);
  const id = result[0].insertId;
  const row = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row[0];
}

export async function listCompanies(adminId: number): Promise<Company[]> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companies.filter(company => company.createdByAdminId === adminId);
  }
  return db.select().from(companies).where(eq(companies.createdByAdminId, adminId));
}

export async function getCompany(id: number): Promise<Company | undefined> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.companies.find(company => company.id === id);
  }
  const row = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return row[0];
}

export async function inviteUserToCompany(input: InsertCompanyMember): Promise<CompanyMember> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(data => {
      const now = new Date().toISOString();
      data.counters.companyMembers += 1;

      const member = {
        id: data.counters.companyMembers,
        userId: input.userId,
        companyId: input.companyId,
        role: input.role ?? "user",
        status: input.status ?? "pending",
        invitedAt: now,
        approvedAt: input.approvedAt ?? null,
        rejectedAt: input.rejectedAt ?? null,
        approvedByAdminId: input.approvedByAdminId ?? null,
        createdAt: now,
        updatedAt: now,
      } as CompanyMember;

      data.companyMembers.push(member);
      return member;
    });
  }
  const result = await db.insert(companyMembers).values(input);
  const id = result[0].insertId;
  const row = await db.select().from(companyMembers).where(eq(companyMembers.id, id)).limit(1);
  return row[0];
}

export async function getCompanyMember(userId: number, companyId: number): Promise<CompanyMember | undefined> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.companyMembers.find(member => member.userId === userId && member.companyId === companyId);
  }
  const row = await db
    .select()
    .from(companyMembers)
    .where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId)))
    .limit(1);
  return row[0];
}

export async function listCompanyMembers(companyId: number): Promise<Array<CompanyMember & { user: typeof users.$inferSelect }>> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companyMembers
      .filter(member => member.companyId === companyId)
      .map(member => companyMemberWithUser(member, data.users.find(user => user.id === member.userId)));
  }
  return db
    .select()
    .from(companyMembers)
    .leftJoin(users, eq(companyMembers.userId, users.id))
    .where(eq(companyMembers.companyId, companyId))
    .then(rows => rows.map(r => ({ ...r.companyMembers, user: r.users! })))
}

export async function approveCompanyMember(memberId: number, adminId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(data => {
      const member = data.companyMembers.find(item => item.id === memberId);
      if (!member) return;
      member.status = "approved";
      member.approvedAt = new Date().toISOString();
      member.approvedByAdminId = adminId;
      member.updatedAt = new Date().toISOString();
    });
    return;
  }
  await db
    .update(companyMembers)
    .set({ status: "approved", approvedAt: new Date().toISOString(), approvedByAdminId: adminId })
    .where(eq(companyMembers.id, memberId));
}

export async function rejectCompanyMember(memberId: number, adminId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(data => {
      const member = data.companyMembers.find(item => item.id === memberId);
      if (!member) return;
      member.status = "rejected";
      member.rejectedAt = new Date().toISOString();
      member.approvedByAdminId = adminId;
      member.updatedAt = new Date().toISOString();
    });
    return;
  }
  await db
    .update(companyMembers)
    .set({ status: "rejected", rejectedAt: new Date().toISOString(), approvedByAdminId: adminId })
    .where(eq(companyMembers.id, memberId));
}

export async function removeCompanyMember(memberId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(data => {
      data.companyMembers = data.companyMembers.filter(member => member.id !== memberId);
    });
    return;
  }
  await db.delete(companyMembers).where(eq(companyMembers.id, memberId));
}

export async function getUserCompanies(userId: number): Promise<Array<Company & { membership: CompanyMember }>> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companyMembers
      .filter(member => member.userId === userId && member.status === "approved")
      .map(member => {
        const company = data.companies.find(item => item.id === member.companyId);
        return company ? ({ ...company, membership: member } as Company & { membership: CompanyMember }) : null;
      })
      .filter((item): item is Company & { membership: CompanyMember } => Boolean(item));
  }
  return db
    .select()
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(and(eq(companyMembers.userId, userId), eq(companyMembers.status, "approved")))
    .then(rows => rows.map(r => ({ ...r.companies, membership: r.companyMembers })))
}

export async function listAllProtocolsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
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
      userEmail: users.email,
    })
    .from(protocols)
    .leftJoin(companies, eq(protocols.companyId, companies.id))
    .leftJoin(users, eq(protocols.userId, users.id))
    .orderBy(desc(protocols.createdAt));
  return rows;
}
export async function listProtocolsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
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
      userEmail: users.email,
    })
    .from(protocols)
    .leftJoin(companies, eq(protocols.companyId, companies.id))
    .leftJoin(users, eq(protocols.userId, users.id))
    .where(eq(protocols.companyId, companyId))
    .orderBy(desc(protocols.createdAt));
  return rows;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return undefined;
    const data = await readLocalDevDb();
    return data.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
  }
  const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row[0];
}

export async function getUserPendingMemberships(userId: number): Promise<Array<CompanyMember & { companyName: string }>> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) return [];
    const data = await readLocalDevDb();
    return data.companyMembers
      .filter(member => member.userId === userId && member.status === "pending")
      .map(member => {
        const company = data.companies.find(item => item.id === member.companyId);
        return company ? ({ ...member, companyName: company.name } as CompanyMember & { companyName: string }) : null;
      })
      .filter((item): item is CompanyMember & { companyName: string } => Boolean(item));
  }
  const rows = await db
    .select({
      member: companyMembers,
      companyName: companies.name,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(and(eq(companyMembers.userId, userId), eq(companyMembers.status, "pending")));
  return rows.map(r => ({ ...r.member, companyName: r.companyName }));
}

export async function cloneProtocol(userId: number, sourceProtocolId: number, organizationId: number) {
  const db = await getDb();

  let sourceProto: Protocol | undefined;
  let targetOrg: Organization | undefined;

  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    const accessibleCompanyIds = new Set<number>();
    for (const member of data.companyMembers) {
      if (member.userId === userId && member.status === "approved") accessibleCompanyIds.add(member.companyId);
    }
    for (const company of data.companies) {
      if (company.createdByAdminId === userId) accessibleCompanyIds.add(company.id);
    }

    sourceProto = data.protocols.find(protocol =>
      protocol.id === sourceProtocolId &&
      (protocol.userId === userId || accessibleCompanyIds.has(protocol.companyId)),
    );
    if (!sourceProto) throw new Error("Source protocol not found or not accessible");

    targetOrg = data.organizations.find(org =>
      org.id === organizationId &&
      (org.userId === userId || (org.companyId != null && accessibleCompanyIds.has(org.companyId))),
    );
    if (!targetOrg) throw new Error("Target organization not found or not accessible");

    const year = new Date().getFullYear();
    const targetCompanyId = targetOrg.companyId ?? sourceProto.companyId;
    const number = await nextProtocolNumberForCompany(targetCompanyId, year);
    const newProto = await insertProtocol({
      organizationId,
      companyId: targetCompanyId,
      userId,
      number,
      equipmentType: sourceProto.equipmentType,
      customEquipmentName: sourceProto.customEquipmentName,
    });

    const sourceGI = data.generalInfo.find(item => item.protocolId === sourceProtocolId);
    if (sourceGI) {
      await upsertGeneralInfo(newProto.id, {
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
        loadPercent: sourceGI.loadPercent,
      });
    }

    return newProto;
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

  // Get source general info (equipment data)
  const sourceGI = await getGeneralInfo(sourceProtocolId);
  
  // Create new protocol with same equipment type and organization
  const year = new Date().getFullYear();
  const targetCompanyId = targetOrg.companyId ?? sourceProto.companyId;
  const number = await nextProtocolNumberForCompany(targetCompanyId, year);
  
  const newProto = await insertProtocol({
    organizationId,
    companyId: targetCompanyId,
    userId,
    number,
    equipmentType: sourceProto.equipmentType,
    customEquipmentName: sourceProto.customEquipmentName,
  });
  
  // Copy general info (equipment, organization, commission) but NOT test results or dates
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
      loadPercent: sourceGI.loadPercent,
      // Do NOT copy: validationDate, reportDate, planDeviations, recommendations, documentValidityPeriod, signatoriesPart1, signatoriesPart2
    });
  }
  
  return newProto;
}

/* ------------------------------------------------------------------ */
/* Warehouse Protocol Sections                                         */
/* ------------------------------------------------------------------ */
/** Returns all section rows for a protocol, keyed by sectionKey */
export async function getWarehouseSections(
  protocolId: number,
): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select()
    .from(warehouseProtocolSections)
    .where(eq(warehouseProtocolSections.protocolId, protocolId));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.sectionKey] = r.content ?? "";
  return map;
}

/** Upserts a map of { sectionKey: content } for a protocol */
export async function saveWarehouseSections(
  protocolId: number,
  sections: Record<string, string>,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  for (const [sectionKey, content] of Object.entries(sections)) {
    // Try update first, then insert
    const existing = await db
      .select({ id: warehouseProtocolSections.id })
      .from(warehouseProtocolSections)
      .where(
        and(
          eq(warehouseProtocolSections.protocolId, protocolId),
          eq(warehouseProtocolSections.sectionKey, sectionKey),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(warehouseProtocolSections)
        .set({ content })
        .where(eq(warehouseProtocolSections.id, existing[0].id));
    } else {
      await db.insert(warehouseProtocolSections).values({ protocolId, sectionKey, content });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Warehouse Equipment (Section 5)                                    */
/* ------------------------------------------------------------------ */
export async function listWarehouseEquipment(protocolId: number): Promise<WarehouseEquipment[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(warehouseEquipment)
    .where(eq(warehouseEquipment.protocolId, protocolId))
    .orderBy(warehouseEquipment.ord, warehouseEquipment.id);
}

export async function createWarehouseEquipment(
  data: Omit<InsertWarehouseEquipment, "id" | "createdAt" | "updatedAt">,
): Promise<WarehouseEquipment> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(warehouseEquipment).values(data);
  const [row] = await db
    .select()
    .from(warehouseEquipment)
    .where(eq(warehouseEquipment.id, (result as any).insertId))
    .limit(1);
  return row;
}

export async function updateWarehouseEquipment(
  id: number,
  data: Partial<Omit<InsertWarehouseEquipment, "id" | "protocolId" | "createdAt" | "updatedAt">>,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(warehouseEquipment).set(data).where(eq(warehouseEquipment.id, id));
}

export async function deleteWarehouseEquipment(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(warehouseEquipment).where(eq(warehouseEquipment.id, id));
}


// ─── Sensors ──────────────────────────────────────────────────────────────────

export async function listSensors(): Promise<Sensor[]> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return [...data.sensors].sort((a, b) => a.number.localeCompare(b.number));
  }
  return db.select().from(sensors);
}

export async function getSensor(sensorId: number): Promise<Sensor | undefined> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.sensors.find(sensor => sensor.id === sensorId);
  }
  const result = await db.select().from(sensors).where(eq(sensors.id, sensorId));
  return result[0];
}

export async function createSensor(data: InsertSensor): Promise<Sensor> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const existing = localData.sensors.find(sensor => sensor.number.toLowerCase() === data.number.toLowerCase());
      if (existing) throw new Error("Sensor already exists");
      const now = new Date().toISOString();
      localData.counters.sensors += 1;
      const sensor = {
        id: localData.counters.sensors,
        number: data.number,
        calibrationDate: data.calibrationDate,
        nextCalibrationDate: data.nextCalibrationDate,
        status: data.status ?? "active",
        createdAt: now,
        updatedAt: now,
      } as Sensor;
      localData.sensors.push(sensor);
      return sensor;
    });
  }
  await db.insert(sensors).values(data);
  const result = await db.select().from(sensors).where(eq(sensors.number, data.number));
  return result[0];
}

export async function updateSensor(sensorId: number, data: Partial<InsertSensor>): Promise<Sensor> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const sensor = localData.sensors.find(item => item.id === sensorId);
      if (!sensor) throw new Error("Sensor not found");
      if (data.number !== undefined) sensor.number = data.number;
      if (data.calibrationDate !== undefined) sensor.calibrationDate = data.calibrationDate;
      if (data.nextCalibrationDate !== undefined) sensor.nextCalibrationDate = data.nextCalibrationDate;
      if (data.status !== undefined) sensor.status = data.status;
      sensor.updatedAt = new Date().toISOString();
      return sensor;
    });
  }
  await db.update(sensors).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(sensors.id, sensorId));
  const result = await db.select().from(sensors).where(eq(sensors.id, sensorId));
  return result[0];
}

export async function deleteSensor(sensorId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(localData => {
      localData.sensors = localData.sensors.filter(sensor => sensor.id !== sensorId);
      localData.protocolSensors = localData.protocolSensors.filter(link => link.sensorId !== sensorId);
    });
    return;
  }
  await db.delete(sensors).where(eq(sensors.id, sensorId));
}

export async function getSensorsExpiringIn30Days(): Promise<Sensor[]> {
  const db = await getDb();
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return data.sensors.filter(sensor => {
      const next = new Date(sensor.nextCalibrationDate);
      return sensor.status === "active" && next >= now && next <= in30Days;
    });
  }
  return db
    .select()
    .from(sensors)
    .where(
      and(
        gte(sensors.nextCalibrationDate, now.toISOString()),
        lte(sensors.nextCalibrationDate, in30Days.toISOString()),
        eq(sensors.status, "active")
      )
    );
}

export async function bulkCreateSensors(sensorsData: Array<{ number: string; calibrationDate: string; nextCalibrationDate: string }>): Promise<Sensor[]> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const now = new Date().toISOString();
      for (const item of sensorsData) {
        const existing = localData.sensors.find(sensor => sensor.number.toLowerCase() === item.number.toLowerCase());
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
          updatedAt: now,
        } as Sensor);
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
        status: 'active',
      });
    } catch (err: any) {
      if (err.code !== 'ER_DUP_ENTRY') {
        console.warn(`Failed to insert sensor ${data.number}:`, err.message);
      }
    }
  }
  
  return db.select().from(sensors);
}


// Protocol-Sensor functions
export async function addSensorToProtocol(protocolId: number, sensorId: number): Promise<ProtocolSensor> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    return updateLocalDevDb(localData => {
      const existing = localData.protocolSensors.find(
        link => link.protocolId === protocolId && link.sensorId === sensorId,
      );
      if (existing) return existing;
      const now = new Date().toISOString();
      localData.counters.protocolSensors += 1;
      const link = {
        id: localData.counters.protocolSensors,
        protocolId,
        sensorId,
        createdAt: now,
      } as ProtocolSensor;
      localData.protocolSensors.push(link);
      return link;
    });
  }

  const [existing] = await db.select().from(protocolSensors).where(
    and(
      eq(protocolSensors.protocolId, protocolId),
      eq(protocolSensors.sensorId, sensorId)
    )
  ).limit(1);

  if (existing) return existing;
  
  const result = await db.insert(protocolSensors).values({
    protocolId,
    sensorId,
  });
  
  const inserted = await db.select().from(protocolSensors).where(
    and(
      eq(protocolSensors.protocolId, protocolId),
      eq(protocolSensors.sensorId, sensorId)
    )
  );
  
  return inserted[0];
}

export async function getProtocolSensors(protocolId: number): Promise<Array<Sensor & { protocolSensorId: number }>> {
  const db = await getDb();
  const dedupeBySensorId = (items: Array<Sensor & { protocolSensorId: number }>) => {
    const unique = new Map<number, Sensor & { protocolSensorId: number }>();
    for (const item of items) {
      const existing = unique.get(item.id);
      if (!existing || item.protocolSensorId < existing.protocolSensorId) {
        unique.set(item.id, item);
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.number.localeCompare(b.number));
  };

  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    const data = await readLocalDevDb();
    return dedupeBySensorId(data.protocolSensors
      .filter(link => link.protocolId === protocolId)
      .map(link => {
        const sensor = data.sensors.find(item => item.id === link.sensorId);
        return sensor ? ({ ...sensor, protocolSensorId: link.id } as Sensor & { protocolSensorId: number }) : null;
      })
      .filter((item): item is Sensor & { protocolSensorId: number } => Boolean(item)));
  }
  
  const result = await db
    .select({
      id: sensors.id,
      number: sensors.number,
      calibrationDate: sensors.calibrationDate,
      nextCalibrationDate: sensors.nextCalibrationDate,
      status: sensors.status,
      createdAt: sensors.createdAt,
      updatedAt: sensors.updatedAt,
      protocolSensorId: protocolSensors.id,
    })
    .from(protocolSensors)
    .innerJoin(sensors, eq(protocolSensors.sensorId, sensors.id))
    .where(eq(protocolSensors.protocolId, protocolId));
  
  return dedupeBySensorId(result);
}

export async function removeProtocolSensor(protocolId: number, sensorId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(localData => {
      localData.protocolSensors = localData.protocolSensors.filter(
        link => !(link.protocolId === protocolId && link.sensorId === sensorId),
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

export async function clearProtocolSensors(protocolId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    if (!shouldUseLocalDevDb()) throw new Error("DB unavailable");
    await updateLocalDevDb(localData => {
      localData.protocolSensors = localData.protocolSensors.filter(link => link.protocolId !== protocolId);
    });
    return;
  }
  
  await db.delete(protocolSensors).where(
    eq(protocolSensors.protocolId, protocolId)
  );
}
