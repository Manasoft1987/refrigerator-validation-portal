// PDF report generation for the validation protocol.
// Uses pdfkit for full layout control + chartjs-node-canvas for inline charts.

import PDFDocument from "pdfkit";
import { drawChamberFormulae } from "./chamberFormulae";
import { CHAMBER_MIN_DURATION_HOURS } from "../shared/validation";
import path from "path";
import fs from "fs";
import { buildChamberScene, CHAMBER_POSITIONS, CHAMBER_VIEW, chamberPlacementIssues, chamberMetrologyIssues, chamberFeatures, type ChamberLogger, type ChamberMode } from "../shared/chamberMapping";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  drawColdChart,
  drawChamberLoggerChart,
  drawExcursionChart,
  drawExternalChart,
  drawHeatmapChart,
  drawHotChart,
  drawOverviewChart,
  drawRefrigeratorDiagram,
  drawReeferTruckDiagram3D,
  drawStatsBarChart,
  drawTemperatureMapSummary,
  type DiagramSensor,
  type EventMarker,
} from "./charts";
import { calculateAllOperationalMetrics } from "./operationalMetrics";
import { calculateCriticalLoggerIndices, criticalLoggerScore } from "./pvCriticalPoints";
import {
  computeWarehouseSensorCount,
  DEFAULT_IQ_QUESTIONS_WAREHOUSE,
  DEFAULT_OQ_QUESTIONS_WAREHOUSE,
  findWarehouseChecklistQuestionMatch,
  isAutoRefrigeratorLike,
  isKyrgyzstanAutoRefrigerator,
  isKyrgyzstanWarehouse,
  isWarehouseEaeu,
  isWarehouseLike,
  normalizeWarehouseChecklistQuestion,
  normalizeSensorAccuracyC,
  WAREHOUSE_EXPERT_EQUIPMENT_TYPE,
  WAREHOUSE_MAPPING_METHOD_NOTE,
  PHARMACY_STORAGE_MAPPING_METHOD_NOTE,
} from "../shared/validation";
import type { OperationalMetrics } from "./operationalMetrics";

const PAGE_MARGIN = 56;
const ACCENT = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const SOFT_BG = "#f8fafc";
const WAREHOUSE_MAPPING_DOCUMENT_TITLE_RU =
  "Протокол и отчёт температурного картирования помещения (зоны) хранения лекарственных средств";
const WAREHOUSE_MAPPING_DOCUMENT_TITLE_EN =
  "Storage Room / Area Temperature Mapping Protocol and Report";
const WAREHOUSE_MAPPING_PROTOCOL_TITLE_RU =
  "Протокол температурного картирования помещения (зоны) хранения лекарственных средств";
const WAREHOUSE_MAPPING_PROTOCOL_TITLE_EN =
  "Storage Room / Area Temperature Mapping Protocol";
const WAREHOUSE_MAPPING_REPORT_TITLE_RU =
  "Отчёт температурного картирования помещения (зоны) хранения лекарственных средств";
const WAREHOUSE_MAPPING_REPORT_TITLE_EN =
  "Storage Room / Area Temperature Mapping Report";

type TableOfContentsEntry = {
  title: string;
  page: number;
  level?: number;
};

type ChecklistItem = {
  questionIndex: number;
  questionText: string;
  answer: "yes" | "no" | "na" | "unset";
  comment: string | null;
  updatedAt?: string | Date | null;
};

export function checklistItemsForReport(input: ReportInput, stage: "iq" | "oq"): ChecklistItem[] {
  const sourceItems = stage === "iq" ? input.iq.items : input.oq.items;
  if (!isWarehouseLike(getReportEquipmentType(input)) || isEnglishWarehouse(input)) {
    return sourceItems.filter(item => String(item.questionText ?? "").trim().length > 0);
  }

  const defaults = stage === "iq" ? DEFAULT_IQ_QUESTIONS_WAREHOUSE : DEFAULT_OQ_QUESTIONS_WAREHOUSE;
  const savedItems = sourceItems
    .slice()
    .sort((a, b) => a.questionIndex - b.questionIndex)
    .filter(item => String(item.questionText ?? "").trim().length > 0);
  if (savedItems.length > 0 && !shouldNormalizeLegacyWarehouseChecklist(savedItems, defaults)) {
    return savedItems.map((item, index) => ({ ...item, questionIndex: index }));
  }

  const usedIndexes = new Set<number>();
  return defaults.map((questionText, index) => {
    const matched = findWarehouseChecklistQuestionMatch(savedItems, questionText, usedIndexes);
    const saved = matched?.item;
    if (matched) {
      usedIndexes.add(matched.index);
    }
    return {
      questionIndex: index,
      questionText,
      answer: saved?.answer ?? "unset",
      comment: saved?.comment ?? null,
      updatedAt: saved?.updatedAt ?? null,
    };
  });
}

function shouldNormalizeLegacyWarehouseChecklist(savedItems: ChecklistItem[], defaults: string[]): boolean {
  if (savedItems.length <= defaults.length) return false;

  const normalizedItems = savedItems.map(item => normalizeWarehouseChecklistQuestion(item.questionText));
  const hasDuplicateQuestions = new Set(normalizedItems).size < normalizedItems.length;
  if (!hasDuplicateQuestions) return false;

  const usedIndexes = new Set<number>();
  const matchedDefaults = defaults.filter((questionText) => {
    const matched = findWarehouseChecklistQuestionMatch(savedItems, questionText, usedIndexes);
    if (matched) {
      usedIndexes.add(matched.index);
      return true;
    }
    return false;
  }).length;

  return matchedDefaults >= Math.min(defaults.length, 6);
}

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
    customMin?: string | number | null;
    customMax?: string | number | null;
    reportLanguage?: "ru" | "en" | string | null;
    refrigerationUnits?: Array<{
      manufacturer?: string | null;
      model?: string | null;
      serial?: string | null;
      note?: string | null;
    }> | null;
    thermalContainerConfig?: {
      selectedModes?: string[];
      volumeLiters?: string | number | null;
      innerLengthCm?: string | number | null;
      innerWidthCm?: string | number | null;
      innerHeightCm?: string | number | null;
      insulationType?: string | null;
      thermalElementType?: string | null;
      thermalElementCount?: string | number | null;
      conditioningTemperature?: string | number | null;
      targetDurationHours?: string | number | null;
      loadProfile?: "empty" | "partial" | "full" | null;
      packingNotes?: string | null;
    } | null;
    location: string | null;
    purpose: string | null;
    validationDate: string | null;
    basis: string | null;
    season?: string | null;
    qualificationType?: string | null;
    commissionMembers?: Array<{ name: string; role: string; company?: string | null }> | null;
    // Warehouse / storage zone (EEC Rec. №8)
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
  thermalTrials?: Array<{
    trialKey: string;
    tempMode: string;
    verdict: "pass" | "fail" | "none";
    startAt: number | null;
    endAt: number | null;
    durationHours: number | null;
    targetDurationHours: number;
    internalSensorCount: number;
    failureReasons: string[];
    loggers: Array<{
      label: string;
      customName: string | null;
      role: "internal" | "external";
      min: number | null;
      avg: number | null;
      max: number | null;
      mkt: number | null;
    }>;
  }>;
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
   * Warehouse protocol sections (Рек. ЕЭК №8, разделы 1–7).
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
  attachments?: Array<{
    id?: number;
    kind?: string | null;
    title: string;
    comment?: string | null;
    fileName: string;
    fileUrl?: string | null;
    contentType?: string | null;
    size?: number | null;
    includeInPdf?: number | boolean | null;
    imageBuffer?: Buffer | null;
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
    avg?: number | null;
  }>;
  /** Датчики, используемые для валидации (из базы датчиков) */
  protocolSensors?: Array<{
    id: number;
    number: string;
    calibrationDate: string | Date | null;
    nextCalibrationDate: string | Date | null;
    accuracyC?: string | number | null;
    status?: string;
  }>;
  /** Позиция кондиционера на интерактивной схеме помещения */
  coolingUnitPos?: { x: number; y: number } | null;
  coolingUnitPositions?: Array<{ x: number; y: number }> | null;
  /** Позиция двери на интерактивной схеме */
  doorPos?: { x: number; y: number } | null;
  refrigeratorDrawerCount?: number | null;
  refrigeratorLevelCount?: number | null;
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
    leaderEndXPct?: number | null;
    leaderEndYPct?: number | null;
  }> | null;
  /**
   * Saved PNG screenshot of the FloorPlanEditor (stored in S3).
   * Used only as a fallback when structured plan coordinates are unavailable.
   */
  planImageUrl?: string | Buffer | null;
  /**
   * Clean uploaded room plan/photo used as a background under vector markers.
   */
  planBackgroundImageUrl?: string | Buffer | null;
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
  custom: "Произвольный режим",
};

const EQUIPMENT_LABEL: Record<string, string> = {
  refrigerator: "Холодильник",
  "auto-refrigerator": "Авторефрижератор", // Note: for warehouse protocols, use getEquipmentName() which returns "помещение (зона) хранения"
  "auto-refrigerator-kg": "Авторефрижератор Кыргызстана",
  "thermal-container": "Термоконтейнер",
  freezer: "Морозильник",
  chamber: "Холодильная камера",
  warehouse: "Помещение (зона) хранения аптеки", // Note: use getEquipmentName() for proper display
  "warehouse-kg": "Помещение (зона) хранения Кыргызстана",
  "warehouse-expert": "Помещение (зона) хранения",
  other: "Оборудование",
};

const WAREHOUSE_STUDY_LABEL: Record<string, string> = {
  warehouse: "Помещение (зона) хранения аптеки",
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
  if (input?.protocol?.customEquipmentName === "__equipmentType:chamber" || input?.generalInfo?.equipmentType === "chamber") return "chamber";
  return input?.protocol?.equipmentType || input?.generalInfo?.equipmentType || null;
}

function isEnglishWarehouse(input?: ReportInput): boolean {
  return isWarehouseLike(getReportEquipmentType(input)) && input?.generalInfo?.reportLanguage === "en";
}

function isPharmacyStorageType(type: string | null | undefined): boolean {
  return type === "warehouse" || type === WAREHOUSE_EXPERT_EQUIPMENT_TYPE;
}

function isPharmacyStorageReport(input?: ReportInput): boolean {
  return isPharmacyStorageType(getReportEquipmentType(input));
}

function hasCyrillic(text: string | null | undefined): boolean {
  return /[А-Яа-яЁё]/.test(text || "");
}

function enRu(input: ReportInput | undefined, en: string, ru: string): string {
  return isEnglishWarehouse(input) ? en : ru;
}

const WAREHOUSE_STUDY_LABEL_EN: Record<string, string> = {
  warehouse: "Pharmacy storage room / area",
  controlled_env: "Controlled environment room",
  reception: "Receiving area",
  expedition: "Dispatch area",
  cold_room: "Cold / freezer room within a controlled environment",
};

const SEASON_LABEL_RU: Record<string, string> = {
  warm: "Теплый период",
  cold: "Холодный период",
  interseasonal: "Межсезонье",
  none: "Не применимо",
};

const SEASON_LABEL_EN: Record<string, string> = {
  warm: "Warm season",
  cold: "Cold season",
  interseasonal: "Interseasonal period",
  none: "Not applicable",
};

const QUALIFICATION_LABEL_RU: Record<string, string> = {
  primary: "Первичная",
  periodic: "Периодическая",
  repeat: "Повторная",
};

const QUALIFICATION_LABEL_EN: Record<string, string> = {
  primary: "Initial qualification",
  periodic: "Periodic qualification",
  repeat: "Repeat qualification",
};

const FILL_STATUS_LABEL_RU: Record<string, string> = {
  empty: "Пустой",
  loaded: "Загруженный",
};

const FILL_STATUS_LABEL_EN: Record<string, string> = {
  empty: "Empty",
  loaded: "Loaded",
};

function answerLabel(answer: string | null | undefined, input?: ReportInput): string {
  if (!isEnglishWarehouse(input)) return ANSWER_LABEL[answer || "unset"] || "—";
  return ({ yes: "Yes", no: "No", na: "N/A", unset: "—" } as Record<string, string>)[answer || "unset"] || "—";
}

function verificationTerminology(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/поверку\s*\(калибровку\)/gi, "поверку")
    .replace(/поверке\s*\/\s*калибровке/gi, "поверке")
    .replace(/поверки\s*\/\s*калибровки/gi, "поверки")
    .replace(/поверка\s*\/\s*калибровка/gi, "поверка")
    .replace(/поверенными\s*\(калиброванными\)/gi, "поверенными")
    .replace(/поверенных\s*\(калиброванных\)/gi, "поверенных")
    .replace(/калиброванными\s+датчиками-логгерами/gi, "поверенными датчиками-логгерами")
    .replace(/калиброванных\s+датчиков-логгеров/gi, "поверенных датчиков-логгеров")
    .replace(/калиброванных\s+логгеров/gi, "поверенных логгеров")
    .replace(/калиброванных\s+регистраторов\s+данных/gi, "поверенных регистраторов данных")
    .replace(/сертификат\s+калибровки/gi, "свидетельство о поверке")
    .replace(/сертификатов\s+калибровки\s*\/\s*поверки/gi, "свидетельств о поверке")
    .replace(/сертификатов\s+калибровки\s+или\s+поверки/gi, "свидетельств о поверке")
    .replace(/Calibration of Measuring Instruments/g, "Metrological Verification of Measuring Instruments")
    .replace(/calibrated data loggers/gi, "verified data loggers")
    .replace(/Last calibration date/g, "Last verification date")
    .replace(/Calibration certificate No\./g, "Verification certificate No.");
}

function refrigeratorIqTerminology(text: string | null | undefined, input?: ReportInput): string {
  const value = String(text ?? "");
  if (getReportEquipmentType(input) !== "refrigerator") return value;
  return value
    .replace(
      "Подтвердить, что холодильное оборудование смонтировано и установлено в соответствии с проектной, нормативной и эксплуатационной документацией, а также соответствует требованиям производителя и условиям предполагаемого использования.",
      "Подтвердить, что холодильное оборудование идентифицировано, укомплектовано, размещено в месте эксплуатации, подключено к электропитанию и находится в состоянии, пригодном для дальнейшей квалификации, в соответствии с эксплуатационной документацией производителя, требованиями пользователя и условиями предполагаемого использования.",
    )
    .replace(/\s+\u043a\u0430\u043a \u0433\u043e\u0442\u043e\u0432\u043e\u0435 \u0438\u0437\u0434\u0435\u043b\u0438\u0435\s+/gi, " ")
    .replace(
      "В ходе квалификации монтажа (IQ) проверяется наличие идентификационных бирок и сопроводительной документации, комплектность оборудования, корректность подключения к инженерным сетям, а также соответствие места установки требованиям эксплуатации и проектной документации.",
      "В ходе квалификации монтажа (IQ) проверяется наличие идентификационных бирок и сопроводительной документации, комплектность и внешнее состояние оборудования, корректность размещения в выбранном месте эксплуатации, подключение к электропитанию, а также соответствие условий установки требованиям эксплуатационной документации производителя.",
    )
    .replace(
      "Оборудование установлено, подключено и соответствует требованиям проектной, нормативной и эксплуатационной документации.",
      "Оборудование идентифицировано, укомплектовано, размещено в месте эксплуатации, подключено к электропитанию и пригодно для дальнейшей квалификации в соответствии с эксплуатационной документацией производителя и требованиями пользователя.",
    );
}

function warehouseMappingTerminology(text: string | null | undefined, input?: ReportInput): string {
  const value = String(text ?? "");
  if (!isWarehouseLike(getReportEquipmentType(input))) return value;
  return value
    .replace(
      "В ходе квалификации монтажа (IQ)",
      "В ходе подготовительной проверки IQ (квалификация монтажа)",
    )
    .replace(
      "В ходе квалификации функционирования (OQ)",
      "В ходе подготовительной проверки OQ (квалификация функционирования)",
    )
    .replace(
      "В ходе эксплуатационной квалификации / валидации (PQ/PV) выполняется температурное картирование",
      "В ходе этапа PQ/PV выполняется температурное картирование",
    )
    .replace(
      "эксплуатационной квалификации / валидации (PQ/PV)",
      "этапа PQ/PV",
    );
}

function verdictLabelLocal(verdict: "pass" | "fail" | "none", input?: ReportInput): string {
  if (!isEnglishWarehouse(input)) return verdictLabel(verdict);
  if (verdict === "pass") return "Passed";
  if (verdict === "fail") return "Failed";
  return "Not completed";
}

/** Returns the human-readable equipment name from protocol-level fields (nominative case) */
function getEquipmentName(input: ReportInput): string {
  const type = getReportEquipmentType(input);
  if (type === "other" && input.protocol?.customEquipmentName) {
    return input.protocol.customEquipmentName;
  }
  // For storage protocols, use the selected pharmacy/warehouse object name instead of equipment terminology.
  if (isWarehouseLike(type)) {
    if (isEnglishWarehouse(input)) return isPharmacyStorageType(type) ? "pharmacy storage room / area" : "storage room / storage area";
    if (isKyrgyzstanWarehouse(type)) return "помещение (зона) хранения Кыргызстана";
    return isPharmacyStorageType(type) ? "помещение (зона) хранения аптеки" : "помещение (зона) хранения";
  }
  return EQUIPMENT_LABEL[type || ""] || "Оборудование";
}

/** Returns equipment name with proper Russian case declension */
function getEquipmentNameWithCase(input: ReportInput, gramCase: "nominative" | "genitive" | "accusative" | "instrumental" = "nominative"): string {
  const type = getReportEquipmentType(input);
  if (type === "other" && input.protocol?.customEquipmentName) {
    return input.protocol.customEquipmentName;
  }
  if (isKyrgyzstanAutoRefrigerator(type)) {
    switch (gramCase) {
      case "genitive": return "авторефрижератора Кыргызстана";
      case "accusative": return "авторефрижератор Кыргызстана";
      case "instrumental": return "авторефрижератором Кыргызстана";
      case "nominative":
      default: return "Авторефрижератор Кыргызстана";
    }
  }
  if (isWarehouseLike(type)) {
    if (isKyrgyzstanWarehouse(type)) {
      switch (gramCase) {
        case "genitive": return "помещения (зоны) хранения Кыргызстана";
        case "accusative": return "помещение (зону) хранения Кыргызстана";
        case "instrumental": return "помещением (зоной) хранения Кыргызстана";
        case "nominative":
        default: return "Помещение (зона) хранения Кыргызстана";
      }
    }
    if (isPharmacyStorageType(type)) {
      switch (gramCase) {
        case "genitive": return "помещения (зоны) хранения аптеки";
        case "accusative": return "помещение (зону) хранения аптеки";
        case "instrumental": return "помещением (зоной) хранения аптеки";
        case "nominative":
        default: return "помещение (зона) хранения аптеки";
      }
    }
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
  return isAutoRefrigeratorLike(type) || type === "chamber" || type === "thermal-container";
}

function isRefrigeratorCabinetLike(type: string | null | undefined): boolean {
  return type === "refrigerator" || type === "freezer";
}

function reeferSubject(type: string | null | undefined): string {
  if (type === "thermal-container") return "Термоконтейнер";
  if (type === "chamber") return "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u043c\u0435\u0440\u0430";
  if (type === "refrigerator") return "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a";
  if (type === "freezer") return "\u041c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a";
  return "\u0410\u0432\u0442\u043e\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440";
}

function reeferArea(type: string | null | undefined): string {
  if (type === "thermal-container") return "термоконтейнер";
  if (type === "chamber") return "\u043a\u0430\u043c\u0435\u0440\u0430";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a";
  return "\u043a\u0443\u0437\u043e\u0432";
}

function reeferAreaGenitive(type: string | null | undefined): string {
  if (type === "thermal-container") return "термоконтейнера";
  if (type === "chamber") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0439 \u043a\u0430\u043c\u0435\u0440\u044b";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  return "\u043a\u0443\u0437\u043e\u0432\u0430 \u0430\u0432\u0442\u043e\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440\u0430";
}

function reeferInsideVolume(type: string | null | undefined): string {
  if (type === "thermal-container") return "термоконтейнера";
  if (type === "chamber") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0439 \u043a\u0430\u043c\u0435\u0440\u044b";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a\u0430";
  return "\u043a\u0443\u0437\u043e\u0432\u0430 \u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440\u0430";
}

function reeferAreaAfterIn(type: string | null | undefined): string {
  if (type === "thermal-container") return "термоконтейнере";
  if (type === "chamber") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0439 \u043a\u0430\u043c\u0435\u0440\u0435";
  if (type === "refrigerator") return "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a\u0435";
  if (type === "freezer") return "\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a\u0435";
  return reeferAreaGenitive(type);
}

function reeferLocationLabel(type: string | null | undefined): string {
  if (type === "thermal-container") return "Место подготовки и эксплуатации";
  return type === "chamber" ? "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u043c\u0435\u0440\u0430 / \u043c\u0435\u0441\u0442\u043e \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438" : "\u0422\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442\u043d\u043e\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043e / \u0433\u043e\u0441. \u043d\u043e\u043c\u0435\u0440";
}

function reeferUnitLabel(type: string | null | undefined): string {
  if (type === "thermal-container") return "Производитель / модель";
  return type === "chamber" ? "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 / \u0430\u0433\u0440\u0435\u0433\u0430\u0442" : "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430";
}

type RefrigerationUnitInfo = {
  manufacturer?: string | null;
  model?: string | null;
  serial?: string | null;
  note?: string | null;
};

function safeTrim(value: unknown): string {
  return String(value ?? "").trim();
}

function getRefrigerationUnits(input: ReportInput): RefrigerationUnitInfo[] {
  const rawUnits = Array.isArray((input.generalInfo as any)?.refrigerationUnits)
    ? (input.generalInfo as any).refrigerationUnits
    : [];
  const units = rawUnits
    .map((unit: any) => ({
      manufacturer: safeTrim(unit?.manufacturer),
      model: safeTrim(unit?.model),
      serial: safeTrim(unit?.serial),
      note: safeTrim(unit?.note),
    }))
    .filter((unit: RefrigerationUnitInfo) => unit.manufacturer || unit.model || unit.serial || unit.note)
    .slice(0, 2);
  if (units.length > 0) return units;

  const legacy = {
    manufacturer: safeTrim(input.generalInfo?.manufacturer),
    model: safeTrim(input.generalInfo?.model),
    serial: safeTrim(input.generalInfo?.serial),
    note: "",
  };
  return legacy.manufacturer || legacy.model || legacy.serial ? [legacy] : [];
}

function formatRefrigerationUnit(unit: RefrigerationUnitInfo): string {
  const model = [unit.manufacturer, unit.model].map(safeTrim).filter(Boolean).join(" ");
  const serial = safeTrim(unit.serial);
  const note = safeTrim(unit.note);
  const parts = [
    model || "—",
    serial ? `сер. № ${serial}` : "",
    note ? `расположение: ${note}` : "",
  ].filter(Boolean);
  return parts.join("; ");
}

function reeferConclusionObject(input: ReportInput): string {
  const units = getRefrigerationUnits(input);
  const unit = units.length > 1
    ? units.map((item, idx) => `№${idx + 1}: ${formatRefrigerationUnit(item)}`).join("; ")
    : ((input.generalInfo?.manufacturer || "") + " " + (input.generalInfo?.model || "")).trim();
  const serial = units.length > 1 ? "см. перечень агрегатов" : (input.generalInfo?.serial || "\u2014");
  const type = getReportEquipmentType(input);
  const withUnit = (obj: string) => obj + " \u0441 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435\u043c \u00ab" + unit + "\u00bb (\u0441\u0435\u0440. \u2116 " + serial + ")";
  if (type === "chamber") return withUnit("\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0443\u044e \u043a\u0430\u043c\u0435\u0440\u0443");
  if (type === "refrigerator") return withUnit("\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a");
  if (type === "freezer") return withUnit("\u043c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a");
  if (type === "thermal-container") return withUnit("термоконтейнер");
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

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function temperatureModeLabel(mode: string | null | undefined, customMin?: unknown, customMax?: unknown, input?: ReportInput): string {
  if (mode === "custom") {
    const min = numericOrNull(customMin);
    const max = numericOrNull(customMax);
    if (min !== null && max !== null) return `${fmtTempRange(min, max)} (${enRu(input, "custom mode", "произвольный режим")})`;
  }
  return TEMP_MODE_LABEL[mode || ""] || mode || "—";
}

function pvTemperatureModeLabel(pv: ReportInput["pv"], input?: ReportInput): string {
  if (pv.tempMode === "custom") {
    const min = pv.rawRangeMin ?? null;
    const max = pv.rawRangeMax ?? null;
    if (min !== null && max !== null) return `${fmtTempRange(min, max)} (${enRu(input, "custom mode", "произвольный режим")})`;
  }
  return temperatureModeLabel(pv.tempMode, null, null, input);
}

function sensorAccuracyRows(pv: ReportInput["pv"], input?: ReportInput): Array<[string, string]> {
  if (pv.sensorAccuracy === undefined || pv.sensorAccuracy === null) return [];
  const rawMin = pv.rawRangeMin ?? pv.rangeMin - pv.sensorAccuracy;
  const rawMax = pv.rawRangeMax ?? pv.rangeMax + pv.sensorAccuracy;
  return [
    [enRu(input, "Nominal temperature range", "Номинальный температурный диапазон"), fmtTempRange(rawMin, rawMax)],
    [enRu(input, "Sensor accuracy applied in calculations", "Погрешность датчиков, учитываемая в расчётах"), `±${pv.sensorAccuracy.toFixed(1)} °C`],
    [enRu(input, "Calculated range with accuracy allowance", "Расчётный диапазон с учётом погрешности"), fmtTempRange(pv.rangeMin, pv.rangeMax)],
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

/**
 * The PV data-entry record describes completion of the PV study, not the
 * date when the general-information form was filled in. Prefer an explicitly
 * entered report date; otherwise use the end of the PV test window.
 */
function getPvCompletionDate(input: ReportInput): Date | null {
  return (
    coerceDate(input.reportDate) ??
    coerceDate(input.pv.endAt) ??
    latestDate([
      input.pv.updatedAt,
      ...input.pv.loggers.map(logger => logger.createdAt),
    ])
  );
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
  const warehouse = isWarehouseLike(getReportEquipmentType(input));
  if (stage === "IQ") {
    return {
      stage,
      label: warehouse
        ? "IQ — ввод данных и опросник подготовительной проверки монтажа"
        : "IQ — ввод данных и опросник квалификации монтажа",
      completedBy: preparedBy,
      completedAt: latestDate(input.iq.items.map(item => item.updatedAt)) ?? fallbackDate,
      source: "Записи чек-листа IQ",
    };
  }
  if (stage === "OQ") {
    return {
      stage,
      label: warehouse
        ? "OQ — ввод данных и опросник подготовительной проверки функционирования"
        : "OQ — ввод данных и опросник квалификации функционирования",
      completedBy: preparedBy,
      completedAt: latestDate(input.oq.items.map(item => item.updatedAt)) ?? fallbackDate,
      source: "Записи чек-листа OQ",
    };
  }
  return {
    stage,
    label: warehouse
      ? "PQ/PV — ввод данных температурного картирования"
      : "PQ/PV — ввод данных эксплуатационной квалификации",
    completedBy: preparedBy,
    completedAt: getPvCompletionDate(input) ?? fallbackDate,
    source: "Параметры PQ/PV и загруженные файлы логгеров",
  };
}

/**
 * Returns the last 4 characters of a sensor label for use in table column headers.
 * e.g. "230609STS0013707" → "3707", "D1" → "D1" (unchanged when ≤4 chars).
 * If customName is provided, appends it on a new line.
 */
function shortLabel(label: string, customName?: string | null): string {
  return shortSensorId(label) || shortSensorId(customName) || label || customName || "";
}

function normalizeSensorNumber(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function formatDiagramAverageTemp(value: number | string | null | undefined): string | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return null;
  return `${n.toFixed(1).replace(".", ",")} °C`;
}

function shortSensorId(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length >= 4) return compact.slice(-4);
  return raw.length > 4 ? raw.slice(-4) : raw;
}

function buildSensorAverageMap(input: ReportInput): Map<string, string> {
  const map = new Map<string, string>();
  const add = (label: string | null | undefined, avg: number | string | null | undefined) => {
    const formatted = formatDiagramAverageTemp(avg);
    if (!formatted) return;
    const normalized = normalizeSensorNumber(label);
    if (!normalized) return;
    map.set(normalized, formatted);
    const shortId = normalizeSensorNumber(shortSensorId(label));
    if (shortId) map.set(shortId, formatted);
  };

  input.pv.loggers.forEach(logger => {
    add(logger.label, logger.avg);
    add(logger.customName, logger.avg);
  });
  input.pvLoggers?.forEach(logger => {
    add(logger.label, logger.avg);
    add(logger.customName, logger.avg);
  });

  return map;
}

function buildSensorAverageNumberMap(input: ReportInput): Map<string, number> {
  const map = new Map<string, number>();
  const add = (label: string | null | undefined, avg: number | string | null | undefined) => {
    const numeric = finiteNumberOrNull(avg);
    if (numeric === null) return;
    const normalized = normalizeSensorNumber(label);
    if (!normalized) return;
    map.set(normalized, numeric);
    const shortId = normalizeSensorNumber(shortSensorId(label));
    if (shortId) map.set(shortId, numeric);
  };

  input.pv.loggers.forEach(logger => {
    add(logger.label, logger.avg);
    add(logger.customName, logger.avg);
  });
  input.pvLoggers?.forEach(logger => {
    add(logger.label, logger.avg);
    add(logger.customName, logger.avg);
  });

  return map;
}

function sensorLabelWithAverage(label: string | null | undefined, avgBySensor: Map<string, string>): string {
  const shortId = shortSensorId(label) || "D";
  const direct = normalizeSensorNumber(label);
  const avg = avgBySensor.get(direct) ?? avgBySensor.get(normalizeSensorNumber(shortId));
  return avg ? `${shortId} (${avg})` : shortId;
}

function sensorTokenVariants(value: string | number | null | undefined): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const tokens = new Set<string>();
  const compact = normalizeSensorNumber(raw);
  if (compact) tokens.add(compact);
  const compactAlnum = raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (compactAlnum) tokens.add(compactAlnum);
  if (compactAlnum.length >= 4) tokens.add(compactAlnum.slice(-4));
  const digits = raw.replace(/\D/g, "");
  if (digits) tokens.add(digits);
  if (digits.length >= 4) tokens.add(digits.slice(-4));
  return Array.from(tokens);
}

function tokenSetsIntersect(a: Iterable<string>, b: Iterable<string>): boolean {
  const bSet = new Set(b);
  for (const token of a) {
    if (bSet.has(token)) return true;
  }
  return false;
}

function buildWarehouseCriticalSensorTokens(input: ReportInput): { hot: Set<string>; cold: Set<string> } {
  const add = (set: Set<string>, value: string | number | null | undefined) => {
    for (const token of sensorTokenVariants(value)) set.add(token);
  };
  const addSummaryLogger = (
    set: Set<string>,
    logger: { label?: string | null; customName?: string | null; position?: string | null } | undefined | null,
  ) => {
    if (!logger) return;
    add(set, logger.label);
    add(set, logger.customName);
    add(set, logger.position);
  };
  const addMatchingPvLoggerPositions = (set: Set<string>) => {
    const current = Array.from(set);
    for (const logger of input.pvLoggers ?? []) {
      const tokens = [
        ...sensorTokenVariants(logger.label),
        ...sensorTokenVariants(logger.customName),
      ];
      if (tokenSetsIntersect(current, tokens)) {
        add(set, logger.label);
        add(set, logger.customName);
        add(set, logger.position);
      }
    }
  };

  const hot = new Set<string>();
  const cold = new Set<string>();
  // Warehouse critical markers should follow PV risk, not only the average
  // shown in the label: deviations first, then extremes/MKT/AVG. Stored
  // hotIdx/coldIdx can become stale after logger deletion or re-upload.
  const currentCritical = calculateCriticalLoggerIndices(input.pv.loggers);
  const hottestByRisk = currentCritical.hotIdx !== null ? input.pv.loggers[currentCritical.hotIdx] : null;
  const coldestByRisk = currentCritical.coldIdx !== null ? input.pv.loggers[currentCritical.coldIdx] : null;
  const currentInternalPlanLoggers = (input.pvLoggers ?? [])
    .filter(logger => logger.role === "internal" && Number.isFinite(Number(logger.avg)));

  if (hottestByRisk || coldestByRisk) {
    addSummaryLogger(hot, hottestByRisk);
    addSummaryLogger(cold, coldestByRisk);
  } else if (currentInternalPlanLoggers.length > 0) {
    const hottest = currentInternalPlanLoggers.reduce((best, logger) => (
      Number(logger.avg) > Number(best.avg) ? logger : best
    ), currentInternalPlanLoggers[0]);
    const coldest = currentInternalPlanLoggers.reduce((best, logger) => (
      Number(logger.avg) < Number(best.avg) ? logger : best
    ), currentInternalPlanLoggers[0]);
    addSummaryLogger(hot, hottest);
    addSummaryLogger(cold, coldest);
  } else {
    addSummaryLogger(hot, input.pv.hotIdx !== null ? input.pv.loggers[input.pv.hotIdx] : null);
    addSummaryLogger(cold, input.pv.coldIdx !== null ? input.pv.loggers[input.pv.coldIdx] : null);
  }
  addMatchingPvLoggerPositions(hot);
  addMatchingPvLoggerPositions(cold);
  return { hot, cold };
}

function buildWarehouseSensorTokensByRole(input: ReportInput, role: string): Set<string> {
  const tokens = new Set<string>();
  const add = (value: string | number | null | undefined) => {
    for (const token of sensorTokenVariants(value)) tokens.add(token);
  };
  for (const logger of input.pv.loggers ?? []) {
    if (logger.role !== role) continue;
    add(logger.label);
    add(logger.customName);
  }
  for (const logger of input.pvLoggers ?? []) {
    if (logger.role !== role) continue;
    add(logger.label);
    add(logger.customName);
    add(logger.position);
  }
  return tokens;
}

function floorSensorPointMatchesTokens(
  sp: { id?: string; label?: string | null },
  tokens: Set<string>,
): boolean {
  if (tokens.size === 0) return false;
  return tokenSetsIntersect([
    ...sensorTokenVariants(sp.id),
    ...sensorTokenVariants(sp.label),
  ], tokens);
}

function drawPdfStar(doc: PDFKit.PDFDocument, cx: number, cy: number, size: number, color: string): void {
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? size : size * 0.42;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  doc.save();
  doc.fillColor(color).strokeColor("#ffffff").lineWidth(0.9).polygon(...points).fillAndStroke();
  doc.restore();
}

function drawPdfDiamond(doc: PDFKit.PDFDocument, cx: number, cy: number, size: number, color: string): void {
  const points: [number, number][] = [
    [cx, cy - size],
    [cx + size, cy],
    [cx, cy + size],
    [cx - size, cy],
  ];
  doc.save();
  doc.fillColor(color).strokeColor("#ffffff").lineWidth(0.9).polygon(...points).fillAndStroke();
  doc.restore();
}

function drawPdfArrowHead(
  doc: PDFKit.PDFDocument,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number,
  color: string,
): void {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const wing = size * 0.58;
  const backX = toX - Math.cos(angle) * size;
  const backY = toY - Math.sin(angle) * size;
  const points: [number, number][] = [
    [toX, toY],
    [backX + Math.sin(angle) * wing, backY - Math.cos(angle) * wing],
    [backX - Math.sin(angle) * wing, backY + Math.cos(angle) * wing],
  ];
  doc.save();
  doc.fillColor(color).strokeColor(color).lineWidth(0.5).polygon(...points).fillAndStroke();
  doc.restore();
}

type WarehouseMarkerBox = { x: number; y: number; w: number; h: number };

function warehouseClamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function warehouseTemperatureColor(value: number, lo: number, hi: number): string {
  const t = warehouseClamp01((value - lo) / (hi - lo || 1));
  const stops = [
    { at: 0.00, rgb: [37, 99, 235] },
    { at: 0.24, rgb: [6, 182, 212] },
    { at: 0.50, rgb: [34, 197, 94] },
    { at: 0.74, rgb: [250, 204, 21] },
    { at: 1.00, rgb: [239, 68, 68] },
  ];
  let left = stops[0];
  let right = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      left = stops[i];
      right = stops[i + 1];
      break;
    }
  }
  const k = (t - left.at) / (right.at - left.at || 1);
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  const r = left.rgb[0] + (right.rgb[0] - left.rgb[0]) * k;
  const g = left.rgb[1] + (right.rgb[1] - left.rgb[1]) * k;
  const b = left.rgb[2] + (right.rgb[2] - left.rgb[2]) * k;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function warehouseTemperatureOverlayRange(values: number[]): { lo: number; hi: number } | null {
  const finiteValues = values.filter(value => Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const span = max - min;
  const margin = Math.max(0.15, span * 0.06);
  if (span < 0.2) {
    return { lo: min - 0.35, hi: max + 0.35 };
  }
  return { lo: min - margin, hi: max + margin };
}

function drawWarehouseTemperatureOverlay(
  doc: PDFKit.PDFDocument,
  plan: WarehouseMarkerBox,
  points: Array<{ x: number; y: number; avg: number }>,
  opacity = 0.9,
): { lo: number; hi: number } | null {
  const finitePoints = points.filter(point =>
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.avg),
  );
  const range = warehouseTemperatureOverlayRange(finitePoints.map(point => point.avg));
  if (!range) return null;
  const minSide = Math.min(plan.w, plan.h);
  const baseRadius = Math.max(44, Math.min(112, minSide * 0.23));
  const rings = 24;
  const midTemp = range.lo + (range.hi - range.lo) / 2;

  doc.save();
  doc.rect(plan.x, plan.y, plan.w, plan.h).clip();

  // Keep the neutral wash subtle so the warm/cold fields remain saturated and
  // the underlying plan is still clearly visible.
  doc.opacity(0.035).fillColor(warehouseTemperatureColor(midTemp, range.lo, range.hi))
    .rect(plan.x, plan.y, plan.w, plan.h)
    .fill();

  // Draw local radial temperature fields around the actual measurement points.
  // This prevents a high/low corner from appearing in empty space when the
  // label bubble is offset from the true point by a leader arrow.
  const orderedPoints = [...finitePoints].sort((a, b) => Math.abs(a.avg - midTemp) - Math.abs(b.avg - midTemp));
  for (const point of orderedPoints) {
    const color = warehouseTemperatureColor(point.avg, range.lo, range.hi);
    for (let ring = rings; ring >= 1; ring -= 1) {
      const k = ring / rings;
      const radius = baseRadius * k;
      const ringOpacity = opacity * (0.012 + Math.pow(1 - k, 1.55) * 0.17);
      doc.opacity(ringOpacity).fillColor(color).circle(point.x, point.y, radius).fill();
    }
    doc.opacity(Math.min(0.96, opacity * 0.96)).fillColor(color)
      .circle(point.x, point.y, Math.max(7, baseRadius * 0.10))
      .fill();
  }
  doc.restore();
  return range;
}

function drawWarehouseTemperatureLegend(
  doc: PDFKit.PDFDocument,
  plan: WarehouseMarkerBox,
  range: { lo: number; hi: number },
): void {
  const barW = Math.min(260, plan.w * 0.5);
  const barH = 7;
  const x = plan.x + (plan.w - barW) / 2;
  const y = plan.y + plan.h + 8;
  const segments = 64;
  doc.save();
  for (let i = 0; i < segments; i += 1) {
    const t = i / Math.max(1, segments - 1);
    const value = range.lo + (range.hi - range.lo) * t;
    doc.fillColor(warehouseTemperatureColor(value, range.lo, range.hi))
      .rect(x + (i / segments) * barW, y, barW / segments + 0.6, barH)
      .fill();
  }
  doc.strokeColor("#cbd5e1").lineWidth(0.4).rect(x, y, barW, barH).stroke();
  doc.fillColor(MUTED).font("body").fontSize(6.5)
    .text(`${fmtPlainNumber(range.lo, 1)} °C`, x, y + barH + 2, { width: 46, align: "left", lineBreak: false })
    .text(`${fmtPlainNumber(range.hi, 1)} °C`, x + barW - 46, y + barH + 2, { width: 46, align: "right", lineBreak: false });
  doc.restore();
}

function warehouseMarkerBox(cx: number, cy: number, radius: number): WarehouseMarkerBox {
  return { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
}

function warehouseBoxesOverlap(a: WarehouseMarkerBox, b: WarehouseMarkerBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function chooseWarehouseCriticalMarkerPosition(
  candidates: Array<[number, number]>,
  plan: WarehouseMarkerBox,
  occupied: WarehouseMarkerBox[],
  markerRadius: number,
): [number, number] {
  let fallback: [number, number] | null = null;
  for (const [rawX, rawY] of candidates) {
    const x = Math.max(plan.x + markerRadius, Math.min(plan.x + plan.w - markerRadius, rawX));
    const y = Math.max(plan.y + markerRadius, Math.min(plan.y + plan.h - markerRadius, rawY));
    fallback ??= [x, y];
    const box = warehouseMarkerBox(x, y, markerRadius + 1);
    if (!occupied.some(item => warehouseBoxesOverlap(box, item))) {
      return [x, y];
    }
  }
  return fallback ?? [plan.x + markerRadius, plan.y + markerRadius];
}

function chooseWarehouseFloatingLabelPosition(
  candidates: Array<[number, number]>,
  plan: WarehouseMarkerBox,
  occupied: WarehouseMarkerBox[],
  labelW: number,
  labelH: number,
): WarehouseMarkerBox {
  let fallback: WarehouseMarkerBox | null = null;
  const desired = candidates[0] ?? [plan.x + 2, plan.y + 2];
  for (const [rawX, rawY] of candidates) {
    const x = Math.max(plan.x + 2, Math.min(plan.x + plan.w - labelW - 2, rawX));
    const y = Math.max(plan.y + 2, Math.min(plan.y + plan.h - labelH - 2, rawY));
    const box = { x, y, w: labelW, h: labelH };
    fallback ??= box;
    if (!occupied.some(item => warehouseBoxesOverlap(box, item))) {
      return box;
    }
  }

  let nearest: WarehouseMarkerBox | null = null;
  let nearestDistance = Infinity;
  const desiredX = Math.max(plan.x + 2, Math.min(plan.x + plan.w - labelW - 2, desired[0]));
  const desiredY = Math.max(plan.y + 2, Math.min(plan.y + plan.h - labelH - 2, desired[1]));
  for (let y = plan.y + 2; y <= plan.y + plan.h - labelH - 2; y += 10) {
    for (let x = plan.x + 2; x <= plan.x + plan.w - labelW - 2; x += 12) {
      const box = { x, y, w: labelW, h: labelH };
      if (occupied.some(item => warehouseBoxesOverlap(box, item))) continue;
      const distance = (x - desiredX) ** 2 + (y - desiredY) ** 2;
      if (distance < nearestDistance) {
        nearest = box;
        nearestDistance = distance;
      }
    }
  }
  if (nearest) return nearest;
  return fallback ?? { x: plan.x + 2, y: plan.y + 2, w: labelW, h: labelH };
}

function chooseWarehouseBubblePosition(
  baseX: number,
  baseY: number,
  radius: number,
  plan: WarehouseMarkerBox,
  occupied: WarehouseMarkerBox[],
): [number, number] {
  const bubbleBox = (x: number, y: number) => warehouseMarkerBox(x, y, radius + 3);
  const clampX = (x: number) => Math.max(plan.x + radius + 5, Math.min(plan.x + plan.w - radius - 5, x));
  const clampY = (y: number) => Math.max(plan.y + radius + 5, Math.min(plan.y + plan.h - radius - 5, y));
  const offsets: Array<[number, number]> = [
    [0, 0],
    [radius * 2.4, 0],
    [-radius * 2.4, 0],
    [0, radius * 2.4],
    [0, -radius * 2.4],
    [radius * 2.2, radius * 2.2],
    [-radius * 2.2, radius * 2.2],
    [radius * 2.2, -radius * 2.2],
    [-radius * 2.2, -radius * 2.2],
    [radius * 4.0, 0],
    [-radius * 4.0, 0],
    [0, radius * 4.0],
    [0, -radius * 4.0],
  ];
  let fallback: [number, number] = [clampX(baseX), clampY(baseY)];
  for (const [dx, dy] of offsets) {
    const x = clampX(baseX + dx);
    const y = clampY(baseY + dy);
    const box = bubbleBox(x, y);
    fallback = [x, y];
    if (!occupied.some(item => warehouseBoxesOverlap(box, item))) {
      return [x, y];
    }
  }

  let nearest: [number, number] | null = null;
  let nearestDistance = Infinity;
  const step = Math.max(10, radius * 1.7);
  for (let y = plan.y + radius + 5; y <= plan.y + plan.h - radius - 5; y += step) {
    for (let x = plan.x + radius + 5; x <= plan.x + plan.w - radius - 5; x += step) {
      const box = bubbleBox(x, y);
      if (occupied.some(item => warehouseBoxesOverlap(box, item))) continue;
      const distance = (x - baseX) ** 2 + (y - baseY) ** 2;
      if (distance < nearestDistance) {
        nearest = [x, y];
        nearestDistance = distance;
      }
    }
  }
  return nearest ?? fallback;
}

function buildActiveSensorTokens(input: ReportInput): Set<string> {
  const tokens = new Set<string>();
  const add = (value: string | null | undefined) => {
    const token = normalizeSensorNumber(value);
    if (!token) return;
    tokens.add(token);
    const shortToken = normalizeSensorNumber(shortSensorId(value));
    if (shortToken) tokens.add(shortToken);
  };

  input.pv.loggers.forEach(logger => {
    add(logger.label);
    add(logger.customName);
  });
  input.pvLoggers?.forEach(logger => {
    add(logger.label);
    add(logger.customName);
  });
  input.excursion?.loggers.forEach(logger => add(logger.label));
  input.floorPlanObjects?.forEach(obj => {
    if (obj.type === "sensor_point") add(obj.label);
    obj.sensors?.forEach(sensor => add(sensor.sensorId));
  });

  return tokens;
}

export function filterProtocolSensorsForReport(input: ReportInput): ReportInput["protocolSensors"] {
  const protocolSensors = input.protocolSensors ?? [];
  if (protocolSensors.length === 0) return protocolSensors;

  const activeTokens = buildActiveSensorTokens(input);
  if (activeTokens.size === 0) return protocolSensors;

  return protocolSensors.filter(sensor => {
    const number = normalizeSensorNumber(sensor.number);
    if (!number) return false;
    const shortNumber = normalizeSensorNumber(shortSensorId(sensor.number));
    return activeTokens.has(number) || Boolean(shortNumber && activeTokens.has(shortNumber));
  });
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
      Title: `${isWarehouseLike(getReportEquipmentType(input))
        ? (isEnglishWarehouse(input) ? WAREHOUSE_MAPPING_DOCUMENT_TITLE_EN : WAREHOUSE_MAPPING_DOCUMENT_TITLE_RU)
        : (isEnglishWarehouse(input) ? "Qualification Protocol and Report" : "Протокол валидации")} ${input.protocol.number}`,
      Author: input.org.name,
      Subject: isWarehouseLike(getReportEquipmentType(input))
        ? (isEnglishWarehouse(input)
            ? "Pharmacy storage room / area temperature mapping protocol and report"
            : "Температурное картирование помещения (зоны) хранения лекарственных средств")
        : isEnglishWarehouse(input)
        ? "Storage area temperature mapping qualification protocol and report"
        : "Протокол квалификации/валидации холодильного оборудования",
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
  if (getReportEquipmentType(input) === "chamber") {
    drawChamberMappingReport(doc, input);
    addHeadersAndFooters(doc, input);
    doc.end();
    return done;
  }
  const isWarehouseDoc = isWarehouseLike(getReportEquipmentType(input));
  const tocEntries: TableOfContentsEntry[] = [];
  let tableOfContentsPageIndex: number | null = null;
  const currentPageNumber = () => {
    const range = doc.bufferedPageRange();
    return range.start + range.count;
  };
  const recordToc = (title: string, level = 0) => {
    if (!isWarehouseDoc) return;
    tocEntries.push({ title, page: currentPageNumber(), level });
  };

  drawPartCover(doc, input, "part1");
  if (isWarehouseDoc) {
    recordToc(isEnglishWarehouse(input) ? "PART I. Protocol" : "ЧАСТЬ I. Протокол");
    doc.addPage();
    tableOfContentsPageIndex = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
    // ── WAREHOUSE PART I: sections 1–7 per EEC Rec. #8 ───────────────────────
    drawWarehouseProtocolPart1(doc, input, recordToc);
  } else {
    // ── STANDARD PART I ──────────────────────────────────────────────────────
    doc.addPage();
    drawSectionTitle(doc, "1. Общие сведения об оборудовании");
    drawGeneralInfoTable(doc, input);
    drawRevisionHistorySection(doc, input);
    
    // Draw only sensors still present in the final protocol data.
    // Historical protocol_sensors links can remain after a logger is deleted.
    const reportSensors = filterProtocolSensorsForReport(input);
    if (reportSensors && reportSensors.length > 0) {
        doc.addPage();
        drawSectionTitle(doc, "1.1. Датчики, используемые для валидации");
      drawSensorTable(
        doc,
        reportSensors,
        input.pv.sensorAccuracy,
        resolveProtocolReferenceDate(input.generalInfo?.validationDate, input.protocol.createdAt),
      );
    }

    if (isWarehouseLike(getReportEquipmentType(input)) && input.warehouseEquipment && input.warehouseEquipment.length > 0) {
      doc.addPage();
      drawWarehouseEquipmentList(doc, input, "1.2.");
    }
    
    doc.addPage();
    drawSectionTitle(doc, "2. План IQ — Квалификация монтажа");
    drawStageBlocks(doc, input.iq, input);
    drawChecklistPlan(doc, checklistItemsForReport(input, "iq"), input);
    doc.addPage();
    drawSectionTitle(doc, "3. План OQ — Квалификация функционирования");
    drawStageBlocks(doc, input.oq, input);
    drawChecklistPlan(doc, checklistItemsForReport(input, "oq"), input);
    doc.addPage();
    drawSectionTitle(doc, "4. План PQ/PV — Эксплуатационная квалификация / валидация");
    drawStageBlocks(doc, input.pv, input);
    drawPVPlan(doc, input.pv, input);
    drawPVPlacementPlan(doc, input);
    doc.addPage();
    drawSectionTitle(doc, "5. Подписи к Протоколу");
    drawSignaturesBlock(doc, getSignatoriesPart1(input), "Настоящий протокол квалификации рассмотрен и утверждён:", input);
  }

  /* ============================================================ */
  /* ЧАСТЬ II — ОТЧЁТ О КВАЛИФИКАЦИИ (РЕЗУЛЬТАТЫ)        */
  /* ============================================================ */
  doc.addPage();
  recordToc(isEnglishWarehouse(input) ? "PART II. Report" : "ЧАСТЬ II. Отчёт");
  drawPartCover(doc, input, "part2");

  doc.addPage();
  recordToc(isEnglishWarehouse(input) ? "6. Test Period" : "6. Период проведения испытаний", 1);
  drawSectionTitle(doc, isEnglishWarehouse(input) ? "6. Test Period" : "6. Период проведения испытаний");
  drawTestPeriod(doc, input);

  doc.addPage();
  recordToc(
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? "7. IQ Results - Installation Qualification"
          : "7. Результаты IQ — квалификация монтажа")
      : isEnglishWarehouse(input)
        ? "7. IQ Results - Installation Qualification"
        : "7. Результаты IQ — Квалификация монтажа",
    1,
  );
  drawSectionTitle(
    doc,
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? "7. IQ Readiness Check Results - Installation Qualification"
          : "7. Результаты подготовительной проверки IQ — квалификация монтажа")
      : isEnglishWarehouse(input)
        ? "7. IQ Results - Installation Qualification"
        : "7. Результаты IQ — Квалификация монтажа",
  );
  const iqItems = checklistItemsForReport(input, "iq");
  drawStageDataEntryTable(doc, input, "IQ");
  drawChecklistTable(doc, iqItems, input);
  drawStageVerdict(doc, "IQ", input.iq.verdict, iqItems, input);

  doc.addPage();
  recordToc(
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? "8. OQ Results - Operational Qualification"
          : "8. Результаты OQ — квалификация функционирования")
      : isEnglishWarehouse(input)
        ? "8. OQ Results - Operational Qualification"
        : "8. Результаты OQ — Квалификация функционирования",
    1,
  );
  drawSectionTitle(
    doc,
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? "8. OQ Readiness Check Results - Operational Qualification"
          : "8. Результаты подготовительной проверки OQ — квалификация функционирования")
      : isEnglishWarehouse(input)
        ? "8. OQ Results - Operational Qualification"
        : "8. Результаты OQ — Квалификация функционирования",
  );
  const oqItems = checklistItemsForReport(input, "oq");
  drawStageDataEntryTable(doc, input, "OQ");
  drawChecklistTable(doc, oqItems, input);
  drawStageVerdict(doc, "OQ", input.oq.verdict, oqItems, input);

  doc.addPage();
  recordToc(
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? "9. PQ/PV Results - Temperature Mapping"
          : "9. Результаты PQ/PV — температурное картирование")
      : isEnglishWarehouse(input)
        ? "9. PQ/PV Results - Performance Qualification / Validation"
        : "9. Результаты PQ/PV — Эксплуатационная квалификация / валидация",
    1,
  );
  drawSectionTitle(
    doc,
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? "9. PQ/PV Results - Temperature Mapping"
          : "9. Результаты PQ/PV — температурное картирование")
      : isEnglishWarehouse(input)
        ? "9. PQ/PV Results - Performance Qualification / Validation"
        : "9. Результаты PQ/PV — Эксплуатационная квалификация / валидация",
  );
  if (getReportEquipmentType(input) === "thermal-container") {
    drawThermalTrialsSummary(doc, input);
  }
  drawStageDataEntryTable(doc, input, "PV");
  drawPVParams(doc, input.pv, input);
  drawPVPassportSummary(doc, input);

  if (input.pvLoggers && input.pvLoggers.length > 0) {
    const eqType = getReportEquipmentType(input) || "";
    // Recalculate on PDF generation so old saved hotIdx/coldIdx cannot mark
    // the same logger as both hot and cold after data/import corrections.
    const critical = calculateCriticalLoggerIndices(input.pv.loggers);
    const hotLabel = critical.hotIdx !== null && input.pv.loggers[critical.hotIdx] ? input.pv.loggers[critical.hotIdx].label : null;
    const coldLabel = critical.coldIdx !== null && input.pv.loggers[critical.coldIdx] ? input.pv.loggers[critical.coldIdx].label : null;
    const internalPvLoggerCount = input.pvLoggers.filter(logger => logger.role === "internal").length;
    const useRiskOrientedReeferPlacement = isAutoRefrigeratorLike(eqType) && internalPvLoggerCount > 0 && internalPvLoggerCount < 15;
    if (isWarehouseLike(eqType)) {
      // Warehouse schema 2: actual placement before statistics/critical-point
      // analysis. Keep it clean: logger IDs only, no averages and no hot/cold
      // markers yet.
      drawWarehousePlanDiagram(doc, input, false, isEnglishWarehouse(input) ? "Diagram 2. Logger placement on the storage area plan (logger IDs)" : "Схема 2. Расстановка регистраторов на плане помещения (номера логгеров)", {
        showCriticalMarkers: false,
        showAverageLabels: false,
        showHeightLabels: true,
        showPlacementTable: false,
        showLoggerPlacementTable: true,
      });
    } else {
      // Non-warehouse: Schema 1/2 describe planned/actual placement only.
      // Hot/cold critical markers are PV result interpretation and are shown
      // on the final temperature map instead of the placement diagrams.
      if (isReeferLike(eqType) && useRiskOrientedReeferPlacement) {
          drawReeferTruckDiagram3D(
            doc,
            input.pvLoggers as DiagramSensor[],
            PAGE_MARGIN,
            input.coolingUnitPos,
            input.doorPos,
            false,
            "Схема 1. Риск-ориентированная фактическая расстановка датчиков (серийные номера)",
            null,
            null,
            "truck",
            { showEmptyReferencePositions: false, showReferenceLegend: false, coolingUnitPositions: input.coolingUnitPositions },
          );
      }
      // Schema 2: with serial numbers. For reduced auto-refrigerator studies
      // the first diagram is already the actual risk-based placement, so avoid
      // duplicating the same layout and numbering.
      if (!useRiskOrientedReeferPlacement) {
        doc.addPage();
        if (isReeferLike(eqType)) {
          drawReeferTruckDiagram3D(doc, input.pvLoggers as DiagramSensor[], PAGE_MARGIN, input.coolingUnitPos, input.doorPos, false, "Схема 2. Расстановка датчиков (с серийными номерами)", null, null, eqType === "chamber" || eqType === "thermal-container" ? "chamber" : "truck", { coolingUnitPositions: input.coolingUnitPositions });
        } else {
          drawRefrigeratorDiagram(doc, input.pvLoggers as DiagramSensor[], PAGE_MARGIN, input.coolingUnitPos, input.doorPos, "Схема 2. Расстановка датчиков (серийные номера и позиции)", "serial-position", input.refrigeratorDrawerCount ?? 2, input.refrigeratorLevelCount ?? 7, null, null);
        }
      }
    }
    const supportsTemperatureMap =
      !isWarehouseLike(eqType) &&
      (isAutoRefrigeratorLike(eqType) || eqType === "refrigerator" || eqType === "freezer");
    const temperatureMapSchemaNumber = useRiskOrientedReeferPlacement ? 2 : 3;
    const pvAverageBySensorKey = new Map<string, number | string | null | undefined>();
    const addAverageKey = (key: unknown, avg: number | string | null | undefined) => {
      const normalized = String(key ?? "").trim();
      if (normalized) pvAverageBySensorKey.set(normalized, avg);
    };
    input.pv.loggers.forEach(logger => {
      addAverageKey(logger.label, logger.avg);
      addAverageKey(logger.customName, logger.avg);
    });
    const temperatureMapLoggers = (input.pvLoggers ?? []).map(logger => {
      const mergedAvg =
        logger.avg ??
        pvAverageBySensorKey.get(String(logger.label ?? "").trim()) ??
        pvAverageBySensorKey.get(String(logger.customName ?? "").trim()) ??
        null;
      return { ...logger, avg: mergedAvg };
    });
    const hasTemperatureMapData = temperatureMapLoggers.some(logger =>
      logger.role === "internal" &&
      logger.avg != null &&
      Number.isFinite(typeof logger.avg === "string" ? Number(logger.avg) : logger.avg),
    );
    if (supportsTemperatureMap && hasTemperatureMapData) {
      doc.addPage();
      drawTemperatureMapSummary(doc, temperatureMapLoggers as DiagramSensor[], PAGE_MARGIN, {
        title: `Схема ${temperatureMapSchemaNumber}. Температурная карта по средним значениям PQ/PV`,
        objectType: isAutoRefrigeratorLike(eqType) ? "truck" : eqType === "freezer" ? "freezer" : "refrigerator",
        rangeMin: input.pv.rangeMin,
        rangeMax: input.pv.rangeMax,
        drawerCount: input.refrigeratorDrawerCount ?? 2,
        levelCount: input.refrigeratorLevelCount ?? 7,
        hotLabel,
        coldLabel,
      });
    }
  }

  ensureSpace(doc, 220);
  drawPVCalculationMethodSection(doc, input, { compact: true });

  ensureSpace(doc, 50 + 24 + input.pv.loggers.length * 26);
  drawSubTitle(doc, isEnglishWarehouse(input) ? "Sensor Summary Statistics" : "Сводная статистика по датчикам");
  const statsCritical = calculateCriticalLoggerIndices(input.pv.loggers);
  drawStatsTable(doc, input.pv.loggers, statsCritical.hotIdx, statsCritical.coldIdx, input.pv.extIndices, input);
  drawPVCriticalInterpretationSummary(doc, input);
  if (isWarehouseLike(getReportEquipmentType(input)) && (input.pvLoggers?.length ?? 0) > 0) {
    doc.addPage();
    drawWarehousePlanDiagram(
      doc,
      input,
      false,
      isEnglishWarehouse(input)
        ? "Diagram 3. PQ/PV temperature map on the storage area plan (logger IDs and average temperature)"
        : "Схема 3. Температурная карта PQ/PV на плане помещения (номера логгеров и средняя температура)",
      {
        showCriticalMarkers: true,
        showAverageLabels: true,
        showPlacementTable: false,
        showTemperatureOverlay: true,
      },
    );
  }
  drawWarehouseOperationalEventsSection(doc, input);

  if (isWarehouseEaeu(getReportEquipmentType(input))) {
    drawWarehouseAnnex1(doc, input, recordToc);
    drawWarehouseAnnex2(doc, input, recordToc);
  }

  doc.addPage();
  drawSubTitle(doc, isEnglishWarehouse(input) ? "Measurement Results Table" : "Таблица результатов измерений");
  drawMeasurementTable(doc, input.pv.loggers, input.pv.samplingStepMinutes, input);

  drawCharts(doc, input.pv, input);
  drawDeviationsSection(doc, input.pv, input);
  drawStagePVVerdict(doc, input.pv, input);

  if (input.excursion?.enabled) {
    doc.addPage();
    drawExcursionSection(doc, input.excursion, input.pv.rangeMin, input.pv.rangeMax, input.pv.sensorAccuracy);
  }

  doc.addPage();
  recordToc(
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? `${input.excursion?.enabled ? "11" : "10"}. Temperature Mapping Report`
          : `${input.excursion?.enabled ? "11" : "10"}. Отчёт о температурном картировании`)
      : isEnglishWarehouse(input)
        ? (input.excursion?.enabled ? "11. Qualification Report" : "10. Qualification Report")
        : (input.excursion?.enabled ? "11. Отчёт о квалификации" : "10. Отчёт о квалификации"),
    1,
  );
  drawSectionTitle(
    doc,
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? `${input.excursion?.enabled ? "11" : "10"}. Temperature Mapping Report`
          : `${input.excursion?.enabled ? "11" : "10"}. Отчёт о температурном картировании`)
      : isEnglishWarehouse(input)
        ? (input.excursion?.enabled ? "11. Qualification Report" : "10. Qualification Report")
        : (input.excursion?.enabled ? "11. Отчёт о квалификации" : "10. Отчёт о квалификации"),
  );
  drawFinalConclusion(doc, input);

  doc.addPage();
  recordToc(isEnglishWarehouse(input) ? (input.excursion?.enabled ? "12. Deviations from the Protocol Plan" : "11. Deviations from the Protocol Plan") : (input.excursion?.enabled ? "12. Отклонения от плана протокола" : "11. Отклонения от плана протокола"), 1);
  drawSectionTitle(doc, isEnglishWarehouse(input) ? (input.excursion?.enabled ? "12. Deviations from the Protocol Plan" : "11. Deviations from the Protocol Plan") : (input.excursion?.enabled ? "12. Отклонения от плана протокола" : "11. Отклонения от плана протокола"));
  drawPlanDeviationsSection(doc, input);

  recordToc(isEnglishWarehouse(input) ? (input.excursion?.enabled ? "13. Recommendations" : "12. Recommendations") : (input.excursion?.enabled ? "13. Рекомендации" : "12. Рекомендации"), 1);
  drawSectionTitle(doc, isEnglishWarehouse(input) ? (input.excursion?.enabled ? "13. Recommendations" : "12. Recommendations") : (input.excursion?.enabled ? "13. Рекомендации" : "12. Рекомендации"));
  drawRecommendationsSection(doc, input);

  doc.addPage();
  recordToc(isEnglishWarehouse(input) ? (input.excursion?.enabled ? "14. Report Signatures" : "13. Report Signatures") : (input.excursion?.enabled ? "14. Подписи к Отчёту" : "13. Подписи к Отчёту"), 1);
  drawSectionTitle(doc, isEnglishWarehouse(input) ? (input.excursion?.enabled ? "14. Report Signatures" : "13. Report Signatures") : (input.excursion?.enabled ? "14. Подписи к Отчёту" : "13. Подписи к Отчёту"));
  drawSignaturesBlock(
    doc,
    getSignatoriesPart2(input),
    isWarehouseLike(getReportEquipmentType(input))
      ? (isEnglishWarehouse(input)
          ? "This temperature mapping report has been reviewed and approved by:"
          : "Настоящий отчёт о температурном картировании рассмотрен и утверждён:")
      : isEnglishWarehouse(input)
        ? "This qualification report has been reviewed and approved by:"
        : "Настоящий отчёт о квалификации рассмотрен и утверждён:",
    input,
  );

  const mappingPeriodicitySectionNumber = input.excursion?.enabled ? 15 : 14;
  doc.addPage();
  recordToc(
    isEnglishWarehouse(input)
      ? `${mappingPeriodicitySectionNumber}. Mapping Frequency and Conditions`
      : `${mappingPeriodicitySectionNumber}. Периодичность и условия картирования`,
    1,
  );
  drawSectionTitle(
    doc,
    isEnglishWarehouse(input)
      ? `${mappingPeriodicitySectionNumber}. Mapping Frequency and Conditions`
      : `${mappingPeriodicitySectionNumber}. Периодичность и условия картирования`,
  );
  drawMappingPeriodicitySection(doc, input);

  const skipValiditySection = isRefrigeratorCabinetLike(getReportEquipmentType(input)) || isWarehouseLike(getReportEquipmentType(input));
  let nextSectionNumber = mappingPeriodicitySectionNumber + 1;
  if (!skipValiditySection) {
    doc.addPage();
    recordToc(
      isEnglishWarehouse(input)
        ? `${nextSectionNumber}. Document Validity Period`
        : `${nextSectionNumber}. Срок действия документа`,
      1,
    );
    drawSectionTitle(
      doc,
      isEnglishWarehouse(input)
        ? `${nextSectionNumber}. Document Validity Period`
        : `${nextSectionNumber}. Срок действия документа`,
    );
    drawValiditySection(doc, input);
    nextSectionNumber += 1;
  }

  if (input.attachments?.some(item => item.includeInPdf !== false && item.includeInPdf !== 0)) {
    doc.addPage();
    const annexSectionNumber = nextSectionNumber;
    recordToc(isEnglishWarehouse(input) ? `${annexSectionNumber}. Annexes` : `${annexSectionNumber}. Приложения`, 1);
    drawSectionTitle(doc, isEnglishWarehouse(input) ? `${annexSectionNumber}. Annexes` : `${annexSectionNumber}. Приложения`);
    drawAttachmentsSection(doc, input);
    nextSectionNumber += 1;
  }

  doc.addPage();
  const metrologySectionNumber = nextSectionNumber;
  recordToc(isEnglishWarehouse(input) ? `${metrologySectionNumber}. Metrological Verification of Measuring Instruments` : `${metrologySectionNumber}. Поверка средств измерений`, 1);
  drawCalibrationPage(doc, isEnglishWarehouse(input) ? `${metrologySectionNumber}. Metrological Verification of Measuring Instruments` : `${metrologySectionNumber}. Поверка средств измерений`);

  /* ---------------- Footer / pagination ---------------- */
  if (tableOfContentsPageIndex !== null) {
    drawWarehouseTableOfContentsPage(doc, input, tableOfContentsPageIndex, tocEntries);
  }
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

  const en = isEnglishWarehouse(input);
  const eqType = getReportEquipmentType(input) || "";
  const isWarehouseDocument = isWarehouseLike(eqType);
  const partLabel = part === "part1" ? (en ? "PART I" : "ЧАСТЬ I") : (en ? "PART II" : "ЧАСТЬ II");
  const partTitle = eqType === "chamber"
    ? `${part === "part1" ? "Протокол" : "Отчёт"} температурного картирования холодильной камеры для хранения лекарственных средств`
    : isWarehouseDocument
    ? (part === "part1"
        ? (en ? WAREHOUSE_MAPPING_PROTOCOL_TITLE_EN : WAREHOUSE_MAPPING_PROTOCOL_TITLE_RU)
        : (en ? WAREHOUSE_MAPPING_REPORT_TITLE_EN : WAREHOUSE_MAPPING_REPORT_TITLE_RU))
    : part === "part1"
      ? (en ? "QUALIFICATION PROTOCOL" : "ПРОТОКОЛ КВАЛИФИКАЦИИ")
      : (en ? "QUALIFICATION REPORT" : "ОТЧЁТ О КВАЛИФИКАЦИИ");
  const partSubtitle = isWarehouseDocument
    ? (part === "part1"
        ? (en ? "Mapping plan · IQ/OQ readiness checks · PQ/PV" : "План картирования · подготовительные проверки IQ/OQ · PQ/PV")
        : (en ? "Mapping results · IQ/OQ readiness checks · PQ/PV report" : "Результаты картирования · подготовительные проверки IQ/OQ · отчёт PQ/PV"))
    : part === "part1"
      ? "IQ · OQ · PQ/PV"
      : (en ? "IQ · OQ · PQ/PV Test Results" : "Результаты испытаний IQ · OQ · PQ/PV");

  doc
    .fillColor(MUTED)
    .font("bold")
    .fontSize(13)
    .text(partLabel, left, y, { align: "center" });

  y += 22;
  doc
    .fillColor(ACCENT)
    .font("bold")
    .fontSize(isWarehouseDocument || eqType === "chamber" ? 19 : 26)
    .text(partTitle, left, y, { align: "center", width: right - left });

  y += doc.heightOfString(partTitle, {
    width: right - left,
    align: "center",
  }) + (isWarehouseDocument ? 12 : 10);
  doc
    .fillColor(MUTED)
    .font("body")
    .fontSize(13)
    .text(partSubtitle, left, y, { align: "center", width: right - left });

  y += doc.heightOfString(partSubtitle, {
    width: right - left,
    align: "center",
  }) + (isWarehouseDocument ? 14 : 12);
  const equipmentTypeLabel = en && isWarehouseLike(eqType)
    ? (isPharmacyStorageType(eqType) ? "Pharmacy Storage Room / Area" : "Storage Room / Storage Area")
    : eqType === "chamber"
    ? "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u043c\u0435\u0440\u0430"
    : eqType === "thermal-container"
      ? "\u0422\u0435\u0440\u043c\u043e\u043a\u043e\u043d\u0442\u0435\u0439\u043d\u0435\u0440"
    : isKyrgyzstanAutoRefrigerator(eqType)
      ? "Авторефрижератор Кыргызстана"
    : isAutoRefrigeratorLike(eqType)
      ? "\u0422\u0440\u0430\u043d\u0441\u043f\u043e\u0440\u0442\u043d\u043e\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u043e"
    : eqType === "freezer"
      ? "\u041c\u043e\u0440\u043e\u0437\u0438\u043b\u044c\u043d\u0438\u043a"
    : isWarehouseLike(eqType)
        ? getEquipmentName(input)
        : "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0435 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435";
  if (!isWarehouseDocument && eqType !== "chamber") {
    doc
      .fillColor(ACCENT)
      .font("bold")
      .fontSize(16)
      .text(equipmentTypeLabel, left, y, { align: "center" });
    y += 50;
  } else {
    y += 18;
  }

  // Card with key metadata
  const cardX = left + 24;
  const cardW = right - left - 48;
  const cardY = y;
  const gi = input.generalInfo;
  const objectLabel = isWarehouseLike(eqType)
    ? getEquipmentName(input)
    : EQUIPMENT_LABEL[eqType || ""] || "—";
  const refrigerationUnits = getRefrigerationUnits(input);
  const refrigerationUnit = `${gi?.manufacturer || ""} ${gi?.model || ""}`.trim() || "—";
  const selectedThermalModes = gi?.thermalContainerConfig?.selectedModes || [];
  const temperatureModeText = selectedThermalModes.length > 0
    ? selectedThermalModes.map(mode => TEMP_MODE_LABEL[mode] || mode).join(", ")
    : temperatureModeLabel(gi?.tempMode, gi?.customMin, gi?.customMax, input);
  const seasonLabels = en
    ? SEASON_LABEL_EN
    : { ...SEASON_LABEL_RU, warm: "Тёплый период" };
  const qualificationLabels = en ? QUALIFICATION_LABEL_EN : QUALIFICATION_LABEL_RU;
  const baseRows: Array<[string, string]> = [
    [en ? "Protocol No." : "Номер протокола", input.protocol.number],
    [en ? "Revision" : "Редакция", input.dataIntegrity?.revision || "01"],
    [en ? "Organization" : "Организация", input.org.name],
    [en ? "BIN / Tax ID" : "БИН / ИНН", input.org.bin || "—"],
    [
      en
        ? (isWarehouseDocument ? "Mapping object" : "Qualification object")
        : (isWarehouseDocument || eqType === "chamber" ? "Объект температурного картирования" : "Объект квалификации"),
      objectLabel,
    ],
    ...(isReeferLike(eqType)
      ? [
          [reeferLocationLabel(eqType), gi?.location || "\u2014"],
          ...(isAutoRefrigeratorLike(eqType) && refrigerationUnits.length > 1
            ? refrigerationUnits.map((unit, idx) => [`${reeferUnitLabel(eqType)} ${idx + 1}`, formatRefrigerationUnit(unit)] as [string, string])
            : [
                [reeferUnitLabel(eqType), refrigerationUnit],
                ["\u0421\u0435\u0440\u0438\u0439\u043d\u044b\u0439 \u043d\u043e\u043c\u0435\u0440 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438", gi?.serial || "\u2014"],
              ] as Array<[string, string]>),
        ] as Array<[string, string]>
      : [
          [en ? "Object address" : "Адрес объекта", gi?.location || "—"],
        ] as Array<[string, string]>),
    [en ? "Temperature mode" : "Температурный режим", temperatureModeText],
    [en ? "Season" : "Сезон", gi?.season ? seasonLabels[gi.season] || "—" : "—"],
    [
      en
        ? (isWarehouseDocument ? "Mapping type" : "Qualification type")
        : (isWarehouseDocument ? "Тип картирования" : "Тип квалификации"),
      gi?.qualificationType ? qualificationLabels[gi.qualificationType] || "—" : "—",
    ],
  ];
  const rows: Array<[string, string | undefined]> = part === "part1"
    ? [
        ...baseRows,
        [en ? "Protocol date" : "Дата составления протокола", fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === 'string' ? new Date(input.protocol.createdAt) : input.protocol.createdAt)],
      ]
    : [
        // Перекрёстная ссылка на Протокол (Часть I)
        [en ? "Report prepared under Protocol No." : "Отчёт составлен по Протоколу №", en
          ? `${input.protocol.number} dated ${fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === 'string' ? new Date(input.protocol.createdAt) : input.protocol.createdAt)}`
          : `${input.protocol.number} от ${fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === 'string' ? new Date(input.protocol.createdAt) : input.protocol.createdAt)}`],
        ...baseRows,
        [en ? "Report date" : "Дата составления отчёта", input.reportDate && input.reportDate.trim() ? input.reportDate.trim() : fmtDateOnly(input.generalInfo?.validationDate ? new Date(input.generalInfo.validationDate) : typeof input.protocol.createdAt === 'string' ? new Date(input.protocol.createdAt) : input.protocol.createdAt)]
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
      "Organization",
      "Object address",
      "Mapping object",
    ]);
    const twoLineKeys = new Set([
      "\u041e\u0431\u044a\u0435\u043a\u0442 \u043a\u0432\u0430\u043b\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438",
      "\u041e\u0431\u044a\u0435\u043a \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u043d\u043e\u0433\u043e \u043a\u0430\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f",
      "\u0425\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430",
      "Qualification object",
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
        eqType === "chamber" ? "Методическая основа: Рекомендация ЕЭК №8. Размещение регистраторов: ISPE, 15+1."
          : isWarehouseDocument
          ? (en
              ? "The document was generated with EEC Board Recommendation No. 8 used as the methodological basis."
              : "Документ сформирован с учётом Рекомендации Коллегии ЕЭК № 8 как методической основы.")
          : en
            ? "The document was generated in accordance with GMP / GDP / GPP requirements."
            : "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u0441\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d \u0432 \u0441\u043e\u043e\u0442\u0432\u0438\u0438 \u0441 \u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f\u043c\u0438 GMP / GDP / GPP.",
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
  const normalized = raw.replace("%", "").replace(",", ".").trim();
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return raw;
  const rounded = Math.round(numeric * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function drawThermalTrialsSummary(doc: PDFKit.PDFDocument, input: ReportInput) {
  const trials = input.thermalTrials || [];
  drawSubTitle(doc, "9.1. Сводные результаты испытаний температурных режимов");
  if (trials.length === 0) {
    doc.font("body").fontSize(10).fillColor(MUTED).text("Испытания не зарегистрированы.");
    return;
  }

  const verdictLabel = (value: string) => value === "pass"
    ? "Пройдено"
    : value === "fail"
      ? "Не пройдено"
      : "Не завершено";
  const rows: Array<[string, string]> = [];
  for (const trial of trials) {
    const mode = TEMP_MODE_LABEL[trial.tempMode] || trial.tempMode;
    const duration = trial.durationHours === null ? "—" : `${trial.durationHours.toFixed(1)} ч`;
    rows.push([
      `Режим ${mode}`,
      `${verdictLabel(trial.verdict)}; фактически ${duration}; требование ${trial.targetDurationHours} ч; внутренних датчиков: ${trial.internalSensorCount}`,
    ]);
    if (trial.failureReasons.length > 0) {
      rows.push([`Замечания (${mode})`, trial.failureReasons.join("; ")]);
    }
    for (const logger of trial.loggers) {
      const role = logger.role === "external" ? "внешний" : "внутренний";
      const fmt = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)} °C`;
      rows.push([
        `${logger.label}${logger.customName ? ` (${logger.customName})` : ""}`,
        `${role}; Min ${fmt(logger.min)}; Avg ${fmt(logger.avg)}; Max ${fmt(logger.max)}; MKT ${fmt(logger.mkt)}`,
      ]);
    }
  }
  drawKVTable(doc, rows, 145);
}

function drawGeneralInfoTable(doc: PDFKit.PDFDocument, input: ReportInput) {
  const gi = input.generalInfo;
  const eqType = getReportEquipmentType(input) || "";
  const isWarehouse = isWarehouseLike(eqType);
  const en = isEnglishWarehouse(input);
  const loadPercentLabel = formatLoadPercent(gi?.loadPercent);

  let rows: Array<[string, string]>;

  if (isWarehouse) {
    // Warehouse: show object-specific fields only.
    const hasDimensions = !!(gi?.whLengthM || gi?.whWidthM || gi?.whHeightM);
    const lengthM = gi?.whLengthM ? Number(gi.whLengthM).toFixed(2) : "—";
    const widthM  = gi?.whWidthM ? Number(gi.whWidthM).toFixed(2) : "—";
    const heightM = gi?.whHeightM ? Number(gi.whHeightM).toFixed(2) : "—";
    const dims = en
      ? `${lengthM} × ${widthM} × ${heightM} m (L × W × H)`
      : `${lengthM} × ${widthM} × ${heightM} м (Д × Ш × В)`;
    const fillStatusLabel = gi?.fillStatus
      ? (en ? FILL_STATUS_LABEL_EN : FILL_STATUS_LABEL_RU)[gi.fillStatus]
      : "—";
    const humidityText = gi?.whHumidityControl
      ? (en ? `Yes (${gi?.whHumidityMin ?? "—"} – ${gi?.whHumidityMax ?? "—"} % RH)` : `Да (${gi?.whHumidityMin ?? "—"} – ${gi?.whHumidityMax ?? "—"} % о.в.)`)
      : (en ? "Not controlled" : "Не контролируется");
    rows = [
      [en ? "Object type" : "Тип объекта", isWarehouseLike(eqType) ? getEquipmentName(input) : EQUIPMENT_LABEL[eqType || ""] || "—"],
      [en ? "Room / area type" : "Тип помещения / зоны", en ? (WAREHOUSE_STUDY_LABEL_EN[gi?.whStudyType || ""] || "—") : (WAREHOUSE_STUDY_LABEL[gi?.whStudyType || ""] || "—")],
      [en ? "Object address" : "Адрес объекта", gi?.location || "—"],
      [en ? "Temperature mode" : "Температурный режим", temperatureModeLabel(gi?.tempMode, gi?.customMin, gi?.customMax, input)],
      [en ? "Humidity control" : "Контроль влажности", humidityText],
      [en ? "Study season" : "Сезон исследования", gi?.season ? (en ? SEASON_LABEL_EN[gi.season] : ({ warm: "Тёплый период", cold: "Холодный период", interseasonal: "Межсезонье", none: "Не применимо" } as Record<string, string>)[gi.season] || WAREHOUSE_SEASON_LABEL[gi.season]) || "—" : "—"],
      [en ? "Contact with external environment" : "Контакт с внешней средой", gi?.whExternalEnv ? (en ? "Present (seasonal fluctuations are considered)" : "Имеется (учитываются сезонные колебания)") : (en ? "Absent" : "Отсутствует")],
      [en ? "Object fill status" : "Заполненность объекта", fillStatusLabel],
      [en ? "Object load percentage" : "Процент загруженности объекта", loadPercentLabel],
      [en ? "Purpose / stored products" : "Назначение / хранимая продукция", gi?.purpose || "—"],
      [en ? "Organization" : "Организация", input.org.name],
      [en ? "BIN / Tax ID" : "БИН / ИНН", input.org.bin || "—"],
      [en ? "Organization address" : "Адрес организации", input.org.addressFact || "—"],
      [en ? "Responsible person" : "Ответственное лицо", input.org.responsible || "—"],
      [en ? "Contacts" : "Контакты", input.org.phone || "—"],
    ];
    if (hasDimensions) {
      rows.splice(3, 0, [en ? "Geometric dimensions" : "Геометрические размеры", dims]);
    }
    if (gi?.whLayoutNotes) {
      rows.push([en ? "Layout notes" : "Примечания к планировке", gi.whLayoutNotes]);
    }
  } else {
    // Refrigerator / auto-refrigerator: show equipment-specific fields
    const units = getRefrigerationUnits(input);
    rows = [
      ["Тип оборудования", isWarehouseLike(eqType) ? getEquipmentName(input) : EQUIPMENT_LABEL[eqType || ""] || "—"],
      ...(isAutoRefrigeratorLike(eqType) && units.length > 1
        ? units.map((unit, idx) => [`Холодильный агрегат ${idx + 1}`, formatRefrigerationUnit(unit)] as [string, string])
        : [
            ["Производитель", gi?.manufacturer || "—"],
            ["Модель", gi?.model || "—"],
            ["Серийный номер", gi?.serial || "—"],
          ] as Array<[string, string]>),
      ["Температурный режим", temperatureModeLabel(gi?.tempMode, gi?.customMin, gi?.customMax)],
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
  if (eqType === "thermal-container") {
    const config = gi?.thermalContainerConfig;
    const modeLabels = (config?.selectedModes || [gi?.tempMode].filter(Boolean) as string[])
      .map(mode => TEMP_MODE_LABEL[mode] || mode)
      .join(", ") || "—";
    const dimensions = [config?.innerLengthCm, config?.innerWidthCm, config?.innerHeightCm]
      .map(value => value || "—")
      .join(" × ");
    const loadProfile = config?.loadProfile
      ? { empty: "Пустой", partial: "Частично загруженный", full: "Полностью загруженный" }[config.loadProfile]
      : "—";

    rows = [
      ["Тип оборудования", "Термоконтейнер"],
      ["Производитель", gi?.manufacturer || "—"],
      ["Модель", gi?.model || "—"],
      ["Серийный / инвентарный номер", gi?.serial || gi?.inventory || "—"],
      ["Заявленные температурные режимы", modeLabels],
      ["Режим текущего испытания", temperatureModeLabel(gi?.tempMode, gi?.customMin, gi?.customMax)],
      ["Полезный объем", config?.volumeLiters ? `${config.volumeLiters} л` : "—"],
      ["Внутренние размеры (Д × Ш × В)", `${dimensions} см`],
      ["Тип теплоизоляции", config?.insulationType || "—"],
      ["Тип и количество термоэлементов", `${config?.thermalElementType || "—"}; ${config?.thermalElementCount || "—"} шт.`],
      ["Температура кондиционирования", config?.conditioningTemperature !== null && config?.conditioningTemperature !== undefined && config?.conditioningTemperature !== "" ? `${config.conditioningTemperature} °C` : "—"],
      ["Заявленное время удержания", config?.targetDurationHours ? `${config.targetDurationHours} ч` : "—"],
      ["Профиль загрузки", loadProfile || "—"],
      ["Схема упаковки / примечания", config?.packingNotes || "—"],
      ["Место подготовки и эксплуатации", gi?.location || "—"],
      ["Назначение", gi?.purpose || "—"],
      ["Организация", input.org.name],
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
  opts: { fontSize?: number; headerFontSize?: number; padding?: number; headerHeight?: number; headerLineBreak?: boolean } = {},
) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const totalW = right - left;
  const colW = colFractions.map(fraction => fraction * totalW);
  const padding = opts.padding ?? 6;
  const fontSize = opts.fontSize ?? 9;
  const headerFontSize = opts.headerFontSize ?? fontSize;

  ensureSpace(doc, 28);
  let y = doc.y;
  const headerH = opts.headerHeight ?? 24;
  doc.save();
  doc.rect(left, y, totalW, headerH).fill(ACCENT);
  doc.restore();

  let cx = left;
  doc.fillColor("white").font("bold").fontSize(headerFontSize);
  headers.forEach((header, index) => {
    doc.text(header, cx + padding, y + 7, { width: colW[index] - padding * 2, lineBreak: opts.headerLineBreak ?? false });
    cx += colW[index];
  });
  doc.y = y + headerH;

  rows.forEach((cells, rowIndex) => {
    doc.font("body").fontSize(fontSize);
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
      doc.fillColor(ACCENT).font("body").fontSize(fontSize)
        .text(cell || "—", cx + padding, y + padding, { width: colW[index] - padding * 2 });
      cx += colW[index];
    });
    doc.y = y + rowH;
  });
  doc.x = PAGE_MARGIN;
  doc.moveDown(0.7);
}

function drawRevisionHistorySection(doc: PDFKit.PDFDocument, input: ReportInput) {
  const en = isEnglishWarehouse(input);
  drawSubTitle(doc, en ? "Protocol Revision and Change History" : "Редакция протокола и история изменений");
  const revision = input.dataIntegrity?.revision || "01";
  drawKVTable(doc, [
    [en ? "Current revision" : "Текущая редакция", revision],
    [en ? "Revision status" : "Статус редакции", en ? "Effective" : "Действующая"],
  ], 180);

  const author = getTraceablePerson(input);
  const defaultDate = input.generalInfo?.validationDate || input.reportDate || input.protocol.createdAt || input.dataIntegrity?.generatedAt;
  const defaultChange = isWarehouseLike(getReportEquipmentType(input))
    ? (en
        ? "Initial issue of the temperature mapping protocol and report."
        : "Первичная редакция протокола и отчёта температурного картирования.")
    : (en ? "Initial issue of the qualification protocol and report." : "Первичная редакция протокола и отчёта о квалификации.");
  const rows = (input.dataIntegrity?.revisionHistory?.length
    ? input.dataIntegrity.revisionHistory
    : [{
        revision,
        date: defaultDate,
        change: defaultChange,
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
    en
      ? ["Rev.", "Date", "Change description", "Entered / prepared by"]
      : ["Ред.", "Дата", "Описание изменения", "Внес / подготовил"],
    rows,
    [0.10, 0.20, 0.45, 0.25],
  );
}

function drawStageDataEntryTable(doc: PDFKit.PDFDocument, input: ReportInput, stage: "IQ" | "OQ" | "PV") {
  const trace = getStageTrace(input, stage);
  const en = isEnglishWarehouse(input);
  // Auto-fill: ФИО — автор из истории изменений («внёс/подготовил»),
  // дата — дата завершения соответствующего этапа (для PV — дата отчёта
  // либо дата окончания испытания), а не общая дата создания протокола.
  const filledBy = getTraceablePerson(input);
  const fallbackDate = coerceDate(input.generalInfo?.validationDate) ?? coerceDate(input.protocol.createdAt);
  const completionDate = stage === "PV"
    ? getPvCompletionDate(input) ?? coerceDate(trace.completedAt) ?? fallbackDate
    : fallbackDate;
  const protocolDate = fmtDateOnly(completionDate);
  drawSubTitle(doc, en ? `Data Entry Record ${stage === "PV" ? "PQ/PV" : stage}` : `Запись ввода данных ${stage === "PV" ? "PQ/PV" : stage}`);
  drawSimpleTable(
    doc,
    en
      ? ["Data section", "Completed by", "Completion date", "Source record"]
      : ["Раздел данных", "Заполнил (ФИО)", "Дата заполнения", "Источник записи"],
    [[en ? `${stage === "PV" ? "PQ/PV" : stage} data` : (trace.label || " "), filledBy || " ", protocolDate || " ", en ? "Electronic protocol record / change history" : (trace.source || " ")]],
    [0.30, 0.22, 0.24, 0.24],
  );
}

function drawStageBlocks(
  doc: PDFKit.PDFDocument,
  stage: { purpose: string; description: string; criteria: string },
  input?: ReportInput,
) {
  const blocks: Array<[string, string]> = [
    [enRu(input, "Test objective", "Цель испытания"), warehouseMappingTerminology(refrigeratorIqTerminology(verificationTerminology(stage.purpose), input), input)],
    [enRu(input, "Test description", "Описание испытания"), warehouseMappingTerminology(refrigeratorIqTerminology(verificationTerminology(stage.description), input), input)],
    [enRu(input, "Acceptance criteria", "Критерии приемлемости"), warehouseMappingTerminology(refrigeratorIqTerminology(verificationTerminology(stage.criteria), input), input)],
  ];
  blocks.forEach(([k, v]) => {
    ensureSpace(doc, 60);
    doc.fillColor(ACCENT).font("bold").fontSize(11).text(k);
    doc.moveDown(0.3);
    doc.fillColor("#1f2937").font("body").fontSize(10).text(v, { align: "justify" });
    doc.moveDown(0.7);
  });
}

function drawChecklistTable(doc: PDFKit.PDFDocument, items: ChecklistItem[], input?: ReportInput) {
  const en = isEnglishWarehouse(input);
  const visibleItems = items.filter(item => item.questionText.trim().length > 0);
  drawSubTitle(doc, en ? "Checklist" : "Опросник");
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
  doc.text(en ? "No." : "№", left + 6, y + 6, { width: numW - 6 });
  doc.text(en ? "Question / comment" : "Вопрос / комментарий", left + numW + 6, y + 6, { width: qW - 12 });
  doc.text(en ? "Answer" : "Ответ", left + numW + qW + 6, y + 6, { width: ansW - 12 });
  doc.y = y + 22;

  visibleItems.forEach((it, idx) => {
    const padding = 6;
    doc.font("body").fontSize(10);
    const qText = verificationTerminology(it.questionText) + (it.comment ? `\n${en ? "Comment" : "Комментарий"}: ${it.comment}` : "");
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

    const ansLabel = answerLabel(it.answer, input);
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
  input?: ReportInput,
) {
  const en = isEnglishWarehouse(input);
  const warehouse = isWarehouseLike(getReportEquipmentType(input));
  const noItems = items.filter(i => i.answer === "no");
  doc.moveDown(0.5);
  // Draw title and box together — reserve space for both to prevent orphaned title
  doc.font("bold").fontSize(12);
  const verdictTitle = en ? "Stage Conclusion" : "Заключение по этапу";
  const titleH = doc.heightOfString(verdictTitle) + 4;
  doc.font("body").fontSize(10);
  // Use the longest possible verdict text to correctly estimate required height
  const longestSample =
    en
      ? "All acceptance criteria are met. Installation Qualification (IQ) has been completed successfully. The storage area and supporting systems meet the protocol requirements."
      : "Все критерии приемлемости выполнены. Квалификация монтажа (IQ) пройдена успешно. " +
        "Оборудование установлено, подключено и соответствует требованиям проектной, нормативной и эксплуатационной документации.";
  const sampleH = Math.max(60, doc.heightOfString(refrigeratorIqTerminology(longestSample, input), { width: doc.page.width - PAGE_MARGIN * 2 - 28 }) + 28);
  ensureSpace(doc, titleH + 8 + sampleH);
  doc.fillColor(ACCENT).font("bold").fontSize(12).text(
    verdictTitle,
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
  let text = en ? "Conclusion has not been generated — the stage is not completed." : "Заключение не сформировано — этап не завершён.";

  if (verdict === "pass") {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    if (warehouse && en) {
      if (name === "IQ") {
        text =
          "All acceptance criteria are met. The IQ readiness check has been completed successfully. The storage area, utilities and supporting documentation meet the protocol requirements.";
      } else if (name === "OQ") {
        text =
          "All acceptance criteria are met. The OQ readiness check has been completed successfully. The storage area and supporting systems operate in accordance with the defined requirements.";
      } else {
        text = `All acceptance criteria are met. The ${name} temperature mapping stage has been completed successfully.`;
      }
    } else if (warehouse && name === "IQ") {
      text =
        "Все критерии приемлемости выполнены. Подготовительная проверка IQ выполнена успешно. " +
        "Помещение (зона) хранения, инженерные сети и сопроводительная документация соответствуют требованиям протокола.";
    } else if (warehouse && name === "OQ") {
      text =
        "Все критерии приемлемости выполнены. Подготовительная проверка OQ выполнена успешно. " +
        "Климатическое оборудование и поддерживающие системы функционируют в соответствии с заданными требованиями.";
    } else if (en) {
      if (name === "IQ") {
        text =
          "All acceptance criteria are met. Installation Qualification (IQ) has been completed successfully. The storage area, utilities and supporting documentation meet the protocol requirements.";
      } else if (name === "OQ") {
        text =
          "All acceptance criteria are met. Operational Qualification (OQ) has been completed successfully. The storage area and supporting systems operate in accordance with the defined requirements.";
      } else {
        text = `All acceptance criteria are met. The ${name} stage has been completed successfully.`;
      }
    } else if (name === "IQ") {
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
      .map((it, i) => `${i + 1}. ${verificationTerminology(it.questionText)}${it.comment ? ` (${it.comment})` : ""}`)
      .join("\n");
    text = en
      ? `The ${name} stage failed. Non-conformities were identified:\n${list || "—"}`
      : `Этап ${name} не пройден. Выявлены несоответствия:\n${list || "—"}`;
  }

  text = warehouseMappingTerminology(refrigeratorIqTerminology(text, input), input);

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

function pvDurationRequirementLabel(pv: ReportInput["pv"], input?: ReportInput, nonWarehousePrefix = false): string {
  const en = isEnglishWarehouse(input);
  const eqType = getReportEquipmentType(input);
  if (eqType === "chamber") return `не менее ${CHAMBER_MIN_DURATION_HOURS} часов`;
  if (isWarehouseEaeu(eqType)) {
    const whStudyType = (input?.generalInfo as any)?.whStudyType;
    if (whStudyType === "cold_room") {
      return en
        ? `24–72 h or longer when justified; selected ${pv.minDurationHours} h`
        : `24–72 ч или более при обосновании; выбрано ${pv.minDurationHours} ч`;
    }
    return en
      ? `not less than 7 consecutive days (168 h); selected ${pv.minDurationHours} h`
      : `не менее 7 суток подряд (168 ч); выбрано ${pv.minDurationHours} ч`;
  }
  return nonWarehousePrefix ? `не менее ${pv.minDurationHours} ч` : `${pv.minDurationHours} ч`;
}

function drawPVParams(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const en = isEnglishWarehouse(input);
  const durationMs = pv.startAt && pv.endAt ? pv.endAt - pv.startAt : 0;
  const durationRequirement = pvDurationRequirementLabel(pv, input);
  const rows: Array<[string, string]> = [
    [en ? "Temperature mode" : "Температурный режим", pvTemperatureModeLabel(pv, input)],
    ...sensorAccuracyRows(pv, input),
    [en ? "Test start" : "Начало испытания", pv.startAt ? fmtDate(pv.startAt) : "—"],
    [en ? "Test end" : "Окончание испытания", pv.endAt ? fmtDate(pv.endAt) : "—"],
    [en ? "Actual duration" : "Фактическая длительность", durationMs ? fmtDuration(durationMs) : "—"],
    [
      isWarehouseEaeu(getReportEquipmentType(input))
        ? (en ? "Required duration" : "Требуемая длительность")
        : "Минимальная длительность (по умолчанию)",
      durationRequirement,
    ],
    [en ? "Minimum internal loggers (configured)" : "Минимум внутренних датчиков (настройка)", String(pv.minSensorCount)],
    [en ? "Loggers used" : "Использовано датчиков", String(pv.loggers.length)],
    [en ? "Internal loggers" : "Внутренних датчиков", String(pv.loggers.filter(l => l.role === "internal").length)],
    [en ? "External loggers" : "Внешних датчиков", String(pv.loggers.filter(l => l.role === "external").length)],
  ];
  drawKVTable(doc, rows);
}

function supportsExpertPvSummary(input?: ReportInput): boolean {
  const eqType = getReportEquipmentType(input) || "";
  return isWarehouseLike(eqType) || isAutoRefrigeratorLike(eqType) || eqType === "refrigerator" || eqType === "freezer" || eqType === "chamber";
}

function finiteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function fmtPlainNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}

function fmtTempMetric(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${fmtPlainNumber(value, digits)} °C`;
}

function shortLoggerDisplay(logger: Pick<LoggerSummary, "label" | "customName"> | null | undefined): string {
  const label = String(logger?.label ?? "").trim();
  const labelShort = shortSensorId(label);
  if (labelShort) return labelShort;
  const customName = String(logger?.customName ?? "").trim();
  return shortSensorId(customName) || "—";
}

function findPlacementLogger(input: ReportInput, logger: LoggerSummary | null | undefined) {
  if (!logger) return null;
  const candidates = [logger.label, logger.customName]
    .map(value => String(value ?? "").trim())
    .filter(Boolean);
  return (input.pvLoggers ?? []).find(item => {
    const itemKeys = [item.label, item.customName]
      .map(value => String(value ?? "").trim())
      .filter(Boolean);
    return itemKeys.some(key => candidates.includes(key));
  }) ?? null;
}

function refrigeratorPlacementLabel(input: ReportInput, rawPosition: string): string | null {
  const match = /^RF:S(\d+):(BL|BC|BR|FL|FC|FR)$/.exec(rawPosition);
  if (!match) return null;

  const shelf = Number(match[1]);
  const zoneLabels: Record<string, string> = {
    BL: "у задней стенки слева",
    BC: "у задней стенки по центру",
    BR: "у задней стенки справа",
    FL: "у дверцы слева",
    FC: "у дверцы по центру",
    FR: "у дверцы справа",
  };
  const levelCount = Number(input.refrigeratorLevelCount);
  const normalizedLevelCount = Number.isFinite(levelCount) && levelCount >= 3 ? Math.round(levelCount) : null;
  const shelfLabel = shelf === 1
    ? "верхняя полка"
    : normalizedLevelCount !== null && shelf === normalizedLevelCount
      ? "нижняя полка"
      : `${shelf}-я полка`;

  return `${shelfLabel}, ${zoneLabels[match[2]]}`;
}

function placementLabel(input: ReportInput, logger: LoggerSummary | null | undefined): string {
  const placement = findPlacementLogger(input, logger);
  const rawPosition = String(placement?.position ?? "").trim();
  if (placement?.role === "external" || rawPosition === "external") return "внешний регистратор";
  if (rawPosition && rawPosition !== "unset") {
    return refrigeratorPlacementLabel(input, rawPosition) ?? rawPosition;
  }
  return "по схеме";
}

function drawPVInfoBox(
  doc: PDFKit.PDFDocument,
  text: string,
  options: { bg?: string; border?: string; color?: string } = {},
) {
  const left = PAGE_MARGIN;
  const width = doc.page.width - PAGE_MARGIN * 2;
  const padding = 14;
  doc.font("body").fontSize(10);
  const height = Math.max(54, doc.heightOfString(text, { width: width - padding * 2 }) + padding * 2);
  ensureSpace(doc, height + 8);
  const y = doc.y;
  doc.save();
  doc
    .lineWidth(0.7)
    .fillColor(options.bg || "#f8fafc")
    .strokeColor(options.border || BORDER)
    .roundedRect(left, y, width, height, 6)
    .fillAndStroke();
  doc.restore();
  doc
    .fillColor(options.color || ACCENT)
    .font("body")
    .fontSize(10)
    .text(text, left + padding, y + padding, { width: width - padding * 2 });
  doc.y = y + height;
  doc.moveDown(0.6);
}

function drawPVPassportSummary(doc: PDFKit.PDFDocument, input: ReportInput) {
  if (!supportsExpertPvSummary(input)) return;
  const pv = input.pv;
  const internal = pv.loggers.filter(logger => logger.role === "internal");
  const external = pv.loggers.filter(logger => logger.role === "external");
  const durationMs = pv.startAt && pv.endAt ? pv.endAt - pv.startAt : 0;
  const period = `${pv.startAt ? fmtDate(pv.startAt) : "—"} — ${pv.endAt ? fmtDate(pv.endAt) : "—"}`;
  const samplingStep = pv.samplingStepMinutes ? `${pv.samplingStepMinutes} мин` : "—";
  const accuracy = pv.sensorAccuracy !== undefined && pv.sensorAccuracy !== null ? `±${pv.sensorAccuracy.toFixed(1)} °C` : "—";

  drawSubTitle(doc, "Паспорт испытания PQ/PV");
  drawKVTable(doc, [
    ["Объект испытания", getEquipmentName(input)],
    ["Температурный режим / критерий", `${pvTemperatureModeLabel(pv, input)}; расчетный диапазон ${fmtTempRange(pv.rangeMin, pv.rangeMax)}`],
    ["Период мониторинга", period],
    ["Фактическая длительность", durationMs > 0 ? fmtDuration(durationMs) : "—"],
    ["Логгеры в расчете", `${internal.length} внутренних; ${external.length} внешних`],
    ["Шаг регистрации / погрешность", `${samplingStep}; ${accuracy}`],
    ["Итог PQ/PV", verdictLabelLocal(pv.verdict, input)],
  ], 190);
}

function drawPVCriticalInterpretationSummary(doc: PDFKit.PDFDocument, input: ReportInput) {
  if (!supportsExpertPvSummary(input)) return;
  drawPVCriticalPointsSummary(doc, input);
  drawPVResultInterpretation(doc, input);
}

function drawPVCalculationMethodSection(
  doc: PDFKit.PDFDocument,
  input: ReportInput,
  options: { title?: string; compact?: boolean } = {},
) {
  if (!supportsExpertPvSummary(input)) return;
  const en = isEnglishWarehouse(input);
  const compact = options.compact ?? false;
  drawSubTitle(doc, options.title ?? (en ? "PQ/PV Calculation Method" : "Методика расчета показателей PQ/PV"));

  drawPVInfoBox(
    doc,
    en
      ? "Calculation is performed for each internal data logger over the approved PQ/PV time window. External loggers are used to interpret ambient influence and are not included in the main acceptance calculation or critical-point ranking."
      : "Расчет выполняется для каждого внутреннего регистратора данных за утвержденный интервал PQ/PV. Внешние регистраторы используются для оценки влияния окружающей среды и не включаются в основной расчет критериев приемлемости и выбор критических точек.",
    { bg: "#f8fafc", border: BORDER, color: ACCENT },
  );

  const formulaRows = en
    ? [
        ["Min", "Tmin = min(T1...Tn)", "Lowest measured temperature in the selected PQ/PV interval."],
        ["Max", "Tmax = max(T1...Tn)", "Highest measured temperature in the selected PQ/PV interval."],
        ["Avg", "Tavg = (T1 + T2 + ... + Tn) / n", "Arithmetic mean temperature for the logger."],
        ["Std", "Std = sqrt(sum((Ti - Tavg)^2) / n)", "Temperature variation around the mean value."],
        ["MKT", "MKT = -dH/R / ln((1/n) x sum(exp(-dH/(R x Tk_i)))) - 273.15", "Mean kinetic temperature; Tk_i = Ti + 273.15 K, dH = 83144 J/mol, R = 8.314 J/(mol x K)."],
        ["Deviation duration", "D = sum(delta t outside limits)", "Total time when values are below the lower limit or above the upper limit."],
      ]
    : [
        ["Min", "Tmin = min(T1...Tn)", "Минимальная измеренная температура в выбранном интервале PQ/PV."],
        ["Max", "Tmax = max(T1...Tn)", "Максимальная измеренная температура в выбранном интервале PQ/PV."],
        ["Avg", "Tavg = (T1 + T2 + ... + Tn) / n", "Среднее арифметическое значение температуры по регистратору."],
        ["Std", "Std = sqrt(sum((Ti - Tavg)^2) / n)", "Оценка разброса температурных значений относительно среднего."],
        ["MKT", "MKT = -dH/R / ln((1/n) x sum(exp(-dH/(R x Tk_i)))) - 273,15", "Среднекинетическая температура; Tk_i = Ti + 273,15 K, dH = 83144 Дж/моль, R = 8,314 Дж/(моль x K)."],
        ["Длительность отклонений", "D = sum(delta t вне границ)", "Суммарное время значений ниже нижней границы или выше верхней границы режима."],
      ];

  if (getReportEquipmentType(input) === "chamber") {
    drawChamberFormulae(doc, PAGE_MARGIN);
  } else drawSimpleTable(
    doc,
    en ? ["Indicator", "Formula", "Meaning"] : ["Показатель", "Формула", "Что подтверждает"],
    formulaRows,
    [0.16, 0.38, 0.46],
    { fontSize: compact ? 7.8 : 8.2, headerFontSize: 8.4, padding: 5, headerHeight: 24, headerLineBreak: true },
  );

  drawPVInfoBox(
    doc,
    en
      ? "Critical points are selected by a risk vector, not by a single isolated value. Hot point vector: [high excursion present, total high-excursion duration, worst high excursion, Max, MKT, Avg]. Cold point vector: [low excursion present, total low-excursion duration, worst low excursion, Min, Avg]. Loggers are compared factor by factor in this order; the first material difference substantiates the selected critical point."
      : "Критические точки выбираются по риск-вектору, а не по одному изолированному значению. Для горячей точки применяется вектор: [наличие превышений, суммарная длительность превышений, наиболее выраженное превышение, Max, MKT, Avg]. Для холодной точки применяется вектор: [наличие понижений, суммарная длительность понижений, наиболее выраженное понижение, Min, Avg]. Регистраторы сравниваются последовательно по указанным факторам; первое существенное отличие является доказательством выбора критической точки.",
    { bg: "#ecfdf5", border: "#a7f3d0", color: "#065f46" },
  );
}

const CRITICAL_SCORE_LABELS: Record<"hot" | "cold", string[]> = {
  hot: [
    "наличие превышений",
    "суммарная длительность превышений",
    "наиболее выраженное превышение",
    "Max",
    "MKT",
    "Avg",
  ],
  cold: [
    "наличие понижений",
    "суммарная длительность понижений",
    "наиболее выраженное понижение",
    "Min",
    "Avg",
  ],
};

function compareCriticalScoreTuples(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (Math.abs(diff) > 1e-9) return diff;
  }
  return 0;
}

function criticalDeviationEvidence(logger: LoggerSummary, kind: "hot" | "cold"): string {
  const relevant = (logger.deviations ?? []).filter(dev => kind === "hot" ? dev.type === "high" : dev.type === "low");
  if (relevant.length === 0) {
    return kind === "hot"
      ? "превышений верхней границы не зарегистрировано"
      : "понижений ниже нижней границы не зарегистрировано";
  }
  const totalDuration = relevant.reduce((sum, dev) => sum + Math.max(0, dev.durationMs), 0);
  const worst = kind === "hot"
    ? relevant.reduce((max, dev) => Math.max(max, dev.value), -Infinity)
    : relevant.reduce((min, dev) => Math.min(min, dev.value), Infinity);
  return `${relevant.length} откл.; суммарно ${fmtDuration(totalDuration)}; худшее значение ${fmtTempMetric(worst)}`;
}

function criticalScoreFactorValue(logger: LoggerSummary, kind: "hot" | "cold", factorIndex: number): string {
  if (factorIndex === 0) {
    const count = (logger.deviations ?? []).filter(dev => kind === "hot" ? dev.type === "high" : dev.type === "low").length;
    return count > 0 ? "есть" : "нет";
  }
  if (factorIndex === 1) {
    const totalDuration = (logger.deviations ?? [])
      .filter(dev => kind === "hot" ? dev.type === "high" : dev.type === "low")
      .reduce((sum, dev) => sum + Math.max(0, dev.durationMs), 0);
    return fmtDuration(totalDuration);
  }
  if (factorIndex === 2) {
    const relevant = (logger.deviations ?? []).filter(dev => kind === "hot" ? dev.type === "high" : dev.type === "low");
    if (relevant.length === 0) return "—";
    const worst = kind === "hot"
      ? relevant.reduce((max, dev) => Math.max(max, dev.value), -Infinity)
      : relevant.reduce((min, dev) => Math.min(min, dev.value), Infinity);
    return fmtTempMetric(worst);
  }
  if (kind === "hot") {
    if (factorIndex === 3) return fmtTempMetric(logger.max);
    if (factorIndex === 4) return fmtTempMetric(logger.mkt);
    if (factorIndex === 5) return fmtTempMetric(logger.avg);
  } else {
    if (factorIndex === 3) return fmtTempMetric(logger.min);
    if (factorIndex === 4) return fmtTempMetric(logger.avg);
  }
  return "—";
}

function criticalSelectionEvidence(input: ReportInput, logger: LoggerSummary, kind: "hot" | "cold"): string {
  const ranked = input.pv.loggers
    .map((item, index) => ({ item, index, score: criticalLoggerScore(item, kind) }))
    .filter(entry => entry.item.role === "internal" && [entry.item.min, entry.item.max, entry.item.avg, entry.item.mkt].some(value => finiteNumberOrNull(value) !== null))
    .sort((a, b) => compareCriticalScoreTuples(b.score, a.score));
  const next = ranked.find(entry => entry.item !== logger);
  const metricSummary = kind === "hot"
    ? `Max ${fmtTempMetric(logger.max)}, MKT ${fmtTempMetric(logger.mkt)}, Avg ${fmtTempMetric(logger.avg)}`
    : `Min ${fmtTempMetric(logger.min)}, Avg ${fmtTempMetric(logger.avg)}`;
  const factorSummary = CRITICAL_SCORE_LABELS[kind]
    .map((label, index) => `${label}: ${criticalScoreFactorValue(logger, kind, index)}`)
    .join("; ");
  if (!next) {
    return `Выбор выполнен по комплексной оценке PQ/PV: ${criticalDeviationEvidence(logger, kind)}; ${metricSummary}. Подтверждающие факторы выбранной точки: ${factorSummary}.`;
  }

  const firstDiffIndex = logger
    ? criticalLoggerScore(logger, kind).findIndex((value, index) => Math.abs(value - (next.score[index] ?? 0)) > 1e-9)
    : -1;
  const firstDiffText = firstDiffIndex >= 0
    ? `Ключевое отличие от ближайшей альтернативы ${shortLoggerDisplay(next.item)}: ${CRITICAL_SCORE_LABELS[kind][firstDiffIndex]} (${criticalScoreFactorValue(logger, kind, firstDiffIndex)} против ${criticalScoreFactorValue(next.item, kind, firstDiffIndex)}).`
    : `Ближайшая альтернатива: ${shortLoggerDisplay(next.item)}; различия по расчетным факторам минимальны.`;

  return `Выбор выполнен по комплексной оценке PQ/PV: ${criticalDeviationEvidence(logger, kind)}; ${metricSummary}. Подтверждающие факторы выбранной точки: ${factorSummary}. ${firstDiffText}`;
}

function drawPVCriticalPointsSummary(doc: PDFKit.PDFDocument, input: ReportInput) {
  const pv = input.pv;
  const internal = pv.loggers.filter(logger => logger.role === "internal" && finiteNumberOrNull(logger.avg) !== null);
  drawSubTitle(doc, "Критические точки PQ/PV");

  if (internal.length < 2) {
    drawPVInfoBox(
      doc,
      "Для выделения отдельных горячей и холодной точек требуется не менее двух внутренних логгеров с расчетными показателями. При меньшем количестве точек результат оценивается по общей статистике PQ/PV.",
      { bg: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
    );
    return;
  }

  const critical = calculateCriticalLoggerIndices(pv.loggers);
  drawPVInfoBox(
    doc,
    "Критические точки PQ/PV определяются по комплексной оценке PQ/PV, риск-ориентированно, а не по одному минимальному или максимальному значению. Для каждого внутреннего логгера сопоставляются расчетные факторы температурного риска. Для горячей точки последовательно учитываются: наличие превышений верхней границы, суммарная длительность превышений, наиболее выраженное превышение, Max, MKT и Avg. Для холодной точки последовательно учитываются: наличие понижений ниже нижней границы, суммарная длительность понижений, наиболее выраженное понижение, Min и Avg. Сравнение выполняется по первому отличающемуся фактору в указанном порядке; поэтому логгер с самым высоким Avg не обязательно является горячей точкой, если другой логгер имеет более значимый температурный риск.",
    { bg: "#f8fafc", border: BORDER, color: ACCENT },
  );
  const rows: string[][] = [];
  const addRow = (kind: "hot" | "cold", index: number | null) => {
    if (index === null) return;
    const logger = pv.loggers[index];
    if (!logger) return;
    rows.push([
      kind === "hot" ? "Горячая точка" : "Холодная точка",
      shortLoggerDisplay(logger),
      `${fmtTempMetric(logger.min)} / ${fmtTempMetric(logger.avg)} / ${fmtTempMetric(logger.max)}`,
      fmtTempMetric(logger.mkt),
      criticalSelectionEvidence(input, logger, kind),
    ]);
  };

  addRow("hot", critical.hotIdx);
  addRow("cold", critical.coldIdx);

  if (rows.length === 0) {
    drawPVInfoBox(doc, "Критические точки не определены: отсутствует достаточный набор расчетных данных внутренних логгеров.");
    return;
  }

  drawSimpleTable(
    doc,
    ["Точка", "Логгер", "Min / Avg / Max", "MKT", "Доказательство выбора"],
    rows,
    [0.14, 0.11, 0.21, 0.09, 0.45],
  );
}

function drawPVResultInterpretation(doc: PDFKit.PDFDocument, input: ReportInput) {
  const pv = input.pv;
  const internal = pv.loggers
    .filter(logger => logger.role === "internal")
    .map(logger => ({ logger, avg: finiteNumberOrNull(logger.avg) }))
    .filter(item => item.avg !== null) as Array<{ logger: LoggerSummary; avg: number }>;

  drawSubTitle(doc, "Интерпретация результата PQ/PV");

  if (internal.length === 0) {
    drawPVInfoBox(doc, "Интерпретация не сформирована: отсутствуют расчетные данные внутренних логгеров.");
    return;
  }

  const sortedByAvg = [...internal].sort((a, b) => a.avg - b.avg);
  const coldByAvg = sortedByAvg[0];
  const hotByAvg = sortedByAvg[sortedByAvg.length - 1];
  const avgSpread = hotByAvg.avg - coldByAvg.avg;
  const deviations = internal.reduce((sum, item) => sum + (item.logger.deviations?.length ?? 0), 0);
  const critical = calculateCriticalLoggerIndices(pv.loggers);
  const criticalHot = critical.hotIdx !== null ? pv.loggers[critical.hotIdx] : null;
  const criticalCold = critical.coldIdx !== null ? pv.loggers[critical.coldIdx] : null;
  const includePlacementText = !isWarehouseLike(getReportEquipmentType(input));
  const loggerWithOptionalPlacement = (logger: LoggerSummary) => {
    const loggerLabel = shortLoggerDisplay(logger);
    return includePlacementText ? `${loggerLabel} (${placementLabel(input, logger)})` : loggerLabel;
  };

  const verdictText =
    pv.verdict === "pass"
      ? "На основании выполненного мониторинга эксплуатационная квалификация / валидация PQ/PV признана пройденной."
      : pv.verdict === "fail"
        ? "На основании выполненного мониторинга эксплуатационная квалификация / валидация PQ/PV признана не пройденной; требуется анализ причин и корректирующие действия."
        : "Итоговый вывод PQ/PV не сформирован, так как этап не завершен.";

  const deviationText =
    deviations === 0
      ? "Отклонения за пределы установленного температурного режима по внутренним логгерам не зарегистрированы."
      : `Зарегистрировано отклонений по внутренним логгерам: ${deviations}; детализация приведена в разделе зафиксированных отклонений.`;

  const criticalText =
    criticalHot && criticalCold
      ? `Критические точки по комплексной оценке: горячая — ${loggerWithOptionalPlacement(criticalHot)}, холодная — ${loggerWithOptionalPlacement(criticalCold)}.`
      : "Критические точки по комплексной оценке не выделены из-за недостаточного количества сопоставимых внутренних логгеров.";

  const text =
    `Диапазон средних значений внутренних логгеров составил ${fmtTempMetric(coldByAvg.avg)}...${fmtTempMetric(hotByAvg.avg)}; разница между максимальной и минимальной средней температурой — ${fmtTempMetric(avgSpread)}. ` +
    `По средним значениям наиболее холодная зона: ${loggerWithOptionalPlacement(coldByAvg.logger)}, наиболее теплая зона: ${loggerWithOptionalPlacement(hotByAvg.logger)}. ` +
    `${criticalText} ${deviationText} ${verdictText}`;

  const boxStyle =
    pv.verdict === "pass"
      ? { bg: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : pv.verdict === "fail"
        ? { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" }
        : { bg: "#f8fafc", border: BORDER, color: ACCENT };
  drawPVInfoBox(doc, text, boxStyle);
}

function drawWarehouseOperationalEventsSection(doc: PDFKit.PDFDocument, input: ReportInput) {
  if (!isWarehouseEaeu(getReportEquipmentType(input))) return;
  const en = isEnglishWarehouse(input);
  drawSubTitle(doc, en ? "Operational Events Log" : "Журнал эксплуатационных событий");
  drawPVInfoBox(
    doc,
    en
      ? "According to the data entered in the portal, no abnormal events that could affect the temperature profile were recorded during the study period. Routine door/gate openings were considered part of normal storage-area operation. Prolonged or abnormal door/gate openings, power failure, maintenance work or other events, if they occur, shall be recorded with date, time, duration and reason."
      : "По данным, внесённым в портал, в период исследования не зарегистрированы нештатные события, способные повлиять на температурный режим. Рутинные открытия дверей/ворот рассматривались как часть штатной эксплуатации помещения хранения. Длительные или нештатные открытия дверей/ворот, отключение электропитания, ремонтные работы и иные события, при их возникновении, подлежат фиксации с указанием даты, времени, продолжительности и причины.",
    { bg: "#f8fafc", border: BORDER, color: ACCENT },
  );
}

function drawStatsTable(
  doc: PDFKit.PDFDocument,
  loggers: LoggerSummary[],
  hotIdx: number | null,
  coldIdx: number | null,
  extIndices: number[],
  input?: ReportInput,
) {
  const en = isEnglishWarehouse(input);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const cols = [
    { label: en ? "Logger" : "Датчик", w: 0.14 },
    { label: en ? "Role" : "Роль", w: 0.14 },
    { label: "Min, °C", w: 0.1 },
    { label: "Max, °C", w: 0.1 },
    { label: "Avg, °C", w: 0.11 },
    { label: "STD", w: 0.08 },
    { label: "MKT, °C", w: 0.11 },
    { label: en ? "Points" : "Точек", w: 0.10 },
    { label: en ? "Dev." : "Откл.", w: 0.08 },
  ];

  const ROW_H = 26; // Increased by 10% from 24
  const HEADER_H = 24; // Increased by 10% from 22

  const drawHeader = () => {
    const y = doc.y;
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
  };

  const tableHeight = HEADER_H + loggers.length * ROW_H;
  const maxTableHeight = doc.page.height - PAGE_MARGIN - HEADER_CONTENT_TOP;
  ensureSpace(doc, tableHeight <= maxTableHeight ? tableHeight : HEADER_H + ROW_H);
  drawHeader();

  loggers.forEach((l, idx) => {
    if (doc.y + ROW_H > doc.page.height - PAGE_MARGIN) {
      doc.addPage();
      doc.y = HEADER_CONTENT_TOP;
      drawHeader();
    }
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, w, ROW_H).fill();
      doc.restore();
    }
    let role = l.role === "external" ? (en ? "external" : "внеш.") : (en ? "internal" : "внутр.");
    if (idx === hotIdx) role = en ? "internal hot" : "внутр. гор.";
    if (idx === coldIdx) role = en ? "internal cold" : "внутр. хол.";
    const rawLabel = shortSensorId(l.label) || l.label;
    const name = rawLabel;
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
  const en = isEnglishWarehouse(input);
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
      en
        ? "The overview chart shows temperature curves for all internal loggers on one diagram. " +
          "The green band indicates the allowable temperature range (" + (pv.rangeMin > 0 ? '+' : '') + pv.rangeMin + "…" + (pv.rangeMax > 0 ? '+' : '') + pv.rangeMax + " °C). " +
          "Curves remaining within the band indicate stable storage conditions. Crossing the band indicates an excursion requiring assessment."
        : "Обзорный график показывает температурные кривые всех внутренних датчиков на одной диаграмме. " +
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
    const externalChartText = en
      ? "The external logger chart shows ambient temperature outside the storage room / storage area. This logger is not included in the main PQ/PV acceptance calculation, but supports assessment of environmental influence."
      : isWarehouseLike(getReportEquipmentType(input))
      ? "\u0413\u0440\u0430\u0444\u0438\u043a \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u0442 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044b \u0432\u043d\u0435 \u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u044f (\u0437\u043e\u043d\u044b) \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f. " +
        "Этот датчик не входит в расчёт критериев приемлемости PQ/PV, но помогает оценить влияние среды."
      : "\u0413\u0440\u0430\u0444\u0438\u043a \u0432\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u0442 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u0443 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044b \u0432\u043d\u0435 " + reeferAreaGenitive(getReportEquipmentType(input)) + ". " +
        "Этот датчик не входит в расчёт критериев приемлемости PQ/PV, но помогает оценить влияние среды.";
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
      en
        ? "The hot point chart shows the internal logger selected by PQ/PV temperature-risk ranking: out-of-range excursions, excursion duration and severity, maximum temperature, MKT and average temperature. This supports worst-case assessment of the warmest/least favourable area."
        : isWarehouseLike(getReportEquipmentType(input))
        ? "График горячей точки показывает внутренний датчик, выбранный по риск-оценке PQ/PV: отклонения за пределы режима, длительность и выраженность отклонений, максимальная температура, MKT и среднее значение. Это поддерживает оценку наихудшей тёплой зоны помещения."
        : "График горячей точки показывает внутренний датчик, выбранный по риск-оценке PQ/PV: отклонения за пределы режима, длительность и выраженность отклонений, максимальная температура, MKT и среднее значение. Это поддерживает оценку наихудшей тёплой зоны в " + reeferAreaAfterIn(getReportEquipmentType(input)) + "."
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
      en
        ? "The cold point chart shows the internal logger selected by PQ/PV temperature-risk ranking: out-of-range low excursions, excursion duration and severity, minimum temperature and average temperature. This supports worst-case assessment of the coldest area."
        : isWarehouseLike(getReportEquipmentType(input))
        ? "График холодной точки показывает внутренний датчик, выбранный по риск-оценке PQ/PV: отклонения ниже режима, длительность и выраженность отклонений, минимальная температура и среднее значение. Это поддерживает оценку наихудшей холодной зоны помещения."
        : "График холодной точки показывает внутренний датчик, выбранный по риск-оценке PQ/PV: отклонения ниже режима, длительность и выраженность отклонений, минимальная температура и среднее значение. Это поддерживает оценку наихудшей холодной зоны в " + reeferAreaAfterIn(getReportEquipmentType(input)) + "."
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
      en
        ? "The heat map shows distribution of average temperatures across all internal loggers in the storage room / storage area."
        : isWarehouseLike(getReportEquipmentType(input))
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
      en
        ? "The statistics chart shows key parameters for each logger: minimum, average, maximum and MKT. MKT is used as an integrated indicator of thermal exposure to medicinal products."
        : "\u0413\u0440\u0430\u0444\u0438\u043a \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0438 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0434\u043b\u044f \u043a\u0430\u0436\u0434\u043e\u0433\u043e \u0434\u0430\u0442\u0447\u0438\u043a\u0430: \u043c\u0438\u043d\u0438\u043c\u0443\u043c, \u0441\u0440\u0435\u0434\u043d\u0435\u0435, \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0438 MKT. MKT \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f \u043a\u0430\u043a \u043e\u0431\u043e\u0431\u0449\u0451\u043d\u043d\u044b\u0439 \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c \u0442\u0435\u0440\u043c\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e \u0432\u043e\u0437\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u043d\u0430 \u043f\u0440\u043e\u0434\u0443\u043a\u0446\u0438\u044e."
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

function drawDeviationsSection(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const en = isEnglishWarehouse(input);
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
  doc.fillColor(ACCENT).font("bold").fontSize(12).text(en ? "Recorded Deviations" : "Зафиксированные отклонения");
  doc.moveDown(0.3);
  if (all.length === 0) {
    doc
      .fillColor(MUTED)
      .font("body")
      .fontSize(10)
      .text(en ? "No deviations outside the specified range were recorded during the study." : "Отклонений за границы режима в течение испытания не зафиксировано.");
    doc.moveDown(0.4);
    return;
  }

  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  const cols = [
    { label: en ? "Logger" : "Датчик", w: 0.22 },
    { label: en ? "Type" : "Тип", w: 0.17 },
    { label: en ? "Start" : "Начало", w: 0.185 },
    { label: en ? "End" : "Окончание", w: 0.185 },
    { label: en ? "Duration" : "Длительность", w: 0.14 },
    { label: en ? "Extreme, °C" : "Экстремум, °C", w: 0.1 },
  ];
  const padding = 4;
  const headerFontSize = 8.5;
  doc.font("bold").fontSize(headerFontSize);
  const headerH = Math.max(
    24,
    ...cols.map(c =>
      doc.heightOfString(c.label, { width: c.w * w - padding * 2 }) + padding * 2,
    ),
  );
  ensureSpace(doc, headerH + 4);
  let y = doc.y;
  doc.save();
  doc.rect(left, y, w, headerH).fill(ACCENT);
  doc.restore();
  let cx = left;
  doc.fillColor("white").font("bold").fontSize(headerFontSize);
  cols.forEach(c => {
    const cw = c.w * w;
    doc.text(c.label, cx + padding, y + padding, { width: cw - padding * 2 });
    cx += cw;
  });
  doc.y = y + headerH;

  all.forEach((d, idx) => {
    const cells = [
      d.label,
      d.type === "high" ? (en ? "High" : "Превышение") : (en ? "Low" : "Понижение"),
      fmtDate(d.start),
      fmtDate(d.end),
      fmtDuration(d.durationMs),
      d.value.toFixed(2),
    ];
    doc.font("body").fontSize(9);
    const rowH = Math.max(
      24,
      ...cells.map((val, i) =>
        doc.heightOfString(val || "—", { width: cols[i].w * w - padding * 2 }) + padding * 2,
      ),
    );
    ensureSpace(doc, rowH);
    const ry = doc.y;
    if (idx % 2 === 0) {
      doc.save();
      doc.fillColor(SOFT_BG).rect(left, ry, w, rowH).fill();
      doc.restore();
    }
    let cx2 = left;
    doc.font("body").fontSize(9).fillColor(d.type === "high" ? "#b91c1c" : "#1d4ed8");
    cells.forEach((val, i) => {
      const cw = cols[i].w * w;
      doc.text(val, cx2 + padding, ry + padding, { width: cw - padding * 2 });
      cx2 += cw;
    });
    doc.y = ry + rowH;
  });
  doc.moveDown(0.4);
}

function drawStagePVVerdict(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const en = isEnglishWarehouse(input);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;
  ensureSpace(doc, 120);
  doc.moveDown(0.5);
  doc.x = left;
  doc.fillColor(ACCENT).font("bold").fontSize(12).text(
    en ? "PQ/PV Stage Conclusion" : "Заключение по этапу PQ/PV",
    left,
    doc.y,
    { width: w, align: "center", lineBreak: false },
  );
  doc.moveDown(0.3);
  let text = en ? "Conclusion has not been generated — the stage is not completed." : "Заключение не сформировано — этап не завершён.";
  let bg = "#f1f5f9";
  let bd = BORDER;
  let fg = ACCENT;
  if (pv.verdict === "pass") {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    
    // Enhanced conclusion for warehouse protocols with sensor analysis
    if (isWarehouseLike(getReportEquipmentType(input))) {
      const hotSensor = pv.hotIdx !== null ? pv.loggers[pv.hotIdx] : null;
      const coldSensor = pv.coldIdx !== null ? pv.loggers[pv.coldIdx] : null;
      const hotLabel = hotSensor ? `${en ? "logger" : "датчик"} "${shortLoggerDisplay(hotSensor)}"` : (en ? "logger" : "датчик");
      const coldLabel = coldSensor ? `${en ? "logger" : "датчик"} "${shortLoggerDisplay(coldSensor)}"` : (en ? "logger" : "датчик");
      const internalCount = pv.loggers.filter(l => l.role === "internal").length;
      
      text = en
        ? "All acceptance criteria are met. The PQ/PV temperature mapping stage has been completed successfully. " +
          `Analysis of ${internalCount} internal logger(s) demonstrates stable temperature distribution throughout the storage room / storage area volume. ` +
          (hotSensor ? `The maximum temperature was recorded by ${hotLabel} (hot point). ` : "") +
          (coldSensor ? `The minimum temperature was recorded by ${coldLabel} (cold point). ` : "") +
          "The HVAC/heating system operates normally and provides appropriate storage conditions for medicinal products."
        : "Все критерии приемлемости выполнены. Этап температурного картирования PQ/PV выполнен успешно. " +
          `Анализ данных ${internalCount} внутренних датчиков показал стабильное распределение температуры ` +
          "по всему объёму помещения (зоны) хранения. " +
          (hotSensor ? `Максимальная температура зафиксирована ${hotLabel} (горячая точка). ` : "") +
          (coldSensor ? `Минимальная температура зафиксирована ${coldLabel} (холодная точка). ` : "") +
          "Система кондиционирования/отопления функционирует в штатном режиме, обеспечивая равномерное распределение " +
          "температуры и надлежащие условия для хранения лекарственных средств.";
    } else {
      text =
        "Все критерии приемлемости выполнены. Эксплуатационная квалификация / валидация (PQ/PV) пройдена успешно. " +
        "Оборудование признано пригодным для хранения лекарственных средств в указанном режиме.";
    }
  } else if (pv.verdict === "fail") {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    text =
      (en ? "Performance Qualification / Validation (PQ/PV) failed. Non-conformities were recorded:\n" : "Эксплуатационная квалификация / валидация (PQ/PV) не пройдена. Зафиксированы несоответствия:\n") +
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
  const en = isEnglishWarehouse(input);
  const eqName = input ? getEquipmentName(input) : "оборудования";
  const eqGen = eqName.toLowerCase();
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;

  ensureSpace(doc, 100);
  doc.moveDown(0.3);
  doc.fillColor(ACCENT).font("bold").fontSize(11).text(en ? "Sensor Placement Analysis and Risk Assessment" : "Анализ расстановки датчиков и оценка рисков", left, doc.y, { width: w });
  doc.moveDown(0.2);

  const internals = sensors.filter(s => s.role === "internal");
  const externals = sensors.filter(s => s.role === "external");
  const eqType = getReportEquipmentType(input);
  const isRiskOrientedAutoReefer = isAutoRefrigeratorLike(eqType) && internals.length > 0 && internals.length < 15;

  if (en) {
    const analysisText =
      `Internal data loggers are placed at representative points across the storage room / storage area volume to identify temperature gradients, hot points and cold points. ` +
      `The placement covers the room geometry and relevant risk areas such as walls, corners, doors, shelving zones and areas influenced by HVAC/heating equipment where applicable. ` +
      (externals.length > 0
        ? "The external logger monitors ambient conditions outside the storage area and is not included in the main PQ/PV acceptance calculation, but supports interpretation of environmental influence."
        : "No external logger is included in the sensor placement set.");
    doc.font("body").fontSize(10).fillColor(ACCENT);
    doc.text(analysisText, left, doc.y, { width: w, align: "justify", lineGap: 2 });
    doc.moveDown(0.5);
    return;
  }

  let analysisText = "";

  if (isRiskOrientedAutoReefer) {
    analysisText +=
      `Для данного авторефрижератора принята риск-ориентированная фактическая схема размещения: ${internals.length} внутренних регистраторов данных` +
      (externals.length > 0 ? ` и ${externals.length} внешний регистратор` : "") +
      ". Количество и позиции регистраторов определены с учетом объема грузового отсека, расположения холодильного агрегата, дверей, зон возможного температурного градиента, маршрута циркуляции воздуха и условий фактической эксплуатации. Выбранная схема направлена на покрытие наиболее критичных зон и оценку равномерности температурного распределения в рамках данного исследования.\n\n";
  }

  // Analyze internal sensor placement
  if (internals.length > 0) {
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

    const placementArea = isWarehouseLike(getReportEquipmentType(input))
      ? "\u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u044f (\u0437\u043e\u043d\u044b) \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f"
      : reeferAreaGenitive(getReportEquipmentType(input));
    const positions = [];
    if (hasTop) positions.push("верхняя полка");
    if (hasMiddle) positions.push("средняя часть");
    if (hasBottom) positions.push("нижняя полка");
    if (hasDoor) positions.push("дверная зона");
    if (positions.length > 0) {
      analysisText += "\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043a\u0438 \u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u044b \u0432 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0445 \u043f\u043e\u0437\u0438\u0446\u0438\u044f\u0445 " + placementArea + ": ";
      analysisText += positions.join(", ") + ".\n\n";
    } else {
      analysisText += "\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u0434\u0430\u0442\u0447\u0438\u043a\u0438 \u0440\u0430\u0441\u043f\u043e\u043b\u0430\u0433\u0430\u044e\u0442\u0441\u044f \u043f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0439 \u0441\u0445\u0435\u043c\u0435 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u044f " + placementArea + ".\n\n";
    }

    if (isWarehouseLike(getReportEquipmentType(input))) {
      analysisText +=
        `Такая многоточечная расстановка позволяет выявить температурные градиенты внутри помещения (зоны) хранения и оценить ` +
        "равномерность распределения температуры по всему объёму помещения. Датчики на верхней и нижней полках фиксируют " +
        "потенциальные зоны риска, где может возникнуть локальное отклонение температуры от установленного диапазона. " +
        "Это критически важно для обеспечения стабильности условий хранения лекарственных средств и выявления " +
        "неисправностей системы кондиционирования или отопления на ранних этапах.\n\n";
    } else if (getReportEquipmentType(input) === "chamber") {
      analysisText +=
        "Такая многоточечная расстановка позволяет выявить температурные градиенты внутри холодильной камеры и оценить " +
        "равномерность распределения температуры по её рабочему объёму. При интерпретации учитываются зоны возле двери, " +
        "испарителя или холодильного агрегата, верхний и нижний уровни хранения, а также полки/стеллажи, которые могут " +
        "влиять на циркуляцию воздуха. Выбранная схема направлена на подтверждение пригодности камеры для хранения " +
        "лекарственных средств в заданном температурном режиме и на определение критических тёплой и холодной точек.\n\n";
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
    if (isWarehouseLike(getReportEquipmentType(input))) {
      analysisText +=
        "Внешний датчик установлен на улице и служит для мониторинга температуры окружающей среды " +
        "и не входит в расчёт основных критериев приемлемости этапа PQ/PV. Данные внешнего датчика используются для " +
        "анализа влияния условий окружающей среды на работу оборудования и могут быть полезны при " +
        "диагностике отклонений. Внешний датчик помогает отличить проблемы, вызванные неисправностью оборудования, " +
        "от колебаний, обусловленных изменениями температуры в окружающей среде.";
    } else {
      analysisText +=
        "\u0412\u043d\u0435\u0448\u043d\u0438\u0439 \u0434\u0430\u0442\u0447\u0438\u043a (\u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u043d\u044b\u0439 \u0432\u043d\u0435 " + reeferAreaGenitive(getReportEquipmentType(input)) + ") \u0441\u043b\u0443\u0436\u0438\u0442 \u0434\u043b\u044f \u043c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433\u0430 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u043e\u0432 \u043e\u043a\u0440\u0443\u0436\u0430\u044e\u0449\u0435\u0439 \u0441\u0440\u0435\u0434\u044b " +
        "и не входит в расчёт основных критериев приемлемости этапа PQ/PV. Данные внешнего датчика используются для анализа влияния условий окружающей среды на работу оборудования.";
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
  const en = isEnglishWarehouse(input);

  const all = [input.iq.verdict, input.oq.verdict, input.pv.verdict];
  const allPass = all.every(v => v === "pass");
  const anyFail = all.some(v => v === "fail");

  const lines: Array<[string, string]> = [
    [en ? "IQ stage — Installation Qualification" : "Этап IQ — квалификация монтажа", verdictLabelLocal(input.iq.verdict, input)],
    [en ? "OQ stage — Operational Qualification" : "Этап OQ — квалификация функционирования", verdictLabelLocal(input.oq.verdict, input)],
    [en ? "PQ/PV stage — Performance Qualification / Validation" : "Этап PQ/PV — эксплуатационная квалификация / валидация", verdictLabelLocal(input.pv.verdict, input)],
  ];
  if (input.excursion?.enabled) {
    const excVerdict = excursionVerdictLabel(input.excursion);
    lines.push([
      en ? "Temperature Excursion Study" : "Испытания на температурное отклонение (Excursion Study)",
      en ? excVerdict.replace("Пройдено", "Passed").replace("Не пройдено", "Failed").replace("Не завершено", "Not completed") : excVerdict,
    ]);
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
          ? (isWarehouseLike(getReportEquipmentType(input)) ? "\u041f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f" : reeferSubject(getReportEquipmentType(input))) + " \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u0442\u0440\u0435\u0431\u0443\u0435\u043c\u044b\u0439 \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0437\u0430 " + warmupText + "."
          : "Время входа в режим не определено.",
      doorOpeningDescription:
        doorOpeningMinutes !== null
          ? `Дверь можно открывать на время до ${doorOpeningText} без нарушения температурного режима.`
          : "Время открытия двери не определено.",
      thermalRetentionDescription:
        thermalRetentionMinutes !== null
          ? "\u041f\u0440\u0438 \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0438 \u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u043e\u0433\u043e \u0430\u0433\u0440\u0435\u0433\u0430\u0442\u0430 " + (isWarehouseLike(getReportEquipmentType(input)) ? "\u043e\u0431\u044a\u0435\u043a\u0442" : reeferArea(getReportEquipmentType(input))) + " \u0441\u043f\u043e\u0441\u043e\u0431\u0435\u043d \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u044c \u0442\u0440\u0435\u0431\u0443\u0435\u043c\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0432 \u0442\u0435\u0447\u0435\u043d\u0438\u0435 " + thermalRetentionText + "."
          : "Время сохранения режима не определено.",
    };
  }

  // Add operational parameters section.
  // Only когда аварийные (excursion) испытания действительно проводились — иначе
  // эти значения вычисляются из логгеров картирования и недостоверны (напр. «0 минут»).
  if (allPass && input.excursion?.enabled) {
    doc.moveDown(0.3);
    doc.font("body").fontSize(10).fillColor(MUTED);
    doc.text(en ? "Operational parameters:" : "Параметры эксплуатации:", { underline: true });
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
  let text = en ? "Validation is not completed. Not all stages have been completed successfully." : "Валидация не завершена. Не все этапы пройдены успешно.";
  if (allPass) {
    bg = "#ecfdf5";
    bd = "#a7f3d0";
    fg = "#065f46";
    const excNote = input.excursion?.enabled
      ? (en ? " Temperature excursion testing was performed and documented in the relevant section of this report." : ` Испытания на температурное отклонение проведены и зафиксированы в разделе 10 настоящего отчёта.`)
      : "";
    const suitabilityWord = getReportEquipmentType(input) === "chamber" ? "пригодной" : "пригодным";
    const isWarehouseConclusion = isWarehouseLike(getReportEquipmentType(input));
    text = en
      ? `Based on IQ, OQ and PQ/PV results, the commission recognizes ${isPharmacyStorageReport(input) ? "the pharmacy storage room / area" : "the storage room / storage area"} as suitable for storage of medicinal products within the temperature regime ${pvTemperatureModeLabel(input.pv, input)}${isWarehouseConclusion ? "." : " in accordance with GDP / GPP requirements."} The HVAC/heating system provides stable temperature distribution throughout the room volume. Validation has been completed with a positive conclusion.${excNote}`
      : "На основании результатов IQ, OQ и PQ/PV комиссия признаёт " + (isPharmacyStorageReport(input) ? "помещение (зону) хранения аптеки" : isWarehouseLike(getReportEquipmentType(input)) ? "помещение (зону) хранения" : reeferConclusionObject(input)) + " " +
        `${suitabilityWord} для хранения лекарственных средств ` +
        `в температурном режиме ${pvTemperatureModeLabel(input.pv, input)}${isWarehouseConclusion ? ". " : " в соответствии с требованиями GDP / GPP. "}` +
        (isWarehouseLike(getReportEquipmentType(input))
          ? `Система кондиционирования/отопления обеспечивает стабильное распределение температуры по всему объёму помещения. ` 
          : "") +
        `${isWarehouseConclusion ? "Испытание завершено" : "Валидация завершена"} с положительным заключением.${excNote}`;
  } else if (anyFail) {
    bg = "#fef2f2";
    bd = "#fecaca";
    fg = "#991b1b";
    text = en
      ? "Validation has been completed with a negative conclusion. The storage area cannot be released for operation until the recorded non-conformities are corrected and repeat testing is performed."
      : "Валидация завершена с отрицательным заключением. Оборудование не может быть допущено к эксплуатации " +
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
  input?: ReportInput,
) {
  const en = isEnglishWarehouse(input);
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
    doc.fillColor(MUTED).font("body").fontSize(9).text(en ? "Signature" : "Подпись", right - 220, y + 48);
    doc
      .strokeColor(BORDER)
      .lineWidth(0.6)
      .moveTo(left, y + 65)
      .lineTo(left + 160, y + 65)
      .stroke();
    doc.fillColor(MUTED).fontSize(9).text(en ? "Date" : "Дата", left, y + 68);
    doc.y = y + BLOCK_H;
  });
}

/* -------------------------------------------------------------------------- */
/* Part I plan helpers                                                         */
/* -------------------------------------------------------------------------- */

function drawChecklistPlan(doc: PDFKit.PDFDocument, items: ChecklistItem[], input?: ReportInput) {
  const en = isEnglishWarehouse(input);
  const visibleItems = items.filter(item => item.questionText.trim().length > 0);
  drawSubTitle(doc, en ? "List of Control Questions" : "Перечень контрольных вопросов");
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
  doc.text(en ? "Control question" : "Контрольный вопрос", left + numW + 6, y + 6, { width: qW - 12 });
  doc.y = y + 22;

  visibleItems.forEach((it, idx) => {
    const padding = 6;
    doc.font("body").fontSize(10);
    const questionText = verificationTerminology(it.questionText);
    const qH = doc.heightOfString(questionText, { width: qW - 12 });
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
      .text(questionText, left + numW + 6, ry + padding, { width: qW - 12 });
    doc.y = ry + rowH;
  });
  doc.moveDown(0.4);
}

function drawPVPlacementPlan(doc: PDFKit.PDFDocument, input: ReportInput) {
  const sensors = input.pvLoggers ?? [];
  if (sensors.length === 0) return;

  const eqType = getReportEquipmentType(input);
  const en = isEnglishWarehouse(input);
  doc.addPage();
  drawSectionTitle(
    doc,
    en
      ? "4.1. PQ/PV sensor placement plan and risk assessment"
      : "4.1. План расстановки датчиков и оценка рисков",
  );

  if (isWarehouseLike(eqType)) {
    drawWarehousePlanDiagram(
      doc,
      input,
      false,
      en
        ? "Diagram 1. Planned logger positions on the storage area plan"
        : "Схема 1. Планируемые позиции регистраторов на плане помещения",
      {
        showCriticalMarkers: false,
        showAverageLabels: false,
        showSensorLabels: false,
        showHeightLabels: true,
        showPlacementTable: false,
        showCaption: false,
      },
    );
  } else if (isReeferLike(eqType)) {
    drawReeferTruckDiagram3D(
      doc,
      sensors as DiagramSensor[],
      PAGE_MARGIN,
      null,
      null,
      true,
      en
        ? "Diagram 1. Reference logger positions in the cargo body"
        : "Схема 1. Эталонные позиции размещения регистраторов в грузовом отсеке",
      null,
      null,
      eqType === "chamber" || eqType === "thermal-container" ? "chamber" : "truck",
    );
  } else {
    const shelfObjectName = eqType === "freezer" ? "морозильника" : "холодильника";
    drawRefrigeratorDiagram(
      doc,
      sensors as DiagramSensor[],
      PAGE_MARGIN,
      null,
      null,
      `Схема 1. Планируемые позиции размещения датчиков по полкам ${shelfObjectName}`,
      "position",
      input.refrigeratorDrawerCount ?? 2,
      input.refrigeratorLevelCount ?? 7,
      null,
      null,
    );
  }

  drawSensorPlacementAnalysis(doc, sensors as DiagramSensor[], input);
}

function drawPVPlan(doc: PDFKit.PDFDocument, pv: ReportInput["pv"], input?: ReportInput) {
  const en = isEnglishWarehouse(input);
  const durationRequirement = pvDurationRequirementLabel(pv, input, true);
  const rows: Array<[string, string]> = [
    [en ? "Temperature mode" : "Температурный режим", pvTemperatureModeLabel(pv, input)],
    ...sensorAccuracyRows(pv, input),
    [en ? "Required test duration" : "Требуемая длительность испытания", durationRequirement],
    [en ? "Minimum internal loggers (configured)" : "Минимум внутренних датчиков (настройка)", String(pv.minSensorCount)],
    [
      en ? "Logger placement points" : "Места установки датчиков",
      pv.sensorPlacement
        || (isWarehouseLike(getReportEquipmentType(input))
          ? (en
              ? "Data loggers shall be arranged as a representative grid covering the storage area across its length, width and height. Where possible, loggers are positioned at comparable intervals. The external logger is installed outdoors to monitor ambient temperature."
              : "Регистраторы данных следует располагать в форме сетки и таким образом, чтобы они покрывали зону хранения по всей ее длине и ширине, а также высоте. Регистраторы данных размещаются по возможности с равными интервалами. Внешний датчик установлен на улице для мониторинга температуры окружающей среды.")
              : "\u0414\u0430\u0442\u0447\u0438\u043a\u0438 \u0440\u0430\u0441\u043f\u043e\u043b\u0430\u0433\u0430\u044e\u0442\u0441\u044f \u0432 \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u043d\u044b\u0445 \u0442\u043e\u0447\u043a\u0430\u0445 \u043e\u0431\u044a\u0451\u043c\u0430 " + reeferAreaGenitive(getReportEquipmentType(input)) + ", \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0445 \u043f\u043e \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0430\u043c \u0430\u043d\u0430\u043b\u0438\u0437\u0430 \u0440\u0438\u0441\u043a\u043e\u0432."),
    ],
  ];
  drawKVTable(doc, rows);
}

/* -------------------------------------------------------------------------- */
/* Part II report-only sections                                                */
/* -------------------------------------------------------------------------- */

function drawTestPeriod(doc: PDFKit.PDFDocument, input: ReportInput) {
  const en = isEnglishWarehouse(input);
  const pv = input.pv;
  const durationMs = pv.startAt && pv.endAt ? pv.endAt - pv.startAt : 0;
  const rows: Array<[string, string]> = [
    [en ? "Test start (PQ/PV)" : "Начало испытаний (PQ/PV)", pv.startAt ? fmtDate(pv.startAt) : "—"],
    [en ? "Test end (PQ/PV)" : "Окончание испытаний (PQ/PV)", pv.endAt ? fmtDate(pv.endAt) : "—"],
    [en ? "Actual duration" : "Фактическая длительность", durationMs ? fmtDuration(durationMs) : "—"],
  ];
  drawKVTable(doc, rows);
}

function drawPlanDeviationsSection(doc: PDFKit.PDFDocument, input: ReportInput) {
  const text = (input.planDeviations && input.planDeviations.trim())
    || enRu(
      input,
      "No deviations from the protocol plan were recorded. The study was performed in accordance with the approved Protocol (Part I).",
      "Отклонений от плана протокола не зафиксировано. Испытания проведены в полном соответствии с утверждённым планом Протокола (Часть I).",
    );
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text, { align: "justify" });
  doc.moveDown(0.6);
}

function drawRecommendationsSection(doc: PDFKit.PDFDocument, input: ReportInput) {
  const all = [input.iq.verdict, input.oq.verdict, input.pv.verdict];
  const anyFail = all.some(v => v === "fail");
  const equipmentType = getReportEquipmentType(input);
  const criticalPointRecommendation = isRefrigeratorCabinetLike(equipmentType)
    ? enRu(
        input,
        "It is also recommended to install measuring instruments or temperature monitoring system sensors at the critical points identified based on the validation results.",
        "Также рекомендуется установить средства измерения или датчики системы мониторинга температуры в критических точках, выявленных по результатам валидации.",
      )
    : isWarehouseLike(equipmentType)
      ? enRu(
          input,
          "It is also recommended to install temperature and air-humidity monitoring instruments or system sensors at the critical points identified based on the validation results.",
          "Также рекомендуется установить средства измерения или датчики системы мониторинга температуры и влажности воздуха в критических точках, выявленных по результатам валидации.",
        )
      : "";
  let text = (input.recommendations && input.recommendations.trim()) || "";
  if (!text) {
    text = anyFail
      ? enRu(
          input,
          "It is recommended to eliminate the identified non-conformities, perform corrective actions and repeat qualification for the failed stages. Until positive results are obtained, the storage area shall not be released for storage of medicinal products.",
          "Рекомендуется устранить выявленные несоответствия, выполнить корректирующие действия и провести повторную квалификацию по этапам, завершившимся с отрицательным заключением. До получения положительных результатов эксплуатация оборудования для хранения лекарственных средств не допускается.",
        )
      : enRu(
          input,
          "It is recommended to perform periodic requalification in accordance with the organization’s internal procedures and after changes to operating conditions, repair, reconstruction or relocation of the storage area.",
          "Рекомендуется проводить периодическую повторную квалификацию в соответствии с внутренними процедурами организации, а также при изменении условий эксплуатации, ремонте или перемещении оборудования.",
        );
  }
  if (criticalPointRecommendation && !text.includes(criticalPointRecommendation)) {
    text += `\n\n${criticalPointRecommendation}`;
  }
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text, { align: "justify" });
  doc.moveDown(0.6);
}

function drawMappingPeriodicitySection(doc: PDFKit.PDFDocument, input: ReportInput) {
  const text = (isEnglishWarehouse(input)
    ? "Initial temperature mapping shall be performed with consideration of both the cold and warm periods of the year.\n\n" +
      "Repeat mapping shall be performed at an interval established by the object owner based on a documented risk assessment. The recommended interval is once every three years, taking into account WHO recommendations.\n\n" +
      "Mapping shall be performed earlier than planned when changes capable of affecting the temperature profile occur, for example after repair, replacement or relocation of equipment, changes in operating conditions, or identification of temperature excursions."
    : "Первичное картирование проводится с учетом холодного и теплого периодов года.\n\n" +
      "Повторное картирование проводится с периодичностью, установленной владельцем объекта на основании оценки рисков. Рекомендуемый интервал — один раз в 3 года с учетом рекомендаций ВОЗ.\n\n" +
      "Картирование проводится ранее планируемого срока при изменениях, способных повлиять на температурный режим, например после ремонта, замены или перемещения оборудования, изменения условий эксплуатации либо выявления температурных отклонений.");

  renderTextBlock(doc, text);
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
  const en = isEnglishWarehouse(input);
  let period = (input.documentValidityPeriod && input.documentValidityPeriod.trim())
    ? input.documentValidityPeriod.trim()
    : (en ? "1 year" : "1 года"); // genitive: "в течение 1 года"
  
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
  
  const text = en
    ? `This document is valid for ${period} from the date of signing. After expiration, periodic requalification shall be performed in accordance with the organization’s internal procedures.`
    : `Настоящий документ действителен в течение ${period} с момента подписания. ` +
      `По истечении срока действия требуется проведение повторной периодической квалификации в соответствии с внутренними ` +
      `процедурами организации.`;
  doc.fillColor("#1f2937").font("body").fontSize(10).text(text, { align: "justify" });
  doc.moveDown(0.6);
}

const REPORT_ATTACHMENT_LABELS: Record<string, string> = {
  vehicle_registration: "Техпаспорт / СРТС",
  vehicle_photo: "Фото автомобиля",
  cargo_body_photo: "Фото кузова / отсека",
  refrigeration_unit_photo: "Фото холодильного агрегата",
  unit_nameplate: "Фото шильдика агрегата",
  operating_manual: "Инструкция / руководство",
  other: "Прочее",
};

function formatAttachmentSize(size: number | null | undefined): string {
  if (!size || !Number.isFinite(size) || size <= 0) return "—";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(size / 1024))} КБ`;
}

function drawAttachmentsSection(doc: PDFKit.PDFDocument, input: ReportInput) {
  const attachments = (input.attachments ?? []).filter(item => item.includeInPdf !== false && item.includeInPdf !== 0);
  if (attachments.length === 0) return;

  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const contentW = right - left;
  const pageBottom = () => doc.page.height - PAGE_MARGIN;

  attachments.forEach((attachment, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const label = REPORT_ATTACHMENT_LABELS[String(attachment.kind ?? "")] || "Приложение";
    const title = (attachment.title || label).trim();
    const isImage = (attachment.contentType ?? "").startsWith("image/") && attachment.imageBuffer;

    if (isImage && attachment.imageBuffer) {
      try {
        const image = (doc as any).openImage(attachment.imageBuffer);
        ensureSpace(doc, 300);
        drawSubTitle(doc, `Приложение ${index + 1}. ${title}`);
        doc
          .font("body")
          .fontSize(8.5)
          .fillColor(MUTED)
          .text(
            [
              `Тип: ${label}`,
              `Файл: ${attachment.fileName || "—"}`,
              attachment.comment?.trim() ? `Комментарий: ${attachment.comment.trim()}` : null,
            ].filter(Boolean).join(" · "),
            left,
            doc.y,
            { width: contentW, lineGap: 1.2 },
          );
        doc.moveDown(0.5);

        const availableH = Math.max(220, pageBottom() - doc.y - 14);
        const maxW = contentW - 16;
        const maxH = Math.min(560, availableH);
        const scale = Math.min(maxW / image.width, maxH / image.height, 2.4);
        const imageW = image.width * scale;
        const imageH = image.height * scale;
        const x = left + (contentW - imageW) / 2;
        const y = doc.y + 6;

        doc.save();
        doc
          .roundedRect(x - 8, y - 8, imageW + 16, imageH + 16, 8)
          .fill("#ffffff")
          .strokeColor(BORDER)
          .stroke();
        doc.restore();
        doc.image(attachment.imageBuffer, x, y, { width: imageW, height: imageH });
        doc.y = y + imageH + 14;
      } catch {
        drawSubTitle(doc, `Приложение ${index + 1}. ${title}`);
        doc
          .fillColor(MUTED)
          .font("body")
          .fontSize(9)
          .text("Изображение не удалось встроить в PDF, файл сохранён как приложение.", left, doc.y, { width: contentW });
        doc.moveDown(0.6);
      }
      return;
    }

    const metaRows = [
      ["Тип", label],
      ["Файл", attachment.fileName || "—"],
      ["Формат", attachment.contentType || "—"],
      ["Размер", formatAttachmentSize(attachment.size)],
    ];
    if (attachment.comment?.trim()) metaRows.push(["Комментарий", attachment.comment.trim()]);

    ensureSpace(doc, 130);
    drawSubTitle(doc, `Приложение ${index + 1}. ${title}`);
    drawSimpleTable(doc, ["Поле", "Значение"], metaRows, [0.24, 0.76]);
    doc.moveDown(0.2);
  });
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
function drawMeasurementTable(doc: PDFKit.PDFDocument, loggers: LoggerSummary[], samplingStepMinutes?: number | null, input?: ReportInput) {
  const en = isEnglishWarehouse(input);
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
    doc.font("body").fontSize(9).fillColor(MUTED).text(en ? "No measurement data available." : "Нет данных измерений.");
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
      { label: en ? "Date / Time" : "Дата / Время", w: tsColW },
      ...group.map(({ logger }) => ({
        label: shortLabel(logger.label, logger.customName),
        w: sensorColW,
      })),
    ];
    const firstSensorNo = groupIdx * MAX_SENSORS_PER_BLOCK + 1;
    const lastSensorNo = firstSensorNo + group.length - 1;
    const blockLabel = en
      ? `Loggers ${firstSensorNo}–${lastSensorNo} of ${loggers.length}`
      : `Датчики ${firstSensorNo}–${lastSensorNo} из ${loggers.length}`;

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
      .text(en ? `Showing ${MAX_ROWS} of ${allTs.length} rows (uniform sample).` : `Показано ${MAX_ROWS} из ${allTs.length} строк (равномерная выборка).`, { align: "right" });
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
  sectionNumber = "10",
) {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const w = right - left;

  const TIMING_LABELS: Record<string, string> = {
    before_pv: "До этапа PQ/PV",
    after_pv: "После этапа PQ/PV",
    independent: "Независимо",
  };

  drawSectionTitle(doc, `${sectionNumber}. Испытания на температурное отклонение (Temperature Excursion Study)`);

  // General parameters table — only show enabled tests
  const enabledTests: string[] = [];
  if (excursion.test1Enabled) enabledTests.push("Включение оборудования (выход на режим)");
  if (excursion.test2Enabled) enabledTests.push("Открытие двери (время до нарушения режима)");
  if (excursion.test3Enabled) enabledTests.push("Отключение питания (время до нарушения режима)");
  const paramRows: Array<[string, string]> = [
    ["Окно записи", `${excursion.recordStartAt ? fmtDate(excursion.recordStartAt) : "—"} – ${excursion.recordEndAt ? fmtDate(excursion.recordEndAt) : "—"}`],
    ["Срок проведения относительно PQ/PV", TIMING_LABELS[excursion.timingVsPv || ""] || excursion.timingVsPv || "—"],
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
/* Metrological Verification Page                                             */
/* -------------------------------------------------------------------------- */
function drawCalibrationPage(doc: PDFKit.PDFDocument, title = "16. Поверка средств измерений") {
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const contentW = right - left;

  // Section title
  drawSectionTitle(doc, title);

  const y0 = doc.y + 8;

  // Introductory paragraph
  doc
    .font("body")
    .fontSize(10)
    .fillColor(ACCENT)
    .text(
      "Средства измерений (датчики температуры), применённые при проведении квалификации, " +
      "прошли метрологическую поверку в аккредитованной лаборатории. " +
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
    .text("Запрос свидетельств о поверке", left + boxPad, boxY + boxPad, {
      width: contentW - boxPad * 2,
    });
  doc.moveDown(0.4);
  doc
    .font("body")
    .fontSize(9)
    .fillColor(ACCENT)
    .text(
      "Для получения оригиналов свидетельств о поверке средств измерений " +
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

function drawWarehouseTableOfContentsPage(
  doc: PDFKit.PDFDocument,
  input: ReportInput,
  pageIndex: number,
  entries: TableOfContentsEntry[],
) {
  if (!entries.length) return;
  const range = doc.bufferedPageRange();
  doc.switchToPage(pageIndex);

  const en = isEnglishWarehouse(input);
  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const width = right - left;

  doc.x = left;
  doc.y = 92;
  doc.fillColor(ACCENT).font("bold").fontSize(22)
    .text(en ? "Contents" : "Содержание", left, doc.y, { width });
  doc.moveDown(1.0);

  const rowH = 24;
  const pageColW = 34;
  const titleMaxW = width - pageColW - 12;
  entries.forEach(entry => {
    if (doc.y + rowH > doc.page.height - 56) return;
    const y = doc.y;
    const level = entry.level ?? 0;
    const titleX = left + level * 16;
    const titleW = titleMaxW - level * 16;
    const title = fitTextToWidth(doc, entry.title, titleW);
    const pageText = String(entry.page);
    const isPart = level === 0;

    doc.fillColor(isPart ? ACCENT : "#334155")
      .font(isPart ? "bold" : "body")
      .fontSize(isPart ? 11 : 10)
      .text(title, titleX, y, { width: titleW, lineBreak: false });

    const titleEndX = titleX + Math.min(doc.widthOfString(title), titleW);
    const pageX = right - pageColW;
    const dotsStart = Math.max(titleEndX + 8, titleX + 40);
    const dotsEnd = pageX - 8;
    if (dotsEnd > dotsStart) {
      doc.save();
      doc.strokeColor("#cbd5e1").lineWidth(0.5).dash(1, { space: 3 })
        .moveTo(dotsStart, y + 12)
        .lineTo(dotsEnd, y + 12)
        .stroke()
        .undash();
      doc.restore();
    }

    doc.fillColor(isPart ? ACCENT : "#334155")
      .font(isPart ? "bold" : "body")
      .fontSize(isPart ? 11 : 10)
      .text(pageText, pageX, y, { width: pageColW, align: "right", lineBreak: false });
    doc.y = y + rowH;
  });

  doc.fillColor(MUTED).font("body").fontSize(8)
    .text(
      en
        ? "The contents are generated automatically from the protocol and report structure."
        : "Содержание сформировано автоматически по структуре протокола и отчёта.",
      left,
      doc.page.height - 78,
      { width },
    );

  doc.switchToPage(range.start + range.count - 1);
}

export function addHeadersAndFooters(doc: PDFKit.PDFDocument, input: ReportInput) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  const protocolLabel = isEnglishWarehouse(input)
    ? `Protocol ${input.protocol.number}`
    : `Протокол ${input.protocol.number}`;

  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    doc.font("body").fontSize(8);
    const left = PAGE_MARGIN;
    const right = doc.page.width - PAGE_MARGIN;
    const pageH = doc.page.height;

    if (i > 0) {
      const headerY = 22;
      const headerFontSize = 8;
      const maxProtoW = Math.min(170, (right - left) * 0.38);
      const protoW = Math.max(118, Math.min(maxProtoW, doc.widthOfString(protocolLabel) + 4));
      const headerGap = 18;
      const orgHeaderW = Math.max(120, right - left - protoW - headerGap);
      doc.font("body").fontSize(headerFontSize);
      const orgText = fitTextToWidth(doc, input.org.name, orgHeaderW);
      const orgH = doc.heightOfString(orgText, {
        width: orgHeaderW,
        lineBreak: false,
      });
      const protoH = doc.heightOfString(protocolLabel, {
        width: protoW,
        align: "left",
      });
      doc
        .fillColor(MUTED)
        .font("body")
        .fontSize(headerFontSize)
        .text(orgText, left, headerY, {
          width: orgHeaderW,
          lineBreak: false,
        })
        .text(protocolLabel, right - protoW, headerY, {
          width: protoW,
          align: "left",
        });
      const headerLineY = Math.max(38, headerY + Math.max(orgH, protoH) + 6);
      doc.save();
      doc.strokeColor(BORDER).lineWidth(0.4).moveTo(left, headerLineY).lineTo(right, headerLineY).stroke();
      doc.restore();
    }

    doc.save();
    doc.strokeColor(BORDER).lineWidth(0.4).moveTo(left, pageH - 36).lineTo(right, pageH - 36).stroke();
    doc.restore();
    const pageLabel = isEnglishWarehouse(input) ? `Page ${i + 1} of ${total}` : `Стр. ${i + 1} из ${total}`;
    const pageLabelW = doc.widthOfString(pageLabel);
    const centerX = left + (right - left) / 2 - pageLabelW / 2;
    // The footer intentionally lives below the content margin. PDFKit 0.18
    // otherwise treats this text as overflow and appends a blank page for
    // every buffered page that receives a footer.
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    try {
      doc
        .fillColor(MUTED)
        .font("body")
        .fontSize(8)
        .text(pageLabel, centerX, pageH - 26, {
          width: pageLabelW,
          lineBreak: false,
        });
    } finally {
      doc.page.margins.bottom = originalBottomMargin;
    }
  }
}


/* -------------------------------------------------------------------------- */
/* Warehouse / storage zone (EEC Rec. №8) — plan diagram + annexes            */
/* -------------------------------------------------------------------------- */

type WarehousePlanDiagramOptions = {
  showCriticalMarkers?: boolean;
  showAverageLabels?: boolean;
  showSensorLabels?: boolean;
  showHeightLabels?: boolean;
  showPlacementTable?: boolean;
  showLoggerPlacementTable?: boolean;
  showCaption?: boolean;
  showTemperatureOverlay?: boolean;
};

/** Draw a top-view plan with EEC recommended logger grid for warehouse */
function drawWarehousePlanDiagram(
  doc: PDFKit.PDFDocument,
  input: ReportInput,
  template: boolean,
  title: string,
  options: WarehousePlanDiagramOptions = {},
) {
  const showCriticalMarkers = options.showCriticalMarkers ?? !template;
  const showAverageLabels = options.showAverageLabels ?? false;
  const showSensorLabels = options.showSensorLabels ?? true;
  const showHeightLabels = options.showHeightLabels ?? false;
  const showPlacementTable = options.showPlacementTable ?? false;
  const showLoggerPlacementTable = options.showLoggerPlacementTable ?? false;
  const showCaption = options.showCaption ?? true;
  const showTemperatureOverlay = options.showTemperatureOverlay ?? false;
  const gi = input.generalInfo;
  const isEaeuWarehouse = isWarehouseEaeu(getReportEquipmentType(input));
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
    !!input.planBackgroundImageUrl;

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
    if (showPlacementTable) {
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
  const externalWarehouseLoggers = (input.pvLoggers ?? []).filter(l => l.role === "external");
  const externalBadgeRows = !template && showSensorLabels && externalWarehouseLoggers.length > 0
    ? Math.ceil(Math.min(externalWarehouseLoggers.length, 4) / 2)
    : 0;
  const externalLaneH = externalBadgeRows > 0 ? 22 + externalBadgeRows * 22 : 0;
  const planMaxH = template ? 320 : 430;
  // aspect = widthM / lengthM so that drawW maps to lengthM (horizontal) and
  // drawH maps to widthM (vertical) — matching FloorPlanEditor's SVG orientation.
  const aspect = hasRoomDimensions ? widthM / lengthM : 1;
  let drawW = usableW;
  let drawH = drawW * aspect;
  if (drawH > planMaxH) {
    drawH = planMaxH;
    drawW = drawH / aspect;
  }
  const missingDimensionsNoteHeight = isEaeuWarehouse && calc.total === 0 ? 42 : 0;
  ensureSpace(doc, drawH + externalLaneH + 110 + missingDimensionsNoteHeight);
  drawSubTitle(doc, title);
  if (isEaeuWarehouse && calc.total === 0) {
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

  let embeddedPlanBackground = false;
  if (!template && input.planBackgroundImageUrl) {
    try {
      doc.save();
      doc.rect(planX, planY, drawW, drawH).clip();
      doc.opacity(0.96);
      doc.image(input.planBackgroundImageUrl as any, planX, planY, {
        fit: [drawW, drawH],
        align: "center",
        valign: "center",
      });
      doc.restore();
      embeddedPlanBackground = true;
    } catch (_e) {
      doc.restore();
      embeddedPlanBackground = false;
    }
  }

  if (!embeddedPlanBackground) {
    doc.save();
    doc.fillColor("#fbfdff").rect(planX, planY, drawW, drawH).fill();
    doc.fillColor("#f1f5f9").opacity(0.55);
    doc.roundedRect(planX + 8, planY + 8, drawW - 16, drawH - 16, 4).fill();
    doc.restore();
  }

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
  const gridRows = embeddedPlanBackground ? 0 : (isEaeuWarehouse && calc.nL > 0 ? calc.nL : 4);
  const gridCols = embeddedPlanBackground ? 0 : (isEaeuWarehouse && calc.nW > 0 ? calc.nW : 4);
  for (let i = 0; i < gridRows; i++) {
    const y = planY + (gridRows === 1 ? 0.5 : i / (gridRows - 1)) * drawH;
    doc.moveTo(planX, y).lineTo(planX + drawW, y).stroke();
  }
  for (let j = 0; j < gridCols; j++) {
    const x = planX + (gridCols === 1 ? 0.5 : j / (gridCols - 1)) * drawW;
    doc.moveTo(x, planY).lineTo(x, planY + drawH).stroke();
  }
  doc.undash();
  doc.restore();

  // Floor plan objects (furniture, equipment placed by user) — exclude sensor_point (rendered separately)
  const allFloorObjs = (input.floorPlanObjects ?? []);
  const floorObjs = allFloorObjs.filter((o: { type: string }) => o.type !== "sensor_point");
  const sensorPointObjs = allFloorObjs.filter((o: { type: string }) => o.type === "sensor_point");
  const criticalSensorTokens = showCriticalMarkers
    ? buildWarehouseCriticalSensorTokens(input)
    : { hot: new Set<string>(), cold: new Set<string>() };
  const averageBySensor = showAverageLabels ? buildSensorAverageMap(input) : new Map<string, string>();
  const averageNumberBySensor = showTemperatureOverlay ? buildSensorAverageNumberMap(input) : new Map<string, number>();
  const externalSensorTokens = showTemperatureOverlay
    ? buildWarehouseSensorTokensByRole(input, "external")
    : new Set<string>();
  const markerPlanBox = { x: planX, y: planY, w: drawW, h: drawH };
  const heatmapPoints = showTemperatureOverlay
    ? sensorPointObjs.flatMap(sp => {
      if (floorSensorPointMatchesTokens(sp, externalSensorTokens)) return [];
      const label = shortSensorId(sp.label) || "D";
      const directSensorKey = normalizeSensorNumber(sp.label);
      const avg =
        averageNumberBySensor.get(directSensorKey) ??
        averageNumberBySensor.get(normalizeSensorNumber(label)) ??
        null;
      if (avg === null || !Number.isFinite(avg)) return [];
      const hasLeader =
        typeof sp.leaderEndXPct === "number" &&
        typeof sp.leaderEndYPct === "number" &&
        Number.isFinite(sp.leaderEndXPct) &&
        Number.isFinite(sp.leaderEndYPct);
      const leaderXPct = hasLeader ? warehouseClamp01((sp.leaderEndXPct as number) / 100) : null;
      const leaderYPct = hasLeader ? warehouseClamp01((sp.leaderEndYPct as number) / 100) : null;
      return [{
        x: leaderXPct !== null
          ? planX + leaderXPct * drawW
          : planX + ((sp.xPct + sp.widthPct / 2) / 100) * drawW,
        y: leaderYPct !== null
          ? planY + leaderYPct * drawH
          : planY + ((sp.yPct + sp.heightPct / 2) / 100) * drawH,
        avg,
      }];
    })
    : [];
  const heatmapRange = heatmapPoints.length > 0
    ? drawWarehouseTemperatureOverlay(doc, markerPlanBox, heatmapPoints, embeddedPlanBackground ? 0.9 : 0.96)
    : null;
  if (heatmapRange) {
    doc.save();
    doc.lineWidth(1.2).strokeColor(ACCENT)
      .rect(planX, planY, drawW, drawH).stroke();
    doc.restore();
  }
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

  // Keep the warehouse plan clean: do not draw automatic numbered grid circles
  // like "1-1", "2-1". Only user-placed sensor_point objects are rendered below.
  const renderCalculatedGridMarkers = false;
  const margin = 0.08;
  const span = 1 - margin * 2;
  for (let r = 1; renderCalculatedGridMarkers && r <= calc.nL; r++) {
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
          const placedLabel = placed ? String(placed.label || placed.customName || "").trim() : "";
          if (placedLabel) matches.push(placedLabel);
        }
        if (matches.length) {
          const firstLabel = matches[0];
          const shortSensorLabel = shortSensorId(firstLabel) || firstLabel;
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
  const occupiedSensorBubbles: WarehouseMarkerBox[] = [];
  const sensorMarkerRadii = sensorPointObjs
    .map(sp => Math.min((sp.widthPct / 100) * drawW, (sp.heightPct / 100) * drawH) / 2)
    .filter(radius => Number.isFinite(radius) && radius > 0)
    .sort((a, b) => a - b);
  const medianSensorMarkerRadius = sensorMarkerRadii.length > 0
    ? sensorMarkerRadii[Math.floor(sensorMarkerRadii.length / 2)]
    : 8;
  const uniformSensorMarkerRadius = Math.max(5, Math.min(20, medianSensorMarkerRadius));
  const sensorDisplays = sensorPointObjs.map(sp => {
    // sensor_point xPct/yPct are stored as the top-left corner in the editor.
    // Render the PDF marker at the same visual center as the portal.
    const baseX = planX + ((sp.xPct + sp.widthPct / 2) / 100) * drawW;
    const baseY = planY + ((sp.yPct + sp.heightPct / 2) / 100) * drawH;
    const hasLeader =
      typeof sp.leaderEndXPct === "number" &&
      typeof sp.leaderEndYPct === "number" &&
      Number.isFinite(sp.leaderEndXPct) &&
      Number.isFinite(sp.leaderEndYPct);
    const leaderEndX = hasLeader ? planX + ((sp.leaderEndXPct as number) / 100) * drawW : null;
    const leaderEndY = hasLeader ? planY + ((sp.leaderEndYPct as number) / 100) * drawH : null;
    const r = uniformSensorMarkerRadius;
    const markerBox = warehouseMarkerBox(baseX, baseY, r + 4);
    occupiedSensorBubbles.push(markerBox);
    return { sp, baseX, baseY, x: baseX, y: baseY, r, markerBox, leaderEndX, leaderEndY };
  });
  const sensorLabelBoxes: WarehouseMarkerBox[] = [...occupiedSensorBubbles];
  for (const display of sensorDisplays) {
    const { sp, baseX, baseY, x: spX, y: spY, r, markerBox, leaderEndX, leaderEndY } = display;
    const label = shortSensorId(sp.label) || "D";
    const directSensorKey = normalizeSensorNumber(sp.label);
    const avgLabel = showAverageLabels
      ? averageBySensor.get(directSensorKey) ?? averageBySensor.get(normalizeSensorNumber(label)) ?? null
      : null;
    const isCriticalHot = floorSensorPointMatchesTokens(sp, criticalSensorTokens.hot);
    const isCriticalCold = floorSensorPointMatchesTokens(sp, criticalSensorTokens.cold);
    doc.save();
    let labelFont = Math.max(5.0, Math.min(9.2, r * 0.58));
    doc.font("bold").fontSize(labelFont);
    const maxLabelW = r * 1.96;
    while (labelFont > 4.3 && doc.widthOfString(label) > maxLabelW) {
      labelFont -= 0.2;
      doc.font("bold").fontSize(labelFont);
    }
    if (isCriticalHot) {
      doc.circle(spX, spY, r + 2.5).lineWidth(2.0).strokeColor("#ef4444").stroke();
    }
    if (isCriticalCold) {
      doc.circle(spX, spY, r + (isCriticalHot ? 5.2 : 2.5)).lineWidth(1.8).strokeColor("#2563eb").stroke();
    }
    const bubbleWasShifted = Math.hypot(spX - baseX, spY - baseY) > 2;
    if (bubbleWasShifted) {
      doc.save();
      doc.strokeColor("#0369a1").lineWidth(0.55).opacity(0.45)
        .moveTo(baseX, baseY)
        .lineTo(spX, spY)
        .stroke();
      doc.fillColor("#0369a1").opacity(0.55).circle(baseX, baseY, 1.8).fill();
      doc.restore();
    }
    if (leaderEndX !== null && leaderEndY !== null) {
      const dx = leaderEndX - spX;
      const dy = leaderEndY - spY;
      const dist = Math.hypot(dx, dy);
      if (dist > r + 7) {
        const ux = dx / dist;
        const uy = dy / dist;
        const startX = spX + ux * (r + 1.5);
        const startY = spY + uy * (r + 1.5);
        doc.save();
        doc.strokeColor("#0f172a").lineWidth(1.0)
          .moveTo(startX, startY)
          .lineTo(leaderEndX, leaderEndY)
          .stroke();
        doc.restore();
        drawPdfArrowHead(doc, startX, startY, leaderEndX, leaderEndY, 5.2, "#0f172a");
      }
    }
    doc.fillColor("#7dd3fc").strokeColor("#0369a1").lineWidth(1.5).circle(spX, spY, r).fillAndStroke();
    if (showSensorLabels) {
      doc.fillColor("#0c4a6e")
        .text(label, spX - r * 1.2, spY - labelFont / 2 + 0.6, { width: r * 2.4, align: "center", lineBreak: false });
    }
    if (avgLabel) {
      const avgText = `(${avgLabel})`;
      const avgFont = Math.max(5.8, Math.min(8.2, r * 0.64));
      doc.font("bold").fontSize(avgFont);
      const avgW = Math.max(r * 2.35, doc.widthOfString(avgText) + 4);
      const avgH = avgFont + 4.0;
      const avgX = Math.max(markerPlanBox.x + 1, Math.min(markerPlanBox.x + markerPlanBox.w - avgW - 1, spX - avgW / 2));
      const preferredAvgY = spY + r + 1.2;
      const avgY = preferredAvgY + avgH <= markerPlanBox.y + markerPlanBox.h - 1
        ? preferredAvgY
        : Math.max(markerPlanBox.y + 1, spY - r - avgH - 1.2);
      doc.save();
      doc.opacity(0.82).fillColor("#ffffff").roundedRect(avgX, avgY, avgW, avgH, 2).fill();
      doc.restore();
      doc.fillColor("#0c4a6e").font("bold").fontSize(avgFont)
        .text(avgText, avgX + 2, avgY + 1.6, { width: avgW - 4, align: "center", lineBreak: false });
    }
    const heightLabel = showHeightLabels && (sp.heightM ?? 0) > 0
      ? `${(sp.heightM as number).toFixed(1)} м`
      : null;
    if (heightLabel) {
      const heightFont = Math.max(5.5, Math.min(7.2, r * 0.55));
      doc.font("bold").fontSize(heightFont);
      const heightW = Math.max(r * 2.5, doc.widthOfString(heightLabel) + 4);
      const preferredHeightY = spY + r + 2;
      const heightY = preferredHeightY + heightFont + 3 <= markerPlanBox.y + markerPlanBox.h - 1
        ? preferredHeightY
        : Math.max(markerPlanBox.y + 1, spY - r - heightFont - 3);
      const heightX = Math.max(markerPlanBox.x + 1, Math.min(markerPlanBox.x + markerPlanBox.w - heightW - 1, spX - heightW / 2));
      doc.fillColor("#0c4a6e").font("bold").fontSize(heightFont)
        .text(heightLabel, heightX + 2, heightY + 1, { width: heightW - 4, align: "center", lineBreak: false });
    }
    const criticalOffset = r + Math.max(3.2, r * 0.35);
    const criticalMarkerRadius = 5.6;
    const occupiedCriticalBoxes = sensorLabelBoxes.filter(item => item !== markerBox);
    if (isCriticalHot) {
      const [markerX, markerY] = chooseWarehouseCriticalMarkerPosition([
        [spX + criticalOffset, spY - criticalOffset],
        [spX - criticalOffset, spY - criticalOffset],
        [spX + criticalOffset, spY + criticalOffset],
        [spX - criticalOffset, spY + criticalOffset],
        [spX + criticalOffset, spY],
        [spX - criticalOffset, spY],
      ], markerPlanBox, occupiedCriticalBoxes, criticalMarkerRadius);
      drawPdfStar(doc, markerX, markerY, 5.4, "#ef4444");
      occupiedCriticalBoxes.push(warehouseMarkerBox(markerX, markerY, criticalMarkerRadius + 1));
    }
    if (isCriticalCold) {
      const [markerX, markerY] = chooseWarehouseCriticalMarkerPosition([
        [spX + criticalOffset, spY + criticalOffset],
        [spX - criticalOffset, spY + criticalOffset],
        [spX + criticalOffset, spY - criticalOffset],
        [spX - criticalOffset, spY - criticalOffset],
        [spX + criticalOffset, spY],
        [spX - criticalOffset, spY],
      ], markerPlanBox, occupiedCriticalBoxes, criticalMarkerRadius);
      drawPdfDiamond(doc, markerX, markerY, 5.2, "#2563eb");
      occupiedCriticalBoxes.push(warehouseMarkerBox(markerX, markerY, criticalMarkerRadius + 1));
    }
    doc.restore();
  }

  let planBottomY = planY + drawH;
  if (!template && showSensorLabels && externalWarehouseLoggers.length > 0) {
    const badgeW = 92;
    const badgeH = 18;
    const gap = 10;
    const externalBadges = externalWarehouseLoggers.slice(0, 4);
    const perRow = Math.min(2, externalBadges.length);
    const rowW = perRow * badgeW + (perRow - 1) * gap;
    const startX = planX + drawW / 2 - rowW / 2;
    const startY = planY + drawH + 14;
    doc.save();
    doc.strokeColor("#64748b").lineWidth(0.7).dash(3, { space: 2 })
      .moveTo(planX + drawW / 2, planY + drawH)
      .lineTo(planX + drawW / 2, startY - 4)
      .stroke();
    doc.undash();
    externalBadges.forEach((logger, idx) => {
      const row = Math.floor(idx / 2);
      const col = idx % 2;
      const x = startX + col * (badgeW + gap);
      const y = startY + row * 22;
      const rawLabel = String(logger.label || logger.customName || "EXT");
      const label = shortSensorId(rawLabel) || "EXT";
      doc.fillColor("#f1f5f9").strokeColor("#64748b").lineWidth(0.8)
        .roundedRect(x, y, badgeW, badgeH, 9)
        .fillAndStroke();
      doc.fillColor("#64748b").circle(x + 9, y + badgeH / 2, 4.5).fill();
      doc.fillColor("#334155").font("bold").fontSize(6.5)
        .text(label, x + 18, y + 3, { width: 26, align: "left", lineBreak: false });
      doc.fillColor("#64748b").font("body").fontSize(5.5)
        .text("внешний", x + 46, y + 4, { width: 38, align: "left", lineBreak: false });
    });
    doc.restore();
    planBottomY = startY + externalBadgeRows * 22 + 2;
  }

  if (heatmapRange) {
    const legendAnchor = { x: planX, y: planY, w: drawW, h: planBottomY - planY };
    drawWarehouseTemperatureLegend(doc, legendAnchor, heatmapRange);
    planBottomY = legendAnchor.y + legendAnchor.h + 28;
  }

  doc.x = pageLeft;
  doc.y = planBottomY + 12;
  // ── Sensor placement table for floor plan objects ────────────────────────
  if (showPlacementTable) {
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
  if (showCaption && isEaeuWarehouse) {
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
        "Сетка построена по таблицам п. 16д Рек. ЕЭК №8 (горизонталь: 2/3/4/5 точек при ≤10/40/60/>60 м; " +
        "вертикаль: 1/2/3 точки при ≤1.5 / <5 / ≥5 м).",
        pageLeft,
        doc.y,
        { width: usableW, align: "justify" },
      );
    doc.moveDown(0.3);
  } else if (showCaption) {
    const manualSensorCount = sensorPointObjs.length + floorObjs.reduce((count, obj) => (
      count + (obj.sensors ?? []).filter((s: { sensorId: string }) => s.sensorId && s.sensorId.trim()).length
    ), 0);
    doc.fillColor(MUTED).font("body").fontSize(9)
      .text(
        manualSensorCount > 0
          ? `Точки размещения датчиков заданы вручную специалистом; всего отмечено ${manualSensorCount}.`
          : "Точки размещения датчиков задаются вручную специалистом на схеме помещения.",
        pageLeft,
        doc.y,
        { width: usableW, align: "center" },
      );
    doc.moveDown(0.4);
  }

  // ── Sensor placement table (height + comments) ──────────────────────────────
  // Only render when pvLoggers are available (second diagram call with template=false)
  if (!template && showLoggerPlacementTable) {
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
      const sColW = [24, 42, 112, 160, 56, totalW2 - (24 + 42 + 112 + 160 + 56)];
      const sHeaders = ["№", "ID", "Серийный №", "Позиция на схеме", "Высота, м", "Прим."];
      const floorObjectById = new Map((input.floorPlanObjects ?? []).map(obj => [obj.id, obj]));
      const formatGridPosition = (raw: string): string | null => {
        const match = raw.match(/^L(\d+)-c(\d+)-t(\d+)$/i);
        if (!match) return null;
        return `\u0420\u044f\u0434 ${match[1]}, \u043a\u043e\u043b\u043e\u043d\u043a\u0430 ${match[2]}, \u044f\u0440\u0443\u0441 ${match[3]}`;
      };
      const compactRawPosition = (raw: string): string => {
        if (raw.length <= 22) return raw;
        return `${raw.slice(0, 8)}...${raw.slice(-5)}`;
      };
      const floorSensorHeightByToken = new Map<string, string>();
      const floorSensorPointTokens = new Set<string>();
      const addFloorSensorHeight = (
        value: string | number | null | undefined,
        heightValue: number | null | undefined,
      ) => {
        if (!heightValue || heightValue <= 0) return;
        const formatted = heightValue.toFixed(2);
        for (const token of sensorTokenVariants(value)) {
          floorSensorHeightByToken.set(token, formatted);
          floorSensorPointTokens.add(token);
        }
      };
      sensorPointObjs.forEach(sp => {
        addFloorSensorHeight(sp.id, sp.heightM as number | null | undefined);
        addFloorSensorHeight(sp.label, sp.heightM as number | null | undefined);
      });
      floorObjs.forEach(obj => {
        (obj.sensors ?? []).forEach((sensor: { sensorId: string; heightFromFloor: number }) => {
          addFloorSensorHeight(sensor.sensorId, sensor.heightFromFloor);
        });
      });
      const manualFloorSensorHeight = (...values: Array<string | number | null | undefined>): string | null => {
        for (const value of values) {
          for (const token of sensorTokenVariants(value)) {
            const height = floorSensorHeightByToken.get(token);
            if (height) return height;
          }
        }
        return null;
      };
      const isManualFloorSensorPosition = (raw: string): boolean => {
        return sensorTokenVariants(raw).some(token => floorSensorPointTokens.has(token));
      };
      const formatPlanPosition = (raw: unknown, isExt: boolean): string => {
        const value = String(raw ?? "").trim();
        if (isExt) return "\u0412\u043d\u0435\u0448\u043d\u0438\u0439";
        if (!value || value === "unset") return "-";
        const grid = formatGridPosition(value);
        if (grid) return grid;
        const obj = floorObjectById.get(value);
        if (obj) return obj.label || (obj.type === "sensor_point" ? "\u0422\u043e\u0447\u043a\u0430 \u043d\u0430 \u0441\u0445\u0435\u043c\u0435" : obj.type);
        if (isManualFloorSensorPosition(value)) return "\u0422\u043e\u0447\u043a\u0430 \u043d\u0430 \u043f\u043b\u0430\u043d\u0435";
        return compactRawPosition(value);
      };
      let sy = doc.y;
      const sRowH = 18;
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
        const shortId = shortSensorId(l.label) || l.label;
        const posLabel = formatPlanPosition(l.position, isExt);
        const manualHeightStr = manualFloorSensorHeight(l.position, l.label, l.customName);
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
          manualHeightStr ?? heightStr,
          isExt ? "Внешний" : "",
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
        .text("ID — последние 4 цифры серийного №. Позиция — место регистратора на схеме.",
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
function drawWarehouseAnnex1(doc: PDFKit.PDFDocument, input: ReportInput, recordToc?: (title: string, level?: number) => void) {
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
  recordToc?.("Приложение №1. Сведения о размещении регистраторов данных", 1);

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

  const annexLoggers = buildWarehouseLoggerSelectionEntries(input)
    .sort((a, b) => {
      const aExt = a.role === "external" ? 1 : 0;
      const bExt = b.role === "external" ? 1 : 0;
      if (aExt !== bExt) return aExt - bExt;
      return warehouseLoggerSchemeNumber(input, a).localeCompare(warehouseLoggerSchemeNumber(input, b), "ru");
    });

  const annexRows = annexLoggers.map((logger, index) => [
    String(index + 1),
    warehouseLoggerSchemeNumber(input, logger),
    warehouseLoggerFullId(logger),
    logger.role === "external" ? "Внешняя" : "Внутренняя",
    warehouseLoggerHeight(input, logger),
    warehouseLoggerPlacementNote(input, logger),
  ]);

  drawSimpleTable(
    doc,
    ["№", "Номер на схеме", "ID / серийный номер регистратора данных", "Тип точки", "Высота, м", "Место установки / примечание"],
    annexRows.length > 0 ? annexRows : [["1", "—", "—", "—", "—", "Место установки указывается на схеме расстановки."]],
    [0.06, 0.14, 0.26, 0.14, 0.11, 0.29],
    { fontSize: 8, headerFontSize: 8, padding: 5, headerHeight: 40, headerLineBreak: true },
  );

  doc.fillColor(MUTED).font("body").fontSize(8)
    .text(
      "Приложение 1 формируется автоматически из тех же данных интерактивного плана, которые используются для схемы расстановки регистраторов в протоколе.",
      left,
      doc.y,
      { width: totalW },
    );
}

/**
 * Annex №2 — «Сводная таблица показаний регистраторов» (минимум/максимум/среднее
 * по каждой точке + соответствие критериям приемлемости).
 */
function drawWarehouseAnnex2(doc: PDFKit.PDFDocument, input: ReportInput, recordToc?: (title: string, level?: number) => void) {
  if (!input.pv?.loggers?.length) return;
  doc.addPage();
  recordToc?.("Приложение №2. Сводная таблица показаний регистраторов", 1);
  drawSectionTitle(doc, "Приложение №2. Сводная таблица показаний регистраторов");
  doc.fillColor(MUTED).font("body").fontSize(9)
    .text(
      `Сводные результаты температурного картирования ${isPharmacyStorageReport(input) ? "помещения (зоны) хранения аптеки" : "зоны хранения"} за период ` +
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
    // ID: last 4 alphanumeric characters of serial number (label), or position if assigned
    const pvLogger = (input.pvLoggers ?? []).find(p => p.label === l.label);
    const rawLabel = l.label || "";
    const last4 = shortSensorId(rawLabel) || rawLabel;
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
 * WAREHOUSE PROTOCOL — PART I (Рек. ЕЭК №8, разделы 1–7)
 * ============================================================================ */

/**
 * Default texts for every warehouse protocol section.
 * These are used when the user has not overridden a section.
 */
const WAREHOUSE_DEFAULT_SECTIONS: Record<string, string> = {
  "1.1": `ЕАЭС — Евразийский экономический союз
ЕЭК — Евразийская экономическая комиссия
ЛС — лекарственные средства
СОП — стандартная операционная процедура
IQ (Installation Qualification) — квалификация монтажа
OQ (Operational Qualification) — квалификация функционирования
PQ/PV (Performance Qualification / Process Validation) — эксплуатационная квалификация / валидация
Т — температура
MKT (Mean Kinetic Temperature) — среднекинетическая температура`,

  "1.2": `Температурное картирование — систематическое измерение и документирование температурного распределения внутри помещения (зоны) хранения аптеки с целью выявления «горячих» и «холодных» точек, оценки однородности температурного поля и определения оптимальных мест размещения датчиков системы мониторинга.

Регистратор данных (логгер) — автономное устройство, непрерывно фиксирующее значения температуры (и, при необходимости, относительной влажности) с заданным интервалом и сохраняющее результаты во внутренней памяти.

Критерий приемлемости — заранее установленный предел, с которым сравниваются результаты измерений для принятия решения о соответствии / несоответствии.

Помещение (зона) хранения аптеки — помещение или выделенная часть помещения аптеки, предназначенная для хранения лекарственных средств в определённых температурных условиях.`,

  "2.1": `Объект картирования: помещение (зона) хранения аптеки для лекарственных средств.
Адрес: [указать адрес объекта]
Назначение: хранение лекарственных средств в условиях контролируемой температурной среды.`,

  "2.2.1": `Настоящее температурное картирование проводится в соответствии с:
• Рекомендацией Коллегии ЕЭК от 20.04.2026 № 8 «О Руководстве по проведению температурного картирования зон хранения лекарственных средств»;
• Приказом и.о. МЗ РК от 04.02.2021 г. № ҚР ДСМ-15 «Об утверждении надлежащих фармацевтических практик»;
• Приказом МЗ РК от 16.02.2021 г. № ҚР ДСМ-19 «Об утверждении правил хранения и транспортировки лекарственных средств и медицинских изделий»;
• Внутренними стандартными операционными процедурами аптеки.`,

  "2.2.2": `Конкретные основания для проведения данного исследования:
• Первичное картирование.`,

  "3": `Настоящий протокол распространяется на помещение (зону) хранения аптеки, указанное в разделе 2.1. Результаты картирования применяются для:
• подтверждения соответствия температурных условий установленным требованиям;
• определения мест размещения средств измерения для мониторинга условий хранения лекарственных средств;
• разработки рекомендаций по безопасному хранению лекарственных средств.`,

  "4": `Цели температурного картирования:
а) подтверждение того, что температурные условия в помещении (зоне) хранения аптеки соответствуют установленным требованиям на протяжении всего периода исследования;
б) выявление «горячих» и «холодных» точек, а также участков помещения с нестабильным температурным режимом;
в) документальная фиксация зарегистрированных колебаний температуры;
г) составление рекомендаций по безопасному размещению лекарственных средств в помещении (зоне) хранения аптеки;
д) определение (выявление) мест размещения приборов мониторинга температуры.`,

  "6.1": `Тип регистраторов данных: [указать марку/модель]
Диапазон измерений: [указать]
Абсолютная погрешность измерения: не более ±0,5 °C. Фактическая погрешность каждого регистратора указывается в реестре и отчёте.
Интервал записи: [указать] минут
Дата последней поверки: [указать]
Свидетельство о поверке №: [указать]`,

  "6.2": `Ответственный за проведение картирования: [ФИО, должность]
Исполнители: [перечислить ФИО и должности]

Ответственные лица имеют необходимую подготовку и ознакомлены с настоящим протоколом до начала температурного картирования.`,

  "6.3": `Характеристики объекта исследования заполнены в разделе «Общие сведения» (раздел 5).`,

  "6.4": `Критерии приемлемости:
• Температура во всех точках измерения в течение всего периода исследования должна находиться в пределах установленного режима хранения.
• MKT каждого регистратора не должна превышать верхний предел режима хранения.
• Допустимые кратковременные отклонения: не более [указать] °C в течение не более [указать] минут.`,

  "6.5": `Количество и расположение точек размещения регистраторов определено в соответствии с п. 16д Рекомендации ЕЭК № 8 с учётом объёма помещения (зоны) хранения аптеки. Расчёт приведён в разделе «Общие сведения».`,

  "6.6": `Точки размещения регистраторов зафиксированы на схеме помещения (Приложение № 1). Каждой точке присвоен уникальный идентификатор.`,

  "6.7": `Все регистраторы запрограммированы на одинаковый интервал записи. Дата и время синхронизированы перед началом исследования. Маркировка нанесена на корпус каждого регистратора.`,

  "6.8": `Регистраторы размещены в помещении (зоне) хранения аптеки в соответствии со схемой (Приложение № 1). Размещение выполнено до начала периода регистрации. Персонал, работающий в помещении, информируется о проведении температурного картирования во избежание случайного нарушения работы, отключения, утраты регистраторов данных или собранных данных.`,

  "6.9": `Температурное картирование проводится в условиях штатной эксплуатации помещения (зоны) хранения аптеки. В период исследования двери открываются в обычном рабочем режиме, связанном с движением персонала и выполнением повседневных операций аптеки. Специальное испытание с регламентированным открыванием дверей не проводится, если иное не указано в протоколе.

В течение всего периода исследования:
— регистраторы данных не перемещаются и не извлекаются из помещения;
— условия эксплуатации помещения поддерживаются в штатном режиме;
— длительные или нештатные открытия дверей, отключение электропитания, ремонтные работы и иные события, способные повлиять на температурный режим, фиксируются с указанием даты, времени, продолжительности и причины.

По завершении периода исследования данные регистраторов извлекаются. Выполняется повторная сверка серийных номеров регистраторов данных и мест их размещения с утверждённой схемой и таблицей размещения.`,

  "6.10": `Данные с каждого регистратора выгружены с помощью [указать ПО]. Файлы данных объединены для совместного анализа. Исходные файлы сохранены в архиве.`,
};

const WAREHOUSE_DEFAULT_SECTIONS_EN: Record<string, string> = {
  "1.1": `EAEU — Eurasian Economic Union
EEC — Eurasian Economic Commission
Medicinal products — medicinal products stored under controlled conditions
SOP — Standard Operating Procedure
IQ (Installation Qualification)
OQ (Operational Qualification)
PQ/PV (Performance Qualification / Process Validation)
T — Temperature
MKT (Mean Kinetic Temperature)`,

  "1.2": `Temperature mapping — a documented study of temperature distribution within a pharmacy storage room / area, performed to identify hot and cold points, evaluate temperature uniformity and define appropriate positions for routine monitoring sensors.

Data logger — an autonomous measuring device that continuously records temperature values, and where applicable relative humidity, at a defined interval and stores the results in internal memory.

Acceptance criterion — a predefined limit against which test results are evaluated to determine compliance or non-compliance.

Pharmacy storage room / area — a room or designated part of a pharmacy intended for storage of medicinal products under specified temperature conditions.`,

  "2.1": `Mapping object: pharmacy storage room / area for medicinal products.
Address: [specify object address]
Purpose: storage of medicinal products under controlled temperature conditions.`,

  "2.2.1": `This temperature mapping study is performed with consideration of:
• EEC Board Recommendation No. 8 dated 20.04.2026 on the Guide for temperature mapping of medicinal product storage areas;
• Order No. ҚР ДСМ-15 dated 04.02.2021 approving Good Pharmaceutical Practices;
• Order of the Ministry of Health of the Republic of Kazakhstan No. ҚР ДСМ-19 dated 16.02.2021 approving the rules for storage and transportation of medicinal products and medical devices;
• Internal standard operating procedures of the pharmacy.`,

  "2.2.2": `Study-specific rationale may include:
• Initial mapping before commissioning of the pharmacy storage room / area or after renovation;
• Scheduled periodic mapping (annual and/or seasonal);
• Mapping after significant changes to the room layout, HVAC/heating system or operating conditions.`,

  "3": `This protocol applies to the pharmacy storage room / area specified in Section 2.1. The mapping results are used to:
• confirm compliance of temperature conditions with defined requirements;
• define locations for measuring instruments used to monitor medicinal product storage conditions;
• develop recommendations for safe storage of medicinal products.`,

  "4": `The objectives of temperature mapping are:
a) to confirm that temperature conditions in the pharmacy storage room / area remain within the specified limits during the study period;
b) to identify hot and cold points and areas with unstable temperature behaviour;
c) to document recorded temperature fluctuations;
d) to provide recommendations for safe storage of medicinal products;
e) to identify locations for temperature monitoring instruments.`,

  "6.1": `Data logger type: [specify make/model]
Measurement range: [specify]
Absolute measurement accuracy: not more than ±0.5 °C. The actual accuracy of each data logger is specified in the registry and report.
Recording interval: [specify] minutes
Last verification date: [specify]
Verification certificate No.: [specify]`,

  "6.2": `Person responsible for temperature mapping: [full name, position]
Performers: [list full names and positions]

Responsible personnel have the necessary training and are familiar with this protocol before the start of temperature mapping.`,

  "6.3": `Characteristics of the study object are provided in Section 5 "General Information".`,

  "6.4": `Acceptance criteria:
• Temperature at all internal measurement points shall remain within the defined storage range throughout the study period.
• MKT for each internal data logger shall not exceed the upper limit of the storage range.
• Allowable short-term excursions, if applicable, shall be assessed and documented according to the approved protocol.`,

  "6.5": `The number and arrangement of logger placement points is defined with consideration of EEC Recommendation No. 8, the room dimensions, risk points and contact with the external environment. The calculation is provided in the General Information section.`,

  "6.6": `Logger placement points are documented on the room plan (Annex 1). Each point is assigned a unique identifier.`,

  "6.7": `All data loggers are programmed with the same recording interval. Date and time are synchronized before the start of the study. Each logger is marked with its identifier.`,

  "6.8": `Data loggers are placed according to the approved pharmacy room plan before the start of the recording period. Personnel working in the room are informed about the temperature mapping study to prevent accidental disturbance, deactivation, loss of data loggers or collected data.`,

  "6.9": `Temperature mapping is performed under routine operation of the pharmacy storage room / area. During the study, doors are opened in the normal operating mode related to personnel movement and routine pharmacy activities. A dedicated test with controlled door opening is not performed unless specified in the protocol.

During the study period:
— data loggers are not moved or removed from the room;
— operating conditions of the room are maintained in routine mode;
— prolonged or abnormal door openings, power failure, maintenance work and other events that may affect the temperature profile are recorded with date, time, duration and reason.

After completion of the study period, data loggers are retrieved. Serial numbers of data loggers and their placement locations are re-checked against the approved layout and placement table.`,

  "6.10": `Data from each logger are downloaded using appropriate software. Data files are combined for joint analysis. Source files are retained in the archive.`,
};

// Keep the existing broader templates for the other storage variants. The
// pharmacy type is the only one that uses the pharmacy-specific defaults above.
const GENERIC_WAREHOUSE_DEFAULT_SECTIONS: Record<string, string> = {
  ...WAREHOUSE_DEFAULT_SECTIONS,
  "1.1": `ЕАЭС — Евразийский экономический союз
ЕЭК — Евразийская экономическая комиссия
ЛС — лекарственные средства
GDP (Good Distribution Practice) — Правила надлежащей дистрибьюторской практики
GPP (Good Pharmacy Practice) — Правила надлежащей аптечной практики
GMP (Good Manufacturing Practice) — Правила надлежащей производственной практики
СОП — стандартная операционная процедура
IQ (Installation Qualification) — квалификация монтажа
OQ (Operational Qualification) — квалификация функционирования
PQ/PV (Performance Qualification / Process Validation) — эксплуатационная квалификация / валидация
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
• Рекомендацией Коллегии ЕЭК от 20.04.2026 № 8 «О Руководстве по проведению температурного картирования зон хранения лекарственных средств»;
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
  "6.5": `Количество и расположение точек размещения регистраторов определено в соответствии с п. 16д Рекомендации ЕЭК № 8 с учётом объёма помещения. Расчёт приведён в разделе «Общие сведения».`,
  "6.8": `Регистраторы размещены в соответствии со схемой (Приложение № 1). Размещение выполнено до начала периода регистрации. Персонал, работающий в зоне хранения, информируется о проведении температурного картирования во избежание случайного нарушения работы, отключения, утраты регистраторов данных или собранных данных.`,
  "6.9": `Температурное картирование проводится в условиях штатной эксплуатации помещения хранения. В период исследования двери/ворота открываются в обычном рабочем режиме, связанном с движением персонала, приемкой, размещением, комплектованием и отпуском продукции. Специальное испытание с регламентированным открыванием дверей/ворот не проводится, если иное не указано в протоколе.

В течение всего периода исследования:
— регистраторы данных не перемещаются и не извлекаются из зоны хранения;
— условия эксплуатации зоны хранения поддерживаются в штатном режиме;
— длительные или нештатные открытия дверей/ворот, отключение электропитания, ремонтные работы и иные события, способные повлиять на температурный режим, фиксируются с указанием даты, времени, продолжительности и причины.

По завершении периода исследования данные регистраторов извлекаются. Выполняется повторная сверка серийных номеров регистраторов данных и мест их размещения с утверждённой схемой и таблицей размещения.`,
  "6.10": `Данные с каждого регистратора выгружены с помощью [указать ПО]. Файлы данных объединены для совместного анализа. Исходные файлы сохранены в архиве.`,
};

const GENERIC_WAREHOUSE_DEFAULT_SECTIONS_EN: Record<string, string> = {
  ...WAREHOUSE_DEFAULT_SECTIONS_EN,
  "1.1": `EAEU — Eurasian Economic Union
EEC — Eurasian Economic Commission
Medicinal products — medicinal products stored under controlled conditions
GDP (Good Distribution Practice)
GPP (Good Pharmacy Practice)
GMP (Good Manufacturing Practice)
SOP — Standard Operating Procedure
IQ (Installation Qualification)
OQ (Operational Qualification)
PQ/PV (Performance Qualification / Process Validation)
T — Temperature
MKT (Mean Kinetic Temperature)`,
  "1.2": `Temperature mapping — a documented study of temperature distribution within a storage room or storage area, performed to identify hot and cold points, evaluate temperature uniformity and define appropriate positions for routine monitoring sensors.

Data logger — an autonomous measuring device that continuously records temperature values, and where applicable relative humidity, at a defined interval and stores the results in internal memory.

Acceptance criterion — a predefined limit against which test results are evaluated to determine compliance or non-compliance.

Storage area — a defined part of a warehouse, pharmacy room or other premises intended for storage of medicinal products under specified temperature conditions.`,
  "2.1": `Mapping object: storage room / storage area for medicinal products.
Address: [specify object address]
Purpose: storage of medicinal products under controlled temperature conditions.`,
  "2.2.1": `This temperature mapping study is performed with consideration of:
• EEC Board Recommendation No. 8 dated 20.04.2026 on the Guide for temperature mapping of medicinal product storage areas;
• GDP / GPP / GMP requirements related to maintaining storage conditions for medicinal products;
• Internal standard operating procedures of the organization.`,
  "2.2.2": `Study-specific rationale may include:
• Initial mapping before commissioning of the storage area / after renovation;
• Scheduled periodic mapping (annual and/or seasonal);
• Mapping after significant changes to the room layout, HVAC/heating system or operating conditions.`,
  "3": `This protocol applies to the storage room / storage area specified in Section 2.1. The mapping results are used to:
• confirm compliance of temperature conditions with defined requirements;
• define appropriate locations for routine monitoring sensors;
• develop recommendations for safe storage of medicinal products.`,
  "4": `The objectives of temperature mapping are:
a) to confirm that temperature conditions in the storage area remain within the specified limits during the study period;
b) to identify hot and cold points and areas with unstable temperature behaviour;
c) to document recorded temperature fluctuations;
d) to provide recommendations for safe storage of medicinal products;
e) to define or confirm monitoring sensor placement points.`,
  "6.5": `The number and arrangement of logger placement points is defined with consideration of EEC Recommendation No. 8, the room dimensions, risk points and contact with the external environment. The calculation is provided in the General Information section.`,
  "6.8": `Data loggers are placed according to the approved room plan before the start of the recording period. Personnel working in the storage area are informed about the temperature mapping study to prevent accidental disturbance, deactivation, loss of data loggers or collected data.`,
  "6.9": `Temperature mapping is performed under routine operation of the storage area. During the study, doors/gates are opened in the normal operating mode related to personnel movement, receipt, placement, picking and release of products. A dedicated test with controlled door/gate opening is not performed unless specified in the protocol.

During the study period:
— data loggers are not moved or removed from the storage area;
— operating conditions of the storage area are maintained in routine mode;
— prolonged or abnormal door/gate openings, power failure, maintenance work and other events that may affect the temperature profile are recorded with date, time, duration and reason.

After completion of the study period, data loggers are retrieved. Serial numbers of data loggers and their placement locations are re-checked against the approved layout and placement table.`,
  "6.10": `Data from each logger are downloaded using appropriate software. Data files are combined for joint analysis. Source files are retained in the archive.`,
};

function pharmacyAutoSectionText(key: string, input: ReportInput, en: boolean): string | null {
  const gi = input.generalInfo;
  const value = (raw: unknown, fallback = "—") => {
    const text = String(raw ?? "").trim();
    return text || fallback;
  };
  if (key === "2.1") {
    const location = value(gi?.location);
    const purpose = value(gi?.purpose, en ? "Storage of medicinal products" : "Хранение лекарственных средств");
    const tempMode = value(gi?.tempMode);
    return en
      ? `Mapping object: pharmacy storage room / area for medicinal products.\nAddress: ${location}\nPurpose: ${purpose}${tempMode !== "—" ? `\nTemperature regime: ${tempMode}.` : "."}`
      : `Объект картирования: помещение (зона) хранения аптеки.\nАдрес: ${location}\nНазначение: ${purpose}${tempMode !== "—" ? `\nТемпературный режим: ${tempMode}.` : "."}`;
  }
  if (key === "2.2.2") {
    const type = gi?.qualificationType || gi?.basis;
    const label = type === "primary"
      ? (en ? "Initial" : "Первичное")
      : (en ? "Repeat" : "Повторное");
    return en
      ? `Study-specific rationale:\n• ${label} mapping.`
      : `Конкретные основания для проведения данного исследования:\n• ${label} картирование.`;
  }
  return null;
}

function isDefaultPharmacySection(key: string, text: string): boolean {
  const value = text.trim();
  if (key === "2.1") return !value || value.startsWith("Настоящий протокол описывает") || value.startsWith("Объект картирования:") || value.startsWith("Mapping object:") || value.includes("[указать адрес") || value.includes("[specify object address]");
  if (key === "2.2.1") return !value || value.startsWith("Настоящее температурное картирование проводится") || value.startsWith("This temperature mapping study is performed") || /\bGDP\b|\bGPP\b|\bGMP\b|склад|warehouse/i.test(value);
  if (key === "2.2.2") return !value || value.startsWith("Проведение настоящего исследования обусловлено") || value.startsWith("Конкретные основания для проведения данного исследования:") || value.startsWith("Study-specific rationale");
  if (key === "3") return !value || value.startsWith("Настоящий протокол распространяется") || value.startsWith("This protocol applies to");
  if (key === "4") return !value || value.startsWith("Цели температурного картирования") || value.startsWith("The objectives of temperature mapping");
  return false;
}

function warehouseDefaultSectionText(key: string, input: ReportInput, en: boolean): string {
  const pharmacy = isPharmacyStorageReport(input);
  if (isKyrgyzstanWarehouse(getReportEquipmentType(input))) {
    if (en && key === "2.2.1") {
      return `This temperature mapping study is performed with consideration of:
• EEC Council Decision No. 80 dated 03.11.2016 approving the Rules of Good Distribution Practice within the Eurasian Economic Union;
• EEC Board Recommendation No. 8 dated 20.04.2026 on the Guide for temperature mapping of medicinal product storage areas, used as a methodological reference;
• Law of the Kyrgyz Republic No. 13 dated 12.01.2024 "On Circulation of Medicinal Products";
• Internal standard operating procedures of the process owner for storage of thermolabile medicinal products.`;
    }
    if (!en && key === "2.2.1") {
      return `Настоящее температурное картирование проводится с учётом:
• Решения Совета Евразийской экономической комиссии от 03.11.2016 № 80 «Об утверждении Правил надлежащей дистрибьюторской практики в рамках Евразийского экономического союза»;
• Рекомендации Коллегии ЕЭК от 20.04.2026 № 8 «О Руководстве по проведению температурного картирования зон хранения лекарственных средств» как методической основы;
• Закона Кыргызской Республики от 12.01.2024 № 13 «Об обращении лекарственных средств»;
• внутренних стандартных операционных процедур владельца процесса по хранению термолабильной продукции.`;
    }
  }
  return en
    ? ((pharmacy ? WAREHOUSE_DEFAULT_SECTIONS_EN : GENERIC_WAREHOUSE_DEFAULT_SECTIONS_EN)[key] ?? "")
    : ((pharmacy ? WAREHOUSE_DEFAULT_SECTIONS : GENERIC_WAREHOUSE_DEFAULT_SECTIONS)[key] ?? "");
}

const WAREHOUSE_MAPPING_METHOD_NOTE_EN =
  "The guide for temperature mapping of medicinal product storage areas approved by EEC Board Recommendation No. 8 is used as a methodological reference. " +
  "This protocol is adapted to its structure and approach. For warehouses, controlled-environment rooms, reception and dispatch areas, " +
  "the study duration is established as not less than 7 consecutive days (168 hours), considering risk assessment, operating mode of the storage area " +
  "and representativeness of the observation period. For refrigerated/freezer chambers within a controlled-environment room, a period of 24–72 hours or longer may be used when justified by the protocol.";

const PHARMACY_STORAGE_MAPPING_METHOD_NOTE_EN =
  "The guide for temperature mapping of medicinal product storage areas approved by EEC Board Recommendation No. 8 is used as a methodological reference. " +
  "This protocol is adapted to its structure and approach. For controlled-environment rooms, " +
  "the study duration is established as not less than 7 consecutive days (168 hours), considering risk assessment, operating mode of the object " +
  "and representativeness of the observation period.";

function drawWarehouseEquipmentList(doc: PDFKit.PDFDocument, input: ReportInput, prefix = "5.1."): void {
  const en = isEnglishWarehouse(input);
  const eqList = input.warehouseEquipment ?? [];
  if (eqList.length === 0) return;

    const pharmacy = isPharmacyStorageReport(input);
    drawSubTitle(doc, en
      ? `${prefix} Equipment Installed in the ${pharmacy ? "Pharmacy Storage Room / Area" : "Storage Area"}`
      : `${prefix} Перечень оборудования ${pharmacy ? "помещения (зоны) хранения аптеки" : "зоны хранения"}`);
  eqList.forEach((eq, idx) => {
    ensureSpace(doc, 60);
    doc.font("bold").fontSize(10).fillColor(ACCENT)
      .text(`${en ? "Equipment" : "Оборудование"} ${idx + 1}: ${eq.name}`, { underline: false });
    const safeValue = (v: string | null | undefined): string => {
      const s = (v ?? "").toString().trim();
      return s.length > 0 ? s : "—";
    };
    const rows: [string, string][] = [
      [en ? "Manufacturer" : "Производитель", safeValue(eq.manufacturer)],
      [en ? "Model" : "Модель", safeValue(eq.model)],
      [en ? "Serial number" : "Серийный номер", safeValue(eq.serial)],
      [en ? "Purpose" : "Назначение", safeValue(eq.purpose)],
    ];
    rows.forEach(([label, value]) => {
      doc.font("body").fontSize(10).fillColor(MUTED).text(`${label}: `, { continued: true })
        .fillColor(ACCENT).text(value);
    });
    doc.moveDown(0.5);
  });
}

type WarehouseLoggerSelectionEntry = {
  id?: number;
  label?: string | null;
  customName?: string | null;
  role?: string | null;
  position?: string | null;
};

function buildWarehouseLoggerSelectionEntries(input: ReportInput): WarehouseLoggerSelectionEntry[] {
  const entries: Array<{ logger: WarehouseLoggerSelectionEntry; tokens: Set<string> }> = [];
  const add = (logger: WarehouseLoggerSelectionEntry) => {
    const tokens = new Set([
      ...sensorTokenVariants(logger.label),
      ...sensorTokenVariants(logger.customName),
    ]);
    if (tokens.size === 0 && logger.id === undefined) return;

    const existing = entries.find(entry => tokenSetsIntersect(entry.tokens, tokens));
    if (!existing) {
      entries.push({ logger: { ...logger }, tokens });
      return;
    }

    const currentLabel = existing.logger.label ?? "";
    const nextLabel = logger.label ?? "";
    if (nextLabel.length > currentLabel.length) existing.logger.label = nextLabel;
    if (!existing.logger.customName && logger.customName) existing.logger.customName = logger.customName;
    if (!existing.logger.role && logger.role) existing.logger.role = logger.role;
    if (!existing.logger.position && logger.position) existing.logger.position = logger.position;
    loggerTokenVariants(logger).forEach(token => existing.tokens.add(token));
  };

  input.pv.loggers.forEach(logger => add(logger));
  input.pvLoggers?.forEach(logger => add(logger));

  return entries.map(entry => entry.logger);
}

function loggerTokenVariants(logger: WarehouseLoggerSelectionEntry): string[] {
  return [
    ...sensorTokenVariants(logger.label),
    ...sensorTokenVariants(logger.customName),
  ];
}

function findProtocolSensorForLogger(
  sensors: NonNullable<ReportInput["protocolSensors"]>,
  logger: WarehouseLoggerSelectionEntry,
) {
  const loggerTokens = loggerTokenVariants(logger);
  if (loggerTokens.length === 0) return null;
  return sensors.find(sensor => tokenSetsIntersect(loggerTokens, sensorTokenVariants(sensor.number))) ?? null;
}

function warehouseLoggerRoleLabel(role: string | null | undefined, en: boolean): string {
  if (role === "external") {
    return en
      ? "external; ambient temperature monitoring"
      : "внешний; мониторинг температуры окружающей среды";
  }
  return en ? "internal; mapping point" : "внутренний; точка картирования";
}

function warehouseLoggerCalibrationStatusLabel(
  sensor: NonNullable<ReportInput["protocolSensors"]>[number] | null,
  input: ReportInput,
  en: boolean,
): string {
  if (!sensor) return "—";
  const protocolDate = resolveProtocolReferenceDate(input.generalInfo?.validationDate, input.protocol.createdAt);
  const calibrationStatus = getSensorCalibrationStatusAtProtocolDate(sensor.nextCalibrationDate, protocolDate);
  if (calibrationStatus === "expired") return en ? "Expired" : "Истекла";
  if (calibrationStatus === "valid") return en ? "Valid" : "Годна";
  return sensor.status?.trim() || "—";
}

function warehouseLoggerAccuracyLabel(
  sensor: NonNullable<ReportInput["protocolSensors"]>[number] | null,
  input: ReportInput,
): string {
  if (!sensor) return "—";
  if (!sensor.accuracyC && input.pv.sensorAccuracy === undefined) return "—";
  const accuracy = normalizeSensorAccuracyC(sensor?.accuracyC, input.pv.sensorAccuracy ?? 0.2);
  return `±${accuracy.toFixed(2)} °C`;
}

function drawWarehouseLoggerSelectionTable(doc: PDFKit.PDFDocument, input: ReportInput): void {
  const en = isEnglishWarehouse(input);
  const loggers = buildWarehouseLoggerSelectionEntries(input);
  const sensors = filterProtocolSensorsForReport(input) ?? [];

  if (loggers.length === 0) {
    renderTextBlock(
      doc,
      en
        ? "Information on the data loggers used in the study is completed after PQ/PV logger data are uploaded."
        : "Сведения об использованных регистраторах данных формируются после загрузки данных логгеров PQ/PV.",
    );
    return;
  }

  doc.font("body").fontSize(10).fillColor(ACCENT).text(
    en
      ? "The following data loggers were used for temperature mapping and ambient temperature monitoring:"
      : "Для температурного картирования и мониторинга температуры окружающей среды использованы следующие регистраторы данных:",
    { align: "justify" },
  );
  doc.moveDown(0.5);

  const rows = loggers.map((logger, index) => {
    const sensor = findProtocolSensorForLogger(sensors, logger);
    const displayedNumber = sensor?.number || logger.label || logger.customName || (logger.id ? String(logger.id) : "—");
    const displayedLogger = logger.customName && logger.customName !== displayedNumber
      ? `${displayedNumber}\n(${logger.customName})`
      : displayedNumber;
    return [
      String(index + 1),
      displayedLogger,
      warehouseLoggerRoleLabel(logger.role, en),
      sensor ? fmtTraceDate(sensor.calibrationDate) : "—",
      sensor ? fmtTraceDate(sensor.nextCalibrationDate) : "—",
      warehouseLoggerAccuracyLabel(sensor, input),
      warehouseLoggerCalibrationStatusLabel(sensor, input, en),
    ];
  });

  drawSimpleTable(
    doc,
    en
      ? ["No.", "Data logger", "Purpose", "Verification date", "Valid until", "Accuracy", "Status"]
      : ["№", "Регистратор", "Назначение", "Дата поверки", "Действ. до", "Погрешность", "Статус"],
    rows,
    [0.05, 0.25, 0.18, 0.14, 0.14, 0.11, 0.13],
    { fontSize: 8, headerFontSize: 8, padding: 5 },
  );
}

type WarehousePersonnelEntry = {
  name?: string | null;
  role?: string | null;
  company?: string | null;
};

function nonEmptyText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function buildWarehousePersonnelEntries(input: ReportInput): WarehousePersonnelEntry[] {
  const source =
    (input.generalInfo?.commissionMembers && input.generalInfo.commissionMembers.length > 0
      ? input.generalInfo.commissionMembers
      : null) ??
    (input.signatoriesPart1 && input.signatoriesPart1.length > 0
      ? input.signatoriesPart1
      : null) ??
    (input.signatoriesPart2 && input.signatoriesPart2.length > 0
      ? input.signatoriesPart2
      : null) ??
    [];

  const entries: WarehousePersonnelEntry[] = [];
  const seen = new Set<string>();
  const add = (entry: WarehousePersonnelEntry) => {
    const name = nonEmptyText(entry.name);
    const role = nonEmptyText(entry.role);
    const company = nonEmptyText(entry.company);
    if (!name && !role && !company) return;
    const key = `${name.toLowerCase()}|${role.toLowerCase()}|${company.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ name, role, company });
  };

  source.forEach(add);
  if (entries.length === 0 && nonEmptyText(input.org.responsible)) {
    add({
      name: input.org.responsible,
      role: enRu(input, "Responsible person", "Ответственное лицо"),
      company: input.org.name,
    });
  }

  return entries;
}

function drawWarehousePersonnelTable(doc: PDFKit.PDFDocument, input: ReportInput): void {
  const en = isEnglishWarehouse(input);
  const personnel = buildWarehousePersonnelEntries(input);

  if (personnel.length === 0) {
    renderTextBlock(
      doc,
      en
        ? "Study personnel are specified in the protocol general information and signature sections."
        : "Сведения об исполнителях указываются в общих сведениях протокола и разделах подписей.",
    );
    return;
  }

  doc.font("body").fontSize(10).fillColor(ACCENT).text(
    en
      ? "The temperature mapping study is performed by the following personnel:"
      : "Температурное картирование выполняется следующими исполнителями:",
    { align: "justify" },
  );
  doc.moveDown(0.5);

  drawSimpleTable(
    doc,
    en ? ["No.", "Role / function", "Full name", "Organization"] : ["№", "Роль / функция", "ФИО", "Организация"],
    personnel.map((person, index) => [
      String(index + 1),
      person.role || "—",
      person.name || "—",
      person.company || input.org.name || "—",
    ]),
    [0.06, 0.30, 0.34, 0.30],
    { fontSize: 9, headerFontSize: 9, padding: 6 },
  );

  doc.font("body").fontSize(10).fillColor(ACCENT).text(
    en
      ? "The responsible personnel have the required preparation to place and program data loggers, retrieve data and perform the temperature mapping assessment."
      : "Ответственные лица обладают необходимой подготовкой для размещения и программирования регистраторов данных, считывания данных и выполнения оценки результатов температурного картирования.",
    { align: "left" },
  );
  doc.moveDown(0.8);
}

function warehouseValue(raw: unknown, fallback = "—"): string {
  const text = String(raw ?? "").trim();
  return text || fallback;
}

function warehouseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(String(raw).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function warehouseMetricValue(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function warehouseRoomMetrics(input: ReportInput): {
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  volumeM3: number | null;
} {
  const gi = input.generalInfo;
  const lengthM = input.pvRoomLengthM ?? warehouseNumber(gi?.whLengthM);
  const widthM = input.pvRoomWidthM ?? warehouseNumber(gi?.whWidthM);
  const heightM = input.pvRoomHeightM ?? warehouseNumber(gi?.whHeightM);
  const volumeM3 =
    lengthM !== null && widthM !== null && heightM !== null
      ? Math.round(lengthM * widthM * heightM * 100) / 100
      : null;
  return { lengthM, widthM, heightM, volumeM3 };
}

function warehouseDimensionsLabel(input: ReportInput): string {
  const { lengthM, widthM, heightM, volumeM3 } = warehouseRoomMetrics(input);
  const dims = `${warehouseMetricValue(lengthM)} x ${warehouseMetricValue(widthM)} x ${warehouseMetricValue(heightM)} м`;
  return volumeM3 === null ? dims : `${dims}; расчетный объем ${volumeM3.toFixed(2)} м3`;
}

function warehouseHumidityLabel(input: ReportInput): string {
  const gi = input.generalInfo;
  if (!gi?.whHumidityControl) return "не контролируется";
  const min = warehouseValue(gi.whHumidityMin, "");
  const max = warehouseValue(gi.whHumidityMax, "");
  if (min && max) return `${min}...${max}%`;
  if (max) return `не выше ${max}%`;
  if (min) return `не ниже ${min}%`;
  return "контролируется";
}

function warehouseStudyLabel(input: ReportInput): string {
  const key = input.generalInfo?.whStudyType || "warehouse";
  return WAREHOUSE_STUDY_LABEL[key] || "Помещение (зона) хранения аптеки";
}

function warehouseSeasonLabel(input: ReportInput): string {
  const ruSeasonLabels: Record<string, string> = {
    warm: "Тёплый период",
    cold: "Холодный период",
    interseasonal: "Межсезонье",
    none: "Не применимо",
  };
  const season = String(input.generalInfo?.season ?? "").trim();
  if (season) return ruSeasonLabels[season] || SEASON_LABEL_RU[season] || WAREHOUSE_SEASON_LABEL[season] || season;

  const legacySeason = String(input.generalInfo?.whSeason ?? "").trim();
  if (!legacySeason) return "—";
  if (legacySeason === "n_a" && input.generalInfo?.whExternalEnv) return "—";
  return WAREHOUSE_SEASON_LABEL[legacySeason] || SEASON_LABEL_RU[legacySeason] || legacySeason;
}

function warehouseBasisLabel(input: ReportInput): string {
  const basis = String(input.generalInfo?.qualificationType || input.generalInfo?.basis || "").trim().toLowerCase();
  if (basis.includes("repeat") || basis.includes("повтор")) return "Повторное картирование";
  if (basis.includes("primary") || basis.includes("перв")) return "Первичное картирование";
  return warehouseValue(input.generalInfo?.basis, "Первичное картирование");
}

function warehouseLoggerCounts(input: ReportInput): { internal: number; external: number; total: number } {
  const entries = buildWarehouseLoggerSelectionEntries(input);
  const internal = entries.filter(logger => logger.role !== "external").length;
  const external = entries.filter(logger => logger.role === "external").length;
  return { internal, external, total: entries.length };
}

function warehouseSamplingLabel(input: ReportInput): string {
  const step = input.pv.samplingStepMinutes;
  return step && Number.isFinite(step) ? `${step} мин` : "—";
}

function warehouseActualDurationLabel(input: ReportInput): string {
  return input.pv.startAt && input.pv.endAt ? fmtDuration(input.pv.endAt - input.pv.startAt) : "—";
}

function warehousePointCountLabel(input: ReportInput): string {
  const total = (input.pv.loggers ?? []).reduce((sum, logger) => sum + (logger.pointCount || logger.series?.temp?.length || 0), 0);
  return total > 0 ? String(total) : "—";
}

function warehouseCalibrationSummary(input: ReportInput): string {
  const sensors = filterProtocolSensorsForReport(input) ?? [];
  if (sensors.length === 0) return "сведения о поверке в реестре средств измерений не указаны";
  const protocolDate = resolveProtocolReferenceDate(input.generalInfo?.validationDate, input.protocol.createdAt);
  const valid = sensors.filter(sensor => getSensorCalibrationStatusAtProtocolDate(sensor.nextCalibrationDate, protocolDate) === "valid").length;
  const expired = sensors.filter(sensor => getSensorCalibrationStatusAtProtocolDate(sensor.nextCalibrationDate, protocolDate) === "expired").length;
  const unknown = sensors.length - valid - expired;
  const parts = [`проверено ${sensors.length}`];
  if (valid > 0) parts.push(`годных ${valid}`);
  if (expired > 0) parts.push(`с истекшим сроком ${expired}`);
  if (unknown > 0) parts.push(`без даты следующей поверки ${unknown}`);
  return parts.join(", ");
}

function warehouseMethodologySectionText(key: string, input: ReportInput): string | null {
  if (!isPharmacyStorageReport(input) || isEnglishWarehouse(input)) return null;
  const gi = input.generalInfo;
  const counts = warehouseLoggerCounts(input);
  const tempMode = pvTemperatureModeLabel(input.pv, input);
  const accuracyText =
    input.pv.sensorAccuracy === undefined || input.pv.sensorAccuracy === null
      ? "погрешность средств измерения учитывается согласно сведениям о примененных регистраторах"
      : `погрешность средств измерения учитывается в расчетах: ±${input.pv.sensorAccuracy.toFixed(1)} °C`;
  const humidityCriterion = gi?.whHumidityControl
    ? `; относительная влажность воздуха: ${warehouseHumidityLabel(input)}`
    : "";

  if (key === "6.3") {
    return [
      `Объект исследования: помещение (зона) хранения аптеки.`,
      `Адрес: ${warehouseValue(gi?.location)}.`,
      `Назначение: ${warehouseValue(gi?.purpose, "хранение лекарственных средств")}.`,
      `Тип помещения / зоны: ${warehouseStudyLabel(input)}.`,
      `Температурный режим: ${tempMode}.`,
      `Геометрические размеры: ${warehouseDimensionsLabel(input)}.`,
      `Заполненность объекта: ${gi?.fillStatus ? FILL_STATUS_LABEL_RU[gi.fillStatus] : "—"}; загрузка: ${formatLoadPercent(gi?.loadPercent)}.`,
      `Контроль влажности: ${warehouseHumidityLabel(input)}.`,
      `Контакт с внешней средой: ${gi?.whExternalEnv ? "имеется" : "не указан / отсутствует"}; сезон исследования: ${warehouseSeasonLabel(input)}.`,
      gi?.whLayoutNotes ? `Описание планировки: ${gi.whLayoutNotes}.` : "",
    ].filter(Boolean).join("\n");
  }

  if (key === "6.4") {
    return [
      `Критерии приемлемости сформированы на основании данных, введенных в электронный протокол, и применяются ко всем внутренним регистраторам данных.`,
      `Температура во внутренних точках должна находиться в установленном режиме ${tempMode}; ${accuracyText}.`,
      `MKT каждого внутреннего регистратора должна соответствовать верхней границе температурного режима; выходы Min/Max за расчетные границы не допускаются${humidityCriterion}.`,
      `Продолжительность непрерывного наблюдения: ${pvDurationRequirementLabel(input.pv, input, true)}; фактическая продолжительность: ${warehouseActualDurationLabel(input)}.`,
      `Минимальное количество внутренних регистраторов по настройке PV: ${input.pv.minSensorCount}; фактически задействовано внутренних регистраторов: ${counts.internal}.`,
    ].join("\n");
  }

  if (key === "6.5") {
    return [
      `Количество регистраторов определяется по методическому расчету исходя из протяженности помещения по длине и ширине, а также количества уровней размещения по высоте. По каждой горизонтальной оси предусматривается: при размере до 10 м включительно - 2 точки; свыше 10 до 40 м включительно - 3 точки; свыше 40 до 60 м включительно - 4 точки; свыше 60 м - 5 точек.`,
      `По высоте предусматривается: при высоте до 1,5 м включительно - 1 уровень; свыше 1,5 м и менее 5 м - 2 уровня; 5 м и более - 3 уровня. Расчетная база определяется как произведение количества точек по длине, ширине и высоте: N = Nдлины x Nширины x Nвысоты.`,
      `При наличии контакта помещения с внешней средой дополнительно предусматривается 1 внешний регистратор, установленный на улице для мониторинга температуры окружающей среды.`,
      `Фактически на схеме размещено: внутренних регистраторов ${counts.internal}, внешних регистраторов ${counts.external}, всего ${counts.total}.`,
      `При выборе точек учтены длина, ширина и высота помещения, расположение дверей, окон, стеллажей, кондиционера/отопления и участков возможного контакта с внешней средой.`,
      `Такой подход позволяет выявить температурные градиенты по объему помещения, зоны локального нагрева/охлаждения и места, пригодные для последующего размещения приборов мониторинга температуры.`,
    ].join("\n");
  }

  if (key === "6.6") {
    return [
      `Точки размещения зарегистрированы на интерактивном плане помещения и переносятся в PDF без пересчета координат, чтобы схема на портале и схема в протоколе совпадали.`,
      `Если кружок регистратора вынесен в сторону для читаемости, фактическое место установки задается окончанием стрелки от кружка; именно эта точка используется при построении температурной карты и интерпретации результата.`,
      `Для каждой точки фиксируются номер регистратора на схеме, серийный номер/ID и высота размещения от пола. Эти сведения автоматически выводятся в таблице после схемы расстановки и в Приложении 1.`,
    ].join("\n");
  }

  if (key === "6.7") {
    return [
      `Перед началом испытания регистраторы данных идентифицируются по серийным номерам/ID и сверяются со сведениями о поверке: ${warehouseCalibrationSummary(input)}.`,
      `Регистраторы программируются на единый интервал регистрации ${warehouseSamplingLabel(input)} и единый период наблюдения: ${input.pv.startAt ? fmtDate(input.pv.startAt) : "—"} - ${input.pv.endAt ? fmtDate(input.pv.endAt) : "—"}.`,
      `Маркировка на схеме используется только для однозначной привязки регистратора к месту установки; изменение места установки после начала испытания не допускается без регистрации отклонения.`,
    ].join("\n");
  }

  if (key === "6.8") {
    return [
      `На начало PQ/PV внутренние регистраторы устанавливаются в помещении (зоне) хранения аптеки согласно утвержденной схеме расстановки.`,
      `Внешний регистратор, если предусмотрен планом, устанавливается на улице для мониторинга температуры окружающей среды.`,
      `Высоты размещения указаны на схеме и в Приложении 1. Персонал, работающий в помещении, информируется о проведении температурного картирования, чтобы исключить случайное перемещение, отключение или утрату регистратора данных.`,
    ].join("\n");
  }

  if (key === "6.9") {
    return [
      `После завершения периода наблюдения регистраторы извлекаются без изменения исходной привязки к точкам размещения.`,
      `При извлечении выполняется повторная сверка серийных номеров/ID, номеров на схеме и высот установки с утвержденной схемой и Приложением 1.`,
      `Если выявлено смещение регистратора, повреждение, остановка записи или иное отклонение, информация фиксируется в разделе отклонений и учитывается при интерпретации результата PQ/PV.`,
    ].join("\n");
  }

  if (key === "6.10") {
    return [
      `После извлечения данные регистраторов загружаются в электронный протокол и объединяются в единый набор PQ/PV.`,
      `Период данных: ${input.pv.startAt ? fmtDate(input.pv.startAt) : "—"} - ${input.pv.endAt ? fmtDate(input.pv.endAt) : "—"}; интервал регистрации: ${warehouseSamplingLabel(input)}; общее количество записей: ${warehousePointCountLabel(input)}.`,
      `Для каждого внутреннего регистратора рассчитываются Min, Avg, Max, MKT, длительность и характер возможных отклонений. По совокупности этих показателей определяется горячая и холодная критические точки, после чего формируются температурная карта и заключение испытания.`,
    ].join("\n");
  }

  return null;
}

type WarehouseFloorPlanObject = NonNullable<ReportInput["floorPlanObjects"]>[number];

function warehouseLoggerTokens(logger: WarehouseLoggerSelectionEntry): Set<string> {
  return new Set([
    ...sensorTokenVariants(logger.label),
    ...sensorTokenVariants(logger.customName),
    ...sensorTokenVariants(logger.position),
    ...sensorTokenVariants(logger.id),
  ]);
}

function findWarehouseSensorPointForLogger(input: ReportInput, logger: WarehouseLoggerSelectionEntry): WarehouseFloorPlanObject | null {
  const tokens = warehouseLoggerTokens(logger);
  if (tokens.size === 0) return null;
  return (input.floorPlanObjects ?? [])
    .filter(obj => obj.type === "sensor_point")
    .find(obj => {
      if (floorSensorPointMatchesTokens(obj, tokens)) return true;
      const nested = obj.sensors ?? [];
      return nested.some(sensor => tokenSetsIntersect(sensorTokenVariants(sensor.sensorId), tokens));
    }) ?? null;
}

function hasWarehousePlannedPlacementDiagram(input: ReportInput): boolean {
  const hasPlanObjects = (input.floorPlanObjects ?? []).length > 0;
  const hasAssignedLoggers = (input.pvLoggers ?? []).some(logger => {
    const position = String(logger.position ?? "").trim();
    return position.length > 0 && position !== "unset";
  });
  return Boolean(input.planBackgroundImageUrl || input.planImageUrl || hasPlanObjects || hasAssignedLoggers);
}

function warehouseLoggerFullId(logger: WarehouseLoggerSelectionEntry): string {
  return warehouseValue(logger.label || logger.customName || logger.id);
}

function warehouseLoggerSchemeNumber(input: ReportInput, logger: WarehouseLoggerSelectionEntry): string {
  const sensorPoint = findWarehouseSensorPointForLogger(input, logger);
  return shortSensorId(sensorPoint?.label || logger.label || logger.customName || (logger.id !== undefined ? String(logger.id) : "")) || "—";
}

function warehouseLoggerHeight(input: ReportInput, logger: WarehouseLoggerSelectionEntry): string {
  const sensorPoint = findWarehouseSensorPointForLogger(input, logger);
  const fromPoint = sensorPoint?.heightM;
  if (fromPoint !== undefined && fromPoint !== null && Number.isFinite(fromPoint) && fromPoint > 0) {
    return fromPoint.toFixed(2);
  }
  const nested = sensorPoint?.sensors?.find(sensor => tokenSetsIntersect(sensorTokenVariants(sensor.sensorId), warehouseLoggerTokens(logger)));
  if (nested?.heightFromFloor !== undefined && nested.heightFromFloor !== null && Number.isFinite(nested.heightFromFloor)) {
    return nested.heightFromFloor.toFixed(2);
  }
  return "—";
}

function warehouseLoggerPlacementNote(input: ReportInput, logger: WarehouseLoggerSelectionEntry): string {
  const sensorPoint = findWarehouseSensorPointForLogger(input, logger);
  const hasLeader =
    sensorPoint &&
    typeof sensorPoint.leaderEndXPct === "number" &&
    typeof sensorPoint.leaderEndYPct === "number" &&
    Number.isFinite(sensorPoint.leaderEndXPct) &&
    Number.isFinite(sensorPoint.leaderEndYPct);
  const base = hasLeader ? "Место установки - окончание стрелки на схеме." : "Место установки - точка на схеме.";
  if (logger.role === "external") {
    return `${base} Внешний регистратор установлен на улице для мониторинга температуры окружающей среды.`;
  }
  return base;
}

function normalizeWarehouseSectionText(key: string, text: string, en: boolean): string {
  let out = text;
  if (!en) {
    out = out.replace(/ЕАЭК/g, "ЕЭК");

    if (
      key === "6.1" &&
      (out.includes("наименование датчиков: SSN-13") ||
        out.includes("Государственном реестре средств измерений Республики Казахстан"))
    ) {
      return WAREHOUSE_DEFAULT_SECTIONS["6.1"] ?? out;
    }

    if (key === "6.2" && !/подготовк|обучен/i.test(out)) {
      out += "\n\nОтветственные лица имеют необходимую подготовку и ознакомлены с настоящим протоколом до начала температурного картирования.";
    }
    if (key === "6.8" && !out.includes("Персонал, работающий в зоне хранения")) {
      out += " Персонал, работающий в зоне хранения, информируется о проведении температурного картирования во избежание случайного нарушения работы, отключения, утраты регистраторов данных или собранных данных.";
    }
    if (key === "6.9" && !out.includes("повторная сверка")) {
      out += " По завершении периода исследования выполняется повторная сверка серийных номеров регистраторов данных и мест их размещения с утверждённой схемой и таблицей размещения.";
    }
  } else {
    if (key === "6.2" && !/training|trained/i.test(out)) {
      out += "\n\nResponsible personnel have the necessary training and are familiar with this protocol before the start of temperature mapping.";
    }
    if (key === "6.8" && !out.includes("Personnel working in the storage area")) {
      out += " Personnel working in the storage area are informed about the temperature mapping study to prevent accidental disturbance, deactivation, loss of data loggers or collected data.";
    }
    if (key === "6.9" && !out.includes("re-checked against the approved layout")) {
      out += " After completion of the study period, serial numbers of data loggers and their placement locations are re-checked against the approved layout and placement table.";
    }
  }
  return out;
}

/** Keeps pharmacy-storage PDFs free of legacy warehouse/distribution wording. */
function normalizePharmacySectionText(text: string, en: boolean): string {
  if (en) {
    return text
      .split("\n")
      .filter(line => !/\bGDP\b|\bGPP\b|\bGMP\b|warehouse|receiv(?:e|ing)|dispatch|picking/i.test(line))
      .join("\n")
      .replace(/storage area/gi, "pharmacy storage room / area")
      .replace(/storage room(?! \/ area)/gi, "pharmacy storage room")
      .replace(/routine pharmacy activities[^.]*receipt[^.]*/gi, "routine pharmacy activities");
  }
  return text
    .split("\n")
    .filter(line => !/\bGDP\b|\bGPP\b|\bGMP\b|склад|дистрибьютор|производственн/i.test(line))
    .join("\n")
    .replace(/помещение\/зона хранения/gi, "помещение (зона) хранения аптеки")
    .replace(/(?<!\()зоны хранения/gi, "помещения (зоны) хранения аптеки")
    .replace(/(?<!\()зона хранения/gi, "помещение (зона) хранения аптеки")
    .replace(/приемкой, размещением, комплектованием и отпуском продукции/gi, "движением персонала и выполнением повседневных операций аптеки")
    .replace(/GxP/gi, "утверждённым порядком документооборота");
}

/**
 * Renders warehouse protocol Part I with sections 1–7 per EEC Rec. #8.
 */
function drawWarehouseProtocolPart1(doc: PDFKit.PDFDocument, input: ReportInput, recordToc?: (title: string, level?: number) => void): void {
  const en = isEnglishWarehouse(input);
  const sec = (key: string): string => {
    const custom = input.warehouseSections?.[key];
    if (isPharmacyStorageReport(input) && (key === "2.1" || key === "2.2.2")) {
      const autoText = pharmacyAutoSectionText(key, input, en);
      if (autoText) return autoText;
    }
    if (isPharmacyStorageReport(input) && ["1.1", "1.2", "2.2.1", "3", "4"].includes(key)) {
      return normalizePharmacySectionText(warehouseDefaultSectionText(key, input, en), en);
    }
    if (isPharmacyStorageReport(input) && custom !== undefined && isDefaultPharmacySection(key, custom)) {
      return normalizePharmacySectionText(warehouseDefaultSectionText(key, input, en), en);
    }
    if (custom !== undefined && custom.trim() !== "" && (!en || !hasCyrillic(custom))) {
      const normalized = normalizeWarehouseSectionText(key, custom, en);
      return isPharmacyStorageReport(input) ? normalizePharmacySectionText(normalized, en) : normalized;
    }
    const fallback = warehouseDefaultSectionText(key, input, en);
    const normalized = normalizeWarehouseSectionText(key, fallback, en);
    return isPharmacyStorageReport(input) ? normalizePharmacySectionText(normalized, en) : normalized;
  };

  // ── Section 1: Сокращения и определения ─────────────────────────────────
  doc.addPage();
  recordToc?.(en ? "1. Abbreviations and Definitions" : "1. Сокращения и определения", 1);
  drawSectionTitle(doc, en ? "1. Abbreviations and Definitions" : "1. Сокращения и определения");

  drawSubTitle(doc, en ? "1.1. Abbreviations" : "1.1. Сокращения");
  const abbrevText = sec("1.1");
  abbrevText.split("\n").forEach(line => {
    if (!line.trim()) { doc.moveDown(0.3); return; }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "left" });
  });
  doc.moveDown(0.8);

  drawSubTitle(doc, en ? "1.2. Definitions" : "1.2. Определения");
  const defText = sec("1.2");
  defText.split("\n").forEach(line => {
    if (!line.trim()) { doc.moveDown(0.3); return; }
    doc.font("body").fontSize(10).fillColor(ACCENT).text(line.trim(), { align: "justify" });
  });

  // ── Section 2: Описание и обоснование ───────────────────────────────────
  doc.addPage();
  recordToc?.(en ? "2. Description and Rationale" : "2. Описание и обоснование", 1);
  drawSectionTitle(doc, en ? "2. Description and Rationale" : "2. Описание и обоснование");

  drawSubTitle(doc, en ? "2.1. Mapping Object Description" : "2.1. Описание объекта картирования");
  renderTextBlock(doc, sec("2.1"));

  drawSubTitle(doc, en ? "2.2. Temperature Mapping Rationale" : "2.2. Обоснование проведения температурного картирования");
  drawSubTitle2(doc, en ? "2.2.1. Regulatory Basis" : "2.2.1. Нормативные основания");
  renderTextBlock(doc, sec("2.2.1"));
  drawSubTitle2(doc, en ? "Methodological Approach" : "Принятый методологический подход");
  renderTextBlock(doc, en
    ? (isPharmacyStorageReport(input) ? PHARMACY_STORAGE_MAPPING_METHOD_NOTE_EN : WAREHOUSE_MAPPING_METHOD_NOTE_EN)
    : (isPharmacyStorageReport(input) ? PHARMACY_STORAGE_MAPPING_METHOD_NOTE : WAREHOUSE_MAPPING_METHOD_NOTE));
  drawSubTitle2(doc, en ? "2.2.2. Study-Specific Rationale" : "2.2.2. Конкретные основания для проведения исследования");
  renderTextBlock(doc, sec("2.2.2"));

  // ── Section 3: Область применения ───────────────────────────────────────
  doc.addPage();
  recordToc?.(en ? "3. Scope" : "3. Область применения", 1);
  drawSectionTitle(doc, en ? "3. Scope" : "3. Область применения");
  renderTextBlock(doc, sec("3"));

  // ── Section 4: Цели и задачи ─────────────────────────────────────────────
  recordToc?.(en ? "4. Temperature Mapping Objectives" : "4. Цели и задачи температурного картирования", 1);
  drawSectionTitle(doc, en ? "4. Temperature Mapping Objectives" : "4. Цели и задачи температурного картирования");
  renderTextBlock(doc, sec("4"));

  // ── Section 5: Общие сведения об объекте / оборудовании ────────────────────
  doc.addPage();
  recordToc?.(en ? "5. General Information on the Mapping Object" : "5. Общие сведения об объекте температурного картирования", 1);
  drawSectionTitle(doc, en ? "5. General Information on the Mapping Object" : "5. Общие сведения об объекте температурного картирования");
  drawGeneralInfoTable(doc, input);
  drawRevisionHistorySection(doc, input);

  // Equipment list (multiple items)
  const eqList = input.warehouseEquipment ?? [];
  if (eqList.length > 0) {
    doc.moveDown(0.8);
    drawWarehouseEquipmentList(doc, input, "5.1.");
  }

  // ── Section 6: Методология ───────────────────────────────────────────────
  doc.addPage();
  recordToc?.(en ? "6. Temperature Mapping Methodology" : "6. Методология проведения температурного картирования", 1);
  drawSectionTitle(doc, en ? "6. Temperature Mapping Methodology" : "6. Методология проведения температурного картирования");

  const methodSubs: Array<[string, string]> = [
    [en ? "6.1. Data Logger Type Selection" : "6.1. Сведения о выборе типа регистратора данных", "6.1"],
    [en ? "6.2. Study Personnel" : "6.2. Сведения об исполнителях", "6.2"],
    [en ? "6.3. Study Object Information" : "6.3. Сведения об объекте исследования", "6.3"],
    [en ? "6.4. Acceptance Criteria" : "6.4. Сведения о критериях приемлемости", "6.4"],
    [en ? "6.5. Definition of Logger Placement Points" : "6.5. Сведения об определении точек размещения", "6.5"],
    [en ? "6.6. Registration of Placement Points" : "6.6. Сведения о регистрации точек размещения", "6.6"],
    [en ? "6.7. Marking and Programming" : "6.7. Сведения о маркировке и программировании", "6.7"],
    [en ? "6.8. Logger Placement" : "6.8. Сведения о размещении регистраторов", "6.8"],
    [en ? "6.9. Logger Retrieval" : "6.9. Сведения об извлечении регистраторов", "6.9"],
    [en ? "6.10. Data Download and Consolidation" : "6.10. Сведения о загрузке и объединении данных", "6.10"],
  ];
  methodSubs.forEach(([title, key]) => {
    ensureSpace(doc, 80);
    drawSubTitle(doc, title);
    if (key === "6.1") {
      drawWarehouseLoggerSelectionTable(doc, input);
    } else if (key === "6.2") {
      drawWarehousePersonnelTable(doc, input);
    } else {
      renderTextBlock(doc, warehouseMethodologySectionText(key, input) ?? sec(key));
      const hasPlacementPlan = key === "6.5" && hasWarehousePlannedPlacementDiagram(input);
      if (hasPlacementPlan) {
        drawWarehousePlanDiagram(
          doc,
          input,
          false,
          en
            ? "Diagram 1. Planned logger placement points on the room plan"
            : "Схема 1. Планируемые точки размещения регистраторов на плане помещения",
          {
            showCriticalMarkers: false,
            showAverageLabels: false,
            showSensorLabels: false,
            showHeightLabels: true,
            showPlacementTable: false,
            showLoggerPlacementTable: false,
            showCaption: false,
          },
        );
        drawSensorPlacementAnalysis(doc, (input.pvLoggers ?? []) as DiagramSensor[], input);
      }
    }
  });

  ensureSpace(doc, 260);
  drawPVCalculationMethodSection(
    doc,
    input,
    { title: en ? "6.10.1. Data Processing and Calculation Method" : "6.10.1. Методика обработки данных и расчета показателей" },
  );

  // 6.11 IQ readiness check plan
  ensureSpace(doc, 260);
  drawSubTitle(doc, en ? "6.11. IQ Readiness Check Plan — Installation Qualification" : "6.11. План подготовительной проверки IQ — квалификация монтажа");
  drawStageBlocks(doc, input.iq, input);
  drawChecklistPlan(doc, checklistItemsForReport(input, "iq"), input);

  // 6.12 OQ readiness check plan
  ensureSpace(doc, 260);
  drawSubTitle(doc, en ? "6.12. OQ Readiness Check Plan — Operational Qualification" : "6.12. План подготовительной проверки OQ — квалификация функционирования");
  drawStageBlocks(doc, input.oq, input);
  drawChecklistPlan(doc, checklistItemsForReport(input, "oq"), input);

  // 6.13 PQ/PV mapping plan
  ensureSpace(doc, 260);
  drawSubTitle(doc, en ? "6.13. PQ/PV Plan — Temperature Mapping" : "6.13. План PQ/PV — температурное картирование");
  drawStageBlocks(doc, input.pv, input);
  drawPVPlan(doc, input.pv, input);

  // ── Section 7: Подписи к Протоколу ──────────────────────────────────────
  doc.addPage();
  recordToc?.(en ? "7. Protocol Signatures" : "7. Подписи к Протоколу", 1);
  drawSectionTitle(doc, en ? "7. Protocol Signatures" : "7. Подписи к Протоколу");
  drawSignaturesBlock(
    doc,
    getSignatoriesPart1(input),
    en ? "This temperature mapping protocol has been reviewed and approved by:" : "Настоящий протокол температурного картирования рассмотрен и утверждён:",
    input,
  );
}

/** Render a multi-line text block with proper spacing */
function chamberReportLoggers(input: ReportInput): ChamberLogger[] {
  // Statistics from the current analysis take precedence over saved diagram values.
  const placed = input.pvLoggers ?? [];
  return input.pv.loggers.map(l => {
    const location = placed.find(p => p.id === l.id || p.label === l.label);
    return { ...l, position: location?.position, avg: l.pointCount > 0 ? l.avg : null };
  });
}

function chamberHeight(input: ReportInput, z: number): string {
  const key = z === 0 ? "lower" : z === 1 ? "upper" : "middle";
  const obj = input.floorPlanObjects?.find(o => o.id === `chamber-${key}`);
  return obj?.heightM != null && Number.isFinite(obj.heightM) ? `${obj.heightM.toFixed(2)} м` : "не указана";
}

function drawChamberDiagram(doc: PDFKit.PDFDocument, input: ReportInput, mode: ChamberMode) {
  ensureSpace(doc,mode === "temperature" ? 720 : 670);
  drawSectionTitle(doc, mode === "plan"
    ? "Схема 1. Планируемое размещение регистраторов"
    : mode === "actual" ? "Схема 2. Фактическое размещение регистраторов"
    : "Схема 3. Средние температуры и пространственное распределение PQ/PV");
  const loggers = chamberReportLoggers(input);
  const critical = calculateCriticalLoggerIndices(input.pv.loggers);
  const scene = buildChamberScene(loggers, mode,
    critical.hotIdx == null ? null : input.pv.loggers[critical.hotIdx]?.label,
    critical.coldIdx == null ? null : input.pv.loggers[critical.coldIdx]?.label,
    Object.fromEntries([0,.5,1].map(z=>[String(z),chamberHeight(input,z)==="не указана" ? "h: —" : chamberHeight(input,z)])),chamberFeatures(input.floorPlanObjects));
  const y = doc.y + 8, s = (doc.page.width - 2 * PAGE_MARGIN) / CHAMBER_VIEW.width;
  for (const p of scene) {
    doc.save();
    if (p.kind === "text") {
      doc.font(p.bold ? "bold" : "body").fontSize(p.size * s).fillColor(p.color)
        .text(p.text, PAGE_MARGIN + (p.x - 300) * s, y + p.y * s, { width: 600 * s, align: "center", lineBreak: false });
    } else if (p.kind === "circle") {
      doc.lineWidth((p.width ?? 1) * s).fillColor(p.fill).strokeColor(p.stroke)
        .circle(PAGE_MARGIN + p.x * s, y + p.y * s, p.r * s).fillAndStroke();
    } else {
      doc.moveTo(PAGE_MARGIN + p.points[0][0] * s, y + p.points[0][1] * s);
      p.points.slice(1).forEach(point => doc.lineTo(PAGE_MARGIN + point[0] * s, y + point[1] * s));
      if (p.kind === "poly") {
        doc.closePath().fillOpacity(p.opacity ?? 1).fillColor(p.fill);
        if (p.stroke) doc.strokeColor(p.stroke).lineWidth(s).fillAndStroke(); else doc.fill();
      } else {
        doc.strokeColor(p.stroke).lineWidth((p.width ?? 1) * s);
        if (p.dash) doc.dash(5 * s, { space: 3 * s });
        doc.stroke();
      }
    }
    doc.restore();
  }
  doc.x = PAGE_MARGIN; doc.y = y + CHAMBER_VIEW.height * s + 12;
  renderTextBlock(doc, `Высоты от пола: нижний уровень — ${chamberHeight(input, 0)}; средний — ${chamberHeight(input, .5)}; верхний — ${chamberHeight(input, 1)}. Обозначения C/W/V идентифицируют места установки. Изометрия условная; границы показывают рабочий объём хранения.`);
  if (mode === "temperature") renderTextBlock(doc,
    "Цветовая шкала соответствует диапазону средних температур внутренних регистраторов. Показаны три сечения единого поля; интерполяция выполнена по расстояниям в нормированных координатах рабочего объёма с весами 1/d⁴. Линии соединяют подписи с точками измерения. Внешний регистратор исключён. Цвет между точками является оценкой, а не измерением; пригодность зоны подтверждают исходные данные и оценка рисков. Критические точки Г/Х по временным рядам могут отличаться от точек с крайними средними значениями.");
}

function drawChamberPlacementTable(doc: PDFKit.PDFDocument, input: ReportInput) {
  const loggers = chamberReportLoggers(input);
  const rows = CHAMBER_POSITIONS.map(p => {
    const matches = loggers.filter(l => l.role === "internal" && l.position === p.id);
    return [p.id, matches.map(l=>l.label).join("; ") || "Не назначен", p.name, chamberHeight(input,p.z)];
  });
  loggers.filter(l=>l.role==="external").forEach(l=>rows.push(["EXT",l.label,"Вне камеры; контроль окружающей среды","По месту"]));
  loggers.filter(l=>l.role==="internal"&&!CHAMBER_POSITIONS.some(p=>p.id===l.position)).forEach(l=>rows.push(["—",l.label,"Позиция не подтверждена","—"]));
  drawSimpleTable(doc,["ID точки","Серийный номер","Место размещения","Высота"],rows,[.12,.30,.42,.16],{fontSize:8.5,headerFontSize:8.5,padding:5,headerHeight:32,headerLineBreak:true});
}

function drawChamberMappingReport(doc: PDFKit.PDFDocument, source: ReportInput) {
  // Do not mutate the caller or allow legacy 8/9-sensor settings to certify a
  // new 15+1 study. Preserve the existing raw data, questions and answers.
  const loggers = chamberReportLoggers(source);
  const completeness = chamberPlacementIssues(loggers);
  const duration = source.pv.startAt != null && source.pv.endAt != null ? (source.pv.endAt-source.pv.startAt)/3600000 : 0;
  if(duration < CHAMBER_MIN_DURATION_HOURS) completeness.push("Продолжительность записи меньше требуемого минимума — 24 часов.");
  for (const logger of source.pv.loggers) {
    if (!logger.pointCount || !logger.series.ts.length || logger.series.ts.length!==logger.series.temp.length || logger.series.temp.some(t=>!Number.isFinite(t))) {
      completeness.push(`Регистратор ${logger.label}: нет полного сопоставимого ряда измерений.`);
    } else if (logger.role === "internal" && (logger.min < source.pv.rangeMin || logger.max > source.pv.rangeMax)) {
      completeness.push(`Регистратор ${logger.label}: экстремумы выходят за установленные критерии приемлемости.`);
    }
  }
  completeness.push(...chamberMetrologyIssues(loggers,source.protocolSensors ?? [],source.generalInfo?.validationDate || source.protocol.createdAt,source.pv.sensorAccuracy));
  const critical = calculateCriticalLoggerIndices(source.pv.loggers);
  const input: ReportInput = { ...source, pv: { ...source.pv,
    minSensorCount: Math.max(15,source.pv.minSensorCount || 15),
    minDurationHours: CHAMBER_MIN_DURATION_HOURS,
    hotIdx: critical.hotIdx, coldIdx: critical.coldIdx,
    extIndices: source.pv.loggers.flatMap((l,i)=>l.role==="external"?[i]:[]),
    failureReasons: [...source.pv.failureReasons,...completeness],
    verdict: completeness.length && source.pv.verdict === "pass" ? "fail" : source.pv.verdict,
  }};
  doc.info.Title = `Протокол и отчёт температурного картирования холодильной камеры ${input.protocol.number}`;
  doc.info.Subject = "Температурное картирование холодильной камеры; ЕЭК №8; размещение 15+1";
  const toc: TableOfContentsEntry[] = [];
  const mark = (title: string, level=1) => toc.push({title,page:doc.bufferedPageRange().count,level});
  const section = (title: string) => {doc.addPage();mark(title);drawSectionTitle(doc,title);};
  const sub = (title: string, text: string) => {ensureSpace(doc,100);drawSubTitle(doc,title);renderTextBlock(doc,text);};
  const gi = input.generalInfo;
  const notes = input.floorPlanObjects?.find(o=>o.id==="chamber-notes")?.label || gi?.whLayoutNotes || "Планировка, расположение двери, испарителя, стеллажей и штатного датчика не описаны. Требуется обследование и документирование перед утверждением плана.";
  const dims = [input.pvRoomLengthM ?? gi?.whLengthM,input.pvRoomWidthM ?? gi?.whWidthM,input.pvRoomHeightM ?? gi?.whHeightM].map(v=>v!=null&&Number(v)>0?`${Number(v)} м`:"не указано");
  drawPartCover(doc,input,"part1");mark("ЧАСТЬ I. Протокол температурного картирования",0);
  doc.addPage(); const tocPage = doc.bufferedPageRange().count-1;
  section("1. Сокращения и определения");
  renderTextBlock(doc,"ЕЭК — Евразийская экономическая комиссия. GDP — надлежащая дистрибьюторская практика. ISPE — International Society for Pharmaceutical Engineering. IQ — подготовительная проверка монтажа; OQ — подготовительная проверка функционирования; PQ/PV — температурное картирование в эксплуатационных условиях. MKT — средняя кинетическая температура.");
  renderTextBlock(doc,"Температурное картирование — документированное изучение распределения температуры в рабочей зоне хранения. По Руководству ЕЭК холодная и горячая точки характеризуют наименьшие и наибольшие температуры в допустимом диапазоне; выходы за его пределы отражаются как отклонения. Критическими также являются места наиболее значительных колебаний температуры. Регистратор данных сохраняет временной ряд измерений с возможностью передачи в информационную систему. Рабочий объём — пространство фактического или предполагаемого хранения лекарственных средств, а не весь объём ограждающей конструкции.");
  section("2. Описание и обоснование");
  sub("2.1. Описание объекта",`Объект: холодильная камера для хранения лекарственных средств. Организация: ${input.org.name}. Адрес / место установки: ${gi?.location || input.org.addressFact || "не указано"}. Идентификация камеры: ${[gi?.manufacturer,gi?.model,gi?.serial].filter(Boolean).join(" / ") || "не указана"}. Назначение: ${gi?.purpose || "хранение лекарственных средств в установленном температурном режиме"}.`);
  sub("2.2. Нормативные и методические основания","Структура и процедура картирования адаптированы к Руководству, утверждённому Рекомендацией Коллегии ЕЭК от 20.04.2026 №8 (разделы V–VI, пункты 10–20). Рекомендация имеет рекомендательный характер. Правила GDP ЕАЭС по Решению Совета ЕЭК от 03.11.2016 №80 применяются в соответствующей области деятельности. Размещение 15 внутренних регистраторов основано на международной практике ISPE и документированной оценке рисков; 1 внешний регистратор предназначен для оценки влияния окружающей среды.");
  sub("2.3. Основание данного исследования",`Основание: ${gi?.basis === "primary" ? "Первичное картирование" : gi?.basis === "repeat" || gi?.basis === "periodic" ? "Повторное картирование" : gi?.basis || "не указано"}. Исследуется состояние загрузки: ${gi?.fillStatus==="empty"?"пустая камера":gi?.fillStatus==="loaded"?"загруженная камера":"не указано"}; загрузка: ${gi?.loadPercent ?? "не указана"}${gi?.loadPercent!=null?"%":""}. Период: ${gi?.season ? (SEASON_LABEL_RU[gi.season] || gi.season) : "не указан"}. Результаты относятся к документированной конфигурации камеры и условиям испытания.`);
  section("3. Область применения");
  renderTextBlock(doc,"Настоящий протокол применяется к стационарной холодильной камере для хранения лекарственных средств. Он охватывает проверку готовности камеры и регистратора данных, исследование рабочего объёма, выявление неоднородности температуры и выбор мест постоянного мониторинга. Испытания с открыванием двери, отключением питания, переключением агрегатов и оттайкой оцениваются по утверждённой программе. Применимость результатов к иной загрузке или конфигурации требует оценки рисков.");
  sub("4. Цели и задачи температурного картирования","Подтвердить поддержание заданного диапазона температуры в зоне размещения продукции; оценить стабильность и колебания; выявить холодные, горячие и иные критические точки; определить участки с ограничениями хранения; установить места средств измерения для постоянного мониторинга и необходимые корректирующие действия.");mark("4. Цели и задачи температурного картирования");
  section("5. Общие сведения о холодильной камере");drawGeneralInfoTable(doc,input);drawRevisionHistorySection(doc,input);
  section("6. Методология проведения температурного картирования");
  sub("6.1. Выбор регистраторов данных","Используются электронные регистраторы с подходящим диапазоном, достаточной памятью и автономностью, единым временем и возможностью выгрузки исходных данных. Абсолютная погрешность в исследуемом диапазоне — не более ±0,5 °C. Метрологическая пригодность подтверждается на дату испытания действующей поверкой или калибровкой, когда она допускается применимыми требованиями. Предпочтительны регистраторы одного типа. Номер свидетельства и подтверждающий документ сохраняются в материалах исследования.");
  drawWarehouseLoggerSelectionTable(doc,input);
  sub("6.2. Исполнители","Ответственные лица и организации берутся из данных протокола. Руководитель исследования проверяет подготовку исполнителей, утверждение программы и сохранность исходных файлов.");drawWarehousePersonnelTable(doc,input);
  sub("6.3. Сведения об объекте исследования",`Габариты камеры (длина × ширина × высота): ${dims.join(" × ")}. Нижний уровень хранения: ${chamberHeight(input,0)}; средний: ${chamberHeight(input,.5)}; верхний: ${chamberHeight(input,1)}.\n${notes}`);
  sub("6.4. Критерии приемлемости",`Температурный режим хранения: ${pvTemperatureModeLabel(input.pv,input)}. Оценка внутренних регистраторов проводится по границам ${input.pv.rangeMin}...${input.pv.rangeMax} °C с принятой в протоколе метрологической поправкой / защитным интервалом. Требуются не менее ${input.pv.minSensorCount} внутренних регистраторов и 1 внешний, прослеживаемые позиции и непрерывные сопоставимые записи за утверждённый период. MKT — дополнительный показатель, не заменяющий оценку экстремумов, длительности отклонений и риска замораживания. Выходы за пределы не компенсируются приемлемым средним или MKT. Недостаточность данных не считается соответствием.`);
  sub("6.5. Определение точек размещения и оценка рисков","План 15+1: 8 углов рабочего объёма (C1–C8), 4 центра боковых граней (W1–W4), центры нижней и верхней граней (V1, V3) и центр объёма (V2). Такая расстановка охватывает длину, ширину и высоту хранения и позволяет сравнивать периферийные и центральные зоны. Риск-ориентированный подход допускается пунктом 16д Руководства ЕЭК. Число 15 не является универсальной гарантией покрытия: для больших камер, отдельных отсеков, плотных стеллажей или нескольких испарителей обосновывают дополнительные точки и отдельные зоны исследования. Типовая схема ISPE для объёма до приблизительно 20 м³ не должна автоматически переноситься на любой объём.");
  renderTextBlock(doc,"При обследовании оценивают приток тепла через дверь, зоны подачи холодного воздуха и риска локального переохлаждения, застойные зоны за стеллажами, верхние и нижние уровни хранения, расположение штатного датчика. Датчики фиксируют без прямого контакта с металлом, стенами и продукцией, не мешая рутинным операциям. Внешний регистратор располагают вне камеры в среде, которая воздействует на неё (например, в смежном помещении у двери); место документируют. Он исключён из внутренней статистики, определения критических точек и цветового поля.");
  drawChamberDiagram(doc,input,"plan");
  sub("6.6. Регистрация расположения","Каждой точке присвоен постоянный ID C/W/V или EXT. После установки серийные номера и высоты связываются с этими ID в приложении 1 непосредственно после схемы 2. Перемещения во время исследования регистрируются как отклонения от плана с указанием времени и причины.");
  sub("6.7. Маркировка и программирование",`Регистраторы маркируют, синхронизируют часы и время первого измерения с учётом времени монтажа. Интервал записи: ${input.pv.samplingStepMinutes ? `${input.pv.samplingStepMinutes} мин` : "по исходным записям; подтвердить одинаковый интервал перед запуском"}. Обычно выбирают интервал 1–15 минут с учётом скорости процессов. До начала проверяют запуск, память и питание каждого прибора.`);
  sub("6.8. Установка и проверка перед запуском","После размещения сверяют серийный номер, ID, высоту, крепление и рабочее состояние всех регистраторов. Фиксируют конфигурацию загрузки и ограничения хранения. Персонал информируют об исследовании. Протокол утверждают до начала измерений; изменения оформляют с обоснованием и согласованием.");
  sub("6.9. Продолжительность и проведение исследования","Требуемая длительность испытания — не менее 24 часов непрерывно. Программа установлена для холодильной камеры с контролируемой средой, не подверженной критическому воздействию суточных или сезонных колебаний температуры, с учётом пункта 16и Руководства ЕЭК. Условия применимости подтверждают обследованием, оценкой рисков и внешними измерениями. Период должен охватывать репрезентативный суточный цикл работы камеры. Регистрируют циклы охлаждения и оттайки, обычные открытия двери, переключения основного/резервного агрегата и изменения загрузки. Специальные испытания открывания двери и отключения питания проводят только по согласованным параметрам; отсутствие таких испытаний прямо отражают в отчёте.");
  renderTextBlock(doc,"Справочная информация. Согласно пункту 16и Руководства ЕЭК для холодильного оборудования с контролируемой средой, не подвергающегося критическому воздействию суточных или сезонных колебаний температуры, продолжительность исследования может составлять от 24 до 72 часов или более при необходимости. Этот диапазон приведён для ознакомления и не устанавливает требование проводить настоящее испытание 72 часа. Критерий длительности настоящего протокола — не менее 24 часов непрерывно.");
  sub("6.10. Извлечение, объединение и анализ данных","По окончании повторно сверяют серийные номера и места установки, выгружают исходные файлы без изменения и сохраняют их с записями исследования. Проверяют полноту временного покрытия, единицы, часовой пояс, интервалы записи и пропуски. Статистику рассчитывают в едином окне PQ/PV; любые исключения документируют. Анализ включает минимум, максимум, среднее, разброс, динамику отклонений, влияние двери и оттайки, стабильность зон и сопоставление с внешними условиями.");
  drawPVCalculationMethodSection(doc,input,{title:"6.10.1. Формулы и методика расчёта"});
  ensureSpace(doc,150);drawSubTitle(doc,"6.11. Подготовительная проверка IQ");drawStageBlocks(doc,input.iq,input);drawChecklistPlan(doc,checklistItemsForReport(input,"iq"),input);
  ensureSpace(doc,150);drawSubTitle(doc,"6.12. Подготовительная проверка OQ");drawStageBlocks(doc,input.oq,input);drawChecklistPlan(doc,checklistItemsForReport(input,"oq"),input);
  sub("6.13. Программа PQ/PV",input.pv.description);drawPVPlan(doc,input.pv,input);
  section("7. Утверждение протокола");drawSignaturesBlock(doc,getSignatoriesPart1(input),"Протокол температурного картирования рассмотрен и утверждён:",input);
  doc.addPage();drawPartCover(doc,input,"part2");mark("ЧАСТЬ II. Отчёт температурного картирования",0);
  section("8. Условия исследования и подготовительные проверки");drawTestPeriod(doc,input);
  drawSubTitle(doc,"8.1. Результаты IQ");drawStageDataEntryTable(doc,input,"IQ");drawChecklistTable(doc,checklistItemsForReport(input,"iq"),input);drawStageVerdict(doc,"IQ",input.iq.verdict,checklistItemsForReport(input,"iq"),input);
  drawSubTitle(doc,"8.2. Результаты OQ");drawStageDataEntryTable(doc,input,"OQ");drawChecklistTable(doc,checklistItemsForReport(input,"oq"),input);drawStageVerdict(doc,"OQ",input.oq.verdict,checklistItemsForReport(input,"oq"),input);
  section("9. Результаты температурного картирования PQ/PV");drawStageDataEntryTable(doc,input,"PV");drawPVPassportSummary(doc,input);
  drawChamberDiagram(doc,input,"actual");
  doc.addPage();mark("Приложение 1. Расположение регистраторов");drawSectionTitle(doc,"Приложение 1. Расположение регистраторов данных");
  renderTextBlock(doc,"Сведения по пункту 16е и приложению №1 Руководства ЕЭК. ID обозначает точку схемы; серийный номер указан полностью для прослеживаемости.");drawChamberPlacementTable(doc,input);
  if(completeness.length) drawPVInfoBox(doc,completeness.join("\n"),{bg:"#fff7ed",border:"#fed7aa",color:"#9a3412"});
  section("9.1. Сводная статистика по регистраторам");
  drawStatsTable(doc,input.pv.loggers,critical.hotIdx,critical.coldIdx,input.pv.extIndices,input);
  ensureSpace(doc,500);
  drawPVCriticalInterpretationSummary(doc,input);
  const valid = input.pv.loggers.filter(l=>l.role==="internal"&&l.pointCount>0&&Number.isFinite(l.min)&&Number.isFinite(l.max));
  if(valid.length) {
    const unstable = [...valid].sort((a,b)=>(b.max-b.min)-(a.max-a.min))[0];
    sub("Оценка колебаний и областей хранения",`Наибольший размах температуры зарегистрирован логгером ${unstable.label}: ${fmtTempMetric(unstable.max-unstable.min)} (минимум ${fmtTempMetric(unstable.min)}, максимум ${fmtTempMetric(unstable.max)}). Эта точка дополнительно рассматривается как критическая по нестабильности согласно пункту 19 Руководства ЕЭК. Пространственные ограничения устанавливают по совокупности отклонений и планировки, а не по цветовой интерполяции.`);
  }
  drawChamberDiagram(doc,input,"temperature");
  section("9.2. Графики и исходные результаты");drawCharts(doc,input.pv,input);
  for (const logger of input.pv.loggers) {
    ensureSpace(doc,270);
    drawChamberLoggerChart(doc,{name:logger.label,ts:logger.series.ts,temp:logger.series.temp},input.pv.rangeMin,input.pv.rangeMax);
  }
  drawDeviationsSection(doc,input.pv,input);
  sub("9.3. Эксплуатационные события и дополнительные испытания",input.planDeviations?.trim() || "Отдельный журнал эксплуатационных событий не заполнен. Наличие или отсутствие открываний двери, оттаек, отключений питания и переключений агрегатов следует подтвердить записями исследования; отсутствие записей не доказывает отсутствие событий.");
  if(input.excursion?.enabled) {doc.addPage();drawExcursionSection(doc,input.excursion,input.pv.rangeMin,input.pv.rangeMax,input.pv.sensorAccuracy,"9.3.1");} else renderTextBlock(doc,"Специальные испытания с открыванием двери и отключением питания в данных протокола не включены. Время восстановления и автономного сохранения режима по обычному картированию не устанавливается.");
  section("10. Выводы о пригодности холодильной камеры");
  const passed = input.iq.verdict==="pass"&&input.oq.verdict==="pass"&&input.pv.verdict==="pass";
  renderTextBlock(doc,passed ? `На основании результатов подготовительных проверок IQ/OQ и температурного картирования PQ/PV холодильная камера признана пригодной для хранения лекарственных средств в температурном режиме ${pvTemperatureModeLabel(input.pv,input)} в исследованном рабочем объёме, при документированной загрузке и условиях эксплуатации. Испытание завершено с положительным заключением.` : "Пригодность холодильной камеры по совокупности IQ/OQ и PQ/PV не подтверждена. Требуется завершить проверки, оценить недостаточность данных и устранить зафиксированные несоответствия; при необходимости выполнить повторное картирование.");
  if(input.pv.failureReasons.length) renderTextBlock(doc,input.pv.failureReasons.join("\n"));
  section("11. Отклонения и корректирующие действия");renderTextBlock(doc,input.planDeviations?.trim() || "Записи об отклонениях от плана и корректирующих действиях не внесены. Перед утверждением отчёта подтвердить полноту журнала исследования.");
  sub("12. Рекомендации и последующее картирование","Установить или перенести средства постоянного мониторинга температуры в подтверждённые критические точки рабочего объёма; при необходимости контролировать зоны наибольших колебаний. Участки с отклонениями исключить из хранения до устранения причин и подтверждения эффективности мер. Задать уставки сигнализации с учётом метрологических характеристик и допустимых условий продукции. Повторное картирование предусматривается после значимых изменений камеры, загрузки, стеллажей, агрегатов или необъяснённых отклонений мониторинга. Периодичность и необходимость сезонного исследования устанавливаются на основании документированной оценки рисков.");mark("12. Рекомендации и последующее картирование");
  if(input.recommendations?.trim()) renderTextBlock(doc,input.recommendations);
  section("13. Утверждение отчёта");drawSignaturesBlock(doc,getSignatoriesPart2(input),"Отчёт о температурном картировании рассмотрен и утверждён:",input);
  section("14. Литература и нормативные источники");
  renderTextBlock(doc,"1. Рекомендация Коллегии Евразийской экономической комиссии от 20 апреля 2026 г. №8 «О Руководстве по проведению температурного картирования зон хранения лекарственных средств». Основной методический источник; пункты 9–20 и приложения №1 и №2.\n2. Решение Совета Евразийской экономической комиссии от 3 ноября 2016 г. №80 «Об утверждении Правил надлежащей дистрибьюторской практики в рамках Евразийского экономического союза». GDP ЕАЭС; в применимой области деятельности.\n3. ISPE. Controlled Temperature Chamber Mapping. Pharmaceutical Engineering, 2012. Раздел 4, рисунок 4.1: размещение измерительных точек и оценка рисков. https://ispe.org/pharmaceutical-engineering/white-papers/controlled-temperature-chamber-mapping\n4. ISPE Good Practice Guide: Controlled Temperature Chambers — Commissioning and Qualification, Mapping and Monitoring. Second Edition, December 2021. Международное руководство по надлежащей практике; не нормативный акт ЕАЭС. https://ispe.org/publications/guidance-documents/ispe-good-practice-guide-controlled-temperature-chambers-2nd-edition");
  section("Приложение 2. Информация о распределении температуры");
  drawSimpleTable(doc,["ID / точка","Серийный номер","Min, °C","Max, °C","Avg, °C","В диапазоне"],input.pv.loggers.map(l=>[
    l.role==="external"?"EXT":loggers.find(p=>p.id===l.id)?.position || "не указан", l.label,
    l.pointCount?l.min.toFixed(2):"—",l.pointCount?l.max.toFixed(2):"—",l.pointCount?l.avg.toFixed(2):"—",
    l.role==="external"?"Не оценивается":!l.pointCount?"Нет данных":l.min>=input.pv.rangeMin&&l.max<=input.pv.rangeMax?"Да":"Нет",
  ]),[.12,.25,.12,.12,.12,.27],{fontSize:8,headerFontSize:8,padding:4,headerHeight:32,headerLineBreak:true});
  renderTextBlock(doc,"Исходные показания, выгруженные файлы и метрологические документы составляют материалы исследования. При прореживании таблицы для печати исходные файлы сохраняются полностью; статистика относится к выбранному окну и настройкам обработки.");
  drawMeasurementTable(doc,input.pv.loggers,input.pv.samplingStepMinutes,input);
  if(input.attachments?.some(a=>a.includeInPdf!==false&&a.includeInPdf!==0)) {section("Материалы исследования и метрологические документы");drawAttachmentsSection(doc,input);}
  drawChamberContents(doc,tocPage,toc);
}

function drawChamberContents(doc: PDFKit.PDFDocument, page: number, entries: TableOfContentsEntry[]) {
  const last = doc.bufferedPageRange().count-1;
  doc.switchToPage(page);doc.x=PAGE_MARGIN;doc.y=80;
  drawSectionTitle(doc,"Содержание");
  entries.forEach(entry=>{
    const x=PAGE_MARGIN+(entry.level ? 10 : 0),width=doc.page.width-PAGE_MARGIN-x-32;
    doc.font(entry.level ? "body" : "bold").fontSize(9.3).fillColor(ACCENT);
    const height=Math.max(24,doc.heightOfString(entry.title,{width})+7),y=doc.y;
    doc.text(entry.title,x,y,{width});
    doc.text(String(entry.page),doc.page.width-PAGE_MARGIN-28,y,{width:28,align:"right"});
    doc.y=y+height;
  });
  doc.switchToPage(last);doc.x=PAGE_MARGIN;
}

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
 * Draw table with sensor information (number, verification date, next verification date)
 */
function drawSensorTable(
  doc: PDFKit.PDFDocument,
  sensors: Array<{
    id: number;
    number: string;
    calibrationDate: string | Date | null;
    nextCalibrationDate: string | Date | null;
    accuracyC?: string | number | null;
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
    const rowAccuracy = normalizeSensorAccuracyC(sensor.accuracyC, sensorAccuracy);
    const accuracyText = `±${rowAccuracy.toFixed(2)}`;

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
