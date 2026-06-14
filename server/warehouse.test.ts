import { describe, expect, it } from "vitest";
import { computeWarehouseSensorCount } from "../shared/validation";
import { generateProtocolPdf } from "./pdfReport";

/* -------------------------------------------------------------------------- */
/* EAEU Рек. №8 (п. 16д) — расчёт количества регистраторов                    */
/* -------------------------------------------------------------------------- */
describe("computeWarehouseSensorCount – EAEU Рек. №8 п. 16д", () => {
  it("returns zero total when dimensions are missing", () => {
    const r = computeWarehouseSensorCount({});
    expect(r.total).toBe(0);
    expect(r.base).toBe(0);
  });

  it("uses 2×2×1 grid for a small storage zone (≤10 м, ≤1.5 м)", () => {
    const r = computeWarehouseSensorCount({ lengthM: 8, widthM: 6, heightM: 1.4 });
    expect(r.nL).toBe(2);
    expect(r.nW).toBe(2);
    expect(r.nV).toBe(1);
    expect(r.base).toBe(4);
    expect(r.total).toBe(4);
  });

  it("uses 3×3×2 grid for a mid-size warehouse (10–40 м, <5 м)", () => {
    const r = computeWarehouseSensorCount({ lengthM: 25, widthM: 20, heightM: 4 });
    expect(r.nL).toBe(3);
    expect(r.nW).toBe(3);
    expect(r.nV).toBe(2);
    expect(r.base).toBe(18);
    expect(r.total).toBe(18);
  });

  it("uses 4×4×3 grid for a large warehouse (40–60 м, ≥5 м)", () => {
    const r = computeWarehouseSensorCount({ lengthM: 50, widthM: 45, heightM: 6 });
    expect(r.nL).toBe(4);
    expect(r.nW).toBe(4);
    expect(r.nV).toBe(3);
    expect(r.base).toBe(48);
    expect(r.total).toBe(48);
  });

  it("uses 5 horizontal points when length exceeds 60 м", () => {
    const r = computeWarehouseSensorCount({ lengthM: 80, widthM: 30, heightM: 5 });
    expect(r.nL).toBe(5);
    expect(r.nW).toBe(3);
    expect(r.nV).toBe(3);
    expect(r.base).toBe(45);
  });

  it("adds +1 external sensor when externalEnv is true", () => {
    const r = computeWarehouseSensorCount({ lengthM: 8, widthM: 6, heightM: 1.4, externalEnv: true });
    expect(r.base).toBe(4);
    expect(r.external).toBe(1);
    expect(r.total).toBe(5);
  });

  it("rationale string mentions all three dimensions", () => {
    const r = computeWarehouseSensorCount({ lengthM: 25, widthM: 20, heightM: 4 });
    expect(r.rationale).toContain("25");
    expect(r.rationale).toContain("20");
    expect(r.rationale).toContain("4");
    expect(r.rationale).toMatch(/\d+×\d+×\d+/);
  });
});

/* -------------------------------------------------------------------------- */
/* PDF generation for warehouse / storage zone                                */
/* -------------------------------------------------------------------------- */
function mkSeries(start: number, hours: number, temp: number) {
  const ts: number[] = [];
  const t: number[] = [];
  const step = 5 * 60_000;
  const n = Math.round((hours * 3600_000) / step);
  for (let i = 0; i < n; i++) {
    ts.push(start + i * step);
    t.push(temp + Math.sin(i / 30) * 0.3);
  }
  return { ts, temp: t };
}

describe("generateProtocolPdf – warehouse / storage zone", () => {
  it(
    "produces a non-empty PDF for warehouse with EAEU annexes",
    async () => {
      const now = Date.UTC(2026, 4, 1, 9, 0, 0);
      const series = mkSeries(now, 168, 20);
      const calc = computeWarehouseSensorCount({ lengthM: 25, widthM: 20, heightM: 4 });
      // Generate one logger per (row, col, tier) according to EAEU grid
      const loggers: any[] = [];
      let id = 1;
      for (let t = 1; t <= calc.nV; t++) {
        for (let r = 1; r <= calc.nL; r++) {
          for (let c = 1; c <= calc.nW; c++) {
            loggers.push({
              id: id++,
              label: `L${r}-c${c}-t${t}`,
              customName: null,
              role: "internal" as const,
              pointCount: series.temp.length,
              min: 18.5, max: 21.4, avg: 20.0, std: 0.5, mkt: 20.1,
              series, deviations: [],
            });
          }
        }
      }
      const pvLoggers = loggers.map(l => ({
        id: l.id,
        label: l.label,
        customName: null,
        role: l.role,
        position: l.label,
        posX: null,
        posY: null,
      }));

      const buf = await generateProtocolPdf({
        org: {
          name: "ТОО «Складской комплекс»",
          bin: "200000000000",
          addressLegal: "г. Алматы",
          addressFact: "г. Алматы, ул. Складская 1",
          responsible: "Иванова А. И.",
          phone: "+7 700 000 0000",
          email: "qa@example.kz",
          logoBuffer: null,
        },
        protocol: {
          number: "VAL-2026-0010",
          createdAt: new Date(now),
          equipmentType: "warehouse",
          customEquipmentName: null,
        },
        generalInfo: {
          equipmentType: "warehouse",
          manufacturer: null,
          model: null,
          serial: null,
          inventory: null,
          year: null,
          tempMode: "15-25",
          location: "Склад №1, помещение 105",
          purpose: "Хранение ЛС при +15…+25 °C",
          validationDate: "2026-05-01",
          basis: "primary",
          commissionMembers: [
            { name: "Иванова А. И.", role: "Председатель" },
            { name: "Петров Н. С.", role: "Член комиссии" },
          ],
          whLengthM: 25,
          whWidthM: 20,
          whHeightM: 4,
          whHumidityControl: 0,
          whSeason: "summer",
          whStudyType: "warehouse",
          whExternalEnv: 0,
          whLayoutNotes: "Помещение оборудовано стеллажным хранением, кондиционирование канальное.",
        },
        iq: {
          purpose: "IQ", description: "IQ", criteria: "IQ",
          items: [{ questionIndex: 1, questionText: "Помещение принято в эксплуатацию", answer: "yes", comment: null }],
          verdict: "pass",
        },
        oq: {
          purpose: "OQ", description: "OQ", criteria: "OQ",
          items: [{ questionIndex: 1, questionText: "Кондиционирование стабильно", answer: "yes", comment: null }],
          verdict: "pass",
        },
        pv: {
          purpose: "PV", description: "PV", criteria: "PV",
          tempMode: "15-25", rangeMin: 15, rangeMax: 25,
          startAt: now, endAt: now + 168 * 3600_000,
          minDurationHours: 168, minSensorCount: calc.total,
          loggers, verdict: "pass", failureReasons: [],
          hotIdx: 0, coldIdx: 0, extIndices: [],
        },
        pvLoggers,
      } as any);

      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(2000);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    90_000,
  );

  it(
    "renders PDF without crashing when warehouse dimensions are missing",
    async () => {
      const now = Date.UTC(2026, 4, 1, 9, 0, 0);
      const series = mkSeries(now, 168, 20);
      const sensor = {
        id: 1, label: "S1", customName: null, role: "internal" as const,
        pointCount: series.temp.length, min: 18.5, max: 21.4, avg: 20.0, std: 0.5, mkt: 20.1,
        series, deviations: [],
      };
      const buf = await generateProtocolPdf({
        org: {
          name: "ТОО «Тест»", bin: null, addressLegal: null, addressFact: null,
          responsible: null, phone: null, email: null, logoBuffer: null,
        },
        protocol: {
          number: "VAL-2026-0011",
          createdAt: new Date(now),
          equipmentType: "warehouse",
          customEquipmentName: null,
        },
        generalInfo: {
          equipmentType: "warehouse",
          manufacturer: null, model: null, serial: null, inventory: null, year: null,
          tempMode: "15-25", location: "Зона приёмки", purpose: "Хранение ЛС",
          validationDate: "2026-05-01", basis: "primary",
          // dimensions omitted on purpose
          whHumidityControl: 0,
        },
        iq: {
          purpose: "IQ", description: "IQ", criteria: "IQ",
          items: [{ questionIndex: 1, questionText: "Q", answer: "yes", comment: null }],
          verdict: "pass",
        },
        oq: {
          purpose: "OQ", description: "OQ", criteria: "OQ",
          items: [{ questionIndex: 1, questionText: "Q", answer: "yes", comment: null }],
          verdict: "pass",
        },
        pv: {
          purpose: "PV", description: "PV", criteria: "PV",
          tempMode: "15-25", rangeMin: 15, rangeMax: 25,
          startAt: now, endAt: now + 168 * 3600_000,
          minDurationHours: 168, minSensorCount: 1,
          loggers: [sensor], verdict: "pass", failureReasons: [],
          hotIdx: 0, coldIdx: 0, extIndices: [],
        },
      } as any);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
    60_000,
  );
});
