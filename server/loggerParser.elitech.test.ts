import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseLoggerBuffer, computeStats } from "./loggerParser";

const FIXTURES = join(__dirname, "__fixtures__");

function load(name: string): Buffer {
  return readFileSync(join(FIXTURES, name));
}

describe("parseLoggerBuffer – real Elitech .xls exports (UTF-16 LE TSV)", () => {
  it("reads 2048.xls and picks the NTC(°C) column, not NTC LL/HL", () => {
    const series = parseLoggerBuffer(load("2048.xls"), "2048.xls");
    expect(series.ts.length).toBeGreaterThan(100);
    expect(series.temp.length).toEqual(series.ts.length);
    // Must NOT have selected the LL (constant 2) or HL (constant 8) column:
    // a constant series would collapse to a single unique value.
    const uniqueTemps = new Set(series.temp);
    expect(uniqueTemps.size).toBeGreaterThan(10);
    // First few rows in the file are room-temperature (~18 °C).
    expect(series.temp[0]).toBeGreaterThan(10);
    // Overall range should be realistic for a cold-chain logger (cannot pick
    // a column where all values are exactly 2 or exactly 8).
    const minT = Math.min(...series.temp);
    const maxT = Math.max(...series.temp);
    expect(maxT - minT).toBeGreaterThan(1);
    expect(minT).toBeGreaterThan(-30);
    expect(maxT).toBeLessThan(60);
    // Stats should succeed.
    const stats = computeStats(series.temp);
    expect(stats).not.toBeNull();
  });

  it("reads 8734.xls and picks the NTC(°C) column, not NTC LL/HL", () => {
    const series = parseLoggerBuffer(load("8734.xls"), "8734.xls");
    expect(series.ts.length).toBeGreaterThan(100);
    const uniqueTemps = new Set(series.temp);
    expect(uniqueTemps.size).toBeGreaterThan(10);
    expect(series.temp[0]).toBeGreaterThan(10); // starts at ~18 °C
    const minT = Math.min(...series.temp);
    const maxT = Math.max(...series.temp);
    expect(maxT - minT).toBeGreaterThan(1);
  });

  it("reads 3757.xls successfully (was previously rejected)", () => {
    const series = parseLoggerBuffer(load("3757.xls"), "3757.xls");
    expect(series.ts.length).toBeGreaterThan(10);
    expect(series.temp.length).toEqual(series.ts.length);
    expect(series.temp[0]).toBeGreaterThan(10); // starts at 18,2
    // Intervals should be a few minutes at most (10 min in this file).
    const dt = series.ts[1] - series.ts[0];
    expect(dt).toBeGreaterThanOrEqual(30_000);
    expect(dt).toBeLessThanOrEqual(30 * 60_000);
  });

  it("timestamps are monotonically non-decreasing across all three files", () => {
    for (const f of ["2048.xls", "3757.xls", "8734.xls"]) {
      const series = parseLoggerBuffer(load(f), f);
      for (let i = 1; i < series.ts.length; i++) {
        expect(series.ts[i]).toBeGreaterThanOrEqual(series.ts[i - 1]);
      }
    }
  });
});
