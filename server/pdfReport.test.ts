import { describe, expect, it, vi } from "vitest";
import PDFDocument from "pdfkit";
import {
  addHeadersAndFooters,
  checklistItemsForReport,
  filterProtocolSensorsForReport,
  generateProtocolPdf,
  getSensorCalibrationStatusAtProtocolDate,
  resolveProtocolReferenceDate,
} from "./pdfReport";

describe("PDF page headers and footers", () => {
  it("does not append blank pages while numbering buffered pages", () => {
    const doc = new PDFDocument({ size: "A4", margin: 56, bufferPages: true });
    doc.registerFont("body", "server/fonts/DejaVuSans.ttf");
    doc.font("body").text("Страница 1");
    doc.addPage().font("body").text("Страница 2");
    doc.addPage().font("body").text("Страница 3");

    const before = doc.bufferedPageRange().count;
    addHeadersAndFooters(doc, {
      org: { name: "Тестовая организация" },
      protocol: { number: "VAL-TEST-001" },
    } as any);

    expect(doc.bufferedPageRange().count).toBe(before);
    doc.end();
  });
});

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

describe("sensor verification status in PDF", () => {
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

describe("warehouse checklist normalization for PDF", () => {
  it("keeps user-edited warehouse checklist rows and answers in the PDF input", () => {
    const savedIqItems = [
      { questionIndex: 0, questionText: "Custom IQ question A?", answer: "yes" as const, comment: "ok" },
      { questionIndex: 1, questionText: "Custom IQ question B?", answer: "no" as const, comment: "fix planned" },
      { questionIndex: 2, questionText: "Custom IQ question C?", answer: "na" as const, comment: null },
    ];

    const normalized = checklistItemsForReport({
      generalInfo: { equipmentType: "warehouse" },
      iq: { items: savedIqItems },
      oq: { items: [] },
    } as any, "iq");

    expect(normalized).toEqual(savedIqItems);
  });

  it("replaces legacy stored OQ rows with the reviewed 8-question warehouse checklist", () => {
    const legacyOqItems = [
      "Запускается ли всё оборудование зоны (холодильные установки, кондиционеры, обогреватели) в штатном режиме?",
      "Корректно ли работают пульты управления и интерфейсы оборудования зоны?",
      "Реагирует ли оборудование на изменение уставки температуры в заданных пределах?",
      "Корректно ли отображается температура (и влажность) на индикаторах оборудования и системе мониторинга?",
      "Срабатывает ли сигнализация (звуковая/визуальная/уведомления) при отклонении температуры за установленные границы?",
      "Обеспечивается ли равномерное воздухораспределение по объёму зоны (вентиляторы, воздуховоды работают штатно)?",
      "Удерживается ли заданный температурный режим в пустой зоне в течение тестового периода?",
      "Готово ли резервное оборудование к включению при выходе из строя основного (если предусмотрено)?",
      "Корректно ли логируются и архивируются данные системы мониторинга температуры (и влажности)?",
      "Отсутствуют ли посторонние шумы/вибрации, свидетельствующие о неисправностях оборудования зоны?",
      "Корректно ли работает индикация на дисплее (температура, режимы)?",
      "Оборудование включается и издает характерный звук работы вентилятора, компрессора?",
      "Корректно ли работает индикация на дисплее (температура, режимы)?",
      "Реагируют ли оборудование на изменение уставки температуры?",
      "Отсутствуют ли посторонние шумы / вибрации, указывающие на неисправность?",
    ].map((questionText, questionIndex) => ({
      questionIndex,
      questionText,
      answer: "yes" as const,
      comment: null,
    }));

    const normalized = checklistItemsForReport({
      generalInfo: { equipmentType: "warehouse" },
      iq: { items: [] },
      oq: { items: legacyOqItems },
    } as any, "oq");

    expect(normalized).toHaveLength(8);
    expect(normalized.map(item => item.questionText)).not.toContain(
      "Запускается ли всё оборудование зоны (холодильные установки, кондиционеры, обогреватели) в штатном режиме?",
    );
    expect(normalized[0]?.questionText).toBe("Запускается ли оборудование в штатном режиме?");
    expect(normalized[7]?.questionText).toBe("Оборудование включается и издает характерный звук работы вентилятора, компрессора?");
  });
});

describe("protocol sensor filtering", () => {
  it("keeps only sensors that are still present in the final logger set", () => {
    const filtered = filterProtocolSensorsForReport({
      protocolSensors: [
        { id: 1, number: "230609STS0013706", calibrationDate: null, nextCalibrationDate: null },
        { id: 2, number: "230609STS0013707", calibrationDate: null, nextCalibrationDate: null },
        { id: 3, number: "230609STS0013708", calibrationDate: null, nextCalibrationDate: null },
      ],
      pv: {
        loggers: [
          { label: "230609STS0013706", customName: null },
          { label: "3708", customName: null },
        ],
      },
    } as any);

    expect(filtered?.map(sensor => sensor.number)).toEqual([
      "230609STS0013706",
      "230609STS0013708",
    ]);
  });
});

describe("warehouse methodology logger table", () => {
  it("renders actually used loggers in section 6.1", async () => {
    const capturedText: string[] = [];
    const originalText = PDFDocument.prototype.text;
    const textSpy = vi.spyOn(PDFDocument.prototype, "text").mockImplementation(function (
      this: PDFKit.PDFDocument,
      ...args: Parameters<PDFKit.PDFDocument["text"]>
    ) {
      if (typeof args[0] === "string") capturedText.push(args[0]);
      return originalText.apply(this, args);
    });

    try {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 168, 20);
      await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-STR-TEST", createdAt: new Date(now), equipmentType: "warehouse" },
        generalInfo: {
          ...BASE_GI,
          equipmentType: "warehouse",
          manufacturer: "",
          model: "",
          serial: "",
          inventory: "",
          year: null,
          tempMode: "15-25",
          location: "г. Алматы, помещение хранения аптеки",
          purpose: "Хранение лекарственных средств",
          validationDate: "2024-07-15",
          basis: "primary",
        },
        iq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        oq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        pv: {
          purpose: "",
          description: "",
          criteria: "",
          tempMode: "15-25",
          rangeMin: 15,
          rangeMax: 25,
          startAt: now,
          endAt: now + 168 * 3600_000,
          minDurationHours: 168,
          minSensorCount: 2,
          loggers: [
            {
              id: 1,
              label: "230804STS0019282",
              customName: null,
              role: "internal",
              pointCount: series.temp.length,
              min: 19.2,
              max: 20.4,
              avg: 19.8,
              std: 0.1,
              mkt: 19.9,
              series,
              deviations: [],
            },
            {
              id: 2,
              label: "240903STS0042037",
              customName: null,
              role: "external",
              pointCount: series.temp.length,
              min: 17.5,
              max: 18.8,
              avg: 18.0,
              std: 0.1,
              mkt: 18.1,
              series,
              deviations: [],
            },
          ],
          verdict: "pass",
          failureReasons: [],
          hotIdx: 0,
          coldIdx: 1,
          extIndices: [1],
        },
        protocolSensors: [
          {
            id: 1,
            number: "230804STS0019282",
            calibrationDate: "2024-01-10",
            nextCalibrationDate: "2025-01-10",
            accuracyC: "0.15",
            status: "active",
          },
          {
            id: 2,
            number: "240903STS0042037",
            calibrationDate: "2024-02-20",
            nextCalibrationDate: "2025-02-20",
            accuracyC: "0.20",
            status: "active",
          },
        ],
      } as any);
    } finally {
      textSpy.mockRestore();
    }

    expect(capturedText).toContain("6.1. Сведения о выборе типа регистратора данных");
    expect(capturedText).toContain("Регистратор");
    expect(capturedText).toContain("230804STS0019282");
    expect(capturedText).toContain("240903STS0042037");
    expect(capturedText).toContain("внутренний; точка картирования");
    expect(capturedText).toContain("внешний; мониторинг температуры окружающей среды");
    expect(capturedText).toContain("±0.15 °C");
    expect(capturedText).toContain("Годна");
  });

  it("renders study personnel from the portal commission in section 6.2", async () => {
    const capturedText: string[] = [];
    const originalText = PDFDocument.prototype.text;
    const textSpy = vi.spyOn(PDFDocument.prototype, "text").mockImplementation(function (
      this: PDFKit.PDFDocument,
      ...args: Parameters<PDFKit.PDFDocument["text"]>
    ) {
      if (typeof args[0] === "string") capturedText.push(args[0]);
      return originalText.apply(this, args);
    });

    try {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 168, 20);
      await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-STR-TEST", createdAt: new Date(now), equipmentType: "warehouse" },
        generalInfo: {
          ...BASE_GI,
          equipmentType: "warehouse",
          tempMode: "15-25",
          location: "г. Алматы, помещение хранения аптеки",
          purpose: "Хранение лекарственных средств",
          validationDate: "2024-07-15",
          basis: "primary",
          commissionMembers: [
            { role: "Специалист по валидации", name: "Сафуллин А.В.", company: "ТОО «GxP Training»" },
            { role: "Ответственное лицо за качество", name: "Бабаева А.Б.", company: "ИП \"РИСЛИНГ Н.А.\"" },
          ],
        },
        iq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        oq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        pv: {
          purpose: "",
          description: "",
          criteria: "",
          tempMode: "15-25",
          rangeMin: 15,
          rangeMax: 25,
          startAt: now,
          endAt: now + 168 * 3600_000,
          minDurationHours: 168,
          minSensorCount: 1,
          loggers: [
            {
              id: 1,
              label: "230804STS0019282",
              customName: null,
              role: "internal",
              pointCount: series.temp.length,
              min: 19.2,
              max: 20.4,
              avg: 19.8,
              std: 0.1,
              mkt: 19.9,
              series,
              deviations: [],
            },
          ],
          verdict: "pass",
          failureReasons: [],
          hotIdx: 0,
          coldIdx: 0,
          extIndices: [],
        },
      } as any);
    } finally {
      textSpy.mockRestore();
    }

    expect(capturedText).toContain("6.2. Сведения об исполнителях");
    expect(capturedText).toContain("Специалист по валидации");
    expect(capturedText).toContain("Сафуллин А.В.");
    expect(capturedText).toContain("ТОО «GxP Training»");
    expect(capturedText).toContain("Ответственное лицо за качество");
    expect(capturedText).toContain("Бабаева А.Б.");
    expect(capturedText).toContain("ИП \"РИСЛИНГ Н.А.\"");
  });

  it("auto-fills pharmacy storage methodology sections from portal data", async () => {
    const capturedText: string[] = [];
    const originalText = PDFDocument.prototype.text;
    const textSpy = vi.spyOn(PDFDocument.prototype, "text").mockImplementation(function (
      this: PDFKit.PDFDocument,
      ...args: Parameters<PDFKit.PDFDocument["text"]>
    ) {
      if (typeof args[0] === "string") capturedText.push(args[0]);
      return originalText.apply(this, args);
    });

    try {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 168, 20);
      await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-STR-TEST", createdAt: new Date(now), equipmentType: "warehouse" },
        generalInfo: {
          ...BASE_GI,
          equipmentType: "warehouse",
          tempMode: "15-25",
          location: "г. Алматы, помещение хранения аптеки",
          purpose: "Хранение лекарственных средств",
          validationDate: "2024-07-15",
          basis: "primary",
          season: "warm",
          whLengthM: 4.2,
          whWidthM: 3.1,
          whHeightM: 2.5,
          whHumidityControl: 1,
          whHumidityMax: 65,
          whExternalEnv: 1,
          whSeason: "n_a",
          fillStatus: "loaded",
          loadPercent: 70,
        },
        iq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        oq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        pv: {
          purpose: "",
          description: "",
          criteria: "",
          tempMode: "15-25",
          rangeMin: 15,
          rangeMax: 25,
          rawRangeMin: 15,
          rawRangeMax: 25,
          sensorAccuracy: 0.2,
          startAt: now,
          endAt: now + 168 * 3600_000,
          minDurationHours: 168,
          minSensorCount: 2,
          samplingStepMinutes: 10,
          loggers: [
            {
              id: 1,
              label: "230804STS0019282",
              customName: null,
              role: "internal",
              pointCount: series.temp.length,
              min: 19.2,
              max: 20.4,
              avg: 19.8,
              std: 0.1,
              mkt: 19.9,
              series,
              deviations: [],
            },
            {
              id: 2,
              label: "240903STS0042037",
              customName: null,
              role: "external",
              pointCount: series.temp.length,
              min: 17.5,
              max: 18.8,
              avg: 18.0,
              std: 0.1,
              mkt: 18.1,
              series,
              deviations: [],
            },
          ],
          verdict: "pass",
          failureReasons: [],
          hotIdx: 0,
          coldIdx: 0,
          extIndices: [1],
        },
      } as any);
    } finally {
      textSpy.mockRestore();
    }

    const text = capturedText.join("\n");
    expect(text).toContain("6.3. Сведения об объекте исследования");
    expect(text).toContain("Геометрические размеры: 4.20 x 3.10 x 2.50 м");
    expect(text).toContain("сезон исследования: Тёплый период");
    expect(text).toContain("6.5. Сведения об определении точек размещения");
    expect(text).toContain("Фактически на схеме размещено: внутренних регистраторов 1, внешних регистраторов 1");
    expect(text).toContain("6.10. Сведения о загрузке и объединении данных");
    expect(text).toContain("интервал регистрации: 10 мин");
    expect(text).toContain("6.10.1. Методика обработки данных и расчета показателей");
    expect(text).toContain("Методика расчета показателей PQ/PV");
    expect(text).toContain("MKT = -dH/R / ln((1/n) x sum(exp(-dH/(R x Tk_i)))) - 273,15");
    expect(text).toContain("Критические точки выбираются по риск-вектору");
    expect(text).not.toContain("GDP");
    expect(text).not.toContain("GPP");
    expect(text).not.toContain("GMP");
    expect(text).not.toContain("склад");
  });

  it("does not duplicate the pharmacy storage object type above the cover metadata card", async () => {
    const capturedText: string[] = [];
    const originalText = PDFDocument.prototype.text;
    const textSpy = vi.spyOn(PDFDocument.prototype, "text").mockImplementation(function (
      this: PDFKit.PDFDocument,
      ...args: Parameters<PDFKit.PDFDocument["text"]>
    ) {
      if (typeof args[0] === "string") capturedText.push(args[0]);
      return originalText.apply(this, args);
    });

    try {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 168, 20);
      await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-STR-COVER", createdAt: new Date(now), equipmentType: "warehouse" },
        generalInfo: {
          ...BASE_GI,
          equipmentType: "warehouse",
          tempMode: "15-25",
          location: "г. Алматы, помещение хранения аптеки",
          purpose: "Хранение лекарственных средств",
          validationDate: "2024-07-15",
          basis: "primary",
          season: "warm",
        },
        iq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        oq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        pv: {
          purpose: "",
          description: "",
          criteria: "",
          tempMode: "15-25",
          rangeMin: 15,
          rangeMax: 25,
          startAt: now,
          endAt: now + 168 * 3600_000,
          minDurationHours: 168,
          minSensorCount: 1,
          loggers: [
            {
              id: 1,
              label: "230804STS0019282",
              customName: null,
              role: "internal",
              pointCount: series.temp.length,
              min: 19.2,
              max: 20.4,
              avg: 19.8,
              std: 0.1,
              mkt: 19.9,
              series,
              deviations: [],
            },
          ],
          verdict: "pass",
          failureReasons: [],
          hotIdx: 0,
          coldIdx: 0,
          extIndices: [],
        },
      } as any);
    } finally {
      textSpy.mockRestore();
    }

    const subtitleIndex = capturedText.findIndex(value => value.includes("План картирования"));
    const objectCardLabelIndex = capturedText.findIndex((value, index) =>
      index > subtitleIndex && value.includes("ОБЪЕКТ ТЕМПЕРАТУРНОГО КАРТИРОВАНИЯ"),
    );
    const firstObjectValueIndex = capturedText.findIndex((value, index) =>
      index > subtitleIndex && value === "помещение (зона) хранения аптеки",
    );

    expect(subtitleIndex).toBeGreaterThanOrEqual(0);
    expect(objectCardLabelIndex).toBeGreaterThan(subtitleIndex);
    expect(firstObjectValueIndex).toBeGreaterThan(objectCardLabelIndex);
  });

  it("renders Annex 1 from the same floor-plan placement data", async () => {
    const capturedText: string[] = [];
    const originalText = PDFDocument.prototype.text;
    const textSpy = vi.spyOn(PDFDocument.prototype, "text").mockImplementation(function (
      this: PDFKit.PDFDocument,
      ...args: Parameters<PDFKit.PDFDocument["text"]>
    ) {
      if (typeof args[0] === "string") capturedText.push(args[0]);
      return originalText.apply(this, args);
    });

    try {
      const now = Date.UTC(2024, 6, 15, 9, 0, 0);
      const series = mkSeries(now, 168, 20);
      await generateProtocolPdf({
        org: BASE_ORG,
        protocol: { number: "VAL-STR-TEST", createdAt: new Date(now), equipmentType: "warehouse" },
        generalInfo: {
          ...BASE_GI,
          equipmentType: "warehouse",
          tempMode: "15-25",
          location: "г. Алматы, помещение хранения аптеки",
          purpose: "Хранение лекарственных средств",
          validationDate: "2024-07-15",
          basis: "primary",
          whLengthM: 4.2,
          whWidthM: 3.1,
          whHeightM: 2.5,
          whExternalEnv: 1,
        },
        iq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        oq: { purpose: "", description: "", criteria: "", items: [], verdict: "pass" },
        pv: {
          purpose: "",
          description: "",
          criteria: "",
          tempMode: "15-25",
          rangeMin: 15,
          rangeMax: 25,
          startAt: now,
          endAt: now + 168 * 3600_000,
          minDurationHours: 168,
          minSensorCount: 2,
          loggers: [
            {
              id: 1,
              label: "230804STS0019282",
              customName: null,
              role: "internal",
              pointCount: series.temp.length,
              min: 19.2,
              max: 20.4,
              avg: 19.8,
              std: 0.1,
              mkt: 19.9,
              series,
              deviations: [],
            },
            {
              id: 2,
              label: "240903STS0042037",
              customName: null,
              role: "external",
              pointCount: series.temp.length,
              min: 17.5,
              max: 18.8,
              avg: 18.0,
              std: 0.1,
              mkt: 18.1,
              series,
              deviations: [],
            },
          ],
          verdict: "pass",
          failureReasons: [],
          hotIdx: 0,
          coldIdx: 0,
          extIndices: [1],
        },
        pvLoggers: [
          { id: 1, label: "230804STS0019282", customName: null, role: "internal", position: "sensor-9282" },
          { id: 2, label: "240903STS0042037", customName: null, role: "external", position: "sensor-2037" },
        ],
        floorPlanObjects: [
          {
            id: "sensor-9282",
            type: "sensor_point",
            xPct: 20,
            yPct: 40,
            widthPct: 5,
            heightPct: 5,
            heightM: 0.3,
            rotation: 0,
            label: "9282",
            leaderEndXPct: 18,
            leaderEndYPct: 38,
          },
          {
            id: "sensor-2037",
            type: "sensor_point",
            xPct: 8,
            yPct: 18,
            widthPct: 5,
            heightPct: 5,
            heightM: 2.2,
            rotation: 0,
            label: "2037",
            leaderEndXPct: 6,
            leaderEndYPct: 16,
          },
        ],
      } as any);
    } finally {
      textSpy.mockRestore();
    }

    const text = capturedText.join("\n");
    expect(text).toContain("Приложение N 1");
    expect(text).toContain("ID / серийный номер регистратора данных");
    expect(text).toContain("9282");
    expect(text).toContain("0.30");
    expect(text).toContain("Место установки - окончание стрелки на схеме.");
    expect(text).toContain("Внешний регистратор установлен на улице для мониторинга температуры окружающей среды.");
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
          equipmentType: "thermal-container",
          thermalContainerConfig: {
            selectedModes: ["2-8", "8-15", "15-25"],
            targetDurationHours: 24,
          },
          commissionMembers: [
            { name: "Иванова А. И.", role: "Председатель" },
            { name: "Петров Н. С.", role: "Член комиссии" },
          ],
        },
        thermalTrials: [
          {
            trialKey: "2-8", tempMode: "2-8", verdict: "pass",
            startAt: now, endAt: now + 24 * 3600_000, durationHours: 24,
            targetDurationHours: 24, internalSensorCount: 1, failureReasons: [],
            loggers: [{ label: "D1", customName: null, role: "internal", min: 4.6, avg: 5, max: 5.4, mkt: 5 }],
          },
          {
            trialKey: "8-15", tempMode: "8-15", verdict: "none",
            startAt: null, endAt: null, durationHours: null,
            targetDurationHours: 24, internalSensorCount: 0, failureReasons: [], loggers: [],
          },
        ],
        iq: {
          purpose: "Проверка корректности монтажа",
          description: "Монтаж проведён подрядчиком в соответствии с проектом.",
          criteria: "Все позиции чек-листа должны иметь положительный ответ.",
          items: [
            { questionIndex: 1, questionText: "Оборудование доставлено в исправном виде", answer: "yes", comment: null },
            { questionIndex: 2, questionText: "Имеется свидетельство о поверке термодатчика", answer: "yes", comment: "П-2024-01" },
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
    "uses a risk-oriented actual placement diagram for auto-refrigerators with fewer than 15 internal loggers",
    async () => {
      const now = Date.UTC(2026, 6, 10, 9, 0, 0);
      const series = mkSeries(now, 72, 5);
      const positions = ["C1", "C2", "C4", "C5", "C6", "C8", "W1", "W2", "V1", "V3"];
      const loggers = positions.map((position, idx) => ({
        id: idx + 1,
        label: `S${String(idx + 1).padStart(4, "0")}`,
        customName: null,
        role: "internal" as const,
        position,
        pointCount: series.temp.length,
        min: 4.2 + idx * 0.02,
        max: 5.8 + idx * 0.02,
        avg: 5.0 + idx * 0.02,
        std: 0.2,
        mkt: 5.1 + idx * 0.02,
        series,
        deviations: [],
      }));
      const external = {
        id: 99,
        label: "EXT1",
        customName: null,
        role: "external" as const,
        position: "external",
        pointCount: series.temp.length,
        min: 20,
        max: 25,
        avg: 22,
        std: 0.5,
        mkt: 22,
        series,
        deviations: [],
      };
      const originalText = (PDFDocument.prototype as any).text;
      const writtenText: string[] = [];

      (PDFDocument.prototype as any).text = function (text: string, ...args: any[]) {
        writtenText.push(String(text));
        return originalText.call(this, text, ...args);
      };

      try {
        await generateProtocolPdf({
          org: BASE_ORG,
          protocol: { number: "VAL-TRK-2026-010", createdAt: new Date(now) },
          generalInfo: {
            ...BASE_GI,
            equipmentType: "auto-refrigerator",
            validationDate: "2026-07-10",
          },
          iq: {
            purpose: "IQ", description: "IQ", criteria: "IQ",
            items: [], verdict: "pass",
          },
          oq: {
            purpose: "OQ", description: "OQ", criteria: "OQ",
            items: [], verdict: "pass",
          },
          pv: {
            purpose: "PV", description: "PV", criteria: "PV",
            tempMode: "2-8", rangeMin: 2, rangeMax: 8,
            startAt: now, endAt: now + 72 * 3600_000,
            minDurationHours: 72, minSensorCount: 10,
            loggers: [...loggers, external], verdict: "pass", failureReasons: [],
            hotIdx: 9, coldIdx: 0, extIndices: [10],
          },
          pvLoggers: [...loggers, external],
        } as any);
      } finally {
        (PDFDocument.prototype as any).text = originalText;
      }

      const allText = writtenText.join("\n");
      expect(allText).toContain("Риск-ориентированная фактическая расстановка датчиков");
      expect(allText).toContain("Количество и позиции логгеров приняты по риск-ориентированной фактической схеме");
      expect(allText).toContain("Для данного авторефрижератора принята риск-ориентированная фактическая схема размещения");
      expect(allText).toContain("Схема 2. Температурная карта по средним значениям PQ/PV");
      expect(allText).not.toContain("Эталонные позиции ISPE");
      expect(allText).not.toContain("Схема 3. Температурная карта по средним значениям PQ/PV");
    },
    60_000,
  );

  it(
    "adds compact expert PV interpretation blocks for refrigerators",
    async () => {
      const now = Date.UTC(2026, 6, 10, 9, 0, 0);
      const coldSeries = mkSeries(now, 72, 3.2);
      const hotSeries = mkSeries(now, 72, 7.1);
      const loggers = [
        {
          id: 1,
          label: "230609STS0013742",
          customName: null,
          role: "internal" as const,
          pointCount: coldSeries.temp.length,
          min: 2.8,
          max: 3.7,
          avg: 3.2,
          std: 0.2,
          mkt: 3.3,
          series: coldSeries,
          deviations: [],
        },
        {
          id: 2,
          label: "230609STS0013966",
          customName: null,
          role: "internal" as const,
          pointCount: hotSeries.temp.length,
          min: 6.8,
          max: 8.4,
          avg: 7.1,
          std: 0.3,
          mkt: 7.2,
          series: hotSeries,
          deviations: [{ start: now + 3600_000, end: now + 5400_000, durationMs: 1800_000, value: 8.4, type: "high" as const }],
        },
      ];
      const originalText = (PDFDocument.prototype as any).text;
      const writtenText: string[] = [];

      (PDFDocument.prototype as any).text = function (text: string, ...args: any[]) {
        writtenText.push(String(text));
        return originalText.call(this, text, ...args);
      };

      try {
        await generateProtocolPdf({
          org: BASE_ORG,
          protocol: { number: "VAL-REF-2026-150", createdAt: new Date(now) },
          generalInfo: {
            ...BASE_GI,
            equipmentType: "refrigerator",
            validationDate: "2026-07-10",
          },
          iq: {
            purpose: "IQ", description: "IQ", criteria: "IQ",
            items: [], verdict: "pass",
          },
          oq: {
            purpose: "OQ", description: "OQ", criteria: "OQ",
            items: [], verdict: "pass",
          },
          pv: {
            purpose: "PV", description: "PV", criteria: "PV",
            tempMode: "2-8", rangeMin: 1.8, rangeMax: 8.2,
            sensorAccuracy: 0.2,
            startAt: now, endAt: now + 72 * 3600_000,
            minDurationHours: 72, minSensorCount: 2,
            samplingStepMinutes: 5,
            loggers, verdict: "fail", failureReasons: ["High deviation"],
            hotIdx: 1, coldIdx: 0, extIndices: [],
          },
          pvLoggers: [
            { id: 1, label: "230609STS0013742", role: "internal", position: "верхняя полка слева", avg: 3.2 },
            { id: 2, label: "230609STS0013966", role: "internal", position: "нижняя полка справа", avg: 7.1 },
          ],
        } as any);
      } finally {
        (PDFDocument.prototype as any).text = originalText;
      }

      const allText = writtenText.join("\n");
      expect(allText).toContain("Паспорт испытания PQ/PV");
      expect(allText).toContain("Критические точки PQ/PV");
      expect(allText).toContain("Интерпретация результата PQ/PV");
      expect(allText).toContain("комплексной оценке PQ/PV");
      expect(allText).toContain("разница между максимальной и минимальной средней температурой");
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
        if (text === "Заключение по этапу" || text === "Заключение по этапу PQ/PV") {
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
    "autofills IQ and OQ with protocol date and PV with completion date",
    async () => {
      const now = Date.UTC(2026, 5, 20, 9, 0, 0);
      const pvEndAt = Date.UTC(2026, 5, 22, 9, 0, 0);
      const originalText = (PDFDocument.prototype as any).text;
      const captured = new Map<string, Set<string>>();
      let activeStage: string | null = null;

      (PDFDocument.prototype as any).text = function (text: string, ...args: any[]) {
        if (
          text === "Запись ввода данных IQ" ||
          text === "Запись ввода данных OQ" ||
          text === "Запись ввода данных PQ/PV"
        ) {
          activeStage = text;
          captured.set(text, new Set());
        } else if (
          activeStage &&
          (text === "Оразалина А.А." || text === "25.06.2026" || text === "22.06.2026")
        ) {
          const values = captured.get(activeStage)!;
          values.add(text);
          if (values.size === 2) activeStage = null;
        }
        return originalText.call(this, text, ...args);
      };

      try {
        await generateProtocolPdf({
          org: BASE_ORG,
          protocol: {
            number: "VAL-2026-0041",
            createdAt: new Date(now),
          },
          generalInfo: {
            ...BASE_GI,
            validationDate: "2026-06-25",
          },
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
            startAt: now, endAt: pvEndAt,
            minDurationHours: 0, minSensorCount: 0,
            loggers: [], verdict: "none", failureReasons: [],
            hotIdx: null, coldIdx: null, extIndices: [],
          },
          dataIntegrity: {
            revision: "01",
            preparedBy: "Оразалина А.А.",
            generatedBy: "Оразалина А.А.",
            generatedAt: new Date(now),
            stages: [],
            revisionHistory: [],
          },
        });
      } finally {
        (PDFDocument.prototype as any).text = originalText;
      }

      expect(Array.from(captured.keys())).toEqual([
        "Запись ввода данных IQ",
        "Запись ввода данных OQ",
        "Запись ввода данных PQ/PV",
      ]);
      expect(Array.from(captured.get("Запись ввода данных IQ") ?? [])).toEqual(["Оразалина А.А.", "25.06.2026"]);
      expect(Array.from(captured.get("Запись ввода данных OQ") ?? [])).toEqual(["Оразалина А.А.", "25.06.2026"]);
      expect(Array.from(captured.get("Запись ввода данных PQ/PV") ?? [])).toEqual(["Оразалина А.А.", "22.06.2026"]);
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
    "labels warehouse documents as temperature mapping protocols and reports",
    async () => {
      const now = Date.UTC(2026, 7, 6, 9, 0, 0);
      const captured: string[] = [];
      const originalText = (PDFDocument.prototype as any).text;

      (PDFDocument.prototype as any).text = function (text: string, ...args: any[]) {
        captured.push(String(text));
        return originalText.call(this, text, ...args);
      };

      try {
        await generateProtocolPdf({
          org: BASE_ORG,
          protocol: { number: "VAL-STR-2026-010", createdAt: new Date(now), equipmentType: "warehouse" },
          generalInfo: {
            equipmentType: "warehouse",
            manufacturer: "",
            model: "",
            serial: "",
            inventory: "",
            year: 2026,
            tempMode: "15-25",
            location: "Помещение хранения аптеки",
            purpose: "Хранение лекарственных средств",
            validationDate: "2026-08-06",
            basis: "primary",
          },
          iq: {
            purpose: "IQ",
            description: "IQ",
            criteria: "IQ",
            items: [{ questionIndex: 0, questionText: "IQ question", answer: "yes", comment: null }],
            verdict: "pass",
          },
          oq: {
            purpose: "OQ",
            description: "OQ",
            criteria: "OQ",
            items: [{ questionIndex: 0, questionText: "OQ question", answer: "yes", comment: null }],
            verdict: "pass",
          },
          pv: {
            purpose: "PV",
            description: "PV",
            criteria: "PV",
            tempMode: "15-25",
            rangeMin: 15,
            rangeMax: 25,
            startAt: now,
            endAt: now + 72 * 3600_000,
            minDurationHours: 72,
            minSensorCount: 0,
            loggers: [],
            verdict: "pass",
            failureReasons: [],
            hotIdx: null,
            coldIdx: null,
            extIndices: [],
          },
        });
      } finally {
        (PDFDocument.prototype as any).text = originalText;
      }

      expect(captured).toContain("Протокол температурного картирования помещения (зоны) хранения лекарственных средств");
      expect(captured).toContain("Отчёт температурного картирования помещения (зоны) хранения лекарственных средств");
      expect(captured).toContain("5. Общие сведения об объекте температурного картирования");
      expect(captured).toContain("6.11. План подготовительной проверки IQ — квалификация монтажа");
      expect(captured).toContain("6.12. План подготовительной проверки OQ — квалификация функционирования");
      expect(captured).toContain("6.13. План PQ/PV — температурное картирование");
      expect(captured).toContain("10. Отчёт о температурном картировании");
      expect(captured).not.toContain("ПРОТОКОЛ КВАЛИФИКАЦИИ");
      expect(captured).not.toContain("ОТЧЁТ О КВАЛИФИКАЦИИ");
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
