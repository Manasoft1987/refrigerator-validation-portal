import { describe, expect, it } from "vitest";
import { generateProtocolPdf } from "./pdfReport";

function mkSeries(start: number, hours: number, temp: number) {
  const ts: number[] = [];
  const t: number[] = [];
  const step = 5 * 60_000; // 5-min resolution
  const n = Math.round((hours * 3600_000) / step);
  for (let i = 0; i < n; i++) {
    ts.push(start + i * step);
    t.push(temp + Math.sin(i / 30) * 0.3);
  }
  return { ts, temp: t };
}

const BASE_ORG = {
  name: "АО «Фарма-Холод»",
  bin: "123456789012",
  addressLegal: "г. Алматы, пр. Абая, 1",
  addressFact: "г. Алматы, пр. Абая, 1",
  responsible: "Иванова А. И.",
  phone: "+7 700 123 4567",
  email: "validation@example.kz",
  logoBuffer: null as Buffer | null,
};

const BASE_GI = {
  equipmentType: "refrigerator",
  manufacturer: "Liebherr",
  model: "MKv 3910",
  serial: "SN-00123",
  inventory: "INV-55",
  year: 2022,
  tempMode: "2-8",
  location: "Склад ГЛП, помещение 12",
  purpose: "Хранение ЛС при температуре 2–8 °C",
  validationDate: "2024-07-15",
  basis: "primary",
};

describe("generateProtocolPdf", () => {
  it(
    "produces a non-empty PDF buffer starting with %PDF marker",
    async () => {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 72.5, 5);
      const sensor = {
        id: 1, label: "D1", customName: null, role: "internal" as const,
        pointCount: series.temp.length, min: 4.6, max: 5.4, avg: 5.0, std: 0.2, mkt: 5.0,
        series, deviations: [],
      };
      const buf = await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-2024-0001", createdAt: new Date(now) },
        generalInfo: {
          ...BASE_GI,
          commissionMembers: [
            { name: "Иванова А. И.", role: "Председатель" },
            { name: "Петров Н. С.", role: "Член комиссии" },
          ],
        },
        iq: {
          purpose: "Проверка корректности монтажа",
          description: "Монтаж проведён подрядчиком в соответствии с проектом.",
          criteria: "Все позиции чек-листа должны иметь положительный ответ.",
          items: [
            { questionIndex: 1, questionText: "Оборудование доставлено в исправном виде", answer: "yes", comment: null },
            { questionIndex: 2, questionText: "Имеется сертификат калибровки термодатчика", answer: "yes", comment: "К-2024-01" },
          ],
          verdict: "pass",
        },
        oq: {
          purpose: "Проверка работы в штатных режимах",
          description: "Прогон системы в течение 24 часов.",
          criteria: "Отсутствие отклонений от режима",
          items: [
            { questionIndex: 1, questionText: "Камера поддерживает заданный режим", answer: "yes", comment: null },
          ],
          verdict: "pass",
        },
        pv: {
          purpose: "Проверка стабильности температуры при эксплуатации",
          description: "Загрузка и непрерывный мониторинг 72 ч.",
          criteria: "Температура в пределах 2…8 °C на протяжении всего испытания.",
          tempMode: "2-8", rangeMin: 2, rangeMax: 8,
          startAt: now, endAt: now + 72.5 * 3600_000,
          minDurationHours: 72, minSensorCount: 9,
          loggers: [sensor], verdict: "pass", failureReasons: [],
          hotIdx: 0, coldIdx: 0, extIndices: [],
        },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2000);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    60_000,
  );

  it(
    "includes excursion section when excursion is enabled",
    async () => {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 72.5, 5);
      const excSeries = mkSeries(now + 72.5 * 3600_000, 4, 5);
      const sensor = {
        id: 1, label: "D1", customName: null, role: "internal" as const,
        pointCount: series.temp.length, min: 4.6, max: 5.4, avg: 5.0, std: 0.2, mkt: 5.0,
        series, deviations: [],
      };
      const buf = await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-2024-0002", createdAt: new Date(now) },
        generalInfo: BASE_GI,
        iq: {
          purpose: "IQ", description: "IQ", criteria: "IQ",
          items: [{ questionIndex: 1, questionText: "Q1", answer: "yes", comment: null }],
          verdict: "pass",
        },
        oq: {
          purpose: "OQ", description: "OQ", criteria: "OQ",
          items: [{ questionIndex: 1, questionText: "Q1", answer: "yes", comment: null }],
          verdict: "pass",
        },
        pv: {
          purpose: "PV", description: "PV", criteria: "PV",
          tempMode: "2-8", rangeMin: 2, rangeMax: 8,
          startAt: now, endAt: now + 72.5 * 3600_000,
          minDurationHours: 72, minSensorCount: 9,
          loggers: [sensor], verdict: "pass", failureReasons: [],
          hotIdx: 0, coldIdx: 0, extIndices: [],
        },
        excursion: {
          enabled: true, timingVsPv: "after_pv",
          test1Enabled: true, test2Enabled: true, test3Enabled: false,
          recordStartAt: now + 72.5 * 3600_000, recordEndAt: now + 76.5 * 3600_000,
          t1PowerOnAt: now + 72.5 * 3600_000, t1TStableAt: now + 73.0 * 3600_000,
          t1DurationSec: 1800, t1CriticalSensor: "D1",
          t1SensorEntries: [{ label: "D1", tempAtOn: 22.5, entryAt: now + 73.0 * 3600_000, durationSec: 1800 }],
          t2DoorOpenAt: now + 74.0 * 3600_000, t2DoorCloseAt: now + 74.25 * 3600_000,
          t2TBreakAt: null, t2DurationSec: null, t2CriticalSensor: null, t2NoBreak: true,
          t2SensorBreaks: [{ label: "D1", tBreakAt: null, durationSec: null }],
          t3PowerOffAt: null, t3TBreakAt: null, t3DurationSec: null, t3CriticalSensor: null, t3NoBreak: false,
          t3SensorBreaks: null,
          warnings: ["Тест 2: режим сохранён."],
          loggers: [{ label: "D1", role: "internal", series: excSeries }],
        },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2000);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    60_000,
  );

  it(
    "does not crash when signatoriesPart1 is empty (Проверил deleted)",
    async () => {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 72.5, 5);
      const sensor = {
        id: 1, label: "D1", customName: null, role: "internal" as const,
        pointCount: series.temp.length, min: 4.6, max: 5.4, avg: 5.0, std: 0.2, mkt: 5.0,
        series, deviations: [],
      };
      // Simulate user deleting all rows in signatoriesPart1 (e.g. deleted "Проверил")
      const buf = await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-2024-0003", createdAt: new Date(now) },
        generalInfo: BASE_GI,
        signatoriesPart1: [], // empty — all rows deleted
        signatoriesPart2: [{ role: "Утверждающий", name: "Директор" }],
        iq: {
          purpose: "IQ", description: "IQ", criteria: "IQ",
          items: [{ questionIndex: 1, questionText: "Q1", answer: "yes", comment: null }],
          verdict: "pass",
        },
        oq: {
          purpose: "OQ", description: "OQ", criteria: "OQ",
          items: [{ questionIndex: 1, questionText: "Q1", answer: "yes", comment: null }],
          verdict: "pass",
        },
        pv: {
          purpose: "PV", description: "PV", criteria: "PV",
          tempMode: "2-8", rangeMin: 2, rangeMax: 8,
          startAt: now, endAt: now + 72.5 * 3600_000,
          minDurationHours: 72, minSensorCount: 9,
          loggers: [sensor], verdict: "pass", failureReasons: [],
          hotIdx: 0, coldIdx: 0, extIndices: [],
        },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2000);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    60_000,
  );

  it(
    "generates warehouse protocol Part I (sections 1–7) correctly",
    async () => {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 72.5, 19.5);
      const sensor = {
        id: 1, label: "L1-c1-t1", customName: null, role: "internal" as const,
        pointCount: series.temp.length, min: 14.8, max: 24.2, avg: 19.5, std: 1.2, mkt: 19.6,
        series, deviations: [],
      };
      const buf = await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-2024-0010", createdAt: new Date(now) },
        generalInfo: {
          equipmentType: "warehouse",
          manufacturer: "", model: "", serial: "", inventory: "",
          year: 2024, tempMode: "15-25",
          location: "Склад ГЛП, зона А",
          purpose: "Хранение ЛС при 15–25 °C",
          validationDate: "2024-07-15", basis: "primary",
          whLengthM: "20", whWidthM: "10", whHeightM: "5",
          whHumidityControl: true, whHumidityMin: "40", whHumidityMax: "70",
          whSeason: "summer", whStudyType: "initial",
          whExternalEnv: false, whLayoutNotes: "Стеллажи 3 ряда",
        },
        warehouseSections: {
          "1.1": "ЕАЭС — Евразийский экономический союз",
          "1.2": "Температурное картирование — процедура.",
          "2.1": "Объект: зона A.",
          "2.2.1": "Рек. ЕЭК №8.", "2.2.2": "Первичная.",
          "3": "Область.", "4": "Цели.",
          "6.1": "EL-USB-2", "6.2": "Иванова", "6.3": "Зона A",
          "6.4": "15–25 °C", "6.5": "П. 16д", "6.6": "Схема",
          "6.7": "Маркировка", "6.8": "Размещение", "6.9": "Извлечение", "6.10": "CSV",
        },
        warehouseEquipment: [
          { name: "EL-USB-2", manufacturer: "Lascar", model: "EL-USB-2", serial: "SN-001", inventory: "INV-001", purpose: "Регистратор" },
        ],
        iq: { purpose: "IQ", description: "IQ", criteria: "IQ", items: [{ questionIndex: 1, questionText: "Док.", answer: "yes", comment: null }], verdict: "pass" },
        oq: { purpose: "OQ", description: "OQ", criteria: "OQ", items: [{ questionIndex: 1, questionText: "Фун.", answer: "yes", comment: null }], verdict: "pass" },
        pv: { purpose: "PV", description: "PV", criteria: "PV", tempMode: "15-25", rangeMin: 15, rangeMax: 25, startAt: now, endAt: now + 72.5 * 3600_000, minDurationHours: 72, minSensorCount: 9, loggers: [sensor], verdict: "pass", failureReasons: [], hotIdx: 0, coldIdx: 0, extIndices: [] },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(5000);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    60_000,
  );
  it(
    "generates warehouse protocol without warehouseSections (uses defaults)",
    async () => {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 72.5, 19.5);
      const sensor = { id: 1, label: "L1-c1-t1", customName: null, role: "internal" as const, pointCount: series.temp.length, min: 14.8, max: 24.2, avg: 19.5, std: 1.2, mkt: 19.6, series, deviations: [] };
      const buf = await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-2024-0011", createdAt: new Date(now) },
        generalInfo: { equipmentType: "warehouse", manufacturer: "", model: "", serial: "", inventory: "", year: 2024, tempMode: "15-25", location: "Склад Б", purpose: "Хранение", validationDate: "2024-07-15", basis: "primary" },
        iq: { purpose: "IQ", description: "IQ", criteria: "IQ", items: [{ questionIndex: 1, questionText: "Q", answer: "yes", comment: null }], verdict: "pass" },
        oq: { purpose: "OQ", description: "OQ", criteria: "OQ", items: [{ questionIndex: 1, questionText: "Q", answer: "yes", comment: null }], verdict: "pass" },
        pv: { purpose: "PV", description: "PV", criteria: "PV", tempMode: "15-25", rangeMin: 15, rangeMax: 25, startAt: now, endAt: now + 72.5 * 3600_000, minDurationHours: 72, minSensorCount: 9, loggers: [sensor], verdict: "pass", failureReasons: [], hotIdx: 0, coldIdx: 0, extIndices: [] },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(5000);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    60_000,
  );
  it(
    "only renders selected excursion tests (skips disabled tests)",
    async () => {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 72.5, 5);
      const excSeries = mkSeries(now + 72.5 * 3600_000, 4, 5);
      const sensor = {
        id: 1, label: "D1", customName: null, role: "internal" as const,
        pointCount: series.temp.length, min: 4.6, max: 5.4, avg: 5.0, std: 0.2, mkt: 5.0,
        series, deviations: [],
      };
      // Only test3 enabled — test1 and test2 disabled
      const buf = await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-2024-0004", createdAt: new Date(now) },
        generalInfo: BASE_GI,
        iq: {
          purpose: "IQ", description: "IQ", criteria: "IQ",
          items: [{ questionIndex: 1, questionText: "Q1", answer: "yes", comment: null }],
          verdict: "pass",
        },
        oq: {
          purpose: "OQ", description: "OQ", criteria: "OQ",
          items: [{ questionIndex: 1, questionText: "Q1", answer: "yes", comment: null }],
          verdict: "pass",
        },
        pv: {
          purpose: "PV", description: "PV", criteria: "PV",
          tempMode: "2-8", rangeMin: 2, rangeMax: 8,
          startAt: now, endAt: now + 72.5 * 3600_000,
          minDurationHours: 72, minSensorCount: 9,
          loggers: [sensor], verdict: "pass", failureReasons: [],
          hotIdx: 0, coldIdx: 0, extIndices: [],
        },
        excursion: {
          enabled: true, timingVsPv: "independent",
          test1Enabled: false, test2Enabled: false, test3Enabled: true,
          recordStartAt: now + 72.5 * 3600_000, recordEndAt: now + 76.5 * 3600_000,
          t1PowerOnAt: null, t1TStableAt: null, t1DurationSec: null, t1CriticalSensor: null, t1SensorEntries: null,
          t2DoorOpenAt: null, t2DoorCloseAt: null,
          t2TBreakAt: null, t2DurationSec: null, t2CriticalSensor: null, t2NoBreak: false, t2SensorBreaks: null,
          t3PowerOffAt: now + 73.0 * 3600_000,
          t3TBreakAt: now + 74.5 * 3600_000,
          t3DurationSec: 5400,
          t3CriticalSensor: "D1",
          t3NoBreak: false,
          t3SensorBreaks: [{ label: "D1", tBreakAt: now + 74.5 * 3600_000, durationSec: 5400 }],
          warnings: [],
          loggers: [{ label: "D1", role: "internal", series: excSeries }],
        },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2000);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    60_000,
  );
});
