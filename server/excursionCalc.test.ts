import { describe, expect, it } from "vitest";
import { applySensorAccuracyGuardBand } from "../shared/validation";
import { calcTest1, calcTest2, type SensorSeries } from "./excursionCalc";

const minute = 60_000;

function internal(label: string, start: number, temps: number[]): SensorSeries {
  return {
    label,
    role: "internal",
    ts: temps.map((_, i) => start + i * minute),
    temp: temps,
  };
}

describe("sensor accuracy guard band", () => {
  it("narrows nominal 2-8 C to 2.2-7.8 C for +/-0.2 C sensors", () => {
    expect(applySensorAccuracyGuardBand(2, 8, 0.2)).toEqual({
      rawMin: 2,
      rawMax: 8,
      sensorAccuracy: 0.2,
      min: 2.2,
      max: 7.8,
    });
  });
});

describe("excursion calculations with guarded limits", () => {
  it("waits until the last internal sensor cools to the guarded upper limit", () => {
    const start = Date.UTC(2026, 5, 13, 9, 0, 0);
    const range = applySensorAccuracyGuardBand(2, 8, 0.2);
    const result = calcTest1(
      [
        internal("D1", start, [9.0, 8.0, 7.8, 7.7]),
        internal("D2", start, [8.5, 7.8, 7.7, 7.6]),
      ],
      start,
      0,
      [range.min, range.max],
    );

    expect(result.criticalSensor).toBe("D1");
    expect(result.durationSec).toBe(120);
    expect(result.sensorEntries.find(entry => entry.label === "D1")?.entryAt).toBe(start + 2 * minute);
  });

  it("ignores an early in-range touch if an internal sensor exits again before the next excursion", () => {
    const start = Date.UTC(2026, 5, 13, 9, 0, 0);
    const range = applySensorAccuracyGuardBand(2, 8, 0.2);
    const result = calcTest1(
      [
        internal("D1", start, [9.0, 8.0, 7.8, 7.7, 7.7, 7.7, 7.7]),
        internal("D2", start, [9.2, 7.8, 7.7, 8.0, 7.9, 7.8, 7.7]),
      ],
      start,
      15,
      [range.min, range.max],
      start + 6 * minute,
    );

    expect(result.criticalSensor).toBe("D2");
    expect(result.durationSec).toBe(300);
    expect(result.sensorEntries.find(entry => entry.label === "D2")?.entryAt).toBe(start + 5 * minute);
  });

  it("counts door-opening break only after a sensor exceeds the guarded upper limit", () => {
    const start = Date.UTC(2026, 5, 13, 10, 0, 0);
    const range = applySensorAccuracyGuardBand(2, 8, 0.2);
    const result = calcTest2(
      [
        internal("D1", start, [7.6, 7.8, 7.9]),
        internal("D2", start, [7.4, 7.5, 7.6]),
      ],
      start,
      start + 2 * minute,
      [range.min, range.max],
    );

    expect(result.criticalSensor).toBe("D1");
    expect(result.durationSec).toBe(120);
    expect(result.tBreakAt).toBe(start + 2 * minute);
  });
});
