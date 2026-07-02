// PDF report generation for the validation protocol.
// Uses pdfkit for full layout control + chartjs-node-canvas for inline charts.

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  drawColdChart,
  drawExcursionChart,
  drawExternalChart,
  drawHeatmapChart,
  drawHotChart,
  drawOverviewChart,
  drawRefrigeratorDiagram,
  drawReeferTruckDiagram3D,
  drawStatsBarChart,
  type DiagramSensor,
  type EventMarker,
} from "./charts";
import { calculateAllOperationalMetrics } from "./operationalMetrics";
import {
  computeWarehouseSensorCount,
  WAREHOUSE_MAPPING_METHOD_NOTE,
} from "../shared/validation";
import type { OperationalMetrics } from "./operationalMetrics";

const PAGE_MARGIN = 56;
const ACCENT = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const SOFT_BG = "#f8fafc";

type ChecklistItem = {
  questionIndex: number;
  questionText: string;
  answer: "yes" | "no" | "na" | "unset";
  comment: string | null;
  updatedAt?: string | Date | null;
};

type LoggerSummary = {
  id: number;
  label: string;
  customName: string | null;
  role: "internal" | "external";
  pointCount: number;
  min: number;
  max: number;
  avg: number;
  std: number;
  mkt: number;
  series: { ts: number[]; temp: number[] };
  deviations: Array<{ start: number; end: number; durationMs: number; value: number; type: "high" | "low" }>;
  createdAt?: string | Date | null;
};

type DataIntegrityStage = {
  stage: "IQ" | "OQ" | "PV";
  label: string;
  completedBy: string;
  completedAt: string | Date | number | null;
  source: string;
};

type RevisionHistoryEntry = {
  revision: string;
  date: string | Date | number | null;
  change: string;
  author: string;
};

export type Signatory = {
  role: string; // должность
  name: string; // ФИО
  company?: string | null; // компания
  position?: "composer" | "reviewer" | "approver"; // роль в процессе
};

export type ReportInput = {
  org: {
    name: string;
    bin: string | null;
    addressLegal: string | null;
    addressFact: string | null;
    responsible: string | null;
    phone: string | null;
    email: string | null;
    logoBuffer?: Buffer | null;
  };
  protocol: {
    number: string;
    createdAt: string | Date;
    equipmentType?: string | null;
    customEquipmentName?: string | null;
  };
  generalInfo: {
    equipmentType: string | null;
    manufacturer: string | null;
    model: string | null;
    serial: string | null;
    inventory: string | null;
    year: number | null;
    tempMode: string | null;
    location: string | null;
    purpose: string | null;
    validationDate: string | null;
    basis: string | null;
    season?: string | null;
    qualificationType?: string | null;
    commissionMembers?: Array<{ name: string; role: string }> | null;
    // Warehouse / storage zone (EAEU Рек. №8)
    whLengthM?: string | number | null;
    whWidthM?: string | number | null;
    whHeightM?: string | number | null;
    whHumidityControl?: number | null;
    whHumidityMin?: string | number | null;
    whHumidityMax?: string | number | null;
    whSeason?: string | null;
    whStudyType?: string | null;
    whExternalEnv?: number | null;
    whLayoutNotes?: string | null;
    fillStatus?: "empty" | "loaded" | null;
    loadPercent?: string | number | null;
  } | null;
  iq: {
    purpose: string;
    description: string;
    criteria: string;
    items: ChecklistItem[];
    verdict: "pass" | "fail" | "none";
  };
  oq: {
    purpose: string;
    description: string;
    criteria: string;
    items: ChecklistItem[];
    verdict: "pass" | "fail" | "none";
  };
  pv: {
    purpose: string;
    description: string;
    criteria: string;
    tempMode: string;
    rangeMin: number;
    rangeMax: number;
    rawRangeMin?: number;
    rawRangeMax?: number;
    sensorAccuracy?: number;
    startAt: number | null;
    endAt: number | null;
    minDurationHours: number;
    minSensorCount: number;
    loggers: LoggerSummary[];
    verdict: "pass" | "fail" | "none";
    failureReasons: string[];
    hotIdx: number | null;
    coldIdx: number | null;
    extIndices: number[];
    /** Описание мест установки датчиков (расстановка), свободный текст */
    sensorPlacement?: string;
    /** Sampling step in minutes for measurement table */
    samplingStepMinutes?: number | null;
    updatedAt?: string | Date | null;
  };
  dataIntegrity?: {
    revision: string;
    preparedBy: string;
    generatedBy: string;
    generatedAt: string | Date | number;
    stages: DataIntegrityStage[];
    revisionHistory: RevisionHistoryEntry[];
  };
  /**
   * Warehouse protocol sections (ЕАЭК Рек. №8, разделы 1–7).
   * Key = sectionKey (e.g. "1.1", "2.2.1"), value = text content.
   */
  warehouseSections?: Record<string, string>;
  /**
   * Equipment list for Section 5 of warehouse protocol.
   */
  warehouseEquipment?: Array<{
    name: string;
    manufacturer?: string | null;
    model?: string | null;
    serial?: string | null;
    inventory?: string | null;
    purpose?: string | null;
  }>;
  /** GMP пункт 6 — подписанты Протокола (Часть I) */
  signatoriesPart1?: Signatory[];
  /** GMP пункт 7 — подписанты Отчёта (Часть II) */
  signatoriesPart2?: Signatory[];
  /** GMP пункт 7 — отклонения от плана протокола с обоснованием (свободный текст) */
  planDeviations?: string;
  /** GMP пункт 7 — рекомендуемые корректирующие действия */
  recommendations?: string;
  /** Дата составления отчёта (вводится вручную, если отличается от даты валидации) */
  reportDate?: string | null;
  /** Срок действия документа (по умолчанию «1 года») */
  documentValidityPeriod?: string | null;
  /** Датчики PV с позициями для схемы расстановки */
  pvLoggers?: Array<{
    id: number;
    label: string;
    customName?: string | null;
    role: string;
    position?: string | null;
    posX?: number | null;
    posY?: number | null;
  }>;
  /** Датчики, используемые для валидации (из базы датчиков) */
  protocolSensors?: Array<{
    id: number;
    number: string;
    calibrationDate: string | Date | null;
    nextCalibrationDate: string | Date | null;
    status?: string;
  }>;
  /** Позиция кондиционера на интерактивной схеме помещения */
  coolingUnitPos?: { x: number; y: number } | null;
  /** Позиция двери на интерактивной схеме */
  doorPos?: { x: number; y: number } | null;
  /** Объекты плана помещения (мебель, оборудование) для схемы расстановки */
  floorPlanObjects?: Array<{
    id: string;
    type: string;
    xPct: number;
    yPct: number;
    widthPct: number;
    heightPct: number;
    heightM?: number;
    rotation: number;
    label: string;
    sensors?: Array<{ sensorId: string; heightFromFloor: number }> | null;
  }> | null;
  /**
   * Saved PNG screenshot of the FloorPlanEditor (stored in S3).
   * Used only as a fallback when structured plan coordinates are unavailable.
   */
  planImageUrl?: string | Buffer | null;
  /** Room dimensions from pvSession (preferred over generalInfo.whXxx) */
  pvRoomLengthM?: number | null;
  pvRoomWidthM?: number | null;
  pvRoomHeightM?: number | null;
  /** Испытания на температурное отклонение (Temperature Excursion Study) */
  excursion?: {
    enabled: boolean;
    timingVsPv: string | null;
    test1Enabled: boolean;
    test2Enabled: boolean;
    test3Enabled: boolean;
    recordStartAt: number | null;
    recordEndAt: number | null;
    t1PowerOnAt: number | null;
    t1TStableAt: number | null;
    t1DurationSec: number | null;
    t1CriticalSensor: string | null;
    t1SensorEntries: Array<{ label: string; tempAtOn: number; entryAt: number | null; durationSec: number | null }> | null;
    t2DoorOpenAt: number | null;
    t2DoorCloseAt: number | null;
    t2TBreakAt: number | null;
    t2DurationSec: number | null;
    t2CriticalSensor: string | null;
    t2NoBreak: boolean;
    t2SensorBreaks: Array<{ label: string; tBreakAt: number | null; durationSec: number | null }> | null;
    t3PowerOffAt: number | null;
    t3TestEndAt: number | null;
    t3TBreakAt: number | null;
    t3DurationSec: number | null;
    t3CriticalSensor: string | null;
    t3NoBreak: boolean;
    t3SensorBreaks: Array<{ label: string; tBreakAt: number | null; durationSec: number | null }> | null;
    warnings: string[];
    loggers: Array<{ label: string; role: string; series: { ts: number[]; temp: number[] } }>;
  } | null;
};

const TEMP_MODE_LABEL: Record<string, string> = {
  "2-8": "+2 °C...+8 °C",
  "8-15": "+8 °C...+15 °C",
  "15-25": "+15 °C...+25 °C",
};

const EQUIPMENT_LABEL: Record<string, string> = {
  refrigerator: "Холодильник",
  "auto-refrigerator": "Авторефрижератор", // Note: for warehouse protocols, use getEquipmentName() which returns "помещение (зона) хранения"
  freezer: "Морозильник",
  chamber: "Холодильная камера",
  warehouse: "Помещение (зона) хранения", // Note: use getEquipmentName() for proper display
  other: "Оборудование",
};

const WAREHOUSE_STUDY_LABEL: Record<string, string> = {
  warehouse: "Склад",
  controlled_env: "Помещение с контролируемой средой",
  reception: "Зона приёмки",
  expedition: "Зона экспедиции",
  cold_room: "Холодильная/морозильная камера в помещении с контролируемой средой",
};

const WAREHOUSE_SEASON_LABEL: Record<string, string> = {
  summer: "Летнее (тёплый период)",
  winter: "Зимнее (холодный период)",
  both: "Лето + зима (полный сезонный цикл)",
  n_a: "Не применимо (нет контакта с внешней средой)",
};

function getReportEquipmentType(input?: ReportInput): string | null {
  return input?.generalInfo?.equipmentType || input?.protocol?.equipmentType || null;
}

/** Returns the human-readable equipment name from protocol-level fields (nominative case) */
function getEquipmentName(input: ReportInput): string {
  const type = getReportEquipmentType(input);
  if (type === "other" && input.protocol?.customEquipmentName) {
    return input.protocol.customEquipmentName;
  }
  // For warehouse, always use "помещение (зона) хранения" instead of "авторефрижератор"
  if (type === "warehouse") {
    return "помещение (зона) хранения";
  }
  return EQUIPMENT_LABEL[type || ""] || "Оборудование";
}

/** Returns equipment name with proper Russian case declension */
function getEquipmentNameWithCase(input: ReportInput, gramCase: "nominative" | "genitive" | "accusative" | "instrumental" = "nominative"): string {
  const type = getReportEquipmentType(input);
  if (type === "other" && input.protocol?.customEquipmentName) {
    return input.protocol.customEquipmentName;
  }
  if (type === "warehouse") {
    switch (gramCase) {
      case "genitive": return "помещения (зоны) хранения";
      case "accusative": return "помещение (зону) хранения";
      case "instrumental": return "помещением (зоной) хранения";
      case "nominative":
      default: return "помещение (зона) хранения";
    }
  }
  return EQUIPMENT_LABEL[type || ""] || "Оборудование";
}

function isReeferLike(type: string | null | undefined): boolean {
  return type === "auto-refrigerator" || type === "chamber";
}

function reeferSubject(type: string | null | undefined): string {
  if (type === "chamber") return "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u043c\u0435\u0440\u0430";
  if (type === "refrigerator") return "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a";
  if (type === "freezer") return "\u041c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a";
  return "\u0410\u0432\u0442\u043e\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440";
}

function reeferArea(type: string | null | undefined): string {
  if (type === "chamber") return "\u043a\u0430\u043c\u0435\u0440\u0430";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a";
  return "\u043a\u0443\u0437\u043e\u0432";
}

function reeferAreaGenitive(type: string | null | undefined): string {
  if (type === "chamber") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0439 \u043a\u0430\u043c\u0435\u0440\u044b";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  return "\u043a\u0443\u0437\u043e\u0432\u0430 \u0430\u0432\u0442\u043e\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440\u0430";
}

function reeferInsideVolume(type: string | null | undefined): string {
  if (type === "chamber") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0439 \u043a\u0430\u043c\u0435\u0440\u044b";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  return "\u043a\u0443\u0437\u043e\u0432\u0430 \u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440\u0430";
}

function reeferAreaAfterIn(type: string | null | undefined): string {
  if (type === "chamber") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0439 \u043a\u0430\u043c\u0435\u0440\u0435";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a\u0435";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a\u0435";
  return reeferAreaGenitive(type);
}

function reeferLocationLabel(type: string | null | undefined): string {
  return type === "chamber" ? "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u043c\u0435\u0440\u0430 / \u043c\u0435\u0441\u0442\u043e \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438" : "\u0422\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442\u043d\u043e\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043e / \u0433\u043e\u0441. \u043d\u043e\u043c\u0435\u0440";
}

function reeferUnitLabel(type: string | null | undefined): string {
  return type === "chamber" ? "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 / \u0430\u0433\u0440\u0435\u0433\u0430\u0442" : "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430";
}

function reeferConclusionObject(input: ReportInput): string {
  const unit = ((input.generalInfo?.manufacturer || "") + " " + (input.generalInfo?.model || "")).trim();
  const serial = input.generalInfo?.serial || "\u2014";
  const type = getReportEquipmentType(input);
  const withUnit = (obj: string) => obj + " \u0441 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435\u043c \u00ab" + unit + "\u00bb (\u0441\u0435\u0440. \u2116 " + serial + ")";
  if (type === "chamber") return withUnit("\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0443\u044e \u043a\u0430\u043c\u0435\u0440\u0443");
  if (type === "refrigerator") return withUnit("\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a");
  if (type === "freezer") return withUnit("\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a");
  return withUnit("\u0430\u0432\u0442\u043e\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440");
}

const ANSWER_LABEL: Record<string, string> = {
  yes: "Да",
  no: "Нет",
  na: "Не применимо",
  unset: "—",
};

function fmtDate(ms: number | Date | null): string {
  if (ms === null || ms === undefined) return "—";
  const d = ms instanceof Date ? ms : new Date(ms);
  // Use UTC accessors so the formatted time matches the wall-clock entered by the user / read from the file.
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function fmtDateSec(ms: number | Date | null): string {
  if (ms === null || ms === undefined) return "—";
  const d = ms instanceof Date ? ms : new Date(ms);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
function fmtDateOnly(ms: number | Date | null): string {
  if (ms === null || ms === undefined) return "—";
  const d = ms instanceof Date ? ms : new Date(ms);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function fmtTempValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} °C`;
}

function fmtTempRange(min: number | null | undefined, max: number | null | undefined): string {
  return `${fmtTempValue(min)}...${fmtTempValue(max)}`;
}

function sensorAccuracyRows(pv: ReportInput["pv"]): Array<[string, string]> {
  if (pv.sensorAccuracy === undefined || pv.sensorAccuracy === null) return [];
  const rawMin = pv.rawRangeMin ?? pv.rangeMin - pv.sensorAccuracy;
  const rawMax = pv.rawRangeMax ?? pv.rangeMax + pv.sensorAccuracy;
  return [
    ["Номинальный температурный диапазон", fmtTempRange(rawMin, rawMax)],
    ["Погрешность датчиков, учитываемая в расчётах", `±${pv.sensorAccuracy.toFixed(1)} °C`],
    ["Расчётный диапазон с учётом погрешности", fmtTempRange(pv.rangeMin, pv.rangeMax)],
  ];
}

function coerceDate(value: string | Date | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "—") return null;
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

export function resolveProtocolReferenceDate(
  validationDate: string | Date | number | null | undefined,
  protocolCreatedAt: string | Date | number | null | undefined,
): Date | null {
  return coerceDate(validationDate) ?? coerceDate(protocolCreatedAt);
}

export function getSensorCalibrationStatusAtProtocolDate(
  nextCalibrationDate: string | Date | number | null | undefined,
  protocolDate: string | Date | number | null | undefined,
): "expired" | "valid" | null {
  const nextDate = coerceDate(nextCalibrationDate);
  const referenceDate = coerceDate(protocolDate);
  if (!nextDate || !referenceDate) return null;

  const nextDateOnly = Date.UTC(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth(),
    nextDate.getUTCDate(),
  );
  const referenceDateOnly = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  return nextDateOnly < referenceDateOnly ? "expired" : "valid";
}

function latestDate(values: Array<string | Date | number | null | undefined>): Date | null {
  return values
    .map(coerceDate)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function fmtTraceDate(value: string | Date | number | null | undefined): string {
  const date = coerceDate(value);
  return date ? fmtDateOnly(date) : "—";
}

function fmtTraceDateWithFallback(
  value: string | Date | number | null | undefined,
  fallback: string | Date | number | null | undefined,
): string {
  const date = coerceDate(value) ?? coerceDate(fallback);
  return date ? `${fmtDateOnly(date)} г.` : "—";
}

function getTraceablePerson(input: ReportInput): string {
  return (
    input.dataIntegrity?.preparedBy ||
    input.org.responsible ||
    input.signatoriesPart2?.find(s => s.position === "composer")?.name ||
    input.signatoriesPart1?.find(s => s.position === "composer")?.name ||
    input.signatoriesPart2?.[0]?.name ||
    input.signatoriesPart1?.[0]?.name ||
    "—"
  );
}

function getStageTrace(input: ReportInput, stage: "IQ" | "OQ" | "PV"): DataIntegrityStage {
  const existing = input.dataIntegrity?.stages.find(item => item.stage === stage);
  if (existing) return existing;

  const preparedBy = getTraceablePerson(input);
  const fallbackDate = input.dataIntegrity?.generatedAt || input.reportDate || input.generalInfo?.validationDate || input.protocol.createdAt;
  if (stage === "IQ") {
    return {
      stage,
      label: "IQ — ввод данных и опросник квалификации монтажа",
      completedBy: preparedBy,
      completedAt: latestDate(input.iq.items.map(item => item.updatedAt)) ?? fallbackDate,
      source: "Записи чек-листа IQ",
    };
  }
  if (stage === "OQ") {
    return {
      stage,
      label: "OQ — ввод данных и опросник квалификации функционирования",
      completedBy: preparedBy,
      completedAt: latestDate(input.oq.items.map(item => item.updatedAt)) ?? fallbackDate,
      source: "Записи чек-листа OQ",
    };
  }
  return {
    stage,
    label: "PQ/PV — ввод данных эксплуатационной квалификации",
    completedBy: preparedBy,
    completedAt: latestDate([
      input.pv.updatedAt,
      ...input.pv.loggers.map(logger => logger.createdAt),
    ]) ?? fallbackDate,
    source: "Параметры PV и загруженные файлы логгеров",
  };
}

/**
 * Returns the last 4 characters of a sensor label for use in table column headers.
 * e.g. "230609STS0013707" → "3707", "D1" → "D1" (unchanged when ≤4 chars).
 * If customName is provided, appends it on a new line.
 */
function shortLabel(label: string, customName?: string | null): string {
  const short = label.length > 4 ? label.slice(-4) : label;
  return customName ? `${short}\n${customName}` : short;
}

function findFontPath(): { regular?: string; bold?: string } {
  // In production the build script copies server/fonts/ → dist/fonts/
  // so __dirname resolves to dist/ and the fonts are at dist/fonts/.
  // In dev tsx runs from source, __dirname is server/, fonts are at server/fonts/.
  // We also probe process.cwd() variants as a belt-and-suspenders fallback.
  const cwd = process.cwd();
  const candidates: Array<["regular" | "bold", string]> = [
    ["regular", path.resolve(__dirname, "fonts/DejaVuSans.ttf")],
    ["bold",    path.resolve(__dirname, "fonts/DejaVuSans-Bold.ttf")],
    ["regular", path.join(cwd, "dist",   "fonts", "DejaVuSans.ttf")],
    ["bold",    path.join(cwd, "dist",   "fonts", "DejaVuSans-Bold.ttf")],
    ["regular", path.join(cwd, "server", "fonts", "DejaVuSans.ttf")],
    ["bold",    path.join(cwd, "server", "fonts", "DejaVuSans-Bold.ttf")],
    // system fallbacks (dev sandbox)
    ["regular", "/usr/local/lib/python3.11/dist-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans.ttf"],
    ["bold",    "/usr/local/lib/python3.11/dist-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans-Bold.ttf"],
    ["regular", "/opt/.manus/current/.venv/lib/python3.13/site-packages/cv2/qt/fonts/DejaVuSans.ttf"],
    ["bold",    "/opt/.manus/current/.venv/lib/python3.13/site-packages/cv2/qt/fonts/DejaVuSans-Bold.ttf"],
  ];
  const found: { regular?: string; bold?: string } = {};
  for (const [kind, p] of candidates) {
    if (fs.existsSync(p) && !found[kind]) found[kind] = p;
  }
  return found;
}

export async function generateProtocolPdf(input: ReportInput): Promise<Buffer> {
  const fonts = findFontPath();
  if (!fonts.regular) {
    throw new Error("DejaVu Sans font not found — required for Cyrillic PDF rendering");
  }

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: {
      Title: `Протокол валидации ${input.protocol.number}`,
      Author: input.org.name,
      Subject: "Протокол квалификации/валидации холодильного оборудования",
    },
  });

  doc.registerFont("body", fonts.regular);
  if (fonts.bold) doc.registerFont("bold", fonts.bold);
  else doc.registerFont("bold", fonts.regular);
  doc.font("body");

  const chunks: Buffer[] = [];
  doc.on("data", c => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  /* ============================================================ */
  /* ЧАСТЬ I — ПРОТОКОЛ КВАЛИФИКАЦИИ (ПЛАН)            */
  /* ============================================================ */
  drawPartCover(doc, input, "part1");
  const isWarehouseDoc = (input.generalInfo?.equipmentType || input.protocol?.equipmentType) === "warehouse";
  if (isWarehouseDoc) {
    // ── WAREHOUSE PART I: sections 1–7 per EAEU Rec. #8 ──────────────────────
    drawWarehouseProtocolPart1(doc, input);
  } else {
    // ── STANDARD PART I ──────────────────────────────────────────────────────
    doc.addPage();
    drawSectionTitle(doc, "1. Общие сведения об оборудовании");
    drawGeneralInfoTable(doc, input);
    drawRevisionHistorySection(doc, input);
    
    // Draw sensor table if sensors are linked to protocol
    if (input.protocolSensors && input.protocolSensors.length > 0) {
      doc.addPage();
      drawSectionTitle(doc, "1.1. Датчики, используемые для валидации");
      drawSensorTable(
        doc,
        input.protocolSensors,
        input.pv.sensorAccuracy,
        resolveProtocolReferenceDate(input.generalInfo?.validationDate, input.protocol.createdAt),
      );
    }
    
    doc.addPage();
    drawSectionTitle(doc, "2. План IQ — Квалификация монтажа");
    drawStageBlocks(doc, input.iq);
    drawChecklistPlan(doc, input.iq.items);
    doc.addPage();
    drawSectionTitle(doc, "3. План OQ — Квалификация функционирования");
    drawStageBlocks(doc, input.oq);
    drawChecklistPlan(doc, input.oq.items);
    doc.addPage();
    drawSectionTitle(doc, "4. План PV — Эксплуатационная квалификация");
    drawStageBlocks(doc, input.pv);
    drawPVPlan(doc, input.pv, input);
    doc.addPage();
    drawSectionTitle(doc, "5. Подписи к Протоколу");
    drawSignaturesBlock(doc, getSignatoriesPart1(input), "Настоящий протокол квалификации рассмотрен и утверждён:");
  }

  /* ============================================================ */
  /* ЧАСТЬ II — ОТЧЁТ О КВАЛИФИКАЦИИ (РЕЗУЛЬТАТЫ)        */
  /* ============================================================ */
  doc.addPage();
  drawPartCover(doc, input, "part2");

  doc.addPage();
  drawSectionTitle(doc, "6. Период проведения испытаний");
  drawTestPeriod(doc, input);

  doc.addPage();
  drawSectionTitle(doc, "7. Результаты IQ — Квалификация монтажа");
  drawStageDataEntryTable(doc, input, "IQ");
  drawChecklistTable(doc, input.iq.items);
  drawStageVerdict(doc, "IQ", input.iq.verdict, input.iq.items);

  doc.addPage();
  drawSectionTitle(doc, "8. Результаты OQ — Квалификация функционирования");
  drawStageDataEntryTable(doc, input, "OQ");
  drawChecklistTable(doc, input.oq.items);
  drawStageVerdict(doc, "OQ", input.oq.verdict, input.oq.items);

  doc.addPage();
  drawSectionTitle(doc, "9. Результаты PV — Эксплуатационная квалификация");
  drawStageDataEntryTable(doc, input, "PV");
  drawPVParams(doc, input.pv, input);

  if (input.pvLoggers && input.pvLoggers.length > 0) {
    const eqType = input.generalInfo?.equipmentType || input.protocol?.equipmentType || "";
    if (eqType === "warehouse") {
      // Warehouse: single floor plan diagram only (no ISPE grid schema)
      drawWarehousePlanDiagram(doc, input, false, "Схема. Расстановка датчиков на плане помещения");
    } else {
      // Non-warehouse: Schema 1 (reference positions)
      if (isReeferLike(eqType)) {
        drawReeferTruckDiagram3D(doc, input.pvLoggers as DiagramSensor[], PAGE_MARGIN, null, null, true, "Схема 1. Эталонные позиции ISPE (C1–C8, W1–W4, V1–V3)", null, null, eqType === "chamber" ? "chamber" : "truck");
      } else {
        drawRefrigeratorDiagram(doc, input.pvLoggers as DiagramSensor[], PAGE_MARGIN, null, null, "Схема 1. Эталонные позиции ISPE (C1–C8, W1–W4, V1–V3)", "position");
      }
      // Schema 2: with serial numbers
      doc.addPage();
      if (isReeferLike(eqType)) {
        // Get sensor labels for critical points
        const hotLabel = input.pv.hotIdx !== null && input.pv.loggers[input.pv.hotIdx] ? input.pv.loggers[input.pv.hotIdx].label : null;
        const coldLabel = input.pv.coldIdx !== null && input.pv.loggers[input.pv.coldIdx] ? input.pv.loggers[input.pv.coldIdx].label : null;
        drawReeferTruckDiagram3D(doc, input.pvLoggers as DiagramSensor[], PAGE_MARGIN, input.coolingUnitPos, input.doorPos, false, "Схема 2. Расстановка датчиков (с серийными номерами)", hotLabel, coldLabel, eqType === "chamber" ? "chamber" : "truck");
      } else {
        drawRefrigeratorDiagram(doc, input.pvLoggers as DiagramSensor[], PAGE_MARGIN, input.coolingUnitPos, input.doorPos, "Схема 2. Расстановка датчиков (с серийными номерами)", "serial");
      }
    }
    drawSensorPlacementAnalysis(doc, input.pvLoggers as DiagramSensor[], input);
    if (eqType === "warehouse") {
      drawWarehouseAnnex1(doc, input);
      drawWarehouseAnnex2(doc, input);
    }
  }

  drawSubTitle(doc, "Сводная статистика по датчикам");
  drawStatsTable(doc, input.pv.loggers, input.pv.hotIdx, input.pv.coldIdx, input.pv.extIndices);

  doc.addPage();
  drawSubTitle(doc, "Таблица результатов измерений");
  drawMeasurementTable(doc, input.pv.loggers, input.pv.samplingStepMinutes);

  drawCharts(doc, input.pv, input);
  drawDeviationsSection(doc, input.pv);
  drawStagePVVerdict(doc, input.pv, input);

  if (input.excursion?.enabled) {
    doc.addPage();
    drawExcursionSection(doc, input.excursion, input.pv.rangeMin, input.pv.rangeMax, input.pv.sensorAccuracy);
  }

  doc.addPage();
  drawSectionTitle(doc, input.excursion?.enabled ? "11. Отчёт о квалификации" : "10. Отчёт о квалификации");
  drawFinalConclusion(doc, input);

  doc.addPage();
  drawSectionTitle(doc, input.excursion?.enabled ? "12. Отклонения от плана протокола" : "11. Отклонения от плана протокола");
  drawPlanDeviationsSection(doc, input);

  drawSectionTitle(doc, input.excursion?.enabled ? "13. Рекомендации" : "12. Рекомендации");
  drawRecommendationsSection(doc, input);

  doc.addPage();
  drawSectionTitle(doc, input.excursion?.enabled ? "14. Подписи к Отчёту" : "13. Подписи к Отчёту");
  drawSignaturesBlock(doc, getSignatoriesPart2(input), "Настоящий отчёт о квалификации рассмотрен и утверждён:");

  drawSectionTitle(doc, input.excursion?.enabled ? "15. Срок действия документа" : "14. Срок действия документа");
  drawValiditySection(doc, input);

  doc.addPage();
  drawCalibrationPage(doc);

  /* ---------------- Footer / pagination ---------------- */
  addHeadersAndFooters(doc, input);

  doc.end();
  return done;
}

/* -------------------------------------------------------------------------- */
/* Cover page                                                                  */
/* -------------------------------------------------------------------------- */

function drawPartCover(doc: PDFKit.PDFDocument, input: ReportInput, part: "part1" | "part2") {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;

  // Top accent band
  doc.save();
  doc.rect(0, 0, doc.page.width, 8).fill(ACCENT);
  doc.restore();

  let y = 80;

  if (input.org.logoBuffer) {
    try {
      doc.image(input.org.logoBuffer, left, y, { fit: [110, 70] });
    } catch {
      // ignore unsupported logos
    }
  }

  doc
    .fillColor(MUTED)
    .font("body")
    .fontSize(8)
    .text(input.org.name.toUpperCase(), right - 360, y, { width: 360, align: "right", lineGap: 1 });

  y += 130;

  const partLabel = part === "part1" ? "ЧАСТЬ I" : "ЧАСТЬ II";
  const partTitle = part === "part1"
    ? "ПРОТОКОЛ КВАЛИФИКАЦИИ"
    : "ОТЧЁТ О КВАЛИФИКАЦИИ";
  const partSubtitle = part === "part1"
    ? "IQ · OQ · PQ/PV"
    : "Результаты испытаний IQ · OQ · PQ/PV";

  doc
    .fillColor(MUTED)
    .font("bold")
    .fontSize(13)
    .text(partLabel, left, y, { align: "center" });

  y += 22;
  doc
    .fillColor(ACCENT)
    .font("bold")
    .fontSize(26)
    .text(partTitle, left, y, { align: "center" });

  y += 38;
  doc
    .fillColor(MUTED)
    .font("body")
    .fontSize(13)
    .text(partSubtitle, left, y, { align: "center" });

  y += 24;
  const eqType = input.generalInfo?.equipmentType || input.protocol?.equipmentType || "";
  const equipmentTypeLabel = eqType === "chamber"
    ? "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u043c\u0435\u0440\u0430"
    : eqType === "auto-refrigerator"
      ? "\u0422\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442\u043d\u043e\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043e"
      : eqType === "warehouse"
        ? getEquipmentName(input)
        : "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0435 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435";
  doc
    .fillColor(ACCENT)
    .font("bold")
    .fontSize(16)
    .text(equipmentTypeLabel, left, y, { align: "center" });

  y += 50;

  // Card with key metadata
  const cardX = left + 24;
  const cardW = right - left - 48;
  const cardY = y;
  const gi = input.generalInfo;
  const objectLabel = eqType === "warehouse"
    ? getEquipmentName(input)
    : EQUIPMENT_LABEL[gi?.equipmentType || ""] || "—";
  const refrigerationUnit = `${gi?.manufacturer || ""} ${gi?.model || ""}`.trim() || "—";
  const baseRows: Array<[string, string]> = [
    ["Номер протокола", input.protocol.number],
    ["Редакция", input.dataIntegrity?.revision || "01"],
    ["Организация", input.org.name],
    ["БИН / ИНН", input.org.bin || "—"],
    ["Объект квалификации", objectLabel],
    ...(isReeferLike(eqType)
      ? [
          [reeferLocationLabel(eqType), gi?.location || "\u2014"],
          [reeferUnitLabel(eqType), refrigerationUnit],
          ["\u0421\u0435\u0440\u0438\u0439\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438", gi?.serial || "\u2014"],
        ] as Array<[string, string]>
      : [
          ["Адрес объекта", gi?.location || "—"],
        ] as Array<[string, string]>),
    ["Температурный режим", TEMP_MODE_LABEL[gi?.tempMode || ""] || "—"],
    ["Сезон", gi?.season ? { warm: "Теплый период", cold: "Холодный период", interseasonal: "Межсезонье", none: "Не применимо" }[gi.season] || "—" : "—"],
    ["Тип квалификации", gi?.qualificationType ? { primary: "Первичная", periodic: "Периодическая", repeat: "Повторная" }[gi.qualificationType] || "—" : "—"],
  ];
  const rows: Array<[string, string | undefined]> = part === "part1"
    ? [
        ...baseRows,
        ["Дата составления протокола", fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === 'string' ? new Date(input.protocol.createdAt) : input.protocol.createdAt)],
      ]
    : [
        // Перекрёстная ссылка на Протокол (Часть I)
        ["Отчёт составлен по Протоколу №", `${input.protocol.number} от ${fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === 'string' ? new Date(input.protocol.createdAt) : input.protocol.createdAt)}`],
        ...baseRows,
        ["Дата составления отчёта", input.reportDate && input.reportDate.trim() ? input.reportDate.trim() : fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === 'string' ? new Date(input.protocol.createdAt) : input.protocol.createdAt)]
      ];

  const rowMinH = 24;
  const rowPaddingY = 5;
  const labelX = cardX + 14;
  const valueX = cardX + 164;
  const labelW = 136;
  const valueW = cardW - 184;
  const valueFontSize = 10;
  const cardPaddingTop = 12;
  const cardPaddingBottom = 12;
  const compactCoverValue = (key: string, value: string | undefined): string => {
    const text = value || "\u2014";
    const threeLineKeys = new Set([
      "\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044f",
      "\u0410\u0434\u0440\u0435\u0441 \u043e\u0431\u044a\u0435\u043a\u0442\u0430",
      "\u0422\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442\u043d\u043e\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043e / \u0433\u043e\u0441. \u043d\u043e\u043c\u0435\u0440",
    ]);
    const twoLineKeys = new Set([
      "\u041e\u0431\u044a\u0435\u043a\u0442 \u043a\u0432\u0430\u043b\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
      "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430",
    ]);
    doc.font("bold").fontSize(valueFontSize);
    // Allow long organisation names / addresses to wrap fully instead of being
    // cut off with «…». The card auto-sizes to the measured value height, so a
    // generous line cap keeps real values readable while still bounding
    // pathologically long input.
    if (threeLineKeys.has(key)) return fitTextToLines(doc, text, valueW, 8);
    if (twoLineKeys.has(key)) return fitTextToLines(doc, text, valueW, 4);
    return text;
  };
  const measuredRows = rows.map(([k, rawValue]) => {
    const v = compactCoverValue(k, rawValue);
    doc.font("body").fontSize(8);
    const labelH = doc.heightOfString(k.toUpperCase(), { width: labelW });
    doc.font("bold").fontSize(valueFontSize);
    const valueH = doc.heightOfString(v || "\u2014", { width: valueW, lineGap: 1 });
    return {
      k,
      v,
      rowH: Math.max(rowMinH, Math.ceil(Math.max(labelH, valueH) + rowPaddingY * 2)),
    };
  });

  const cardH = cardPaddingTop + measuredRows.reduce((sum, row) => sum + row.rowH, 0) + cardPaddingBottom;
  doc.save();
  doc.lineWidth(0.7).strokeColor(BORDER).roundedRect(cardX, cardY, cardW, cardH, 8).stroke();
  doc.restore();

  let rowY = cardY + cardPaddingTop;
  measuredRows.forEach(({ k, v, rowH }) => {
    const textY = rowY + rowPaddingY;
    doc.fillColor(MUTED).font("body").fontSize(8).text(k.toUpperCase(), labelX, textY, {
      width: labelW,
    });
    doc
      .fillColor(ACCENT)
      .font("bold")
      .fontSize(valueFontSize)
      .text(v || "\u2014", valueX, textY - 1, { width: valueW, lineGap: 1 });
    rowY += rowH;
  });

  // Footer note: draw only when it can fit without touching the metadata card.
  const footerNoteY = Math.max(cardY + cardH + 10, doc.page.height - 93);
  if (footerNoteY <= doc.page.height - 62) {
    doc
      .fillColor(MUTED)
      .font("body")
      .fontSize(8)
      .text(
        "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u0441\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d \u0432 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c\u0438 GMP / GDP / GPP.",
        left,
        footerNoteY,
        { width: right - left, align: "center" },
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 70);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  doc.save();
  doc.rect(left, doc.y, 4, 30).fill(ACCENT);
  doc.restore();
  doc
    .fillColor(ACCENT)
    .font("bold")
    .fontSize(14)
    .text(title, left + 14, doc.y + 7, { width: right - left - 18, lineBreak: false });
  doc.moveDown(0.7);
  doc.save();
  doc.strokeColor(BORDER).lineWidth(0.6).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.restore();
  doc.moveDown(0.7);
}

function drawSubTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 50);
  doc.moveDown(0.6);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  doc.fillColor(ACCENT).font("bold").fontSize(12).text(title, left, doc.y, { width: right - left });
  doc.moveDown(0.4);
}

function formatLoadPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value).trim();
  if (!raw) return "—";
  const normalized = raw.replace("%", "").replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return raw.endsWith("%") ? raw : `${raw}%`;
  const rounded = Math.round(numeric * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function drawGeneralInfoTable(doc: PDFKit.PDFDocument, input: ReportInput) {
  const gi = input.generalInfo;
  const isWarehouse = gi?.equipmentType === "warehouse";
  const loadPercentLabel = formatLoadPercent(gi?.loadPercent);

  let rows: Array<[string, string]>;

  if (isWarehouse) {
    // Warehouse: show object-specific fields only.
    const hasDimensions = !!(gi?.whLengthM || gi?.whWidthM || gi?.whHeightM);
    const lengthM = gi?.whLengthM ? Number(gi.whLengthM).toFixed(2) : "—";
    const widthM  = gi?.whWidthM ? Number(gi.whWidthM).toFixed(2) : "—";
    const heightM = gi?.whHeightM ? Number(gi.whHeightM).toFixed(2) : "—";
    const dims = `${lengthM} × ${widthM} × ${heightM} м (Д × Ш × В)`;
    const fillStatusLabel = gi?.fillStatus ? { empty: "Пустой", loaded: "Загруженный" }[gi.fillStatus] : "—";
    rows = [
      ["Тип объекта", gi?.equipmentType === "warehouse" ? getEquipmentName(input) : EQUIPMENT_LABEL[gi?.equipmentType || ""] || "—"],
      ["Тип помещения / зоны", WAREHOUSE_STUDY_LABEL[gi?.whStudyType || ""] || "—"],
      ["Адрес объекта", gi?.location || "—"],
      ["Температурный режим", TEMP_MODE_LABEL[gi?.tempMode || ""] || "—"],
      ["Контроль влажности", gi?.whHumidityControl ? `Да (${gi?.whHumidityMin ?? "—"} – ${gi?.whHumidityMax ?? "—"} % о.в.)` : "Не контролируется"],
      ["Сезон исследования", gi?.season ? { warm: "Тёплый период", cold: "Холодный период", interseasonal: "Межсезонье", none: "Не применимо" }[gi.season] || WAREHOUSE_SEASON_LABEL[gi.season] || "—" : "—"],
      ["Контакт с внешней средой", gi?.whExternalEnv ? "Имеется (учитываются сезонные колебания)" : "Отсутствует"],
      ["Заполненность объекта", fillStatusLabel],
      ["Процент загруженности объекта", loadPercentLabel],
      ["Назначение / хранимая продукция", gi?.purpose || "—"],
      ["Организация", input.org.name],
      ["БИН / ИНН", input.org.bin || "—"],
      ["Адрес организации", input.org.addressFact || "—"],
      ["Ответственное лицо", input.org.responsible || "—"],
      ["Контакты", input.org.phone || "—"],
    ];
    if (hasDimensions) {
      rows.splice(3, 0, ["Геометрические размеры", dims]);
    }
    if (gi?.whLayoutNotes) {
      rows.push(["Примечания к планировке", gi.whLayoutNotes]);
    }
  } else {
    // Refrigerator / auto-refrigerator: show equipment-specific fields
    rows = [
      ["Тип оборудования", gi?.equipmentType === "warehouse" ? getEquipmentName(input) : EQUIPMENT_LABEL[gi?.equipmentType || ""] || "—"],
      ["Производитель", gi?.manufacturer || "—"],
      ["Модель", gi?.model || "—"],
      ["Серийный номер", gi?.serial || "—"],
      ["Температурный режим", TEMP_MODE_LABEL[gi?.tempMode || ""] || "—"],
      ["Место установки", gi?.location || "—"],
      ["Назначение / хранимая продукция", gi?.purpose || "—"],
      ["Организация", input.org.name],
      ["БИН / ИНН", input.org.bin || "—"],
      ["Адрес", input.org.addressFact || "—"],
      ["Ответственное лицо", input.org.responsible || "—"],
      ["Контакты", input.org.phone || "—"],
      ["Процент загруженности объекта", loadPercentLabel],
    ];
  }
  drawKVTable(doc, rows);
}

function drawKVTable(doc: PDFKit.PDFDocument, rows: Array<[string, string]>, keyColW = 220) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalWidth = right - left;
  
  // Calculate optimal key column width based on content
  let maxKeyWidth = 0;
  doc.font("body").fontSize(9);
  rows.forEach(([k]) => {
    const width = doc.widthOfString(k);
    maxKeyWidth = Math.max(maxKeyWidth, width);
  });
  doc.fontSize(10);
  
  // Use calculated width with padding, but respect minimum and maximum
  const padding = 10;
  const calculatedKeyColW = Math.min(Math.max(maxKeyWidth + padding * 3, 150), totalWidth * 0.5);
  const colKey = keyColW > 0 ? keyColW : calculatedKeyColW;

  rows.forEach(([k, v], idx) => {
    const padding = 10;
    const keyWidth = colKey - padding * 2;
    const valWidth = right - left - colKey - padding;
    doc.font("body").fontSize(10);
    const keyHeight = doc.heightOfString(k, { width: keyWidth });
    const valHeight = doc.heightOfString(v || "—", { width: valWidth });
    const rowH = Math.max(28, Math.max(keyHeight, valHeight) + padding * 2);
    ensureSpace(doc, rowH);
    const y = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, y, right - left, rowH).fill();
      doc.restore();
    }
    doc
      .fillColor(MUTED)
      .font("body")
      .fontSize(9)
      .text(k, left + padding, y + padding, { width: keyWidth });
    doc
      .fillColor(ACCENT)
      .font("body")
      .fontSize(10)
      .text(v || "—", left + colKey + padding, y + padding, { width: valWidth });
    doc.y = y + rowH;
  });
  doc.moveDown(0.6);
}

function drawSimpleTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colFractions: number[],
) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalW = right - left;
  const colW = colFractions.map(fraction => fraction * totalW);
  const padding = 6;

  ensureSpace(doc, 28);
  let y = doc.y;
  const headerH = 24;
  doc.save();
  doc.rect(left, y, totalW, headerH).fill(ACCENT);
  doc.restore();

  let cx = left;
  doc.fillColor("white").font("bold").fontSize(9);
  headers.forEach((header, index) => {
    doc.text(header, cx + padding, y + 7, { width: colW[index] - padding * 2, lineBreak: false });
    cx += colW[index];
  });
  doc.y = y + headerH;

  rows.forEach((cells, rowIndex) => {
    doc.font("body").fontSize(9);
    const rowH = Math.max(
      26,
      ...cells.map((cell, index) =>
        doc.heightOfString(cell || "—", { width: colW[index] - padding * 2 }) + padding * 2,
      ),
    );
    ensureSpace(doc, rowH);
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
    cells.forEach((cell, index) => {
      if (index > 0) {
        doc.save();
        doc.strokeColor(BORDER).lineWidth(0.5).moveTo(cx, y).lineTo(cx, y + rowH).stroke();
        doc.restore();
      }
      doc.fillColor(ACCENT).font("body").fontSize(9)
        .text(cell || "—", cx + padding, y + padding, { width: colW[index] - padding * 2 });
      cx += colW[index];
    });
    doc.y = y + rowH;
  });
  doc.moveDown(0.7);
}

function drawRevisionHistorySection(doc: PDFKit.PDFDocument, input: ReportInput) {
  drawSubTitle(doc, "Редакция протокола и история изменений");
  const revision = input.dataIntegrity?.revision || "01";
  drawKVTable(doc, [
    ["Текущая редакция", revision],
    ["Статус редакции", "Действующая"],
  ], 180);

  const author = getTraceablePerson(input);
  const defaultDate = input.generalInfo?.validationDate || input.reportDate || input.protocol.createdAt || input.dataIntegrity?.generatedAt;
  const rows = (input.dataIntegrity?.revisionHistory?.length
    ? input.dataIntegrity.revisionHistory
    : [{
        revision,
        date: defaultDate,
        change: "Первичная редакция протокола и отчёта о квалификации.",
        author,
      }]
  ).map(item => [
    item.revision,
    fmtTraceDateWithFallback(item.date, defaultDate),
    item.change,
    item.author,
  ]);

  drawSimpleTable(
    doc,
    ["Ред.", "Дата", "Описание изменения", "Внес / подготовил"],
    rows,
    [0.10, 0.20, 0.45, 0.25],
  );
}

function drawStageDataEntryTable(doc: PDFKit.PDFDocument, input: ReportInput, stage: "IQ" | "OQ" | "PV") {
  const trace = getStageTrace(input, stage);
  // Auto-fill: ФИО — автор из истории изменений («внёс/подготовил»),
  // дата — как дата составления отчёта на обложке Части II.
  const filledBy = getTraceablePerson(input);
  const reportDate = input.reportDate && input.reportDate.trim()
    ? input.reportDate.trim()
    : fmtDateOnly(
        input.generalInfo?.validationDate
          ? new Date(input.generalInfo.validationDate)
          : typeof input.protocol.createdAt === "string"
            ? new Date(input.protocol.createdAt)
            : input.protocol.createdAt,
      );
  drawSubTitle(doc, `Запись ввода данных ${stage === "PV" ? "PQ/PV" : stage}`);
  drawSimpleTable(
    doc,
    ["Раздел данных", "Заполнил (ФИО)", "Дата заполнения", "Источник записи"],
    [[trace.label || " ", filledBy || " ", reportDate || " ", trace.source || " "]],
    [0.30, 0.22, 0.24, 0.24],
  );
}

function drawStageBlocks(
  doc: PDFKit.PDFDocument,
  stage: { purpose: string; description: string; criteria: string },
) {
  const blocks: Array<[string, string]> = [
    ["Цель испытания", stage.purpose],
    ["Описание испытания", stage.description],
    ["Критерии приемлемости", stage.criteria],
  ];
  blocks.forEach(([k, v]) => {
    ensureSpace(doc, 60);
    doc.fillColor(ACCENT).font("bold").fontSize(11).text(k);
    doc.moveDown(0.3);
    doc.fillColor("#1f2937").font("body").fontSize(10).text(v, { align: "justify" });
    doc.moveDown(0.7);
  });
}

function drawChecklistTable(doc: PDFKit.PDFDocument, items: ChecklistItem[]) {
  drawSubTitle(doc, "Опросник");
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const numW = 30;
  const ansW = 90;
  const qW = right - left - numW - ansW;

  // Header
  ensureSpace(doc, 26);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, right - left, 22).fill(ACCENT);
  doc.restore();
  doc.fillColor("white").font("bold").fontSize(10);
  doc.text("№", left + 6, y + 6, { width: numW - 6 });
  doc.text("Вопрос / комментарий", left + numW + 6, y + 6, { width: qW - 12 });
  doc.text("Ответ", left + numW + qW + 6, y + 6, { width: ansW - 12 });
  doc.y = y + 22;

  items.forEach((it, idx) => {
    const padding = 6;
    doc.font("body").fontSize(10);
    const qText = it.questionText + (it.comment ? `\nКомментарий: ${it.comment}` : "");
    const qH = doc.heightOfString(qText, { width: qW - 12 });
    const rowH = Math.max(22, qH + padding * 2);
    ensureSpace(doc, rowH);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, right - left, rowH).fill();
      doc.restore();
    }
    doc.save();
    doc
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .moveTo(left, ry + rowH)
      .lineTo(right, ry + rowH)
      .stroke();
    doc.restore();

    doc
      .fillColor(ACCENT)
      .font("body")
      .fontSize(10)
      .text(String(idx + 1), left + 6, ry + padding, { width: numW - 6 });
    doc
      .fillColor("#1f2937")
      .font("body")
      .fontSize(10)
      .text(qText, left + numW + 6, ry + padding, { width: qW - 12 });

    const ansLabel = ANSWER_LABEL[it.answer] || "—";
    let ansColor = MUTED;
    if (it.answer === "yes") ansColor = "#15803d";
    else if (it.answer === "no") ansColor = "#b91c1c";
    else if (it.answer === "na") ansColor = "#475569";
    doc
      .fillColor(ansColor)
      .font("bold")
      .fontSize(10)
      .text(ansLabel, left + numW + qW + 6, ry + padding, { width: ansW - 12 });

    doc.y = ry + rowH;
  });
  doc.moveDown(0.4);
}

function drawStageVerdict(
  doc: PDFKit.PDFDocument,
  name: string,
  verdict: "pass" | "fail" | "none",
  items: ChecklistItem[],
) {
  const noItems = items.filter(i => i.answer === "no");
  doc.moveDown(0.5);
  // Draw title and box together — reserve space for both to prevent orphaned title
  doc.font("bold").fontSize(12);
  const titleH = doc.heightOfString("Заключение по этапу") + 4;
  doc.font("body").fontSize(10);
  // Use the longest possible verdict text to correctly estimate required height
  const longestSample =
    "Все критерии приемлемости выполнены. Квалификация монтажа (IQ) пройдена успешно. " +
    "Оборудование установлено, подключено и соответствует требованиям проектной, нормативной и эксплуатационной документации.";
  const sampleH = Math.max(60, doc.heightOfString(longestSample, { width: doc.page.width - PAGE_MARGIN * 2 - 28 }) + 28);
  ensureSpace(doc, titleH + 8 + sampleH);
  doc.fillColor(ACCENT).font("bold").fontSize(12).text(
    "Заключение по этапу",
    PAGE_MARGIN,
    doc.y,
    {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: "center",
      lineBreak: false,
    },
  );
  doc.moveDown(0.3);
  // Extra 1.5 cm (≈42.5pt) gap before the verdict box as requested
  doc.y += 42.5;
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;

  let bg = "#f1f5f9";
  let bd = BORDER;
  let fg = ACCENT;
  let text = "Заключение не сформировано — этап не завершён.";

  if (verdict === "pass") {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    if (name === "IQ") {
      text =
        "Все критерии приемлемости выполнены. Квалификация монтажа (IQ) пройдена успешно. " +
        "Оборудование установлено, подключено и соответствует требованиям проектной, нормативной и эксплуатационной документации.";
    } else if (name === "OQ") {
      text =
        "Все критерии приемлемости выполнены. Квалификация функционирования (OQ) пройдена успешно. " +
        "Оборудование функционирует в соответствии с техническими характеристиками и условиями эксплуатации производителя.";
    } else {
      text = `Все критерии приемлемости выполнены. Этап ${name} пройден успешно.`;
    }
  } else if (verdict === "fail") {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    const list = noItems
      .map((it, i) => `${i + 1}. ${it.questionText}${it.comment ? ` (${it.comment})` : ""}`)
      .join("\n");
    text = `Этап ${name} не пройден. Выявлены несоответствия:\n${list || "—"}`;
  }

  const padding = 14;
  doc.font("body").fontSize(10);
  const h = Math.max(50, doc.heightOfString(text, { width: w - padding * 2 }) + padding * 2);
  // Space was already reserved above for title+box together — do NOT call ensureSpace again.
  const y = doc.y;
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(10).text(text, left + padding, y + padding, {
    width: w - padding * 2,
  });
  doc.y = y + h;
  doc.moveDown(0.6);
}

function drawPVParams(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const durationMs = pv.startAt && pv.endAt ? pv.endAt - pv.startAt : 0;
  const durationRequirement = getReportEquipmentType(input) === "warehouse"
    ? `от 3 суток и далее (не менее 72 ч); выбрано ${pv.minDurationHours} ч`
    : `${pv.minDurationHours} ч`;
  const rows: Array<[string, string]> = [
    ["Температурный режим", TEMP_MODE_LABEL[pv.tempMode] || pv.tempMode],
    ...sensorAccuracyRows(pv),
    ["Начало испытания", pv.startAt ? fmtDate(pv.startAt) : "—"],
    ["Окончание испытания", pv.endAt ? fmtDate(pv.endAt) : "—"],
    ["Фактическая длительность", durationMs ? fmtDuration(durationMs) : "—"],
    [
      getReportEquipmentType(input) === "warehouse"
        ? "Требуемая длительность"
        : "Минимальная длительность (по умолчанию)",
      durationRequirement,
    ],
    ["Минимальное число датчиков (по умолчанию)", String(pv.minSensorCount)],
    ["Использовано датчиков", String(pv.loggers.length)],
    ["Внутренних датчиков", String(pv.loggers.filter(l => l.role === "internal").length)],
    ["Внешних датчиков", String(pv.loggers.filter(l => l.role === "external").length)],
  ];
  drawKVTable(doc, rows);
}

function drawStatsTable(
  doc: PDFKit.PDFDocument,
  loggers: LoggerSummary[],
  hotIdx: number | null,
  coldIdx: number | null,
  extIndices: number[],
) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const cols = [
    { label: "Датчик", w: 0.14 },
    { label: "Роль", w: 0.14 },
    { label: "Min, °C", w: 0.1 },
    { label: "Max, °C", w: 0.1 },
    { label: "Avg, °C", w: 0.11 },
    { label: "STD", w: 0.08 },
    { label: "MKT, °C", w: 0.11 },
    { label: "Точек", w: 0.10 },
    { label: "Откл.", w: 0.08 },
  ];

  const ROW_H = 26; // Increased by 10% from 24
  const HEADER_H = 24; // Increased by 10% from 22

  ensureSpace(doc, HEADER_H + 2);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, w, HEADER_H).fill(ACCENT);
  doc.restore();
  let cx = left;
  doc.fillColor("white").font("bold").fontSize(9);
  cols.forEach(c => {
    const cw = c.w * w;
    doc.text(c.label, cx + 4, y + 5, { width: cw - 8, lineBreak: false });
    cx += cw;
  });
  doc.y = y + HEADER_H;

  loggers.forEach((l, idx) => {
    ensureSpace(doc, ROW_H);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, w, ROW_H).fill();
      doc.restore();
    }
    let role = l.role === "external" ? "внеш." : "внутр.";
    if (idx === hotIdx) role = "внутр. гор.";
    if (idx === coldIdx) role = "внутр. хол.";
    const rawLabel = l.label.length > 4 ? l.label.slice(-4) : l.label;
    const name = l.customName ? `${rawLabel} · ${l.customName}` : rawLabel;
    const cells = [
      name,
      role,
      l.min.toFixed(2),
      l.max.toFixed(2),
      l.avg.toFixed(2),
      l.std.toFixed(2),
      l.mkt.toFixed(2),
      String(l.pointCount),
      String(l.deviations.length),
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

function drawCharts(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const eqName = input ? getEquipmentName(input) : "оборудования";
  const eqGen = eqName.toLowerCase(); // genitive approximation for use in sentences
  const internal = pv.loggers
    .map((l, i) => ({ ...l, idx: i }))
    .filter(l => l.role === "internal");

  if (internal.length > 0) {
    drawOverviewChart(
      doc,
      internal.map(l => ({
        name: shortLabel(l.label, l.customName),
        ts: l.series.ts,
        temp: l.series.temp,
      })),
      pv.rangeMin,
      pv.rangeMax,
    );
    drawChartExplanation(
      doc,
      "Обзорный график показывает температурные кривые всех внутренних датчиков на одной диаграмме. " +
      "Зелёная полоса обозначает допустимый диапазон температур (" + (pv.rangeMin > 0 ? '+' : '') + pv.rangeMin + "…" + (pv.rangeMax > 0 ? '+' : '') + pv.rangeMax + " °C). " +
      "Если все кривые остаются в пределах полосы, это свидетельствует о стабильности условий хранения. " +
      "Пересечение кривой за границы диапазона указывает на отклонение, требующее анализа."
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
        temp: l.series.temp,
      },
      pv.rangeMin,
      pv.rangeMax,
    );
    const externalChartText = getReportEquipmentType(input) === "warehouse"
      ? "\u0413\u0440\u0430\u0444\u0438\u043a \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u0442 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044b \u0432\u043d\u0435 \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u044f (\u0437\u043e\u043d\u044b) \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f. " +
        "\u042d\u0442\u043e\u0442 \u0434\u0430\u0442\u0447\u0438\u043a \u043d\u0435 \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0435\u0432 \u043f\u0440\u0438\u0435\u043c\u043b\u0435\u043c\u043e\u0441\u0442\u0438 PV, \u043d\u043e \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u043e\u0446\u0435\u043d\u0438\u0442\u044c \u0432\u043b\u0438\u044f\u043d\u0438\u0435 \u0441\u0440\u0435\u0434\u044b."
      : "\u0413\u0440\u0430\u0444\u0438\u043a \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u0442 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044b \u0432\u043d\u0435 " + reeferAreaGenitive(getReportEquipmentType(input)) + ". " +
        "\u042d\u0442\u043e\u0442 \u0434\u0430\u0442\u0447\u0438\u043a \u043d\u0435 \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0435\u0432 \u043f\u0440\u0438\u0435\u043c\u043b\u0435\u043c\u043e\u0441\u0442\u0438 PV, \u043d\u043e \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u043e\u0446\u0435\u043d\u0438\u0442\u044c \u0432\u043b\u0438\u044f\u043d\u0438\u0435 \u0441\u0440\u0435\u0434\u044b.";
    drawChartExplanation(doc, externalChartText);
  }

  if (pv.hotIdx !== null && pv.loggers[pv.hotIdx]) {
    const l = pv.loggers[pv.hotIdx];
    drawHotChart(
      doc,
      {
        name: shortLabel(l.label, l.customName),
        ts: l.series.ts,
        temp: l.series.temp,
      },
      pv.rangeMin,
      pv.rangeMax,
    );
    drawChartExplanation(
      doc,
      getReportEquipmentType(input) === "warehouse"
        ? "\u0413\u0440\u0430\u0444\u0438\u043a \u0441\u0430\u043c\u043e\u0433\u043e \u0442\u0451\u043f\u043b\u043e\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 (\u0441 \u043d\u0430\u0438\u0431\u043e\u043b\u044c\u0448\u0438\u043c \u0441\u0440\u0435\u0434\u043d\u0438\u043c \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435\u043c \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u044b). \u042d\u0442\u043e\u0442 \u0434\u0430\u0442\u0447\u0438\u043a \u043e\u0431\u044b\u0447\u043d\u043e \u0440\u0430\u0441\u043f\u043e\u043b\u0430\u0433\u0430\u0435\u0442\u0441\u044f \u0432 \u0437\u043e\u043d\u0435 \u0441 \u043d\u0430\u0438\u043c\u0435\u043d\u0435\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u0438\u0432\u043d\u044b\u043c \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u0435\u043c \u0438 \u0441\u043b\u0443\u0436\u0438\u0442 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438 \u043d\u0430\u0438\u0445\u0443\u0434\u0448\u0438\u0445 \u0443\u0441\u043b\u043e\u0432\u0438\u0439 \u0432 \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0438."
        : "\u0413\u0440\u0430\u0444\u0438\u043a \u0441\u0430\u043c\u043e\u0433\u043e \u0442\u0451\u043f\u043b\u043e\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 (\u0441 \u043d\u0430\u0438\u0431\u043e\u043b\u044c\u0448\u0438\u043c \u0441\u0440\u0435\u0434\u043d\u0438\u043c \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435\u043c \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u044b). \u042d\u0442\u043e\u0442 \u0434\u0430\u0442\u0447\u0438\u043a \u043e\u0431\u044b\u0447\u043d\u043e \u0440\u0430\u0441\u043f\u043e\u043b\u0430\u0433\u0430\u0435\u0442\u0441\u044f \u0432 \u0437\u043e\u043d\u0435 \u0441 \u043d\u0430\u0438\u043c\u0435\u043d\u0435\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u0438\u0432\u043d\u044b\u043c \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u0435\u043c \u0438 \u0441\u043b\u0443\u0436\u0438\u0442 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438 \u043d\u0430\u0438\u0445\u0443\u0434\u0448\u0438\u0445 \u0443\u0441\u043b\u043e\u0432\u0438\u0439 \u0432 " + reeferAreaAfterIn(getReportEquipmentType(input)) + "."
    );
  }

  if (pv.coldIdx !== null && pv.loggers[pv.coldIdx]) {
    const l = pv.loggers[pv.coldIdx];
    drawColdChart(
      doc,
      {
        name: shortLabel(l.label, l.customName),
        ts: l.series.ts,
        temp: l.series.temp,
      },
      pv.rangeMin,
      pv.rangeMax,
    );
    drawChartExplanation(
      doc,
      getReportEquipmentType(input) === "warehouse"
        ? "\u0413\u0440\u0430\u0444\u0438\u043a \u0441\u0430\u043c\u043e\u0433\u043e \u0445\u043e\u043b\u043e\u0434\u043d\u043e\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 (\u0441 \u043d\u0430\u0438\u043c\u0435\u043d\u044c\u0448\u0438\u043c \u0441\u0440\u0435\u0434\u043d\u0438\u043c \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435\u043c \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u044b). \u042d\u0442\u043e\u0442 \u0434\u0430\u0442\u0447\u0438\u043a \u0441\u043b\u0443\u0436\u0438\u0442 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438 \u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0445\u043e\u043b\u043e\u0434\u043d\u043e\u0439 \u0437\u043e\u043d\u044b \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u044f."
        : "\u0413\u0440\u0430\u0444\u0438\u043a \u0441\u0430\u043c\u043e\u0433\u043e \u0445\u043e\u043b\u043e\u0434\u043d\u043e\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 (\u0441 \u043d\u0430\u0438\u043c\u0435\u043d\u044c\u0448\u0438\u043c \u0441\u0440\u0435\u0434\u043d\u0438\u043c \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435\u043c \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u044b). \u042d\u0442\u043e\u0442 \u0434\u0430\u0442\u0447\u0438\u043a \u0441\u043b\u0443\u0436\u0438\u0442 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438 \u043d\u0430\u0438\u0431\u043e\u043b\u0435\u0435 \u0445\u043e\u043b\u043e\u0434\u043d\u043e\u0439 \u0437\u043e\u043d\u044b \u0432 " + reeferAreaAfterIn(getReportEquipmentType(input)) + "."
    );
  }

  if (internal.length > 0) {
    drawHeatmapChart(
      doc,
      internal.map(l => ({
        name: shortLabel(l.label, l.customName),
        avg: l.avg,
      })),
      pv.rangeMin,
      pv.rangeMax,
    );
    drawChartExplanation(
      doc,
      getReportEquipmentType(input) === "warehouse"
        ? "\u0422\u0435\u043f\u043b\u043e\u0432\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0440\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0441\u0440\u0435\u0434\u043d\u0438\u0445 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440 \u043f\u043e \u0432\u0441\u0435\u043c \u0434\u0430\u0442\u0447\u0438\u043a\u0430\u043c \u0432 \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0438 (\u0437\u043e\u043d\u0435) \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f."
        : "\u0422\u0435\u043f\u043b\u043e\u0432\u0430\u044f \u043a\u0430\u0440\u0442\u0430 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0440\u0430\u0441\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u0441\u0440\u0435\u0434\u043d\u0438\u0445 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440 \u043f\u043e \u0432\u0441\u0435\u043c \u0434\u0430\u0442\u0447\u0438\u043a\u0430\u043c \u0432 " + reeferAreaAfterIn(getReportEquipmentType(input)) + "."
    );

    drawStatsBarChart(
      doc,
      internal.map(l => ({
        name: shortLabel(l.label, l.customName),
        min: l.min,
        avg: l.avg,
        max: l.max,
        mkt: l.mkt,
      })),
    );
    drawChartExplanation(
      doc,
      "\u0413\u0440\u0430\u0444\u0438\u043a \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0438 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0434\u043b\u044f \u043a\u0430\u0436\u0434\u043e\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430: \u043c\u0438\u043d\u0438\u043c\u0443\u043c, \u0441\u0440\u0435\u0434\u043d\u0435\u0435, \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0438 MKT. MKT \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f \u043a\u0430\u043a \u043e\u0431\u043e\u0431\u0449\u0451\u043d\u043d\u044b\u0439 \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c \u0442\u0435\u0440\u043c\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e \u0432\u043e\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u043d\u0430 \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u044e."
    );
  }

}

function insertImage(doc: PDFKit.PDFDocument, buf: Buffer, height: number) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  ensureSpace(doc, height + 12);
  doc.image(buf, left, doc.y, { width: w, height });
  doc.y += height + 8;
}

function drawDeviationsSection(doc: PDFKit.PDFDocument, pv: ReportInput["pv"]) {
  const internal = pv.loggers
    .map((l, i) => ({ ...l, idx: i }))
    .filter((l, i) => l.role === "internal");
  const all = internal.flatMap(l =>
    l.deviations.map(d => ({
      label: l.customName ? `${l.label} · ${l.customName}` : l.label,
      ...d,
    })),
  );

  ensureSpace(doc, 60);
  doc.moveDown(0.5);
  doc.fillColor(ACCENT).font("bold").fontSize(12).text("Зафиксированные отклонения");
  doc.moveDown(0.3);
  if (all.length === 0) {
    doc
      .fillColor(MUTED)
      .font("body")
      .fontSize(10)
      .text("Отклонений за границы режима в течение испытания не зафиксировано.");
    doc.moveDown(0.4);
    return;
  }

  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const cols = [
    { label: "Датчик", w: 0.2 },
    { label: "Тип", w: 0.12 },
    { label: "Начало", w: 0.22 },
    { label: "Окончание", w: 0.22 },
    { label: "Длительность", w: 0.14 },
    { label: "Экстремум, °C", w: 0.1 },
  ];
  ensureSpace(doc, 26);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, w, 22).fill(ACCENT);
  doc.restore();
  let cx = left;
  doc.fillColor("white").font("bold").fontSize(9);
  cols.forEach(c => {
    const cw = c.w * w;
    doc.text(c.label, cx + 4, y + 6, { width: cw - 8 });
    cx += cw;
  });
  doc.y = y + 22;

  all.forEach((d, idx) => {
    ensureSpace(doc, 22);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
      doc.restore();
    }
    const cells = [
      d.label,
      d.type === "high" ? "Превышение" : "Понижение",
      fmtDate(d.start),
      fmtDate(d.end),
      fmtDuration(d.durationMs),
      d.value.toFixed(2),
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

function drawStagePVVerdict(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  ensureSpace(doc, 120);
  doc.moveDown(0.5);
  doc.x = left;
  doc.fillColor(ACCENT).font("bold").fontSize(12).text(
    "Заключение по этапу PV",
    left,
    doc.y,
    { width: w, align: "center", lineBreak: false },
  );
  doc.moveDown(0.3);
  let text = "Заключение не сформировано — этап не завершён.";
  let bg = "#f1f5f9";
  let bd = BORDER;
  let fg = ACCENT;
  if (pv.verdict === "pass") {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    
    // Enhanced conclusion for warehouse protocols with sensor analysis
    if (getReportEquipmentType(input) === "warehouse") {
      const hotSensor = pv.hotIdx !== null ? pv.loggers[pv.hotIdx] : null;
      const coldSensor = pv.coldIdx !== null ? pv.loggers[pv.coldIdx] : null;
      const hotLabel = hotSensor ? `датчик "${hotSensor.customName || hotSensor.label}"` : "датчик";
      const coldLabel = coldSensor ? `датчик "${coldSensor.customName || coldSensor.label}"` : "датчик";
      const internalCount = pv.loggers.filter(l => l.role === "internal").length;
      
      text =
        "Все критерии приемлемости выполнены. Эксплуатационная квалификация (PV) пройдена успешно. " +
        `Анализ данных ${internalCount} внутренних датчиков показал стабильное распределение температуры ` +
        "по всему объёму помещения (зоны) хранения. " +
        (hotSensor ? `Максимальная температура зафиксирована ${hotLabel} (горячая точка). ` : "") +
        (coldSensor ? `Минимальная температура зафиксирована ${coldLabel} (холодная точка). ` : "") +
        "Система кондиционирования/отопления функционирует в штатном режиме, обеспечивая равномерное распределение " +
        "температуры и надлежащие условия для хранения лекарственных средств в соответствии с требованиями GDP/GSP.";
    } else {
      text =
        "Все критерии приемлемости выполнены. Эксплуатационная квалификация (PV) пройдена успешно. " +
        "Оборудование признано пригодным для хранения лекарственных средств в указанном режиме.";
    }
  } else if (pv.verdict === "fail") {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    text =
      "Эксплуатационная квалификация (PV) не пройдена. Зафиксированы несоответствия:\n" +
      pv.failureReasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
  }

  const padding = 14;
  doc.font("body").fontSize(10);
  const h = Math.max(50, doc.heightOfString(text, { width: w - padding * 2 }) + padding * 2);
  ensureSpace(doc, h);
  const y = doc.y;
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(10).text(text, left + padding, y + padding, {
    width: w - padding * 2,
  });
  doc.y = y + h;
  doc.moveDown(0.6);
}

/**
 * Sensor placement risk analysis section.
 * Explains why sensors are placed on different shelves and describes external sensor role.
 */
function drawSensorPlacementAnalysis(
  doc: PDFKit.PDFDocument,
  sensors: DiagramSensor[],
  input?: ReportInput,
) {
  const eqName = input ? getEquipmentName(input) : "оборудования";
  const eqGen = eqName.toLowerCase();
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;

  ensureSpace(doc, 100);
  doc.moveDown(0.3);
  doc.fillColor(ACCENT).font("bold").fontSize(11).text("Анализ расстановки датчиков и оценка рисков", left, doc.y, { width: w });
  doc.moveDown(0.2);

  const internals = sensors.filter(s => s.role === "internal");
  const externals = sensors.filter(s => s.role === "external");

  let analysisText = "";

  // Analyze internal sensor placement
  if (internals.length >= 2) {
    let hasTop = internals.some(s => s.position === "top");
    let hasMiddle = internals.some(s => s.position === "middle");
    let hasBottom = internals.some(s => s.position === "bottom");
    let hasDoor = internals.some(s => s.position === "door");

    // Infer positions from posX/posY coordinates if not explicitly set
    internals.forEach(s => {
      if ((s.position === "unset" || !s.position) && s.posY != null) {
        const pctY = Number(s.posY);
        if (pctY < 35) hasTop = true;
        else if (pctY > 65) hasBottom = true;
        else hasMiddle = true;
      }
    });

    analysisText += "\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043a\u0438 \u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u044b \u0432 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0445 \u043f\u043e\u0437\u0438\u0446\u0438\u044f\u0445 " +
      (getReportEquipmentType(input) === "warehouse" ? "\u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u044f (\u0437\u043e\u043d\u044b) \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f" : reeferAreaGenitive(getReportEquipmentType(input))) + ": ";
    const positions = [];
    if (hasTop) positions.push("верхняя полка");
    if (hasMiddle) positions.push("средняя часть");
    if (hasBottom) positions.push("нижняя полка");
    if (hasDoor) positions.push("дверная зона");
    analysisText += positions.join(", ") + ".\n\n";

    if (getReportEquipmentType(input) === "warehouse") {
      analysisText +=
        `Такая многоточечная расстановка позволяет выявить температурные градиенты внутри помещения (зоны) хранения и оценить ` +
        "равномерность распределения температуры по всему объёму помещения. Датчики на верхней и нижней полках фиксируют " +
        "потенциальные зоны риска, где может возникнуть локальное отклонение температуры от установленного диапазона. " +
        "Это критически важно для обеспечения стабильности условий хранения лекарственных средств и выявления " +
        "неисправностей системы кондиционирования или отопления на ранних этапах.\n\n";
    } else {
      analysisText +=
        "\u0422\u0430\u043a\u0430\u044f \u043c\u043d\u043e\u0433\u043e\u0442\u043e\u0447\u0435\u0447\u043d\u0430\u044f \u0440\u0430\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u043f\u043e\u0437\u0432\u043e\u043b\u044f\u0435\u0442 \u0432\u044b\u044f\u0432\u0438\u0442\u044c \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u043d\u044b\u0435 \u0433\u0440\u0430\u0434\u0438\u0435\u043d\u0442\u044b \u0432\u043d\u0443\u0442\u0440\u0438 " + reeferInsideVolume(getReportEquipmentType(input)) + " \u0438 \u043e\u0446\u0435\u043d\u0438\u0442\u044c " +
        "равномерность распределения холода по всему объёму объекта. Датчики на верхней и нижней полках фиксируют " +
        "потенциальные зоны риска, где может возникнуть локальное отклонение температуры от установленного диапазона. " +
        "Это критически важно для обеспечения стабильности условий хранения лекарственных средств и выявления " +
        "неисправностей системы охлаждения на ранних этапах.\n\n";
    }
  }

  // External sensor role
  if (externals.length > 0) {
    if (getReportEquipmentType(input) === "warehouse") {
      analysisText +=
        "Внешний датчик (расположенный вне помещения (зоны) хранения) служит для мониторинга параметров окружающей среды " +
        "и не входит в расчёт основных критериев приемлемости этапа PV. Данные внешнего датчика используются для " +
        "анализа влияния условий окружающей среды на работу оборудования и могут быть полезны при " +
        "диагностике отклонений. Внешний датчик помогает отличить проблемы, вызванные неисправностью оборудования, " +
        "от колебаний, обусловленных изменениями температуры в окружающей среде.";
    } else {
      analysisText +=
        "\u0412\u043d\u0435\u0448\u043d\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043a (\u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u043d\u044b\u0439 \u0432\u043d\u0435 " + reeferAreaGenitive(getReportEquipmentType(input)) + ") \u0441\u043b\u0443\u0436\u0438\u0442 \u0434\u043b\u044f \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433\u0430 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u043e\u0432 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044b " +
        "\u0438 \u043d\u0435 \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u0440\u0430\u0441\u0447\u0451\u0442 \u043e\u0441\u043d\u043e\u0432\u043d\u044b\u0445 \u043a\u0440\u0438\u0442\u0435\u0440\u0438\u0435\u0432 \u043f\u0440\u0438\u0435\u043c\u043b\u0435\u043c\u043e\u0441\u0442\u0438 \u044d\u0442\u0430\u043f\u0430 PV. \u0414\u0430\u043d\u043d\u044b\u0435 \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044e\u0442\u0441\u044f \u0434\u043b\u044f \u0430\u043d\u0430\u043b\u0438\u0437\u0430 \u0432\u043b\u0438\u044f\u043d\u0438\u044f \u0443\u0441\u043b\u043e\u0432\u0438\u0439 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044b \u043d\u0430 \u0440\u0430\u0431\u043e\u0442\u0443 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f.";
    }
  }

  doc.font("body").fontSize(10).fillColor(ACCENT);
  doc.text(analysisText, left, doc.y, {
    width: w,
    align: "left",
    lineGap: 2,
  });
  doc.moveDown(0.5);
}

function drawFinalConclusion(doc: PDFKit.PDFDocument, input: ReportInput) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;

  const all = [input.iq.verdict, input.oq.verdict, input.pv.verdict];
  const allPass = all.every(v => v === "pass");
  const anyFail = all.some(v => v === "fail");

  const lines: Array<[string, string]> = [
    ["Этап IQ — квалификация монтажа", verdictLabel(input.iq.verdict)],
    ["Этап OQ — квалификация функционирования", verdictLabel(input.oq.verdict)],
    ["Этап PV — эксплуатационная квалификация", verdictLabel(input.pv.verdict)],
  ];
  if (input.excursion?.enabled) {
    const excVerdict = excursionVerdictLabel(input.excursion);
    lines.push(["Испытания на температурное отклонение (Excursion Study)", excVerdict]);
  }
  // Use wider key column for the summary table so long stage names don't wrap
  drawKVTable(doc, lines, 280);

  // Calculate operational metrics for PV stage
  // If excursion tests are enabled, use their data; otherwise calculate from loggers
  let metrics = calculateAllOperationalMetrics(
    (input.pv.loggers || []).map(l => ({ series: l.series })),
    input.pv.rangeMin,
    input.pv.rangeMax,
    input.pv.hotIdx,
    input.pv.coldIdx,
    undefined,
    getReportEquipmentType(input) ?? undefined,
  );
  
  // Override with excursion test data if available
  if (input.excursion?.enabled) {
    const durationMinutes = (sec: number | null | undefined) =>
      sec === null || sec === undefined ? null : Math.floor(sec / 60);
    const warmupMinutes = durationMinutes(input.excursion.t1DurationSec);
    const doorOpeningMinutes = durationMinutes(input.excursion.t2DurationSec);
    const thermalRetentionMinutes = durationMinutes(input.excursion.t3DurationSec);
    const warmupText = formatDurationSec(input.excursion.t1DurationSec);
    const doorOpeningText = formatDurationSec(input.excursion.t2DurationSec);
    const thermalRetentionText = formatDurationSec(input.excursion.t3DurationSec);
    
    metrics = {
      warmupTimeMinutes: warmupMinutes,
      doorOpeningTimeMinutes: doorOpeningMinutes,
      thermalRetentionMinutes: thermalRetentionMinutes,
      warmupDescription:
        warmupMinutes !== null
          ? (getReportEquipmentType(input) === "warehouse" ? "\u041f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f" : reeferSubject(getReportEquipmentType(input))) + " \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u0442\u0440\u0435\u0431\u0443\u0435\u043c\u044b\u0439 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0437\u0430 " + warmupText + "."
          : "Время входа в режим не определено.",
      doorOpeningDescription:
        doorOpeningMinutes !== null
          ? `Дверь можно открывать на время до ${doorOpeningText} без нарушения температурного режима.`
          : "Время открытия двери не определено.",
      thermalRetentionDescription:
        thermalRetentionMinutes !== null
          ? "\u041f\u0440\u0438 \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0438 \u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0433\u043e \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 " + (getReportEquipmentType(input) === "warehouse" ? "\u043e\u0431\u044a\u0435\u043a\u0442" : reeferArea(getReportEquipmentType(input))) + " \u0441\u043f\u043e\u0441\u043e\u0431\u0435\u043d \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u044c \u0442\u0440\u0435\u0431\u0443\u0435\u043c\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0432 \u0442\u0435\u0447\u0435\u043d\u0438\u0435 " + thermalRetentionText + "."
          : "Время сохранения режима не определено.",
    };
  }

  // Add operational parameters section.
  // Only когда аварийные (excursion) испытания действительно проводились — иначе
  // эти значения вычисляются из логгеров картирования и недостоверны (напр. «0 минут»).
  if (allPass && input.excursion?.enabled) {
    doc.moveDown(0.3);
    doc.font("body").fontSize(10).fillColor(MUTED);
    doc.text("Параметры эксплуатации:", { underline: true });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#1e293b");
    
    // Combine all parameters into a single continuous text
    const paramTexts: string[] = [];
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
      const left = PAGE_MARGIN;
      const right = doc.page.width - PAGE_MARGIN;
      const width = right - left;
      doc.text(combinedText, left, doc.y, { width: width, align: "justify" });
    }
    // Add 1.5cm vertical spacing after operational parameters
    doc.moveDown(1.5);
  }

  let bg = "#f1f5f9";
  let bd = BORDER;
  let fg = ACCENT;
  let text = "Валидация не завершена. Не все этапы пройдены успешно.";
  if (allPass) {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    const excNote = input.excursion?.enabled
      ? ` Испытания на температурное отклонение проведены и зафиксированы в разделе 10 настоящего отчёта.`
      : "";
    const suitabilityWord = getReportEquipmentType(input) === "chamber" ? "пригодной" : "пригодным";
    text =
      "\u041d\u0430 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u0438 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u043e\u0432 IQ, OQ \u0438 PV \u043a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u043f\u0440\u0438\u0437\u043d\u0430\u0451\u0442 " + (getReportEquipmentType(input) === "warehouse" ? "\u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0435 (\u0437\u043e\u043d\u0443) \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f" : reeferConclusionObject(input)) + " " +
      `${suitabilityWord} для хранения лекарственных средств ` +
      `в температурном режиме ${TEMP_MODE_LABEL[input.pv.tempMode || ""] || "—"} в соответствии с требованиями GDP / GPP. ` +
      (getReportEquipmentType(input) === "warehouse"
        ? `Система кондиционирования/отопления обеспечивает стабильное распределение температуры по всему объёму помещения. ` 
        : "") +
      `Валидация завершена с положительным заключением.${excNote}`;
  } else if (anyFail) {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    text =
      "Валидация завершена с отрицательным заключением. Оборудование не может быть допущено к эксплуатации " +
      "до устранения зафиксированных несоответствий и проведения повторных испытаний.";
  }

  const padding = 14;
  doc.font("body").fontSize(11);
  const h = Math.max(70, doc.heightOfString(text, { width: w - padding * 2 }) + padding * 2);
  ensureSpace(doc, h);
  const y = doc.y;
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(11).text(text, left + padding, y + padding, {
    width: w - padding * 2,
    align: "justify",
  });
  doc.y = y + h;
}

function excursionVerdictLabel(exc: NonNullable<ReportInput["excursion"]>): string {
  const tests = [
    exc.test1Enabled ? exc.t1TStableAt !== null : null,
    exc.test2Enabled ? true : null, // Test 2 pass = noBreak or break recorded
    exc.test3Enabled ? true : null, // Test 3 pass = noBreak or break recorded
  ].filter(v => v !== null);
  if (tests.length === 0) return "Не проводились";
  // If all enabled tests have results, consider it completed
  const t1Done = !exc.test1Enabled || exc.t1TStableAt !== null;
  const t2Done = !exc.test2Enabled || exc.t2DoorOpenAt !== null;
  const t3Done = !exc.test3Enabled || exc.t3PowerOffAt !== null;
  if (t1Done && t2Done && t3Done) return "Завершены";
  return "Частично завершены";
}

function verdictLabel(v: "pass" | "fail" | "none"): string {
  if (v === "pass") return "Пройден";
  if (v === "fail") return "Не пройден";
  return "Не завершён";
}

/* -------------------------------------------------------------------------- */
/* Signatories                                                                 */
/* -------------------------------------------------------------------------- */

function defaultSignatories(prefix: "part1" | "part2"): Signatory[] {
  const suffix = prefix === "part1" ? "протокола" : "отчёта";
  return [
    { role: `Составитель ${suffix}`, name: "Инженер по валидации", position: "composer" },
    { role: `Проверяющий ${suffix}`, name: "Руководитель отдела качества", position: "reviewer" },
    { role: `Утверждающий ${suffix}`, name: "Генеральный директор", position: "approver" },
  ];
}

function membersToSignatories(
  members: Array<{ name: string; role: string }> | null | undefined,
  prefix: "part1" | "part2",
): Signatory[] {
  if (!members || members.length === 0) return defaultSignatories(prefix);
  // Если комиссия задана явно — используем её для обеих частей (один состав).
  return members.map(m => ({ role: m.role, name: m.name }));
}

function getSignatoriesPart1(input: ReportInput): Signatory[] {
  if (input.signatoriesPart1 && input.signatoriesPart1.length > 0) return input.signatoriesPart1;
  return membersToSignatories(input.generalInfo?.commissionMembers, "part1");
}

function getSignatoriesPart2(input: ReportInput): Signatory[] {
  if (input.signatoriesPart2 && input.signatoriesPart2.length > 0) return input.signatoriesPart2;
  return membersToSignatories(input.generalInfo?.commissionMembers, "part2");
}

function drawSignaturesBlock(
  doc: PDFKit.PDFDocument,
  signatories: Signatory[],
  intro: string,
) {
  doc.fillColor("#1f2937").font("body").fontSize(10).text(intro, { align: "left" });
  doc.moveDown(1);
  const BLOCK_H = 120;
  signatories.forEach(m => {
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
    doc
      .strokeColor(BORDER)
      .lineWidth(0.6)
      .moveTo(right - 220, y + 45)
      .lineTo(right, y + 45)
      .stroke();
    doc.fillColor(MUTED).font("body").fontSize(9).text("Подпись", right - 220, y + 48);
    doc
      .strokeColor(BORDER)
      .lineWidth(0.6)
      .moveTo(left, y + 65)
      .lineTo(left + 160, y + 65)
      .stroke();
    doc.fillColor(MUTED).fontSize(9).text("Дата", left, y + 68);
    doc.y = y + BLOCK_H;
  });
}

/* -------------------------------------------------------------------------- */
/* Part I plan helpers                                                         */
/* -------------------------------------------------------------------------- */

function drawChecklistPlan(doc: PDFKit.PDFDocument, items: ChecklistItem[]) {
  drawSubTitle(doc, "Перечень контрольных вопросов");
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const numW = 30;
  const qW = right - left - numW;

  ensureSpace(doc, 26);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, right - left, 22).fill(ACCENT);
  doc.restore();
  doc.fillColor("white").font("bold").fontSize(10);
  doc.text("№", left + 6, y + 6, { width: numW - 6 });
  doc.text("Контрольный вопрос", left + numW + 6, y + 6, { width: qW - 12 });
  doc.y = y + 22;

  items.forEach((it, idx) => {
    const padding = 6;
    doc.font("body").fontSize(10);
    const qH = doc.heightOfString(it.questionText, { width: qW - 12 });
    const rowH = Math.max(22, qH + padding * 2);
    ensureSpace(doc, rowH);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, right - left, rowH).fill();
      doc.restore();
    }
    doc.save();
    doc
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .moveTo(left, ry + rowH)
      .lineTo(right, ry + rowH)
      .stroke();
    doc.restore();
    doc
      .fillColor(ACCENT)
      .font("body")
      .fontSize(10)
      .text(String(idx + 1), left + 6, ry + padding, { width: numW - 6 });
    doc
      .fillColor("#1f2937")
      .font("body")
      .fontSize(10)
      .text(it.questionText, left + numW + 6, ry + padding, { width: qW - 12 });
    doc.y = ry + rowH;
  });
  doc.moveDown(0.4);
}

function drawPVPlan(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const durationRequirement = getReportEquipmentType(input) === "warehouse"
    ? `от 3 суток и далее (не менее 72 ч); выбрано ${pv.minDurationHours} ч`
    : `не менее ${pv.minDurationHours} ч`;
  const rows: Array<[string, string]> = [
    ["Температурный режим", TEMP_MODE_LABEL[pv.tempMode] || pv.tempMode],
    ...sensorAccuracyRows(pv),
    ["Требуемая длительность испытания", durationRequirement],
    ["Минимальное число внутренних датчиков", String(pv.minSensorCount)],
    [
      "Места установки датчиков",
      pv.sensorPlacement
        || (getReportEquipmentType(input) === "warehouse"
          ? "Регистраторы данных следует располагать в форме сетки и таким образом, чтобы они покрывать зону хранения по всей ее длине и ширине, а также высоте. Регистраторы данных размещаются по возможности с равными интервалами. Внешний датчик — для контроля температуры вне помещения."
          : "\u0414\u0430\u0442\u0447\u0438\u043a\u0438 \u0440\u0430\u0441\u043f\u043e\u043b\u0430\u0433\u0430\u044e\u0442\u0441\u044f \u0432 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u043d\u044b\u0445 \u0442\u043e\u0447\u043a\u0430\u0445 \u043e\u0431\u044a\u0451\u043c\u0430 " + reeferAreaGenitive(getReportEquipmentType(input)) + ": \u043f\u043e \u0441\u0442\u0435\u043d\u0430\u043c \u0438 \u043f\u043e \u0446\u0435\u043d\u0442\u0440\u0443 \u043e\u0431\u044a\u0435\u043a\u0442\u0430. \u0412\u043d\u0435\u0448\u043d\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043a \u2014 \u0434\u043b\u044f \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u044b \u0432 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u0435."),
    ],
  ];
  drawKVTable(doc, rows);
}

/* -------------------------------------------------------------------------- */
/* Part II report-only sections                                                */
/* -------------------------------------------------------------------------- */

function drawTestPeriod(doc: PDFKit.PDFDocument, input: ReportInput) {
  const pv = input.pv;
  const durationMs = pv.startAt && pv.endAt ? pv.endAt - pv.startAt : 0;
  const rows: Array<[string, string]> = [
    ["Начало испытаний (PV)", pv.startAt ? fmtDate(pv.startAt) : "—"],
    ["Окончание испытаний (PV)", pv.endAt ? fmtDate(pv.endAt) : "—"],
    ["Фактическая длительность", durationMs ? fmtDuration(durationMs) : "—"],
  ];
  drawKVTable(doc, rows);
}

function drawPlanDeviationsSection(doc: PDFKit.PDFDocument, input: ReportInput) {
  const text = (input.planDeviations && input.planDeviations.trim())
    || "Отклонений от плана протокола не зафиксировано. Испытания проведены в полном соответствии с утверждённым планом Протокола (Часть I).";
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text, { align: "justify" });
  doc.moveDown(0.6);
}

function drawRecommendationsSection(doc: PDFKit.PDFDocument, input: ReportInput) {
  const all = [input.iq.verdict, input.oq.verdict, input.pv.verdict];
  const anyFail = all.some(v => v === "fail");
  let text = (input.recommendations && input.recommendations.trim()) || "";
  if (!text) {
    text = anyFail
      ? "Рекомендуется устранить выявленные несоответствия, выполнить корректирующие действия и провести повторную квалификацию по этапам, завершившимся с отрицательным заключением. До получения положительных результатов эксплуатация оборудования для хранения лекарственных средств не допускается."
      : "Рекомендуется проводить периодическую повторную квалификацию в соответствии с внутренними процедурами организации, а также при изменении условий эксплуатации, ремонте или перемещении оборудования.";
  }
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text, { align: "justify" });
  doc.moveDown(0.6);
}

function declenseYears(num: number): string {
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;
  // Genitive case (родительный падеж): "в течение N лет/года/лет"
  // 11-19 → "лет" (11 лет, 12 лет, ...)
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return "лет";
  // 1, 21, 31, ... → "года"
  if (lastDigit === 1) return "года";
  // 2, 3, 4, 22, 23, 24, ... → "года"
  if (lastDigit >= 2 && lastDigit <= 4) return "года";
  // 5-20, 25-30, ... → "лет"
  return "лет";
}

function drawValiditySection(doc: PDFKit.PDFDocument, input: ReportInput) {
  ensureSpace(doc, 60);
  let period = (input.documentValidityPeriod && input.documentValidityPeriod.trim())
    ? input.documentValidityPeriod.trim()
    : "1 года"; // genitive: "в течение 1 года"
  
  // If period is just a number, add proper declension
  const numMatch = period.match(/^(\d+)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    period = `${num} ${declenseYears(num)}`;
  }
  // Normalize stored values like "1 год", "2 года", "5 лет" to correct genitive form
  const storedNumMatch = period.match(/^(\d+)\s+(?:год|года|лет)$/);
  if (storedNumMatch) {
    const num = parseInt(storedNumMatch[1], 10);
    period = `${num} ${declenseYears(num)}`;
  }
  
  const text =
    `Настоящий документ действителен в течение ${period} с момента подписания. ` +
    `По истечении срока действия требуется проведение повторной периодической квалификации в соответствии с внутренними ` +
    `процедурами организации.`;
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text, { align: "justify" });
  doc.moveDown(0.6);
}

// HEADER_CONTENT_TOP: first safe y for content after the header line (38pt from top) + gap
const HEADER_CONTENT_TOP = 60;

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + needed > bottom) {
    doc.addPage();
    // PDFKit sets doc.y = PAGE_MARGIN (56pt) after addPage, but the header line
    // is at 38pt from top. Push content below the header zone.
    doc.y = HEADER_CONTENT_TOP;
  }
}


/* -------------------------------------------------------------------------- */
/* Measurement Data Table                                                     */
/* -------------------------------------------------------------------------- */
function drawMeasurementTable(doc: PDFKit.PDFDocument, loggers: LoggerSummary[], samplingStepMinutes?: number | null) {
  if (!loggers || loggers.length === 0) return;

  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;

  // Build unified timeline: merge all timestamps from all loggers, sort & deduplicate
  const tsSet = new Set<number>();
  for (const l of loggers) {
    for (const t of l.series.ts) tsSet.add(t);
  }
  let allTs = Array.from(tsSet).sort((a, b) => a - b);
  
  // Filter to show only grid points that are on the sampling step boundary
  // Use the samplingStepMinutes from the PV session to determine the grid
  const stepMinutes = samplingStepMinutes && samplingStepMinutes > 0 ? samplingStepMinutes : 10;
  const stepMs = stepMinutes * 60_000;
  
  if (allTs.length > 0) {
    // Keep only timestamps that are on the grid boundary
    const firstTs = allTs[0];
    const gridPoints = new Set<number>();
    gridPoints.add(firstTs);
    
    for (let i = 1; i < allTs.length; i++) {
      const offset = allTs[i] - firstTs;
      const remainder = offset % stepMs;
      // Include if on grid boundary (remainder close to 0 or close to stepMs)
      // Use 500ms tolerance for floating point rounding
      if (remainder < 500 || remainder > stepMs - 500) {
        gridPoints.add(allTs[i]);
      }
    }
    
    allTs = Array.from(gridPoints).sort((a, b) => a - b);
  }

  if (allTs.length === 0) {
    doc.font("body").fontSize(9).fillColor(MUTED).text("Нет данных измерений.");
    return;
  }

  // For each logger build a ts→temp lookup map
  const maps: Map<number, number>[] = loggers.map(l => {
    const m = new Map<number, number>();
    l.series.ts.forEach((t, i) => m.set(t, l.series.temp[i]));
    return m;
  });

  // Helper: linear interpolation for missing values with forward fill
  function getInterpolatedValue(loggerIdx: number, ts: number): number | undefined {
    const m = maps[loggerIdx];
    const v = m.get(ts);
    if (v !== undefined) return v;

    // Find nearest timestamps before and after
    const logger = loggers[loggerIdx];
    let before: { ts: number; temp: number } | null = null;
    let after: { ts: number; temp: number } | null = null;

    for (let i = 0; i < logger.series.ts.length; i++) {
      const t = logger.series.ts[i];
      const temp = logger.series.temp[i];
      if (t <= ts) {
        before = { ts: t, temp };
      } else if (t > ts && !after) {
        after = { ts: t, temp };
        break;
      }
    }

    // Linear interpolation if both before and after exist
    if (before && after) {
      const ratio = (ts - before.ts) / (after.ts - before.ts);
      return before.temp + (after.temp - before.temp) * ratio;
    }

    // Use forward fill (last known value) if only before exists
    if (before) return before.temp;
    // Use next value (backward fill) if only after exists
    if (after) return after.temp;
    return undefined;
  }

  const ROW_H = 18;
  const HEADER_H = 26;
  const MAX_SENSORS_PER_BLOCK = 12;

  // Limit to 2000 rows to avoid huge PDFs; if more, sample evenly
  const MAX_ROWS = 2000;
  let rows = allTs;
  if (rows.length > MAX_ROWS) {
    const step = rows.length / MAX_ROWS;
    rows = Array.from({ length: MAX_ROWS }, (_, i) => rows[Math.round(i * step)]);
  }

  const loggerGroups = Array.from(
    { length: Math.ceil(loggers.length / MAX_SENSORS_PER_BLOCK) },
    (_, groupIdx) => {
      const startIdx = groupIdx * MAX_SENSORS_PER_BLOCK;
      return loggers
        .slice(startIdx, startIdx + MAX_SENSORS_PER_BLOCK)
        .map((logger, offset) => ({ logger, loggerIdx: startIdx + offset }));
    },
  );

  loggerGroups.forEach((group, groupIdx) => {
    if (groupIdx > 0) {
      doc.addPage();
      doc.y = HEADER_CONTENT_TOP;
    }

    const tsColW = 0.2;
    const sensorColW = (1 - tsColW) / group.length;
    const cols: Array<{ label: string; w: number }> = [
      { label: "Дата / Время", w: tsColW },
      ...group.map(({ logger }) => ({
        label: shortLabel(logger.label, logger.customName),
        w: sensorColW,
      })),
    ];
    const firstSensorNo = groupIdx * MAX_SENSORS_PER_BLOCK + 1;
    const lastSensorNo = firstSensorNo + group.length - 1;
    const blockLabel = `Датчики ${firstSensorNo}–${lastSensorNo} из ${loggers.length}`;

    const drawBlockHeading = () => {
      ensureSpace(doc, (loggerGroups.length > 1 ? 20 : 0) + HEADER_H + ROW_H);
      if (loggerGroups.length > 1) {
        doc.font("bold").fontSize(8).fillColor(MUTED).text(blockLabel, left, doc.y, {
          width: w,
          align: "right",
        });
        doc.moveDown(0.15);
      }
    };

    const drawHeader = () => {
      ensureSpace(doc, HEADER_H + ROW_H);
      const y = doc.y;
      doc.save();
      doc.rect(left, y, w, HEADER_H).fillColor(ACCENT).fill();
      doc.restore();
      let cx = left;
      doc.fillColor("white").font("bold").fontSize(6.5);
      cols.forEach(c => {
        const cw = c.w * w;
        doc.text(c.label, cx + 3, y + 5, { width: cw - 6, lineBreak: true });
        cx += cw;
      });
      doc.y = y + HEADER_H;
    };

    drawBlockHeading();
    drawHeader();

    let rowIdx = 0;
    for (const ts of rows) {
      const bottom = doc.page.height - PAGE_MARGIN;
      if (doc.y + ROW_H > bottom) {
        doc.addPage();
        doc.y = HEADER_CONTENT_TOP;
        drawBlockHeading();
        drawHeader();
      }

      const ry = doc.y;
      if (rowIdx % 2 === 0) {
        doc.save();
        doc.fillColor(SOFT_BG).rect(left, ry, w, ROW_H).fill();
        doc.restore();
      }

      const cells: string[] = [
        fmtDate(ts),
        ...group.map(({ loggerIdx }) => {
          const v = getInterpolatedValue(loggerIdx, ts);
          if (v === undefined) return "—";
          return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
        }),
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
    }

    doc.moveDown(0.5);
  });

  if (allTs.length > MAX_ROWS) {
    doc.font("body").fontSize(7.6).fillColor(MUTED)
      .text(`Показано ${MAX_ROWS} из ${allTs.length} строк (равномерная выборка).`, { align: "right" });
  }
}

/* -------------------------------------------------------------------------- */
/* Temperature Excursion Study Section                                        */
/* -------------------------------------------------------------------------- */
function drawExcursionSection(
  doc: PDFKit.PDFDocument,
  excursion: NonNullable<ReportInput["excursion"]>,
  rangeMin: number,
  rangeMax: number,
  sensorAccuracy?: number,
) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;

  const TIMING_LABELS: Record<string, string> = {
    before_pv: "До этапа PV",
    after_pv: "После этапа PV",
    independent: "Независимо",
  };

  drawSectionTitle(doc, "10. Испытания на температурное отклонение (Temperature Excursion Study)");

  // General parameters table — only show enabled tests
  const enabledTests: string[] = [];
  if (excursion.test1Enabled) enabledTests.push("Включение оборудования (выход на режим)");
  if (excursion.test2Enabled) enabledTests.push("Открытие двери (время до нарушения режима)");
  if (excursion.test3Enabled) enabledTests.push("Отключение питания (время до нарушения режима)");
  const paramRows: Array<[string, string]> = [
    ["Окно записи", `${excursion.recordStartAt ? fmtDate(excursion.recordStartAt) : "—"} – ${excursion.recordEndAt ? fmtDate(excursion.recordEndAt) : "—"}`],
    ["Срок проведения относительно PV", TIMING_LABELS[excursion.timingVsPv || ""] || excursion.timingVsPv || "—"],
    ["Проводимые тесты", enabledTests.join(", ") || "—"],
    ...(sensorAccuracy !== undefined && sensorAccuracy !== null
      ? [
          ["Погрешность датчиков, учитываемая в расчётах", `±${sensorAccuracy.toFixed(1)} °C`] as [string, string],
          ["Расчётный диапазон аварийных испытаний", fmtTempRange(rangeMin, rangeMax)] as [string, string],
        ]
      : []),
  ];
  drawKVTable(doc, paramRows);

  // ── TEST 1: Startup / Power-on ──────────────────────────────────────────────
  if (excursion.test1Enabled) {
    ensureSpace(doc, 80);
    doc.moveDown(0.5);
    drawSubTitle(doc, "Тест — Включение оборудования (выход на режим)");
    const t1Rows: Array<[string, string]> = [
      ["Момент включения (Т_on)", excursion.t1PowerOnAt ? fmtDate(excursion.t1PowerOnAt) : "—"],
      ["Момент стабилизации (Т_stable)", excursion.t1TStableAt ? fmtDate(excursion.t1TStableAt) : "—"],
      ["Длительность выхода на режим", excursion.t1DurationSec !== null ? formatDurationSec(excursion.t1DurationSec) : "—"],
      ["Критический датчик (последним вошёдший в диапазон)", excursion.t1CriticalSensor || "—"],
    ];
    drawKVTable(doc, t1Rows);

    // Sensor entry table
    if (excursion.t1SensorEntries && excursion.t1SensorEntries.length > 0) {
      ensureSpace(doc, 50);
      doc.moveDown(0.3);
      doc.fillColor(MUTED).font("body").fontSize(9).text("Вхождение датчиков в целевой диапазон:");
      doc.moveDown(0.2);
      const eCols = [
        { label: "Датчик", w: 0.3 },
        { label: "Т при вкл., °C", w: 0.2 },
        { label: "Вхождение в диапазон", w: 0.3 },
        { label: "Длительность", w: 0.2 },
      ];
      ensureSpace(doc, 26);
      let ey = doc.y;
      doc.save();
      doc.rect(left, ey, w, 22).fillColor(ACCENT).fill();
      doc.restore();
      let ecx = left;
      doc.fillColor("white").font("bold").fontSize(9);
      eCols.forEach(c => {
        doc.text(c.label, ecx + 4, ey + 6, { width: c.w * w - 8 });
        ecx += c.w * w;
      });
      doc.y = ey + 22;
      excursion.t1SensorEntries.forEach((e, idx) => {
        ensureSpace(doc, 22);
        const ry = doc.y;
        if (idx % 2 === 0) {
          doc.save();
          doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
          doc.restore();
        }
        const cells = [
          e.label,
          e.tempAtOn.toFixed(2),
          e.entryAt ? fmtDate(e.entryAt) : "Не вошёл",
          e.durationSec !== null ? formatDurationSec(e.durationSec) : "—",
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

    // Verdict box for Test 1
    drawExcursionTestVerdict(
      doc,
      excursion.t1TStableAt !== null,
      excursion.t1TStableAt !== null
        ? `Тест пройден успешно. Оборудование вышло на целевой температурный режим за ${formatDurationSec(excursion.t1DurationSec)} после включения. Критический датчик (последним вошедший в диапазон): ${excursion.t1CriticalSensor || "—"}.`
        : `Тест не завершён: не все датчики вошли в целевой диапазон за период записи.`,
    );
  }

  // ── TEST 2: Open door ───────────────────────────────────────────────────────
  if (excursion.test2Enabled) {
    ensureSpace(doc, 80);
    doc.moveDown(0.5);
    drawSubTitle(doc, "Тест — Открытие двери (время до нарушения режима)");
    const t2Rows: Array<[string, string]> = [
      ["Открытие двери", excursion.t2DoorOpenAt ? fmtDate(excursion.t2DoorOpenAt) : "—"],
      ["Закрытие двери", excursion.t2DoorCloseAt ? fmtDate(excursion.t2DoorCloseAt) : "—"],
      ["Момент нарушения режима (первый датчик)", excursion.t2NoBreak ? "Не зафиксировано" : (excursion.t2TBreakAt ? fmtDate(excursion.t2TBreakAt) : "—")],
      ["Время до нарушения режима (первый датчик)", excursion.t2NoBreak ? "Режим сохранён" : (excursion.t2DurationSec !== null ? formatDurationSec(excursion.t2DurationSec) : "—")],
      ["Критический датчик (первым вышедший из диапазона)", excursion.t2NoBreak ? "—" : (excursion.t2CriticalSensor || "—")],
    ];
    drawKVTable(doc, t2Rows);

    // Sensor break table for Test 2
    if (!excursion.t2NoBreak && excursion.t2SensorBreaks && excursion.t2SensorBreaks.length > 0) {
      ensureSpace(doc, 50);
      doc.moveDown(0.3);
      doc.fillColor(MUTED).font("body").fontSize(9).text("Выход датчиков за пределы диапазона (по каждому датчику):");
      doc.moveDown(0.2);
      const bCols2 = [
        { label: "Датчик", w: 0.3 },
        { label: "Момент выхода", w: 0.4 },
        { label: "Время до выхода", w: 0.3 },
      ];
      ensureSpace(doc, 26);
      let by2 = doc.y;
      doc.save();
      doc.rect(left, by2, w, 22).fillColor(ACCENT).fill();
      doc.restore();
      let bcx2 = left;
      doc.fillColor("white").font("bold").fontSize(9);
      bCols2.forEach(c => {
        doc.text(c.label, bcx2 + 4, by2 + 6, { width: c.w * w - 8 });
        bcx2 += c.w * w;
      });
      doc.y = by2 + 22;
      excursion.t2SensorBreaks.forEach((sb, idx) => {
        ensureSpace(doc, 22);
        const ry = doc.y;
        if (idx % 2 === 0) {
          doc.save();
          doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
          doc.restore();
        }
        const cells2 = [
          sb.label,
          sb.tBreakAt ? fmtDate(sb.tBreakAt) : "Не вышел",
          sb.durationSec !== null ? formatDurationSec(sb.durationSec) : "—",
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

    // Verdict box for Test 2
    const t2Message = excursion.t2NoBreak
      ? (() => {
          const doorDurationSec = (excursion.t2DoorCloseAt ?? 0) - (excursion.t2DoorOpenAt ?? 0);
          const doorDurationMin = Math.round(doorDurationSec / 1000 / 60);
          return `Тест завершён: температурный режим сохранён в течение всего периода открытой двери (${doorDurationMin} мин).`;
        })()
      : `Тест завершён: первый датчик вышел за пределы диапазона через ${formatDurationSec(excursion.t2DurationSec)} после открытия двери. Критический датчик: ${excursion.t2CriticalSensor || "—"}.`;
    drawExcursionTestVerdict(
      doc,
      true, // Test 2 always has a result (either break or no-break)
      t2Message,
    );
  }

  // ── TEST 3: Power-off ───────────────────────────────────────────────────────
  if (excursion.test3Enabled) {
    ensureSpace(doc, 80);
    doc.moveDown(0.5);
    drawSubTitle(doc, "Тест — Отключение питания (время до нарушения режима)");
    const t3Rows: Array<[string, string]> = [
      ["Отключение питания", excursion.t3PowerOffAt ? fmtDate(excursion.t3PowerOffAt) : "—"],
      ["Момент нарушения режима (первый датчик)", excursion.t3NoBreak ? "Не зафиксировано" : (excursion.t3TBreakAt ? fmtDate(excursion.t3TBreakAt) : "—")],
      ["Время до нарушения режима (первый датчик)", excursion.t3NoBreak ? "Режим сохранён" : (excursion.t3DurationSec !== null ? formatDurationSec(excursion.t3DurationSec) : "—")],
      ["Критический датчик (первым вышедший за пределы)", excursion.t3NoBreak ? "—" : (excursion.t3CriticalSensor || "—")],
    ];
    drawKVTable(doc, t3Rows);

    // Sensor break table for Test 3
    if (!excursion.t3NoBreak && excursion.t3SensorBreaks && excursion.t3SensorBreaks.length > 0) {
      ensureSpace(doc, 50);
      doc.moveDown(0.3);
      doc.fillColor(MUTED).font("body").fontSize(9).text("Выход датчиков за пределы диапазона (по каждому датчику):");
      doc.moveDown(0.2);
      const bCols3 = [
        { label: "Датчик", w: 0.3 },
        { label: "Момент выхода", w: 0.4 },
        { label: "Время до выхода", w: 0.3 },
      ];
      ensureSpace(doc, 26);
      let by3 = doc.y;
      doc.save();
      doc.rect(left, by3, w, 22).fillColor(ACCENT).fill();
      doc.restore();
      let bcx3h = left;
      doc.fillColor("white").font("bold").fontSize(9);
      bCols3.forEach(c => {
        doc.text(c.label, bcx3h + 4, by3 + 6, { width: c.w * w - 8 });
        bcx3h += c.w * w;
      });
      doc.y = by3 + 22;
      excursion.t3SensorBreaks.forEach((sb, idx) => {
        ensureSpace(doc, 22);
        const ry = doc.y;
        if (idx % 2 === 0) {
          doc.save();
          doc.fillColor(SOFT_BG).rect(left, ry, w, 22).fill();
          doc.restore();
        }
        const cells3 = [
          sb.label,
          sb.tBreakAt ? fmtDate(sb.tBreakAt) : "Не вышел",
          sb.durationSec !== null ? formatDurationSec(sb.durationSec) : "—",
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

    // Verdict box for Test 3
    const t3Message = excursion.t3NoBreak
      ? (() => {
          const endTs = excursion.t3TestEndAt ?? excursion.recordEndAt;
          if (excursion.t3PowerOffAt != null && endTs != null) {
            const observationDurationMin = Math.round((endTs - excursion.t3PowerOffAt) / 1000 / 60);
            return `Тест завершён: температурный режим сохранён после отключения питания (${observationDurationMin} мин).`;
          }
          return "Тест завершён: температурный режим сохранён после отключения питания до конца окна записи.";
        })()
      : `Тест завершён: первый датчик вышел за пределы диапазона через ${formatDurationSec(excursion.t3DurationSec)} после отключения питания. Критический датчик: ${excursion.t3CriticalSensor || "—"}.`;
    drawExcursionTestVerdict(
      doc,
      true,
      t3Message,
    );
  }

  // ── Combined chart ──────────────────────────────────────────────────────
  if (excursion.loggers.length > 0) {
    ensureSpace(doc, 60);
    doc.moveDown(0.5);
    drawSubTitle(doc, "График температуры");
    // Filter each logger's data to the recording window only
    const recStart = excursion.recordStartAt;
    const recEnd = excursion.recordEndAt;
    const chartSeries = excursion.loggers.map(l => {
      if (recStart === null && recEnd === null) {
        return { name: shortLabel(l.label), ts: l.series.ts, temp: l.series.temp };
      }
      const filteredTs: number[] = [];
      const filteredTemp: number[] = [];
      l.series.ts.forEach((t, i) => {
        if ((recStart === null || t >= recStart) && (recEnd === null || t <= recEnd)) {
          filteredTs.push(t);
          filteredTemp.push(l.series.temp[i]);
        }
      });
      return { name: shortLabel(l.label), ts: filteredTs, temp: filteredTemp };
    });
    const markers: EventMarker[] = [];
    if (excursion.test1Enabled && excursion.t1PowerOnAt) {
      markers.push({ ts: excursion.t1PowerOnAt, label: "Вкл.", color: "#16a34a" });
    }
    if (excursion.test1Enabled && excursion.t1TStableAt) {
      markers.push({ ts: excursion.t1TStableAt, label: "Стаб.", color: "#15803d" });
    }
    if (excursion.test2Enabled && excursion.t2DoorOpenAt) {
      markers.push({ ts: excursion.t2DoorOpenAt, label: "Дверь↗", color: "#d97706" });
    }
    if (excursion.test2Enabled && excursion.t2DoorCloseAt) {
      markers.push({ ts: excursion.t2DoorCloseAt, label: "Дверь↘", color: "#92400e" });
    }
    if (excursion.test3Enabled && excursion.t3PowerOffAt) {
      markers.push({ ts: excursion.t3PowerOffAt, label: "Откл.", color: "#dc2626" });
    }
    drawExcursionChart(doc, chartSeries, rangeMin, rangeMax, markers);
  }

  // ── Warnings ────────────────────────────────────────────────────────────
  // Only show warnings block if there are real (non-INFO) warnings
  const realWarnings = (excursion.warnings ?? []).filter(w => !w.startsWith('[INFO]'));
  if (realWarnings.length > 0) {
    ensureSpace(doc, 60);
    doc.moveDown(0.5);
    doc.fillColor(ACCENT).font("bold").fontSize(11).text("Предупреждения");
    doc.moveDown(0.3);
    const padding = 14;
    const warnText = realWarnings.map((warn, i) => `${i + 1}. ${warn}`).join("\n");
    doc.font("body").fontSize(10);
    const warnH = Math.max(50, doc.heightOfString(warnText, { width: w - padding * 2 }) + padding * 2);
    ensureSpace(doc, warnH);
    const wy = doc.y;
    doc.save();
    doc.lineWidth(0.7).fillColor("#fffbeb").strokeColor("#fcd34d").roundedRect(left, wy, w, warnH, 6).fillAndStroke();
    doc.restore();
    doc.fillColor("#92400e").font("body").fontSize(10).text(warnText, left + padding, wy + padding, { width: w - padding * 2 });
    doc.y = wy + warnH;
    doc.moveDown(0.6);
  }

  // ── Full time-series data table (matches PV measurement table style) ────────
  const allLoggers = excursion.loggers;
  if (allLoggers.length > 0) {
    const startMs = excursion.recordStartAt;
    const endMs = excursion.recordEndAt;

    // Floor each timestamp to the nearest minute to group sub-minute recordings
    const floorToMin = (ms: number) => Math.floor(ms / 60000) * 60000;

    // Build minute→temp lookup per logger: for each minute keep the last reading
    const minuteMaps: Map<number, number>[] = allLoggers.map(l => {
      const m = new Map<number, number>();
      l.series.ts.forEach((t, i) => {
        if ((startMs === null || t >= startMs) && (endMs === null || t <= endMs)) {
          m.set(floorToMin(t), l.series.temp[i]);
        }
      });
      return m;
    });

    // Collect all unique minute-timestamps within the recording window
    const minuteSet = new Set<number>();
    allLoggers.forEach(l => {
      l.series.ts.forEach(t => {
        if ((startMs === null || t >= startMs) && (endMs === null || t <= endMs)) {
          minuteSet.add(floorToMin(t));
        }
      });
    });
    const sortedMinutes = Array.from(minuteSet).sort((a, b) => a - b);

    if (sortedMinutes.length > 0) {
      ensureSpace(doc, 80);
      doc.moveDown(1.5);
      // Reset x to left margin so subtitle/period text spans the full page width
      doc.x = left;
      drawSubTitle(doc, "Табличные данные температуры");
      doc.x = left;
      doc.fillColor(MUTED).font("body").fontSize(9)
        .text(`Период: ${startMs ? fmtDate(startMs) : "—"} – ${endMs ? fmtDate(endMs) : "—"}  |  Точек: ${sortedMinutes.length}  |  Датчиков: ${allLoggers.length}`, { width: w });
      doc.moveDown(0.3);

      // All sensors in one table — same proportional layout as PV measurement table
      const tsColFrac = 0.18;
      const sensorColFrac = (1 - tsColFrac) / allLoggers.length;
      const exCols: Array<{ label: string; frac: number }> = [
        { label: "Дата / Время", frac: tsColFrac },
        ...allLoggers.map(l => ({ label: shortLabel(l.label), frac: sensorColFrac })),
      ];

      const ROW_H = 18;
      const HEADER_H = 26;

      const drawExHeader = () => {
        ensureSpace(doc, HEADER_H + ROW_H);
        const hy = doc.y;
        doc.save();
        doc.rect(left, hy, w, HEADER_H).fillColor(ACCENT).fill();
        doc.restore();
        let cx = left;
        doc.fillColor("white").font("bold").fontSize(6.5);
        exCols.forEach(c => {
          const cw = c.frac * w;
          doc.text(c.label, cx + 3, hy + 5, { width: cw - 6, lineBreak: true });
          cx += cw;
        });
        doc.y = hy + HEADER_H;
      };

      drawExHeader();

      // Helper function to interpolate temperature value at a specific timestamp
      const getExcursionInterpolatedValue = (loggerIdx: number, ts: number): number | undefined => {
        const logger = allLoggers[loggerIdx];
        const m = minuteMaps[loggerIdx];
        const v = m.get(ts);
        if (v !== undefined) return v;

        // Find nearest timestamps before and after
        let before: { ts: number; temp: number } | null = null;
        let after: { ts: number; temp: number } | null = null;

        for (let i = 0; i < logger.series.ts.length; i++) {
          const t = logger.series.ts[i];
          const temp = logger.series.temp[i];
          if ((startMs === null || t >= startMs) && (endMs === null || t <= endMs)) {
            if (t <= ts) {
              before = { ts: t, temp };
            } else if (t > ts && !after) {
              after = { ts: t, temp };
              break;
            }
          }
        }

        // Linear interpolation if both before and after exist
        if (before && after) {
          const ratio = (ts - before.ts) / (after.ts - before.ts);
          return before.temp + (after.temp - before.temp) * ratio;
        }

        // Use forward fill (last known value) if only before exists
        if (before) return before.temp;
        // Use next value (backward fill) if only after exists
        if (after) return after.temp;
        return undefined;
      }

      // Limit to 2000 rows to avoid huge PDFs
      const MAX_ROWS = 2000;
      let rows = sortedMinutes;
      if (rows.length > MAX_ROWS) {
        const step = rows.length / MAX_ROWS;
        rows = Array.from({ length: MAX_ROWS }, (_, i) => rows[Math.round(i * step)]);
      }

      let rowIdx = 0;

      for (const ts of rows) {
        // If not enough space for one more row, start a new page with a fresh header
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

        const cells: string[] = [
          fmtDate(ts),
          ...allLoggers.map((_, idx) => {
            const v = getExcursionInterpolatedValue(idx, ts);
            if (v === undefined) return "—";
            return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
          }),
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
        doc.font("body").fontSize(7.6).fillColor(MUTED)
          .text(`Показано ${MAX_ROWS} из ${sortedMinutes.length} строк (равномерная выборка).`, { align: "right" });
      }
    }
  }
}

function formatDurationSec(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "—";
  const totalMinutes = Math.floor(sec / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function drawExcursionTestVerdict(
  doc: PDFKit.PDFDocument,
  passed: boolean,
  text: string,
) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const padding = 12;
  doc.font("body").fontSize(10);
  const h = Math.max(44, doc.heightOfString(text, { width: w - padding * 2 }) + padding * 2);
  ensureSpace(doc, h + 8);
  doc.moveDown(0.3);
  const y = doc.y;
  const bg = passed ? "#ecfdf5" : "#fef2f2";
  const bd = passed ? "#a7f3d0" : "#fecaca";
  const fg = passed ? "#065f46" : "#991b1b";
  doc.save();
  doc.lineWidth(0.7).fillColor(bg).strokeColor(bd).roundedRect(left, y, w, h, 6).fillAndStroke();
  doc.restore();
  doc.fillColor(fg).font("body").fontSize(10).text(text, left + padding, y + padding, { width: w - padding * 2 });
  doc.y = y + h;
  doc.moveDown(0.5);
}

/**
 * Draw explanation text for a chart.
 */
function drawChartExplanation(doc: PDFKit.PDFDocument, text: string) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const padding = 10;

  ensureSpace(doc, 40);
  doc.moveDown(0.2);
  doc.font("body").fontSize(9).fillColor(MUTED);
  doc.text(text, left, doc.y, {
    width: w,
    align: "left",
    lineGap: 1.5,
  });
  doc.moveDown(0.3);
}

/* -------------------------------------------------------------------------- */
/* Calibration / Verification Page                                            */
/* -------------------------------------------------------------------------- */
function drawCalibrationPage(doc: PDFKit.PDFDocument) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const contentW = right - left;

  // Section title
  drawSectionTitle(doc, "16. Поверка средств измерений");

  const y0 = doc.y + 8;

  // Introductory paragraph
  doc
    .font("body")
    .fontSize(10)
    .fillColor(ACCENT)
    .text(
      "Средства измерений (датчики температуры), применённые при проведении квалификации, " +
      "прошли метрологическую поверку (калибровку) в аккредитованной лаборатории. " +
      "Сведения о текущей поверке и дате следующей поверки доступны по QR-коду, " +
      "размещённому ниже.",
      left,
      y0,
      { width: contentW, align: "justify" },
    );

  doc.moveDown(1.2);

  // QR code block
  const qrSize = 130;
  const qrX = doc.page.width / 2 - qrSize / 2;
  const qrY = doc.y;

  // Try to load QR image from server/assets (dev) or dist/assets (prod)
  const assetCandidates = [
    path.resolve(__dirname, "assets/qr_calibration.png"),
    path.join(process.cwd(), "dist", "assets", "qr_calibration.png"),
    path.join(process.cwd(), "server", "assets", "qr_calibration.png"),
  ];
  let qrLoaded = false;
  for (const p of assetCandidates) {
    if (fs.existsSync(p)) {
      try {
        doc.image(p, qrX, qrY, { width: qrSize, height: qrSize });
        qrLoaded = true;
        break;
      } catch (_) { /* skip */ }
    }
  }
  if (!qrLoaded) {
    // Fallback: draw a placeholder box
    doc
      .rect(qrX, qrY, qrSize, qrSize)
      .strokeColor(BORDER)
      .lineWidth(1)
      .stroke();
    doc
      .font("body")
      .fontSize(8)
      .fillColor(MUTED)
      .text("QR-код", qrX, qrY + qrSize / 2 - 5, { width: qrSize, align: "center" });
  }

  doc.moveDown(0.5);
  const afterQr = qrY + qrSize + 8;

  // Caption under QR
  doc
    .font("body")
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      "Отсканируйте QR-код для просмотра актуальных сведений о поверке датчиков",
      left,
      afterQr,
      { width: contentW, align: "center" },
    );

  doc.moveDown(2);

  // Certificate request notice box
  const boxY = doc.y;
  const boxH = 130;
  doc
    .roundedRect(left, boxY, contentW, boxH, 6)
    .fillColor("#F0F7FF")
    .fill();
  doc
    .roundedRect(left, boxY, contentW, boxH, 6)
    .strokeColor(ACCENT)
    .lineWidth(0.8)
    .stroke();

  const boxPad = 40;
  doc
    .font("bold")
    .fontSize(9)
    .fillColor(ACCENT)
    .text("Запрос сертификатов калибровки / поверки", left + boxPad, boxY + boxPad, {
      width: contentW - boxPad * 2,
    });
  doc.moveDown(0.4);
  doc
    .font("body")
    .fontSize(9)
    .fillColor(ACCENT)
    .text(
      "Для получения оригиналов сертификатов калибровки или поверки средств измерений " +
      "необходимо направить официальный запрос по телефону:",
      left + boxPad,
      doc.y,
      { width: contentW - boxPad * 2 },
    );
  doc.moveDown(0.3);
  doc
    .font("bold")
    .fontSize(10)
    .fillColor(ACCENT)
    .text("+7 (700) 935-15-15", left + boxPad, doc.y, {
      width: contentW - boxPad * 2,
      align: "center",
    });
  doc
    .font("body")
    .fontSize(8)
    .fillColor(MUTED)
    .text("ТОО «GxP Training» · www.gxp.kz · info@gxp.kz", left + boxPad, doc.y + 2, {
      width: contentW - boxPad * 2,
      align: "center",
    });
}


function fitTextToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
  if (!text || maxWidth <= 0) return "";
  if (doc.widthOfString(text) <= maxWidth) return text;

  const suffix = "...";
  const suffixWidth = doc.widthOfString(suffix);
  if (suffixWidth >= maxWidth) return suffix;

  let low = 0;
  let high = text.length;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid).trimEnd();
    if (doc.widthOfString(candidate) + suffixWidth <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return text.slice(0, best).trimEnd() + suffix;
}

function fitTextToLines(doc: PDFKit.PDFDocument, text: string, maxWidth: number, maxLines: number): string {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized || maxWidth <= 0 || maxLines <= 0) return "";

  const lineGap = 1;
  const lineHeight = typeof (doc as any).currentLineHeight === "function"
    ? (doc as any).currentLineHeight(true)
    : doc.heightOfString("Ag", { width: maxWidth });
  const maxHeight = lineHeight * maxLines + lineGap * Math.max(0, maxLines - 1) + 0.5;
  const fits = (candidate: string) => doc.heightOfString(candidate, { width: maxWidth, lineGap }) <= maxHeight;
  if (fits(normalized)) return normalized;

  const suffix = "...";
  let low = 0;
  let high = normalized.length;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = normalized.slice(0, mid).trimEnd() + suffix;
    if (fits(candidate)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return normalized.slice(0, best).trimEnd() + suffix;
}

function addHeadersAndFooters(doc: PDFKit.PDFDocument, input: ReportInput) {
  const range = doc.bufferedPageRange();
  const total = range.count;

  // Set font once to ensure _font is loaded with correct glyph map
  doc.switchToPage(range.start + total - 1);
  doc.font("body").fontSize(8);
  const protocolLabel = `Протокол ${input.protocol.number}`;

  /**
   * Encode text using PDFKit's internal glyph mapping so that Cyrillic
   * characters render correctly when written via page.write().
   * doc._font.encode(str)[0] returns an array of hex glyph-ID strings.
   */
  const encodeForPage = (text: string): string => {
    const glyphs: string[] = (doc as any)._font.encode(text)[0] as string[];
    return "<" + glyphs.join("") + ">";
  };

  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    // CRITICAL: call doc.font() AFTER switchToPage so _font glyph map is correct
    doc.font("body").fontSize(8);
    const page = doc.page as any;
    const left = PAGE_MARGIN;
    const right = doc.page.width - PAGE_MARGIN;
    const pageH = doc.page.height;

    // doc.font("body") above registers the font on this page and sets doc._font.
    // Use doc._font.id as the PDF resource name (e.g. "F2") — this is guaranteed
    // to match the glyph map used by encodeForPage().
    const fontName: string = (doc as any)._font.id;

    // Helper to write raw PDF text at absolute position without moving doc.y.
    // PDFKit applies a flip matrix (1 0 0 -1 0 pageH) to the content stream,
    // so we use Tm with (1 0 0 -1 x y) to render text upright at the correct position.
    // pdfY is distance from the BOTTOM of the page (PDF native coords).
    const writeText = (text: string, x: number, pdfY: number) => {
      if (!fontName) return;
      page.write("BT");
      page.write("/" + fontName + " 8 Tf");
      page.write("0.392 0.455 0.545 rg"); // MUTED color
      page.write("1 0 0 -1 " + x.toFixed(2) + " " + pdfY.toFixed(2) + " Tm");
      page.write(encodeForPage(text) + " Tj");
      page.write("ET");
    };

    // ─── COORDINATE SYSTEM NOTES ───────────────────────────────────────────
    // writeText uses Tm (1 0 0 -1 x y). PDFKit applies flip matrix (1 0 0 -1 0 pageH).
    // Combined: text renders at PDFKit position y from TOP of page.
    // So writeText(text, x, y) → text appears at y pts from TOP.
    // For header (top): y = 24  (24pt from top)
    // For footer (bottom): y = pageH - 24  (24pt from bottom)
    //
    // page.write() path operators use PDF NATIVE coords (y from BOTTOM).
    // Header line at 38pt from top → PDF native y = pageH - 38
    // Footer line at 36pt from bottom → PDF native y = 36
    // ────────────────────────────────────────────────────────────────────────

    if (i > 0) {
      // Header line at 38pt from top → PDF native y = pageH - 38
      const headerLineY = pageH - 38;
      page.write("q");
      page.write("0.886 0.910 0.941 RG");
      page.write("0.4 w");
      page.write(left.toFixed(2) + " " + headerLineY.toFixed(2) + " m");
      page.write(right.toFixed(2) + " " + headerLineY.toFixed(2) + " l");
      page.write("S");
      page.write("Q");
      // Header text at 24pt from TOP -> writeText y = 24.
      // Keep a fixed gap between the long organization name and the protocol number.
      const protoW = doc.widthOfString(protocolLabel);
      const headerGap = 18;
      const orgHeaderW = Math.max(120, right - left - protoW - headerGap);
      writeText(fitTextToWidth(doc, input.org.name, orgHeaderW), left, 24);
      writeText(protocolLabel, right - protoW, 24);
    }

    // Footer line at 36pt from BOTTOM → PDF native y = 36
    page.write("q");
    page.write("0.886 0.910 0.941 RG");
    page.write("0.4 w");
    page.write(left.toFixed(2) + " 36 m");
    page.write(right.toFixed(2) + " 36 l");
    page.write("S");
    page.write("Q");

    // Footer text at 24pt from BOTTOM → writeText y = pageH - 24
    const pageLabel = `Стр. ${i + 1} из ${total}`;
    const pageLabelW = doc.widthOfString(pageLabel);
    const centerX = left + (right - left) / 2 - pageLabelW / 2;
    writeText(pageLabel, centerX, pageH - 24);
  }
}


/* -------------------------------------------------------------------------- */
/* Warehouse / storage zone (EAEU Рек. №8) — plan diagram + annexes           */
/* -------------------------------------------------------------------------- */

/** Draw a top-view plan with EAEU recommended logger grid for warehouse */
function drawWarehousePlanDiagram(
  doc: PDFKit.PDFDocument,
  input: ReportInput,
  template: boolean,
  title: string,
) {
  const gi = input.generalInfo;
  // Prefer pvSession room dims (saved by FloorPlanEditor), fall back to generalInfo
  const lengthM = input.pvRoomLengthM ?? (gi?.whLengthM ? Number(gi.whLengthM) : 0);
  const widthM  = input.pvRoomWidthM  ?? (gi?.whWidthM  ? Number(gi.whWidthM)  : 0);
  const heightM = input.pvRoomHeightM ?? (gi?.whHeightM ? Number(gi.whHeightM) : 0);
  const calc = computeWarehouseSensorCount({
    lengthM,
    widthM,
    heightM,
    externalEnv: !!gi?.whExternalEnv,
  });
  const hasRoomDimensions = lengthM > 0 && widthM > 0;
  const hasStructuredPlanData =
    hasRoomDimensions ||
    (input.floorPlanObjects?.length ?? 0) > 0 ||
    (input.pvLoggers?.length ?? 0) > 0;

  // ── If we have a saved PNG screenshot, embed it directly ──
  // Prefer structured coordinates: screenshots can contain editor controls,
  // zoom state and other UI that does not belong in the report.
  if (input.planImageUrl && !hasStructuredPlanData) {
    const pageLeft = PAGE_MARGIN;
    const usableW = doc.page.width - PAGE_MARGIN * 2;
    const imgMaxH = 448;
    ensureSpace(doc, imgMaxH + 70);
    drawSubTitle(doc, title);
    try {
      // planImageUrl is a relative path like /manus-storage/... or a full URL
      const imgY = doc.y + 8;
      doc.image(input.planImageUrl as any, pageLeft, imgY, {
        fit: [usableW, imgMaxH],
        align: "center",
      });
      doc.y = imgY + imgMaxH + 12;
    } catch (_e) {
      // fall through to vector drawing if image embed fails
      doc.fillColor(MUTED).font("body").fontSize(9)
        .text("[Изображение схемы недоступно — используется векторный рисунок]");
      doc.moveDown(0.3);
    }
    // Draw sensor-placement table below the image
    {
      const floorObjs2 = (input.floorPlanObjects ?? []);
      // Collect all sensor rows from objects
      const sensorRows2: Array<{ objLabel: string; sensorId: string; heightFromFloor: string }> = [];
      for (const obj of floorObjs2) {
        const sensors = (obj.sensors ?? []).filter(s => s.sensorId && s.sensorId.trim());
        for (const s of sensors) {
          sensorRows2.push({
            objLabel: obj.label || obj.type,
            sensorId: s.sensorId.trim(),
            heightFromFloor: s.heightFromFloor > 0 ? s.heightFromFloor.toFixed(2) : "—",
          });
        }
      }
      if (sensorRows2.length > 0) {
        ensureSpace(doc, sensorRows2.length * 16 + 50);
        doc.moveDown(0.5);
        doc.fillColor(ACCENT).font("bold").fontSize(9).text("Таблица размещения датчиков", { align: "left" });
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
        ["Объект размещения", "ID датчика", "Высота от пола, м"].forEach((h, i) => {
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

  // Plan dimensions
  // NOTE: In FloorPlanEditor, xPct is along the LENGTH axis (horizontal) and
  // yPct is along the WIDTH axis (vertical), so the PDF must use the same
  // orientation: drawW corresponds to lengthM, drawH to widthM.
  const pageLeft = PAGE_MARGIN;
  const pageRight = doc.page.width - PAGE_MARGIN;
  const usableW = pageRight - pageLeft;
  const planMaxH = 320;
  // aspect = widthM / lengthM so that drawW maps to lengthM (horizontal) and
  // drawH maps to widthM (vertical) — matching FloorPlanEditor's SVG orientation.
  const aspect = hasRoomDimensions ? widthM / lengthM : 1;
  let drawW = usableW;
  let drawH = drawW * aspect;
  if (drawH > planMaxH) {
    drawH = planMaxH;
    drawW = drawH / aspect;
  }
  const missingDimensionsNoteHeight = calc.total === 0 ? 42 : 0;
  ensureSpace(doc, drawH + 110 + missingDimensionsNoteHeight);
  drawSubTitle(doc, title);
  if (calc.total === 0) {
    doc.fillColor(MUTED).font("body").fontSize(10)
      .text(
        "Размеры помещения не указаны. Схема приведена без масштаба; расчётная сетка " +
        "регистраторов не формировалась.",
        { align: "justify" },
      );
    doc.moveDown(0.5);
  }
  const planX = pageLeft + (usableW - drawW) / 2;
  const planY = doc.y + 10;

  // Frame
  doc.save();
  doc.lineWidth(1.2).strokeColor(ACCENT)
    .rect(planX, planY, drawW, drawH).stroke();
  doc.restore();

  // Rulers are omitted when room dimensions are not provided.
  if (hasRoomDimensions) {
    const lengthLabel = `${lengthM.toFixed(1)} м (длина)`;
    const widthLabel = `${widthM.toFixed(1)} м (ширина)`;
    doc.fillColor(MUTED).font("body").fontSize(8)
      .text(lengthLabel, planX, planY - 12, { width: drawW, align: "center" });
    doc.save();
    doc.rotate(-90, { origin: [planX - 14, planY + drawH / 2] });
    doc.text(widthLabel, planX - 60, planY + drawH / 2 - 4, { width: 80, align: "center" });
    doc.restore();
  }

  // Grid lines (light)
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

  // Floor plan objects (furniture, equipment placed by user) — exclude sensor_point (rendered separately)
  const allFloorObjs = (input.floorPlanObjects ?? []);
  const floorObjs = allFloorObjs.filter((o: { type: string }) => o.type !== "sensor_point");
  const sensorPointObjs = allFloorObjs.filter((o: { type: string }) => o.type === "sensor_point");
  if (floorObjs.length > 0) {
    // Object type visual properties
    const OBJ_STYLES: Record<string, { fill: string; stroke: string; text: string }> = {
      shelf:        { fill: "#dbeafe", stroke: "#1d4ed8", text: "#1e3a8a" },
      pallet:       { fill: "#fef3c7", stroke: "#b45309", text: "#78350f" },
      cabinet:      { fill: "#e0e7ff", stroke: "#4338ca", text: "#312e81" },
      display_case: { fill: "#cffafe", stroke: "#0e7490", text: "#164e63" },
      refrigerator: { fill: "#bae6fd", stroke: "#0369a1", text: "#0c4a6e" },
      table:        { fill: "#d1fae5", stroke: "#059669", text: "#064e3b" },
      window:       { fill: "#e0f2fe", stroke: "#0284c7", text: "#0c4a6e" },
      radiator:     { fill: "#fee2e2", stroke: "#dc2626", text: "#7f1d1d" },
      vent:         { fill: "#f3e8ff", stroke: "#7c3aed", text: "#4c1d95" },
      door_obj:     { fill: "#fde68a", stroke: "#b45309", text: "#78350f" },
      cooling_unit: { fill: "#a5f3fc", stroke: "#0891b2", text: "#164e63" },
      partition:    { fill: "#64748b", stroke: "#334155", text: "#0f172a" },
    };
    for (const obj of floorObjs) {
      doc.save(); // isolate each object's transform
      const style = OBJ_STYLES[obj.type] ?? { fill: "#f1f5f9", stroke: "#64748b", text: "#1e293b" };
      const objectLabel = obj.type === "cooling_unit" ? "Кондиционер" : obj.label;
      const ox = planX + (obj.xPct / 100) * drawW;
      const oy = planY + (obj.yPct / 100) * drawH;
      const ow = Math.max(4, (obj.widthPct / 100) * drawW);
      const oh = Math.max(4, (obj.heightPct / 100) * drawH);
      const cx = ox + ow / 2;
      const cy = oy + oh / 2;
      // Apply rotation around center
      if (obj.rotation !== 0) {
        doc.translate(cx, cy).rotate(obj.rotation).translate(-cx, -cy);
      }
      // Fill + stroke
      doc.fillColor(style.fill).strokeColor(style.stroke).lineWidth(0.8);
      if (obj.type === "partition") {
        doc.rect(ox, oy, ow, oh).fillAndStroke();
      } else {
        doc.roundedRect(ox, oy, ow, oh, 2).fillAndStroke();
      }
      // Shelf vertical lines
      if (obj.type === "shelf" && ow > 20) {
        const nLines = Math.max(1, Math.floor(ow / 15));
        doc.strokeColor(style.stroke).lineWidth(0.5).opacity(0.4);
        for (let i = 1; i <= nLines; i++) {
          const lx = ox + (i / (nLines + 1)) * ow;
          doc.moveTo(lx, oy + 1).lineTo(lx, oy + oh - 1).stroke();
        }
        doc.opacity(1);
      }
      // Vent cross
      if (obj.type === "vent") {
        doc.strokeColor(style.stroke).lineWidth(0.6).opacity(0.5);
        doc.moveTo(ox + 3, oy + 3).lineTo(ox + ow - 3, oy + oh - 3).stroke();
        doc.moveTo(ox + ow - 3, oy + 3).lineTo(ox + 3, oy + oh - 3).stroke();
        doc.opacity(1);
      }
      // Label
      const fontSize = Math.max(5, Math.min(8, Math.min(ow, oh) * 0.3));
      const canFitObjectLabel = ow >= 24 && oh >= 8;
      if (canFitObjectLabel) {
        doc.fillColor(style.text).font("body").fontSize(fontSize)
          .text(objectLabel.slice(0, 14), ox, cy - fontSize / 2, { width: ow, align: "center" });
      }
      
      if (hasRoomDimensions && ow >= 42 && oh >= 20) {
        // Draw dimension label (Д×Ш×В in meters)
        const dimFontSize = Math.max(4, Math.min(6, Math.min(ow, oh) * 0.2));
        const wM = lengthM > 0 ? ((obj.widthPct / 100) * lengthM).toFixed(1) : obj.widthPct.toFixed(0) + "%";
        const hM = widthM > 0 ? ((obj.heightPct / 100) * widthM).toFixed(1) : obj.heightPct.toFixed(0) + "%";
        const htStr = obj.heightM && obj.heightM > 0 ? `×${obj.heightM.toFixed(1)}м` : "";
        const dimStr = `${wM}м×${hM}м${htStr}`;
        const dimY = oh > 20 ? cy + fontSize / 2 + 2 : oy + oh + 3;
        doc.fillColor(style.text).font("body").fontSize(dimFontSize).opacity(0.7)
          .text(dimStr, ox, dimY, { width: ow, align: "center" });
        doc.opacity(1);
      }
      
      doc.restore(); // always restore per-object
    }
  }

  // Door / cooling unit markers
  if (input.doorPos) {
    const dx = planX + (input.doorPos.x / 100) * drawW;
    const dy = planY + (input.doorPos.y / 100) * drawH;
    doc.save();
    doc.fillColor("#fde68a").strokeColor("#b45309").lineWidth(0.8)
      .roundedRect(dx - 16, dy - 8, 32, 16, 3).fillAndStroke();
    doc.fillColor("#92400e").font("body").fontSize(7)
      .text("Дверь", dx - 16, dy - 4, { width: 32, align: "center" });
    doc.restore();
  }
  if (input.coolingUnitPos) {
    const cx = planX + (input.coolingUnitPos.x / 100) * drawW;
    const cy = planY + (input.coolingUnitPos.y / 100) * drawH;
    doc.save();
    doc.fillColor("#bae6fd").strokeColor("#0369a1").lineWidth(0.8)
      .roundedRect(cx - 28, cy - 8, 56, 16, 3).fillAndStroke();
    doc.fillColor("#075985").font("body").fontSize(7)
      .text("Кондиционер", cx - 28, cy - 4, { width: 56, align: "center" });
    doc.restore();
  }

  // Sensor positions (with assigned labels for "real" diagram)
  const internals = (input.pvLoggers ?? []).filter(l => l.role === "internal");
  const placedById = new Map<string, typeof internals[number]>();
  internals.forEach(l => {
    if (l.position && l.position.startsWith("L")) placedById.set(l.position, l);
  });

  // Render only the lowest tier on the plan, but list all tiers in the legend underneath
  const margin = 0.08;
  const span = 1 - margin * 2;
  for (let r = 1; r <= calc.nL; r++) {
    for (let c = 1; c <= calc.nW; c++) {
      const xPct = calc.nW === 1 ? 0.5 : margin + ((c - 1) / (calc.nW - 1)) * span;
      const yPct = calc.nL === 1 ? 0.5 : margin + ((r - 1) / (calc.nL - 1)) * span;
      const px = planX + xPct * drawW;
      const py = planY + yPct * drawH;
      // Aggregate tiers for this column
      let label = `${r}-${c}`;
      if (!template) {
        const matches: string[] = [];
        for (let t = 1; t <= calc.nV; t++) {
          const id = `L${r}-c${c}-t${t}`;
          const placed = placedById.get(id);
          if (placed) matches.push((placed.customName || placed.label));
        }
        if (matches.length) {
          const firstLabel = matches[0];
          const shortSensorLabel = firstLabel.length > 4 ? firstLabel.slice(-4) : firstLabel;
          label = matches.length > 1 ? `${shortSensorLabel}+` : shortSensorLabel;
        }
      }
      const filled = !template && /[A-Za-zА-Яа-я0-9]/.test(label) && label !== `${r}-${c}`;
      doc.save();
      doc.fillColor(filled ? "#10b981" : "#e2e8f0").strokeColor(filled ? "#047857" : "#64748b")
        .lineWidth(1).circle(px, py, 12).fillAndStroke();
      doc.fillColor(filled ? "white" : "#1f2937").font("bold").fontSize(7)
        .text(label.slice(0, 8), px - 12, py - 3, { width: 24, align: "center" });
      doc.restore();
    }
  }

  // ── Render sensor_point objects as circles on the plan ─────────────────────
  for (const sp of sensorPointObjs) {
    const spX = planX + (sp.xPct / 100) * drawW;
    const spY = planY + (sp.yPct / 100) * drawH;
    const spR = Math.min((sp.widthPct / 100) * drawW, (sp.heightPct / 100) * drawH) / 2;
    const r = Math.max(8, Math.min(16, spR));
    doc.save();
    doc.fillColor("#7dd3fc").strokeColor("#0369a1").lineWidth(1.5).circle(spX, spY, r).fillAndStroke();
    const shortId = (sp.label || "D").slice(0, 6);
    doc.fillColor("#0c4a6e").font("bold").fontSize(Math.max(5, Math.min(8, r * 0.7)))
      .text(shortId, spX - r, spY - 4, { width: r * 2, align: "center" });
    doc.restore();
  }

  doc.x = pageLeft;
  doc.y = planY + drawH + 12;
  // ── Sensor placement table for floor plan objects ────────────────────────
  {
    const sensorRows: Array<{ objLabel: string; sensorId: string; heightFromFloor: string }> = [];
    // From sensor_point objects on the plan
    for (const sp of sensorPointObjs) {
      sensorRows.push({
        objLabel: "Датчик на плане",
        sensorId: sp.label || "Датчик",
        heightFromFloor: (sp.heightM ?? 0) > 0 ? (sp.heightM as number).toFixed(2) : "—",
      });
    }
    // From sensors attached to floor objects
    for (const obj of floorObjs) {
      const sensors = (obj.sensors ?? []).filter((s: { sensorId: string; heightFromFloor: number }) => s.sensorId && s.sensorId.trim());
      for (const s of sensors) {
        sensorRows.push({
          objLabel: obj.label || obj.type,
          sensorId: s.sensorId.trim(),
          heightFromFloor: s.heightFromFloor > 0 ? s.heightFromFloor.toFixed(2) : "—",
        });
      }
    }
    if (sensorRows.length > 0) {
      ensureSpace(doc, sensorRows.length * 16 + 50);
      doc.moveDown(0.5);
      doc.fillColor(ACCENT).font("bold").fontSize(9)
        .text("Таблица размещения датчиков", { align: "left" });
      doc.moveDown(0.3);
      const tLeft  = pageLeft;
      const colW   = [200, 180, 150];
      const tRight = tLeft + colW.reduce((a: number, b: number) => a + b, 0);
      const rowH   = 16;
      let ty = doc.y;
      doc.save();
      doc.fillColor("#f1f5f9").rect(tLeft, ty, tRight - tLeft, rowH).fill();
      doc.strokeColor("#cbd5e1").lineWidth(0.5).rect(tLeft, ty, tRight - tLeft, rowH).stroke();
      let tx = tLeft;
      ["Объект размещения", "ID датчика", "Высота от пола, м"].forEach((h, i) => {
        doc.fillColor(ACCENT).font("bold").fontSize(8)
          .text(h, tx + 4, ty + 4, { width: colW[i] - 8, align: "left" });
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
          doc.fillColor(ACCENT).font("body").fontSize(8)
            .text(cell, cx2 + 4, ty + 4, { width: colW[i] - 8, align: i === 2 ? "center" : "left" });
          cx2 += colW[i];
        });
        ty += rowH;
      });
      doc.restore();
      doc.x = pageLeft;
      doc.y = ty + 6;
    }
  }

  // Caption
  doc.fillColor(MUTED).font("body").fontSize(9)
    .text(
      `Размещено ${calc.nL} × ${calc.nW} точек на ${calc.nV} ярус(а), всего ${calc.base} внутренних регистраторов` +
      (calc.external ? `; +${calc.external} внешний регистратор (контакт с внешней средой)` : "") + ".",
      pageLeft,
      doc.y,
      { width: usableW, align: "center" },
    );
  doc.moveDown(0.4);
  doc.fillColor(MUTED).font("body").fontSize(8)
    .text(
      "Сетка построена по таблицам п. 16д Рек. ЕАЭК №8 (горизонталь: 2/3/4/5 точек при ≤10/40/60/>60 м; " +
      "вертикаль: 1/2/3 точки при ≤1.5 / <5 / ≥5 м).",
      pageLeft,
      doc.y,
      { width: usableW, align: "justify" },
    );
  doc.moveDown(0.3);

  // ── Sensor placement table (height + comments) ──────────────────────────────
  // Only render when pvLoggers are available (second diagram call with template=false)
  if (!template) {
    const pvLoggers = input.pvLoggers ?? [];
    const internals = pvLoggers.filter(l => l.role === "internal");
    const externals = pvLoggers.filter(l => l.role === "external");
    if (pvLoggers.length > 0) {
      const pageLeft2 = PAGE_MARGIN;
      const pageRight2 = doc.page.width - PAGE_MARGIN;
      const totalW2 = pageRight2 - pageLeft2;
      ensureSpace(doc, internals.length * 18 + 80);
      doc.moveDown(0.5);
      doc.fillColor(ACCENT).font("bold").fontSize(9)
        .text("Таблица размещения регистраторов данных", { align: "left" });
      doc.moveDown(0.3);
      // Columns: №, ID (last 4), Serial, Position, Height (m), Comment
      const sColW = [28, 50, 90, 90, 70, totalW2 - (28 + 50 + 90 + 90 + 70)];
      const sHeaders = ["№", "ID", "Серийный №", "Позиция", "Высота, м", "Примечание"];
      let sy = doc.y;
      const sRowH = 16;
      // Header
      doc.save();
      doc.fillColor("#f1f5f9").rect(pageLeft2, sy, totalW2, sRowH).fill();
      doc.strokeColor("#cbd5e1").lineWidth(0.5).rect(pageLeft2, sy, totalW2, sRowH).stroke();
      let scx = pageLeft2;
      sHeaders.forEach((h, i) => {
        doc.fillColor(ACCENT).font("bold").fontSize(8)
          .text(h, scx + 3, sy + 4, { width: sColW[i] - 6, align: i >= 4 ? "center" : "left" });
        scx += sColW[i];
      });
      sy += sRowH;
      doc.restore();
      // Internal sensor rows
      const allSensorRows = [
        ...internals.map((l, idx) => ({ l, idx, isExt: false })),
        ...externals.map((l, idx) => ({ l, idx: internals.length + idx, isExt: true })),
      ];
      allSensorRows.forEach(({ l, idx, isExt }) => {
        ensureSpace(doc, sRowH);
        const bg = idx % 2 === 0 ? "white" : "#f8fafc";
        doc.save();
        doc.fillColor(bg).rect(pageLeft2, sy, totalW2, sRowH).fill();
        doc.strokeColor("#e2e8f0").lineWidth(0.4).rect(pageLeft2, sy, totalW2, sRowH).stroke();
        doc.restore();
        const shortId = l.label.length > 4 ? l.label.slice(-4) : l.label;
        const posLabel = l.position ?? (isExt ? "Внешний" : "—");
        // Approximate height from position id (tier)
        let heightStr = "—";
        if (l.position && l.position.startsWith("L")) {
          const tierMatch = l.position.match(/t(\d+)$/);
          if (tierMatch && calc.nV > 0 && heightM > 0) {
            const tier = parseInt(tierMatch[1], 10);
            const h = (heightM / Math.max(calc.nV, 1) * (tier - 0.5)).toFixed(2);
            heightStr = `${h} м`;
          }
        }
        const cells = [
          String(idx + 1),
          shortId,
          l.label,
          posLabel,
          heightStr,
          isExt ? "Внешний регистратор" : "",
        ];
        let scx2 = pageLeft2;
        cells.forEach((cell, ci) => {
          doc.fillColor(isExt ? "#92400e" : ACCENT).font("body").fontSize(8)
            .text(cell, scx2 + 3, sy + 4, { width: sColW[ci] - 6, align: ci >= 4 ? "center" : "left" });
          scx2 += sColW[ci];
        });
        sy += sRowH;
      });
      doc.y = sy + 6;
      doc.fillColor(MUTED).font("body").fontSize(7)
        .text("ID — последние 4 цифры идентификационного номера регистратора. Высота рассчитана автоматически по ярусу размещения.",
          { align: "left" });
      doc.moveDown(0.4);
    }
  }
}

/**
 * Annex №1 — «Параметры размещения регистраторов»
 * Таблица посадочных мест с координатами строки/колонки/яруса и серийными
 * номерами регистраторов.
 */
function drawWarehouseAnnex1(doc: PDFKit.PDFDocument, input: ReportInput) {
  const gi = input.generalInfo;
  // Prefer pvSession room dims (same as drawWarehousePlanDiagram)
  const lengthM = input.pvRoomLengthM ?? (gi?.whLengthM ? Number(gi.whLengthM) : null);
  const widthM  = input.pvRoomWidthM  ?? (gi?.whWidthM  ? Number(gi.whWidthM)  : null);
  const heightM = input.pvRoomHeightM ?? (gi?.whHeightM ? Number(gi.whHeightM) : null);
  const calc = computeWarehouseSensorCount({
    lengthM,
    widthM,
    heightM,
    externalEnv: !!gi?.whExternalEnv,
  });
  // Show Annex 1 if we have either a valid grid layout OR actual pv.loggers
  const hasLoggers = (input.pv?.loggers ?? []).length > 0;
  if (!calc.total && !hasLoggers) return;

  doc.addPage();

  // Official header block (top-right corner)
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalW = right - left;

  // Top-right annotation
  doc.fillColor(ACCENT).font("body").fontSize(9)
    .text("Приложение N 1", left, doc.y, { width: totalW, align: "right" });
  doc.fillColor(MUTED).font("body").fontSize(9)
    .text("к Руководству по проведению", { width: totalW, align: "right" })
    .text("температурного картирования зон", { width: totalW, align: "right" })
    .text("хранения лекарственных средств", { width: totalW, align: "right" });
  doc.moveDown(0.4);
  doc.fillColor(MUTED).font("body").fontSize(9)
    .text("(форма)", { width: totalW, align: "right" });
  doc.moveDown(1.0);

  // Main heading
  doc.fillColor(ACCENT).font("bold").fontSize(11)
    .text("ИНФОРМАЦИЯ", { width: totalW, align: "center" });
  doc.fillColor(ACCENT).font("body").fontSize(10)
    .text("о расположении регистраторов данных", { width: totalW, align: "center" });
  doc.moveDown(1.0);

  // Build logger list — match by position id and get data from pv.loggers (Annex 2)
  const internals = (input.pvLoggers ?? []).filter(l => l.role === "internal");
  const externals = (input.pvLoggers ?? []).filter(l => l.role === "external");
  const placedById = new Map<string, typeof internals[number]>();
  internals.forEach(l => {
    if (l.position && l.position.startsWith("L")) placedById.set(l.position, l);
  });
  
  // Build a map of sensor heights from floorPlanObjects.
  // sensor_point objects store their height in heightM and their label (last-4 of serial).
  // We index by both the exact label and the last-4 digits to match against full serial numbers.
  const sensorHeightMap = new Map<string, number>();
  (input.floorPlanObjects ?? []).forEach(obj => {
    // Primary: sensor_point objects — label is the sensor ID, heightM is height from floor
    if (obj.type === "sensor_point" && obj.label && obj.heightM != null && obj.heightM > 0) {
      const lbl = obj.label.trim();
      sensorHeightMap.set(lbl, obj.heightM);
      // Also index by last-4 for fuzzy matching against full serial numbers
      if (lbl.length > 4) sensorHeightMap.set(lbl.slice(-4), obj.heightM);
    }
    // Secondary: sensors array on objects (future-proof)
    (obj.sensors ?? []).forEach(s => {
      if (s.sensorId && s.heightFromFloor != null) {
        const sid = s.sensorId.trim();
        sensorHeightMap.set(sid, s.heightFromFloor);
        if (sid.length > 4) sensorHeightMap.set(sid.slice(-4), s.heightFromFloor);
      }
    });
  });
  // Helper: look up height by full label OR last-4 digits of label
  const getHeight = (label: string): number | undefined => {
    if (!label) return undefined;
    const direct = sensorHeightMap.get(label);
    if (direct != null) return direct;
    const last4 = label.length >= 4 ? label.slice(-4) : label;
    return sensorHeightMap.get(last4);
  };

  // Official table columns (matching Annex 1 form):
  // ID регистратора | Серийный номер* | Номер на схеме | Высота установки, м | Примечание
  const colW = [110, 110, 100, 100, totalW - (110 + 110 + 100 + 100)];
  const headers = [
    "Идентификационный номер (ID)\nрегистратора данных",
    "Серийный номер\nрегистратора данных*",
    "Номер на схеме\nразмещения",
    "Высота установки\nрегистратора данных, м",
    "Примечание",
  ];

  let y = doc.y;
  const headerH = 48; // taller header for multi-line text
  ensureSpace(doc, headerH + 4);

  // Draw header row with border
  doc.save();
  doc.fillColor(SOFT_BG).rect(left, y, totalW, headerH).fill();
  doc.lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, headerH).stroke();
  doc.restore();

  let cx = left;
  doc.fillColor(ACCENT).font("bold").fontSize(8);
  headers.forEach((h, i) => {
    // Draw vertical dividers
    if (i > 0) {
      doc.save().lineWidth(0.5).strokeColor(BORDER)
        .moveTo(cx, y).lineTo(cx, y + headerH).stroke().restore();
    }
    doc.text(h, cx + 4, y + 5, { width: colW[i] - 8, align: "center" });
    cx += colW[i];
  });
  y += headerH;

  // Data rows
  let idx = 1;
  doc.font("body").fontSize(9);
  const rowH = 22;

  const drawRow = (cells: string[], bgColor?: string, isExt?: boolean) => {
    ensureSpace(doc, rowH);
    if (bgColor) {
      doc.save().fillColor(bgColor).rect(left, y, totalW, rowH).fill().restore();
    }
    doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, rowH).stroke().restore();
    cx = left;
    cells.forEach((v, i) => {
      if (i > 0) {
        doc.save().lineWidth(0.5).strokeColor(BORDER)
          .moveTo(cx, y).lineTo(cx, y + rowH).stroke().restore();
      }
      doc.fillColor(isExt ? "#92400e" : ACCENT).font("body").fontSize(9)
        .text(v, cx + 4, y + 6, { width: colW[i] - 8, align: "center" });
      cx += colW[i];
    });
    y += rowH;
    idx++;
  };

  // Always show all internal loggers from pv.loggers (most reliable source).
  // If a logger has a grid position assigned, use that as context; otherwise use the label.
  const internalPvLoggers = (input.pv?.loggers ?? []).filter((pvLogger) => {
    const pvL = (input.pvLoggers ?? []).find(p => p.label === pvLogger.label);
    return !pvL || pvL.role !== "external";
  });
  internalPvLoggers.forEach((pvLogger, i) => {
    const pvL = (input.pvLoggers ?? []).find(p => p.label === pvLogger.label);
    const rawLabel = pvLogger.label || "";
    const last4 = rawLabel.length >= 4 ? rawLabel.slice(-4) : rawLabel;
    const idDisplay = last4 || "—";
    const serialNum = pvLogger.label || "—";
    const schemeNum = last4 || "—";
    const sensorHeight = getHeight(pvLogger.label);
    const heightDisplay = sensorHeight != null ? sensorHeight.toFixed(2) : "—";
    const bg = i % 2 === 0 ? "#f1f5f9" : undefined;
    drawRow([idDisplay, serialNum, schemeNum, heightDisplay, ""], bg);
  });

  // External sensors
  externals.forEach((ext, ei) => {
    const rawLabel = ext.label || "";
    const last4 = rawLabel.length >= 4 ? rawLabel.slice(-4) : rawLabel;
    const extId = last4 || "—";
    const serialNum = ext.label || "—";
    const schemeNum = last4 || "—";
    // Height: use actual sensor height from floorPlanObjects if available
    const sensorHeight = ext.label ? getHeight(ext.label) : undefined;
    const heightDisplay = sensorHeight != null ? sensorHeight.toFixed(2) : "—";
    drawRow([extId, serialNum, schemeNum, heightDisplay, "Внешний"], "#fef3c7", true);
  });

  // Empty rows if no loggers placed yet
  if (idx === 1) {
    drawRow(["", "", "", "", ""]);
    drawRow(["", "", "", "", ""]);
  }

  doc.y = y + 8;

  // Footnote separator line — full width
  doc.save().lineWidth(0.5).strokeColor(BORDER)
    .moveTo(left, doc.y).lineTo(right, doc.y).stroke().restore();
  doc.moveDown(0.3);
  doc.fillColor(MUTED).font("body").fontSize(8)
    .text("* Заполняется в случае отличия серийного номера от идентификационного номера (ID)", left, doc.y, { width: totalW });
}

/**
 * Annex №2 — «Сводная таблица показаний регистраторов» (минимум/максимум/среднее
 * по каждой точке + соответствие критериям приемлемости).
 */
function drawWarehouseAnnex2(doc: PDFKit.PDFDocument, input: ReportInput) {
  if (!input.pv?.loggers?.length) return;
  doc.addPage();
  drawSectionTitle(doc, "Приложение №2. Сводная таблица показаний регистраторов");
  doc.fillColor(MUTED).font("body").fontSize(9)
    .text(
      `Сводные результаты температурного картирования зоны хранения за период ` +
      `${formatDateRange(input.pv.startAt, input.pv.endAt)}; режим ` +
      `${input.pv.rangeMin.toFixed(1)} … ${input.pv.rangeMax.toFixed(1)} °C.`,
      { align: "justify" },
    );
  doc.moveDown(0.6);

  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalW = right - left;
  // Official Annex 2 columns: ID | Serial* | T min | T max | T avg | Compliance (да/нет)
  // Use sub-header for "Соответствие установленному диапазону" split into да/нет
  const colW = [110, 110, 60, 60, 60, Math.floor((totalW - (110 + 110 + 60 + 60 + 60)) / 2), Math.ceil((totalW - (110 + 110 + 60 + 60 + 60)) / 2)];
  const headers = [
    "Идентификационный номер (ID)\nрегистратора данных",
    "Серийный номер\nрегистратора данных*",
    "Минимальная\nтемпература, °C",
    "Максимальная\nтемпература, °C",
    "Средняя\nтемпература, °C",
    "да",
    "нет",
  ];
  // Two-level header: top row spans cols 5-6 with "Соответствие установленному диапазону"
  // Bottom row has "да" and "нет" sub-columns
  const headerH1 = 44; // first header row height — tall enough for 3-line text
  const headerH2 = 20; // sub-header row height
  let y = doc.y;
  ensureSpace(doc, headerH1 + headerH2 + 4);

  // --- Header row 1 ---
  doc.save();
  doc.fillColor(SOFT_BG).rect(left, y, totalW, headerH1).fill();
  doc.lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, headerH1).stroke();
  doc.restore();

  let cx = left;
  doc.fillColor(ACCENT).font("bold").fontSize(8);
  // First 5 columns span both rows — draw them tall
  const mainCols = headers.slice(0, 5);
  mainCols.forEach((h, i) => {
    if (i > 0) {
      doc.save().lineWidth(0.5).strokeColor(BORDER)
        .moveTo(cx, y).lineTo(cx, y + headerH1 + headerH2).stroke().restore();
    }
    doc.text(h, cx + 4, y + 4, { width: colW[i] - 8, align: "center" });
    cx += colW[i];
  });
  // "Соответствие установленному диапазону" spans last 2 columns
  const complianceX = cx;
  const complianceW = colW[5] + colW[6];
  doc.save().lineWidth(0.5).strokeColor(BORDER)
    .moveTo(cx, y).lineTo(cx, y + headerH1 + headerH2).stroke().restore();
  doc.text("Соответствие установленному диапазону", complianceX + 4, y + 8, { width: complianceW - 8, align: "center" });
  y += headerH1;

  // --- Header row 2 (sub-header for да/нет) ---
  doc.save();
  doc.fillColor(SOFT_BG).rect(left, y, totalW, headerH2).fill();
  doc.lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, headerH2).stroke();
  doc.restore();
  // Extend first 5 col dividers through row 2
  cx = left;
  for (let i = 0; i < 5; i++) {
    if (i > 0) {
      doc.save().lineWidth(0.5).strokeColor(BORDER)
        .moveTo(cx, y).lineTo(cx, y + headerH2).stroke().restore();
    }
    cx += colW[i];
  }
  // да / нет sub-columns
  doc.save().lineWidth(0.5).strokeColor(BORDER)
    .moveTo(cx, y).lineTo(cx, y + headerH2).stroke().restore();
  doc.fillColor(ACCENT).font("bold").fontSize(8)
    .text("да", cx + 4, y + 5, { width: colW[5] - 8, align: "center" });
  cx += colW[5];
  doc.save().lineWidth(0.5).strokeColor(BORDER)
    .moveTo(cx, y).lineTo(cx, y + headerH2).stroke().restore();
  doc.fillColor(ACCENT).font("bold").fontSize(8)
    .text("нет", cx + 4, y + 5, { width: colW[6] - 8, align: "center" });
  y += headerH2;

  // --- Data rows ---
  const rowH = 20;
  doc.font("body").fontSize(9);
  // Exclude external sensors from Annex 2 (they are ambient monitors, not storage zone points)
  const internalLoggers = input.pv.loggers.filter((l) => {
    const pvL = (input.pvLoggers ?? []).find(p => p.label === l.label);
    return !pvL || pvL.role !== "external";
  });
  internalLoggers.forEach((l, i) => {
    const inRange = (v: number | null | undefined) => {
      if (v == null || !Number.isFinite(v)) return true;
      return v >= input.pv.rangeMin && v <= input.pv.rangeMax;
    };
    const ok = inRange(l.min) && inRange(l.max) && inRange(l.mkt);
    // ID: last 4 digits of serial number (label), or position if assigned
    const pvLogger = (input.pvLoggers ?? []).find(p => p.label === l.label);
    const rawLabel = l.label || "";
    const last4 = rawLabel.length >= 4 ? rawLabel.slice(-4) : rawLabel;
    const positionId = (pvLogger?.position && pvLogger.position !== "unset") ? pvLogger.position : last4 || "—";
    const fmt = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? n.toFixed(2) : "—");
    // cells: ID, Serial, T min, T max, T avg, да-mark, нет-mark
    const cells = [
      positionId,
      l.customName ? `${l.customName} (${l.label})` : l.label,
      fmt(l.min),
      fmt(l.max),
      fmt(l.avg),
      ok ? "✓" : "",
      ok ? "" : "✓",
    ];
    ensureSpace(doc, rowH);
    if (i % 2 === 0) {
      doc.save().fillColor("#f1f5f9").rect(left, y, totalW, rowH).fill().restore();
    }
    doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, rowH).stroke().restore();
    cx = left;
    cells.forEach((v, j) => {
      if (j > 0) {
        doc.save().lineWidth(0.5).strokeColor(BORDER)
          .moveTo(cx, y).lineTo(cx, y + rowH).stroke().restore();
      }
      const isYes = j === 5;
      const isNo = j === 6;
      doc.fillColor(isYes && ok ? "#047857" : isNo && !ok ? "#b91c1c" : ACCENT)
        .font((isYes || isNo) ? "bold" : "body")
        .fontSize(isYes || isNo ? 11 : 9)
        .text(v, cx + 4, y + 4, { width: colW[j] - 8, align: "center" });
      cx += colW[j];
    });
    y += rowH;
  });

  // Empty rows if no data
  if (!internalLoggers.length) {
    for (let e = 0; e < 2; e++) {
      doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, rowH).stroke().restore();
      y += rowH;
    }
  }

  // Start/end time rows
  const timeRowH = 28;
  for (const label of ["Дата и время начала температурного картирования:", "Дата и время окончания температурного картирования:"]) {
    ensureSpace(doc, timeRowH);
    doc.save().lineWidth(0.5).strokeColor(BORDER).rect(left, y, totalW, timeRowH).stroke().restore();
    doc.fillColor(ACCENT).font("body").fontSize(9)
      .text(label, left + 6, y + 8, { width: totalW - 12 });
    y += timeRowH;
  }

  doc.y = y + 6;

  // Footnote
  doc.save().lineWidth(0.5).strokeColor(BORDER)
    .moveTo(left, doc.y).lineTo(left + 120, doc.y).stroke().restore();
  doc.moveDown(0.3);
  doc.fillColor(MUTED).font("body").fontSize(8)
    .text("* Заполняется в случае отличия серийного номера от идентификационного номера ID.");
}

function formatDateRange(startMs: number | null, endMs: number | null): string {
  if (!startMs || !endMs) return "—";
  const fmt = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  };
  return `${fmt(startMs)} — ${fmt(endMs)}`;
}

/* ============================================================================
 * WAREHOUSE PROTOCOL — PART I (ЕАЭК Рек. №8, разделы 1–7)
 * ============================================================================ */

/**
 * Default texts for every warehouse protocol section.
 * These are used when the user has not overridden a section.
 */
const WAREHOUSE_DEFAULT_SECTIONS: Record<string, string> = {
  "1.1": `ЕАЭС — Евразийский экономический союз
ЕЭК — Евразийская экономическая комиссия
ЛС — лекарственные средства
GDP (Good Distribution Practice) — Правила надлежащей дистрибьюторской практики
GPP (Good Pharmacy Practice) — Правила надлежащей аптечной практики
GMP (Good Manufacturing Practice) — Правила надлежащей производственной практики
СОП — стандартная операционная процедура
IQ (Installation Qualification) — квалификация монтажа
OQ (Operational Qualification) — квалификация функционирования
PV / PQ (Performance Validation / Qualification) — эксплуатационная квалификация / валидация
Т — температура
MKT (Mean Kinetic Temperature) — среднекинетическая температура`,

  "1.2": `Температурное картирование — систематическое измерение и документирование температурного распределения внутри помещения или зоны хранения с целью выявления «горячих» и «холодных» точек, оценки однородности температурного поля и определения оптимальных мест размещения датчиков системы мониторинга.

Регистратор данных (логгер) — автономное устройство, непрерывно фиксирующее значения температуры (и, при необходимости, относительной влажности) с заданным интервалом и сохраняющее результаты во внутренней памяти.

Критерий приемлемости — заранее установленный предел, с которым сравниваются результаты измерений для принятия решения о соответствии / несоответствии.

Зона хранения — выделенная часть склада или помещения, предназначенная для хранения лекарственных средств в определённых температурных условиях.`,

  "2.1": `Объект картирования: помещение (зона) хранения лекарственных средств.
Адрес: [указать адрес объекта]
Назначение: хранение лекарственных средств в условиях контролируемой температурной среды.`,

  "2.2.1": `Настоящее температурное картирование проводится в соответствии с:
• Рекомендацией Коллегии ЕЭК № 8 от 20.04.2021 «О Руководстве по надлежащей практике хранения лекарственных средств для медицинского применения»;
• Требованиями GDP/GPP/GMP в части обеспечения условий хранения лекарственных средств;
• Внутренними стандартными операционными процедурами организации.`,

  "2.2.2": `Конкретные основания для проведения данного исследования:
• Первичное картирование перед вводом помещения в эксплуатацию / после ремонта;
• Плановое периодическое картирование (ежегодное / сезонное);
• Картирование после существенных изменений в помещении или системах кондиционирования.`,

  "3": `Настоящий протокол распространяется на помещение (зону) хранения лекарственных средств, указанное в разделе 2.1. Результаты картирования применяются для:
• подтверждения соответствия температурных условий установленным требованиям;
• определения мест размещения датчиков системы мониторинга;
• разработки рекомендаций по безопасному хранению лекарственных средств.`,

  "4": `Цели температурного картирования:
а) подтверждение того, что температурные условия в помещении хранения соответствуют установленным требованиям на протяжении всего периода исследования;
б) выявление «горячих» и «холодных» точек, а также зон с нестабильным температурным режимом;
в) документальная фиксация зарегистрированных колебаний температуры;
г) составление рекомендаций по организации безопасного хранения лекарственных средств;
д) определение (уточнение) мест размещения датчиков мониторинга температуры.`,

  "6.1": `Тип регистраторов данных: [указать марку/модель]
Диапазон измерений: [указать]
Точность: ±[указать] °C
Интервал записи: [указать] минут
Дата последней поверки: [указать]
Свидетельство о поверке №: [указать]`,

  "6.2": `Ответственный за проведение картирования: [ФИО, должность]
Исполнители: [перечислить ФИО и должности]`,

  "6.3": `Характеристики объекта исследования заполнены в разделе «Общие сведения» (раздел 5).`,

  "6.4": `Критерии приемлемости:
• Температура во всех точках измерения в течение всего периода исследования должна находиться в пределах установленного режима хранения.
• MKT каждого регистратора не должна превышать верхний предел режима хранения.
• Допустимые кратковременные отклонения: не более [указать] °C в течение не более [указать] минут.`,

  "6.5": `Количество и расположение точек размещения регистраторов определено в соответствии с п. 16д Рекомендации ЕЭК № 8 с учётом объёма помещения. Расчёт приведён в разделе «Общие сведения».`,

  "6.6": `Точки размещения регистраторов зафиксированы на схеме помещения (Приложение № 1). Каждой точке присвоен уникальный идентификатор.`,

  "6.7": `Все регистраторы запрограммированы на одинаковый интервал записи. Дата и время синхронизированы перед началом исследования. Маркировка нанесена на корпус каждого регистратора.`,

  "6.8": `Регистраторы размещены в соответствии со схемой (Приложение № 1). Размещение выполнено до начала периода регистрации.`,

  "6.9": `Регистраторы извлечены по окончании периода регистрации. Данные выгружены в течение [указать] часов после извлечения.`,

  "6.10": `Данные с каждого регистратора выгружены с помощью [указать ПО]. Файлы данных объединены для совместного анализа. Исходные файлы сохранены в архиве.`,
};

/**
 * Renders warehouse protocol Part I with sections 1–7 per EAEU Rec. #8.
 */
function drawWarehouseProtocolPart1(doc: PDFKit.PDFDocument, input: ReportInput): void {
  const sec = (key: string): string => {
    const custom = input.warehouseSections?.[key];
    return custom !== undefined && custom.trim() !== "" ? custom : (WAREHOUSE_DEFAULT_SECTIONS[key] ?? "");
  };

  // ── Section 1: Сокращения и определения ─────────────────────────────────
  doc.addPage();
  drawSectionTitle(doc, "1. Сокращения и определения");

  drawSubTitle(doc, "1.1. Сокращения");
  const abbrevText = sec("1.1");
  abbrevText.split("\n").forEach(line => {
    if (!line.trim()) { doc.moveDown(0.3); return; }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "left" });
  });
  doc.moveDown(0.8);

  drawSubTitle(doc, "1.2. Определения");
  const defText = sec("1.2");
  defText.split("\n").forEach(line => {
    if (!line.trim()) { doc.moveDown(0.3); return; }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "justify" });
  });

  // ── Section 2: Описание и обоснование ───────────────────────────────────
  doc.addPage();
  drawSectionTitle(doc, "2. Описание и обоснование");

  drawSubTitle(doc, "2.1. Описание объекта картирования");
  renderTextBlock(doc, sec("2.1"));

  drawSubTitle(doc, "2.2. Обоснование проведения температурного картирования");
  drawSubTitle2(doc, "2.2.1. Нормативные основания");
  renderTextBlock(doc, sec("2.2.1"));
  drawSubTitle2(doc, "Принятый методологический подход");
  renderTextBlock(doc, WAREHOUSE_MAPPING_METHOD_NOTE);
  drawSubTitle2(doc, "2.2.2. Конкретные основания для проведения исследования");
  renderTextBlock(doc, sec("2.2.2"));

  // ── Section 3: Область применения ───────────────────────────────────────
  doc.addPage();
  drawSectionTitle(doc, "3. Область применения");
  renderTextBlock(doc, sec("3"));

  // ── Section 4: Цели и задачи ─────────────────────────────────────────────
  drawSectionTitle(doc, "4. Цели и задачи температурного картирования");
  renderTextBlock(doc, sec("4"));

  // ── Section 5: Общие сведения об объекте / оборудовании ────────────────────
  doc.addPage();
  drawSectionTitle(doc, "5. Общие сведения об объекте квалификации");
  drawGeneralInfoTable(doc, input);
  drawRevisionHistorySection(doc, input);

  // Equipment list (multiple items)
  const eqList = input.warehouseEquipment ?? [];
  if (eqList.length > 0) {
    doc.moveDown(0.8);
    drawSubTitle(doc, "5.1. Перечень оборудования зоны хранения");
    eqList.forEach((eq, idx) => {
      ensureSpace(doc, 60);
      doc.font("bold").fontSize(10).fillColor(ACCENT)
        .text(`Оборудование ${idx + 1}: ${eq.name}`, { underline: false });
      const safeValue = (v: string | null | undefined): string => {
        const s = (v ?? "").toString().trim();
        return s.length > 0 ? s : "—";
      };
      const rows: [string, string][] = [
        ["Производитель", safeValue(eq.manufacturer)],
        ["Модель", safeValue(eq.model)],
        ["Серийный номер", safeValue(eq.serial)],
        ["Назначение", safeValue(eq.purpose)],
      ];
      rows.forEach(([label, value]) => {
        doc.font("body").fontSize(10).fillColor(MUTED).text(`${label}: `, { continued: true })
          .fillColor(ACCENT).text(value);
      });
      doc.moveDown(0.5);
    });
  }

  // ── Section 6: Методология ───────────────────────────────────────────────
  doc.addPage();
  drawSectionTitle(doc, "6. Методология проведения температурного картирования");

  const methodSubs: Array<[string, string]> = [
    ["6.1. Сведения о выборе типа регистратора данных", "6.1"],
    ["6.2. Сведения об исполнителях", "6.2"],
    ["6.3. Сведения об объекте исследования", "6.3"],
    ["6.4. Сведения о критериях приемлемости", "6.4"],
    ["6.5. Сведения об определении точек размещения", "6.5"],
    ["6.6. Сведения о регистрации точек размещения", "6.6"],
    ["6.7. Сведения о маркировке и программировании", "6.7"],
    ["6.8. Сведения о размещении регистраторов", "6.8"],
    ["6.9. Сведения об извлечении регистраторов", "6.9"],
    ["6.10. Сведения о загрузке и объединении данных", "6.10"],
  ];
  methodSubs.forEach(([title, key]) => {
    ensureSpace(doc, 80);
    drawSubTitle(doc, title);
    renderTextBlock(doc, sec(key));
  });

  // 6.11 IQ plan
  doc.addPage();
  drawSubTitle(doc, "6.11. План IQ — Квалификация монтажа");
  drawStageBlocks(doc, input.iq);
  drawChecklistPlan(doc, input.iq.items);

  // 6.12 OQ plan
  doc.addPage();
  drawSubTitle(doc, "6.12. План OQ — Квалификация функционирования");
  drawStageBlocks(doc, input.oq);
  drawChecklistPlan(doc, input.oq.items);

  // 6.13 PV plan
  doc.addPage();
  drawSubTitle(doc, "6.13. План PV — Эксплуатационная квалификация");
  drawStageBlocks(doc, input.pv);
  drawPVPlan(doc, input.pv, input);

  // ── Section 7: Подписи к Протоколу ──────────────────────────────────────
  doc.addPage();
  drawSectionTitle(doc, "7. Подписи к Протоколу");
  drawSignaturesBlock(
    doc,
    getSignatoriesPart1(input),
    "Настоящий протокол квалификации рассмотрен и утверждён:",
  );
}

/** Render a multi-line text block with proper spacing */
function renderTextBlock(doc: PDFKit.PDFDocument, text: string): void {
  if (!text || !text.trim()) {
    doc.font("body").fontSize(10).fillColor(MUTED).text("(не заполнено)");
    doc.moveDown(0.5);
    return;
  }
  text.split("\n").forEach(line => {
    if (!line.trim()) { doc.moveDown(0.3); return; }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "justify" });
  });
  doc.moveDown(0.8);
}

/** Smaller sub-heading (level 3) */
function drawSubTitle2(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 40);
  doc.font("bold").fontSize(10).fillColor(ACCENT).text(title, { underline: false });
  doc.moveDown(0.4);
}


/**
 * Draw table with sensor information (number, calibration date, next calibration date)
 */
function drawSensorTable(
  doc: PDFKit.PDFDocument,
  sensors: Array<{
    id: number;
    number: string;
    calibrationDate: string | Date | null;
    nextCalibrationDate: string | Date | null;
    status?: string;
  }>,
  sensorAccuracy = 0.2,
  protocolDate: string | Date | number | null = null,
): void {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalWidth = right - left;
  const uniqueSensors = Array.from(
    sensors
      .reduce((acc, sensor) => {
        const key = sensor.number.trim().toLowerCase();
        if (key && !acc.has(key)) acc.set(key, sensor);
        return acc;
      }, new Map<string, (typeof sensors)[number]>())
      .values(),
  );
  
  // Column widths
  const colWidths = {
    number: totalWidth * 0.28,
    calibrationDate: totalWidth * 0.2,
    nextCalibrationDate: totalWidth * 0.2,
    status: totalWidth * 0.16,
    accuracy: totalWidth * 0.16,
  };
  
  const headers = ["Номер датчика", "Дата поверки", "Следующая поверка", "Статус", "Погрешность (± °C)"];
  const headerY = doc.y;
  
  // Draw header row
  doc.font("bold").fontSize(9).fillColor(ACCENT);
  let x = left;
  headers.forEach((header, idx) => {
    const colW = Object.values(colWidths)[idx];
    doc.text(header, x, headerY, { width: colW, align: "left", lineBreak: true });
    x += colW;
  });
  
  // Draw separator line
  doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.3);
  
  // Draw data rows
  doc.font("body").fontSize(9).fillColor(ACCENT);
  const accuracyText = `±${sensorAccuracy.toFixed(2)}`;
  uniqueSensors.forEach((sensor) => {
    ensureSpace(doc, 28);
    const rowY = doc.y;
    
    // Format dates
    const calibDate = fmtTraceDate(sensor.calibrationDate);
    const nextDate = fmtTraceDate(sensor.nextCalibrationDate);
    const calibrationStatus = getSensorCalibrationStatusAtProtocolDate(
      sensor.nextCalibrationDate,
      protocolDate,
    );

    // Determine status color
    let statusText = "—";
    let statusColor = ACCENT;
    if (calibrationStatus === "expired") {
      statusText = "Истекла";
      statusColor = "#d32f2f"; // Red
    } else if (calibrationStatus === "valid") {
      statusText = "Действительна";
      statusColor = "#388e3c"; // Green
    }
    
    const rowData = [sensor.number, calibDate, nextDate, statusText, accuracyText];
    
    // Draw cells
    x = left;
    Object.values(colWidths).forEach((colW, idx) => {
      doc.fillColor(idx === 3 ? statusColor : ACCENT);
      doc.text(rowData[idx], x, rowY, { width: colW, align: "left", lineBreak: true });
      x += colW;
    });
    
    // Move to next row
    doc.moveDown(1.2);
  });
  
  // Draw bottom border
  doc.moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.5);
}
