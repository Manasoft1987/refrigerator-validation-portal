import { describe, expect, it } from "vitest";
import { calculateCriticalLoggerIndices } from "./pvCriticalPoints";

describe("calculateCriticalLoggerIndices", () => {
  it("prioritizes high deviations over average temperature for the hot point", () => {
    const result = calculateCriticalLoggerIndices([
      { role: "internal", min: 4, max: 7, avg: 6.2, mkt: 6.4, deviations: [] },
      { role: "internal", min: 3, max: 9.2, avg: 5.7, mkt: 6.1, deviations: [{ type: "high", value: 9.2, durationMs: 10 * 60_000 }] },
      { role: "external", min: 1, max: 30, avg: 15, mkt: 18, deviations: [{ type: "high", value: 30, durationMs: 60 * 60_000 }] },
    ]);

    expect(result.hotIdx).toBe(1);
  });

  it("prioritizes low deviations over average temperature for the cold point", () => {
    const result = calculateCriticalLoggerIndices([
      { role: "internal", min: 3.2, max: 7, avg: 4.1, mkt: 4.2, deviations: [] },
      { role: "internal", min: 1.6, max: 6, avg: 4.8, mkt: 4.9, deviations: [{ type: "low", value: 1.6, durationMs: 5 * 60_000 }] },
    ]);

    expect(result.coldIdx).toBe(1);
  });

  it("falls back to extremes and averages when there are no deviations", () => {
    const result = calculateCriticalLoggerIndices([
      { role: "internal", min: 3.1, max: 7.2, avg: 5.1, mkt: 5.3, deviations: [] },
      { role: "internal", min: 2.8, max: 6.9, avg: 4.9, mkt: 5.0, deviations: [] },
      { role: "internal", min: 3.4, max: 7.8, avg: 5.4, mkt: 5.6, deviations: [] },
    ]);

    expect(result.hotIdx).toBe(2);
    expect(result.coldIdx).toBe(1);
  });

  it("keeps hot and cold points on different internal loggers when possible", () => {
    const result = calculateCriticalLoggerIndices([
      {
        role: "internal",
        min: 1.5,
        max: 10.1,
        avg: 6.4,
        mkt: 6.8,
        deviations: [
          { type: "high", value: 10.1, durationMs: 15 * 60_000 },
          { type: "low", value: 1.5, durationMs: 15 * 60_000 },
        ],
      },
      { role: "internal", min: 2.2, max: 8.4, avg: 5.1, mkt: 5.2, deviations: [] },
      { role: "external", min: -5, max: 32, avg: 15, mkt: 16, deviations: [] },
    ]);

    expect(result.hotIdx).toBe(0);
    expect(result.coldIdx).toBe(1);
  });
});
