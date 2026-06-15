import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, mysqlEnum, text, timestamp, varchar, json, index, bigint, decimal } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const checklistAnswers = mysqlTable("checklistAnswers", {
	id: int().autoincrement().notNull(),
	protocolId: int().notNull(),
	stage: mysqlEnum(['iq','oq']).notNull(),
	questionIndex: int().notNull(),
	questionText: text().notNull(),
	answer: mysqlEnum(['yes','no','na','unset']).default('unset').notNull(),
	comment: text(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	warehouseEquipmentId: int(),
});

export const companies = mysqlTable("companies", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	createdByAdminId: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const companyMembers = mysqlTable("companyMembers", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	companyId: int().notNull(),
	role: mysqlEnum(['admin','user']).default('user').notNull(),
	status: mysqlEnum(['pending','approved','rejected']).default('pending').notNull(),
	invitedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	approvedAt: timestamp({ mode: 'string' }),
	rejectedAt: timestamp({ mode: 'string' }),
	approvedByAdminId: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const excursionLoggers = mysqlTable("excursionLoggers", {
	id: int().autoincrement().notNull(),
	excursionSessionId: int().notNull(),
	protocolId: int().notNull(),
	fileKey: varchar({ length: 512 }).notNull(),
	fileUrl: varchar({ length: 512 }).notNull(),
	fileName: varchar({ length: 255 }).notNull(),
	label: varchar({ length: 64 }).notNull(),
	customName: varchar({ length: 128 }),
	role: mysqlEnum(['internal','external']).default('internal').notNull(),
	pointCount: int().default(0).notNull(),
	series: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const excursionStudySessions = mysqlTable("excursionStudySessions", {
	id: int().autoincrement().notNull(),
	protocolId: int().notNull(),
	enabled: int().default(0).notNull(),
	timingVsPv: mysqlEnum(['before_pv','after_pv','independent']).default('after_pv'),
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
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	t2SensorBreaks: json(),
	t3SensorBreaks: json(),
	t3TestEndAt: bigint({ mode: "number" }),
},
(table) => [
	index("excursionStudySessions_protocolId_unique").on(table.protocolId),
]);

export const generalInfo = mysqlTable("generalInfo", {
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
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
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
	fillStatus: mysqlEnum(['empty','loaded']),
	loadPercent: decimal({ precision: 5, scale: 2 }),
},
(table) => [
	index("generalInfo_protocolId_unique").on(table.protocolId),
]);

export const organizations = mysqlTable("organizations", {
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	companyId: int(),
});

export const protocols = mysqlTable("protocols", {
	id: int().autoincrement().notNull(),
	organizationId: int().notNull(),
	userId: int().notNull(),
	number: varchar({ length: 32 }).notNull(),
	status: mysqlEnum(['draft','iq_done','oq_done','pv_done','completed']).default('draft').notNull(),
	iqVerdict: mysqlEnum(['pass','fail','none']).default('none').notNull(),
	oqVerdict: mysqlEnum(['pass','fail','none']).default('none').notNull(),
	pvVerdict: mysqlEnum(['pass','fail','none']).default('none').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	companyId: int().default(0).notNull(),
	equipmentType: mysqlEnum(['refrigerator','auto-refrigerator','warehouse','other']).default('refrigerator').notNull(),
	customEquipmentName: varchar({ length: 255 }),
});

export const pvLoggers = mysqlTable("pvLoggers", {
	id: int().autoincrement().notNull(),
	pvSessionId: int().notNull(),
	protocolId: int().notNull(),
	fileKey: varchar({ length: 512 }).notNull(),
	fileUrl: varchar({ length: 512 }).notNull(),
	fileName: varchar({ length: 255 }).notNull(),
	label: varchar({ length: 64 }).notNull(),
	customName: varchar({ length: 128 }),
	role: mysqlEnum(['internal','external']).default('internal').notNull(),
	pointCount: int().default(0).notNull(),
	minVal: decimal({ precision: 8, scale: 3 }),
	maxVal: decimal({ precision: 8, scale: 3 }),
	avgVal: decimal({ precision: 8, scale: 3 }),
	stdVal: decimal({ precision: 8, scale: 3 }),
	mktVal: decimal({ precision: 8, scale: 3 }),
	series: json(),
	deviations: json(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	position: varchar({ length: 32 }).default('unset').notNull(),
	posX: decimal({ precision: 5, scale: 2 }),
	posY: decimal({ precision: 5, scale: 2 }),
	firstTs: bigint({ mode: "number" }),
});

export const pvSessions = mysqlTable("pvSessions", {
	id: int().autoincrement().notNull(),
	protocolId: int().notNull(),
	tempMode: varchar({ length: 16 }),
	startAt: bigint({ mode: "number" }),
	endAt: bigint({ mode: "number" }),
	minDurationHours: int().default(72).notNull(),
	minSensorCount: int().default(9).notNull(),
	customMin: decimal({ precision: 6, scale: 2 }),
	customMax: decimal({ precision: 6, scale: 2 }),
	verdict: mysqlEnum(['pass','fail','none']).default('none').notNull(),
	stats: json(),
	deviations: json(),
	conclusionText: text(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	samplingStepMinutes: int(),
	coolingUnitPos: json(),
	doorPos: json(),
	floorPlanObjects: json(),
	roomLengthM: decimal({ precision: 6, scale: 2 }),
	roomWidthM: decimal({ precision: 6, scale: 2 }),
	roomHeightM: decimal({ precision: 6, scale: 2 }),
	planImageKey: varchar({ length: 512 }),
	planImageUrl: varchar({ length: 512 }),
},
(table) => [
	index("pvSessions_protocolId_unique").on(table.protocolId),
]);

export const questionTemplates = mysqlTable("questionTemplates", {
	id: int().autoincrement().notNull(),
	stage: mysqlEnum(['iq','oq']).notNull(),
	ord: int().notNull(),
	text: text().notNull(),
	isDefault: int().default(1).notNull(),
	companyId: int(),
	equipmentType: mysqlEnum(['refrigerator','auto-refrigerator','warehouse','other']).default('refrigerator').notNull(),
	equipmentKind: mysqlEnum(['conditioner','ventilation','heat_curtain','chiller','fan_coil','other']),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	passwordHash: varchar({ length: 255 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);

export const warehouseEquipment = mysqlTable("warehouseEquipment", {
	id: int().autoincrement().notNull(),
	protocolId: int().notNull(),
	ord: int().default(0).notNull(),
	name: varchar({ length: 255 }).notNull(),
	manufacturer: varchar({ length: 255 }),
	model: varchar({ length: 255 }),
	serial: varchar({ length: 128 }),
	inventory: varchar({ length: 128 }),
	purpose: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	kind: mysqlEnum(['conditioner','ventilation','heat_curtain','chiller','fan_coil','other']).default('other').notNull(),
});

export const warehouseProtocolSections = mysqlTable("warehouseProtocolSections", {
	id: int().autoincrement().notNull(),
	protocolId: int().notNull(),
	sectionKey: varchar({ length: 16 }).notNull(),
	content: text(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	fillStatus: mysqlEnum(['empty','loaded']),
});


// Type exports for use in application code
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

export type Company = InferSelectModel<typeof companies>;
export type InsertCompany = InferInsertModel<typeof companies>;

export type CompanyMember = InferSelectModel<typeof companyMembers>;
export type InsertCompanyMember = InferInsertModel<typeof companyMembers>;

export type Organization = InferSelectModel<typeof organizations>;
export type InsertOrganization = InferInsertModel<typeof organizations>;

export type Protocol = InferSelectModel<typeof protocols>;
export type InsertProtocol = InferInsertModel<typeof protocols>;

export type WarehouseEquipment = InferSelectModel<typeof warehouseEquipment>;
export type InsertWarehouseEquipment = InferInsertModel<typeof warehouseEquipment>;


export const sensors = mysqlTable("sensors", {
	id: int().autoincrement().notNull(),
		number: varchar({ length: 128 }).notNull(),
	calibrationDate: timestamp({ mode: 'string' }).notNull(),
	nextCalibrationDate: timestamp({ mode: 'string' }).notNull(),
	status: mysqlEnum(['active', 'expiring_soon', 'expired']).default('active').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});


// Primary key for sensors table
export const sensorsIndex = index("sensors_number_unique").on(sensors.number);

export type Sensor = InferSelectModel<typeof sensors>;
export type InsertSensor = InferInsertModel<typeof sensors>;

// Junction table: protocols to sensors used in testing
export const protocolSensors = mysqlTable("protocolSensors", {
	id: int().autoincrement().notNull(),
	protocolId: int().notNull(),
	sensorId: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export type ProtocolSensor = InferSelectModel<typeof protocolSensors>;
export type InsertProtocolSensor = InferInsertModel<typeof protocolSensors>;
