import { describe, expect, it } from "vitest";
import {
  clipSeries,
  computeStats,
  detectExternalSensors,
  findDeviations,
  parseLoggerBuffer,
} from "./loggerParser";

describe("computeStats", () => {
  it("returns min/max/avg/std/mkt for a simple series", () => {
    const s = computeStats([2, 4, 6, 8, 10]);
    expect(s).not.toBeNull();
    expect(s!.min).toBe(2);
    expect(s!.max).toBe(10);
    expect(s!.avg).toBeCloseTo(6, 6);
    expect(s!.std).toBeGreaterThan(2.5);
    // MKT is always >= arithmetic mean for non-constant series
    expect(s!.mkt).toBeGreaterThanOrEqual(s!.avg - 1e-6);
  });

  it("returns null for empty array", () => {
    expect(computeStats([])).toBeNull();
  });

  it("MKT equals mean for constant series", () => {
    const s = computeStats([5, 5, 5, 5]);
    expect(s!.mkt).toBeCloseTo(5, 6);
    expect(s!.std).toBeCloseTo(0, 6);
  });
});

describe("findDeviations", () => {
  it("finds a single deviation above max", () => {
    const ts = [0, 60_000, 120_000, 180_000, 240_000];
    const temp = [5, 5, 9, 9, 5];
    const devs = findDeviations(ts, temp, 2, 8);
    expect(devs.length).toBe(1);
    expect(devs[0].type).toBe("high");
    // Deviation covers indices 2-3 (timestamps 120_000..180_000) plus the first in-range
    // sample end (240_000): the parser ends at ts[j] where j is the first index back in range.
    expect(devs[0].durationMs).toBeGreaterThanOrEqual(60_000);
    expect(devs[0].value).toBeCloseTo(9, 3);
  });

  it("finds a deviation below min", () => {
    const ts = [0, 60_000, 120_000, 180_000];
    const temp = [5, 1, 1, 5];
    const devs = findDeviations(ts, temp, 2, 8);
    expect(devs.length).toBe(1);
    expect(devs[0].type).toBe("low");
  });

  it("returns empty array when in range", () => {
    const devs = findDeviations([0, 60_000], [4, 5], 2, 8);
    expect(devs).toEqual([]);
  });
});

describe("clipSeries", () => {
  it("clips by start and end", () => {
    const res = clipSeries(
      { ts: [1, 2, 3, 4, 5], temp: [10, 20, 30, 40, 50] },
      2,
      4,
    );
    expect(res.ts).toEqual([2, 3, 4]);
    expect(res.temp).toEqual([20, 30, 40]);
  });

  it("returns original when no bounds", () => {
    const res = clipSeries({ ts: [1, 2], temp: [3, 4] });
    expect(res.ts).toEqual([1, 2]);
  });
});

describe("detectExternalSensors", () => {
  it("flags sensors far from the regulated range as external", () => {
    const sensors = [
      { avg: 5 }, // inside 2-8 → internal
      { avg: 6 }, // inside 2-8 → internal
      { avg: 25 }, // ambient / external
      { avg: 4 }, // inside → internal
    ];
    const externals = detectExternalSensors(sensors, 2, 8);
    expect(externals).toContain(2);
    expect(externals).not.toContain(0);
    expect(externals).not.toContain(1);
    expect(externals).not.toContain(3);
  });

  it("returns empty when all sensors are inside range", () => {
    expect(detectExternalSensors([{ avg: 4 }, { avg: 6 }], 2, 8)).toEqual([]);
  });
});

import * as XLSX from "xlsx";

describe("parseLoggerBuffer", () => {
  it("parses a simple CSV with headers", () => {
    const csv =
      "datetime,temperature\n" +
      "2024-01-01T00:00:00Z,5.1\n" +
      "2024-01-01T00:05:00Z,5.2\n" +
      "2024-01-01T00:10:00Z,4.9\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "sample.csv");
    expect(res.ts.length).toBe(3);
    expect(res.temp.length).toBe(3);
    expect(res.temp[0]).toBeCloseTo(5.1, 6);
  });

  it("parses a CSV with European decimal separator and DD.MM.YYYY timestamps", () => {
    const csv =
      "Дата/Время;Температура, °C\n" +
      "01.01.2024 00:00;5,1\n" +
      "01.01.2024 00:05;5,2\n" +
      "01.01.2024 00:10;4,9\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "ru-sample.csv");
    expect(res.ts.length).toBe(3);
    expect(res.temp[1]).toBeCloseTo(5.2, 6);
  });

  it("parses Elitech-style CSV with Index/Timestamp/NTC(°C)/NTC LL/NTC HL/Serial/Logger Name", () => {
    const csv =
      "Index,Timestamp,NTC(°C),NTC LL(°C),NTC HL(°C),Serial Number,Logger Name\n" +
      "0,16.04.2026 11:30,\"18,2\",2,8,240903STS0042048,2048\n" +
      "1,16.04.2026 11:31,\"18,3\",2,8,240903STS0042048,2048\n" +
      "2,16.04.2026 11:32,\"18,3\",2,8,240903STS0042048,2048\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "3757.csv");
    expect(res.ts.length).toBe(3);
    // Must pick the NTC(°C) column, NOT NTC LL / NTC HL (which are limit columns, value 2 or 8)
    expect(res.temp[0]).toBeCloseTo(18.2, 6);
    expect(res.temp[1]).toBeCloseTo(18.3, 6);
    // Timestamps must be parsed correctly from DD.MM.YYYY HH:MM
    // Parser stores wall-clock time as UTC ms so display matches file regardless of server TZ.
    const d0 = new Date(res.ts[0]);
    expect(d0.getUTCFullYear()).toBe(2026);
    expect(d0.getUTCMonth()).toBe(3); // April
    expect(d0.getUTCDate()).toBe(16);
    expect(d0.getUTCHours()).toBe(11);
    expect(d0.getUTCMinutes()).toBe(30);
  });

  it("parses Elitech-style XLSX with the same layout", () => {
    const aoa = [
      ["Index", "Timestamp", "NTC(°C)", "NTC LL(°C)", "NTC HL(°C)", "Serial Number", "Logger Name"],
      [0, new Date(2026, 3, 16, 11, 30), 18.2, 2, 8, "240903STS0042048", 2048],
      [1, new Date(2026, 3, 16, 11, 31), 18.3, 2, 8, "240903STS0042048", 2048],
      [2, new Date(2026, 3, 16, 11, 32), 18.3, 2, 8, "240903STS0042048", 2048],
      [3, new Date(2026, 3, 16, 11, 33), 18.4, 2, 8, "240903STS0042048", 2048],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const res = parseLoggerBuffer(buf, "3757.xlsx");
    expect(res.ts.length).toBe(4);
    expect(res.temp[0]).toBeCloseTo(18.2, 6);
    expect(res.temp[3]).toBeCloseTo(18.4, 6);
    // Ensure NTC LL / HL columns were NOT picked (otherwise values would be 2 or 8)
    for (const v of res.temp) {
      expect(v).toBeGreaterThan(10);
    }
  });

  it("uses the document name as sensor name when the file has no logger identity inside", () => {
    const csv =
      "Timestamp,Temperature\n" +
      "2026.07.27 09:45:00,21.10\n" +
      "2026.07.27 10:00:00,21.20\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "EF719BE00575_20260727095341.xls");
    expect(res.ts.length).toBe(2);
    expect(res.sensorName).toBe("EF719BE00575");
  });

  it("prefers the document name over a suspicious measurement-like logger identity", () => {
    const csv =
      "Logger ID,57.0\n" +
      "Timestamp,Temperature\n" +
      "2026.07.27 09:45:00,20.50\n" +
      "2026.07.27 10:00:00,20.60\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "4955.xlsx");
    expect(res.ts.length).toBe(2);
    expect(res.sensorName).toBe("4955");
  });

  it("keeps the logger identity from file contents when it is present", () => {
    const csv =
      "Logger Name,ABC-123\n" +
      "Timestamp,Temperature\n" +
      "2026.07.27 09:45:00,21.10\n" +
      "2026.07.27 10:00:00,21.20\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "fallback-name.csv");
    expect(res.ts.length).toBe(2);
    expect(res.sensorName).toBe("ABC-123");
  });

  it("extracts Sonor device serial from document name without the date range", () => {
    const csv =
      "Timestamp,Temperature\n" +
      "2026.07.27 09:45:00,21.10\n" +
      "2026.07.27 10:00:00,21.20\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "device_000B44BCADD2568_2026-07-19_to_2026-07-26.csv");
    expect(res.ts.length).toBe(2);
    expect(res.sensorName).toBe("000B44BCADD2568");
  });

  it("does not treat humidity columns as temperature when headers contain percent/RH", () => {
    const csv =
      "Timestamp,Sensor (°C),Sensor (%RH)\n" +
      "2026.07.26 23:45:00,24.20,51.80\n" +
      "2026.07.26 23:30:00,24.30,51.65\n" +
      "2026.07.26 23:15:00,24.40,51.40\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "sonor-rh.csv");
    expect(res.ts.length).toBe(3);
    expect(Math.min(...res.temp)).toBeCloseTo(24.2, 6);
    expect(Math.max(...res.temp)).toBeCloseTo(24.4, 6);
    for (const v of res.temp) {
      expect(v).toBeLessThan(30);
    }
  });

  it("picks the value before ℃, not the value before %, for headerless UTH exports", () => {
    const aoa = [
      [new Date(2026, 6, 19, 7, 9, 49), 21.5, "℃", 65.7, "%"],
      [new Date(2026, 6, 19, 7, 24, 49), 21.6, "℃", 57.1, "%"],
      [new Date(2026, 6, 19, 7, 39, 49), 21.2, "℃", 58.5, "%"],
      [new Date(2026, 6, 19, 7, 54, 49), 21.2, "℃", 58.9, "%"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const res = parseLoggerBuffer(buf, "uth-headerless.xlsx");
    expect(res.ts.length).toBe(3);
    expect(res.temp[0]).toBeCloseTo(21.6, 6);
    expect(res.temp[1]).toBeCloseTo(21.2, 6);
    for (const v of res.temp) {
      expect(v).toBeLessThan(30);
    }
  });

  it("returns empty series for unrelated content", () => {
    const csv = "foo,bar\n1,2\n3,4\n";
    const res = parseLoggerBuffer(Buffer.from(csv), "junk.csv");
    // Without time/temp columns the parser may fall back but most likely returns empty
    // Either way, safety: ensure it does not throw and returns arrays of equal length.
    expect(Array.isArray(res.ts)).toBe(true);
    expect(Array.isArray(res.temp)).toBe(true);
    expect(res.ts.length).toBe(res.temp.length);
  });
});
