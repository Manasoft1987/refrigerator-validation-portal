import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import {
  generateProtocolPdf,
  getSensorCalibrationStatusAtProtocolDate,
  resolveProtocolReferenceDate,
} from "./pdfReport";

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

describe("sensor calibration status in PDF", () => {
  it("uses the protocol validation date instead of today or the stored sensor status", () => {
    const protocolDate = resolveProtocolReferenceDate(
      "2024-07-15",
      new Date("2026-01-01T12:00:00Z"),
    );

    expect(getSensorCalibrationStatusAtProtocolDate("2024-07-14", protocolDate)).toBe("expired");
    expect(getSensorCalibrationStatusAtProtocolDate("2024-07-15", protocolDate)).toBe("valid");
    expect(getSensorCalibrationStatusAtProtocolDate("2025-07-15", protocolDate)).toBe("valid");
  });

  it("falls back to protocol.createdAt and handles Date/null values", () => {
    const protocolDate = resolveProtocolReferenceDate(
      null,
      new Date("2024-08-20T18:30:00Z"),
    );

    expect(
      getSensorCalibrationStatusAtProtocolDate(new Date("2024-08-19T00:00:00Z"), protocolDate),
    ).toBe("expired");
    expect(
      getSensorCalibrationStatusAtProtocolDate(new Date("2024-08-20T00:00:00Z"), protocolDate),
    ).toBe("valid");
    expect(getSensorCalibrationStatusAtProtocolDate(null, protocolDate)).toBeNull();
    expect(getSensorCalibrationStatusAtProtocolDate("not-a-date", protocolDate)).toBeNull();
  });
});

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
    "handles long auto-refrigerator cover metadata without crashing",
    async () => {
      const now = Date.UTC(2026, 5, 5, 9, 0, 0);
      const series = mkSeries(now, 72.5, 5);
      const sensor = {
        id: 1, label: "230610STS0013763", customName: null, role: "internal" as const,
        pointCount: series.temp.length, min: 3.5, max: 7.4, avg: 5.1, std: 0.4, mkt: 5.2,
        series, deviations: [],
      };
      const buf = await generateProtocolPdf({
        org: { ...BASE_ORG, name: "TOO \"Rayza-ADE\"" },
        protocol: { number: "VAL-2026-0002", createdAt: new Date(now) },
        generalInfo: {
          ...BASE_GI,
          equipmentType: "auto-refrigerator",
          manufacturer: "THERMO KING SLXe 400",
          model: "VOLVO FH 429BBX002 with SCHMITZ SKO 24 trailer, long vehicle description",
          location: "Vehicle depot, long dispatch area name",
          validationDate: "2026-06-05",
          season: "warm",
          qualificationType: "periodic",
        },
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
          minDurationHours: 72, minSensorCount: 2,
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
    "splits wide measurement tables into readable sensor blocks",
    async () => {
      const now = Date.UTC(2026, 5, 12, 14, 30, 0);
      const loggers = Array.from({ length: 18 }, (_, idx) => {
        const first = 20 + idx / 10;
        const second = first + 0.2;
        return {
          id: idx + 1,
          label: String(20 + idx * 3),
          customName: null,
          role: "internal" as const,
          pointCount: 2,
          min: first,
          max: second,
          avg: (first + second) / 2,
          std: 0.1,
          mkt: (first + second) / 2,
          series: {
            ts: [now, now + 10 * 60_000],
            temp: [first, second],
          },
          deviations: [],
        };
      });
      const originalText = (PDFDocument.prototype as any).text;
      const blockLabels = new Set<string>();

      (PDFDocument.prototype as any).text = function (text: string, ...args: any[]) {
        if (text.startsWith("Датчики ") && text.endsWith(" из 18")) {
          blockLabels.add(text);
        }
        return originalText.call(this, text, ...args);
      };

      try {
        await generateProtocolPdf({
          org: BASE_ORG,
          protocol: { number: "VAL-2026-0038", createdAt: new Date(now) },
          generalInfo: { ...BASE_GI, validationDate: "2026-06-12" },
          iq: {
            purpose: "IQ", description: "IQ", criteria: "IQ",
            items: [], verdict: "none",
          },
          oq: {
            purpose: "OQ", description: "OQ", criteria: "OQ",
            items: [], verdict: "none",
          },
          pv: {
            purpose: "PV", description: "PV", criteria: "PV",
            tempMode: "2-8", rangeMin: 2, rangeMax: 8,
            samplingStepMinutes: 10,
            startAt: now, endAt: now + 10 * 60_000,
            minDurationHours: 0, minSensorCount: 18,
            loggers, verdict: "none", failureReasons: [],
            hotIdx: 0, coldIdx: 1, extIndices: [],
          },
        });
      } finally {
        (PDFDocument.prototype as any).text = originalText;
      }

      expect(Array.from(blockLabels)).toEqual([
        "Датчики 1–12 из 18",
        "Датчики 13–18 из 18",
      ]);
    },
    60_000,
  );

  it(
    "centers stage verdict headings across the usable page width",
    async () => {
      const now = Date.UTC(2026, 5, 25, 4, 12, 0);
      const originalText = (PDFDocument.prototype as any).text;
      const headingCalls: Array<{
        text: string;
        x: number;
        options: { width?: number; align?: string; lineBreak?: boolean };
      }> = [];

      (PDFDocument.prototype as any).text = function (text: string, ...args: any[]) {
        if (text === "Заключение по этапу" || text === "Заключение по этапу PV") {
          headingCalls.push({ text, x: args[0], options: args[2] ?? {} });
        }
        return originalText.call(this, text, ...args);
      };

      try {
        await generateProtocolPdf({
          org: BASE_ORG,
          protocol: { number: "VAL-2026-0039", createdAt: new Date(now) },
          generalInfo: { ...BASE_GI, validationDate: "2026-06-25" },
          iq: {
            purpose: "IQ", description: "IQ", criteria: "IQ",
            items: [], verdict: "none",
          },
          oq: {
            purpose: "OQ", description: "OQ", criteria: "OQ",
            items: [], verdict: "none",
          },
          pv: {
            purpose: "PV", description: "PV", criteria: "PV",
            tempMode: "2-8", rangeMin: 2, rangeMax: 8,
            startAt: now, endAt: now,
            minDurationHours: 0, minSensorCount: 0,
            loggers: [], verdict: "fail",
            failureReasons: ["Температурное отклонение"],
            hotIdx: null, coldIdx: null, extIndices: [],
          },
        });
      } finally {
        (PDFDocument.prototype as any).text = originalText;
      }

      expect(headingCalls).toHaveLength(3);
      headingCalls.forEach(call => {
        expect(call.x).toBe(56);
        expect(call.options.width).toBeGreaterThan(400);
        expect(call.options.align).toBe("center");
        expect(call.options.lineBreak).toBe(false);
      });
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
    "advances past empty warehouse equipment values before rendering the next item",
    async () => {
      const now = Date.UTC(2026, 5, 12, 9, 0, 0);
      const originalText = (PDFDocument.prototype as any).text;
      let firstSerialValue: string | undefined;
      let firstSerialLabelY: number | undefined;
      let firstSerialValueAfterY: number | undefined;
      let secondEquipmentY: number | undefined;
      let captureFirstSerialValue = false;

      (PDFDocument.prototype as any).text = function (text: string, ...args: any[]) {
        const beforeY = this.y;
        const result = originalText.call(this, text, ...args);

        if (text === "Серийный номер: " && firstSerialLabelY === undefined) {
          firstSerialLabelY = beforeY;
          captureFirstSerialValue = true;
        } else if (captureFirstSerialValue) {
          firstSerialValue = text;
          firstSerialValueAfterY = this.y;
          captureFirstSerialValue = false;
        }

        if (text.startsWith("Оборудование 2:")) {
          secondEquipmentY = beforeY;
        }

        return result;
      };

      try {
        await generateProtocolPdf({
          org: { ...BASE_ORG, name: 'ТОО "АПТЕКАПЛЮС"' },
          protocol: {
            number: "VAL-2026-0001",
            createdAt: new Date(now),
            equipmentType: "warehouse",
          },
          generalInfo: {
            ...BASE_GI,
            equipmentType: "warehouse",
            manufacturer: "",
            model: "",
            serial: "",
            inventory: "",
            year: 2026,
            tempMode: "15-25",
          },
          warehouseEquipment: [
            {
              name: "Сплит-кондиционер настенного типа",
              manufacturer: "Dantex",
              model: "DM-PAC036G/YMF",
              serial: "",
              purpose: "",
            },
            {
              name: "Прямоугольный канальный вентилятор",
              manufacturer: "Airone",
              model: "60-35-4D VA",
              serial: "",
              purpose: "",
            },
          ],
          iq: {
            purpose: "IQ",
            description: "IQ",
            criteria: "IQ",
            items: [],
            verdict: "none",
          },
          oq: {
            purpose: "OQ",
            description: "OQ",
            criteria: "OQ",
            items: [],
            verdict: "none",
          },
          pv: {
            purpose: "PV",
            description: "PV",
            criteria: "PV",
            tempMode: "15-25",
            rangeMin: 15,
            rangeMax: 25,
            startAt: now,
            endAt: now,
            minDurationHours: 0,
            minSensorCount: 0,
            loggers: [],
            verdict: "none",
            failureReasons: [],
            hotIdx: null,
            coldIdx: null,
            extIndices: [],
          },
        });
      } finally {
        (PDFDocument.prototype as any).text = originalText;
      }

      expect(firstSerialValue).toBe("—");
      expect(firstSerialValueAfterY).toBeGreaterThan(firstSerialLabelY!);
      expect(secondEquipmentY).toBeGreaterThan(firstSerialValueAfterY!);
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
