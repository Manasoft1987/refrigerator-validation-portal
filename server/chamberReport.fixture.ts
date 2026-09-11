import { CHAMBER_POSITIONS } from "../shared/chamberMapping";
import {
  CHAMBER_STAGE_TEMPLATES,
  DEFAULT_IQ_QUESTIONS_CHAMBER,
  DEFAULT_OQ_QUESTIONS_CHAMBER,
} from "../shared/validation";
import type { ReportInput } from "./pdfReport";

/** Synthetic, non-client data for chamber report regression and visual QA. */
export function chamberReportFixture(): ReportInput {
  const start = Date.UTC(2026, 8, 1, 0),
    end = start + 24 * 3600_000;
  const loggers = [...CHAMBER_POSITIONS.map(p => p.id), "external"].map(
    (position, i) => {
      const avg = i === 15 ? 22 : 3.1 + i * 0.23;
      const ts = Array.from({ length: 97 }, (_, j) => start + j * 15 * 60_000);
      const temp = ts.map(
        (_, j) => avg + 0.4 * Math.sin((2 * Math.PI * j) / 96)
      );
      return {
        id: i + 1,
        label: `TEST-LOGGER-${String(2001 + i)}`,
        customName: null,
        role: i === 15 ? ("external" as const) : ("internal" as const),
        position,
        pointCount: ts.length,
        min: Math.min(...temp),
        max: Math.max(...temp),
        avg,
        std: 0.28,
        mkt: avg + 0.02,
        series: { ts, temp },
        deviations: [],
      };
    }
  );
  const checklist = (questions: string[]) =>
    questions.map((questionText, questionIndex) => ({
      questionIndex,
      questionText,
      answer: "yes" as const,
      comment: questionIndex === 0 ? "Проверено по паспорту" : null,
    }));
  return {
    org: {
      name: "Демонстрационный объект — тестовые данные",
      bin: null,
      addressLegal: "Тестовый адрес",
      addressFact: "Тестовый адрес",
      responsible: "Тестовый исполнитель",
      phone: null,
      email: null,
    },
    protocol: {
      number: "DEMO-CHAMBER-15+1",
      createdAt: new Date(start),
      equipmentType: "chamber",
    },
    generalInfo: {
      equipmentType: "chamber",
      manufacturer: "Тестовый изготовитель",
      model: "ХК-12",
      serial: "DEMO-001",
      inventory: "ХК-01",
      year: 2025,
      tempMode: "2-8",
      location: "Испытательное помещение, камера 1",
      purpose: "Хранение лекарственных средств",
      validationDate: "2026-09-01",
      basis: "primary",
      season: "warm",
      fillStatus: "loaded",
      loadPercent: "70",
      commissionMembers: [
        {
          name: "Исполнитель И. И.",
          role: "Специалист по картированию",
          company: "Испытательная организация",
        },
      ],
    },
    iq: {
      ...CHAMBER_STAGE_TEMPLATES.iq,
      items: checklist(DEFAULT_IQ_QUESTIONS_CHAMBER),
      verdict: "pass",
    },
    oq: {
      ...CHAMBER_STAGE_TEMPLATES.oq,
      items: checklist(DEFAULT_OQ_QUESTIONS_CHAMBER),
      verdict: "pass",
    },
    pv: {
      ...CHAMBER_STAGE_TEMPLATES.pv,
      tempMode: "2-8",
      rangeMin: 2.2,
      rangeMax: 7.8,
      rawRangeMin: 2,
      rawRangeMax: 8,
      sensorAccuracy: 0.2,
      startAt: start,
      endAt: end,
      minDurationHours: 72, // Legacy saved setting: the chamber policy must use 24.
      minSensorCount: 15,
      loggers,
      verdict: "pass",
      failureReasons: [],
      hotIdx: 0,
      coldIdx: 1,
      extIndices: [15],
      samplingStepMinutes: 15,
    },
    pvLoggers: loggers,
    protocolSensors: loggers.map(l => ({
      id: l.id,
      number: l.label,
      calibrationDate: "2026-01-01",
      nextCalibrationDate: "2027-01-01",
      accuracyC: 0.2,
    })),
    pvRoomLengthM: 3,
    pvRoomWidthM: 2,
    pvRoomHeightM: 2.5,
    floorPlanObjects: [
      ...[
        { key: "door", value: "front" },
        { key: "cooling", value: "back" },
        { key: "racks", value: "both" },
      ].map(p => ({
        id: `chamber-${p.key}`,
        type: "chamber-feature",
        xPct: 0,
        yPct: 0,
        widthPct: 0,
        heightPct: 0,
        rotation: 0,
        label: p.value,
      })),
      ...["lower", "middle", "upper"].map((key, i) => ({
        id: `chamber-${key}`,
        type: "chamber-level",
        xPct: 0,
        yPct: 0,
        widthPct: 0,
        heightPct: 0,
        heightM: [0.3, 1.2, 2.1][i],
        rotation: 0,
        label: key,
      })),
      {
        id: "chamber-notes",
        type: "chamber-notes",
        xPct: 0,
        yPct: 0,
        widthPct: 0,
        heightPct: 0,
        rotation: 0,
        label:
          "Демонстрационная конфигурация: дверь на передней стороне, испаритель у задней стенки. Внешний регистратор — в смежном помещении с контролируемой температурой. Период 24 ч охватывает штатный суточный цикл работы.",
      },
    ],
    reportDate: "2026-09-04",
    planDeviations:
      "Тестовая запись: отклонений от утверждённого плана не отмечено.",
  };
}
