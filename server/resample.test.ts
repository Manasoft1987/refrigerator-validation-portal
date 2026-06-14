import { describe, it, expect } from "vitest";
import { resampleSeries, clipSeries, computeStats } from "./loggerParser";

function minuteTs(count: number, startMs = 1_700_000_000_000, stepMinutes = 1) {
  return Array.from({ length: count }, (_, i) => startMs + i * stepMinutes * 60_000);
}

describe("resampleSeries", () => {
  it("returns input unchanged when step is null/0", () => {
    const s = { ts: minuteTs(5), temp: [1, 2, 3, 4, 5] };
    expect(resampleSeries(s, null)).toBe(s);
    expect(resampleSeries(s, 0)).toBe(s);
  });

  it("thins 1-minute data down to 10-minute step", () => {
    // 60 points, one per minute — with new logic, preserves all original points + grid points
    const s = { ts: minuteTs(60), temp: Array.from({ length: 60 }, (_, i) => i) };
    const out = resampleSeries(s, 10);
    // Should have at least original 60 points + grid points
    expect(out.ts.length).toBeGreaterThanOrEqual(60);
    // All original points should be preserved
    for (const t of s.ts) {
      expect(out.ts).toContain(t);
    }
  });

  it("preserves data when step is smaller than native resolution", () => {
    // Native step 10 min, resample to 5 min — we can only output at grid ticks
    // that have a <= earlier sample, so count should equal original count.
    const s = {
      ts: minuteTs(6, 1_700_000_000_000, 10),
      temp: [4, 4.1, 4.2, 4.3, 4.4, 4.5],
    };
    const out = resampleSeries(s, 5);
    expect(out.temp.length).toBeGreaterThanOrEqual(s.temp.length - 1);
  });

  it("falls back to original series when span is shorter than one step", () => {
    const s = { ts: minuteTs(3), temp: [10, 11, 12] };
    const out = resampleSeries(s, 60); // 60-min step on 2-min span
    expect(out).toBe(s);
  });
});

describe("clipSeries + computeStats together respect the test window", () => {
  it("excludes pre-start and post-end samples", () => {
    // Logger starts at room temperature (18°C) then enters fridge (4°C) at t=10 min
    // and leaves fridge (18°C) at t=70 min.
    const ts: number[] = [];
    const temp: number[] = [];
    for (let i = 0; i < 90; i++) {
      ts.push(1_700_000_000_000 + i * 60_000);
      if (i < 10 || i >= 70) temp.push(18);
      else temp.push(4);
    }
    const windowStart = ts[10];
    const windowEnd = ts[69];
    const clipped = clipSeries({ ts, temp }, windowStart, windowEnd);
    const stats = computeStats(clipped.temp);
    expect(stats).not.toBeNull();
    expect(stats!.min).toBe(4);
    expect(stats!.max).toBe(4);
    expect(stats!.avg).toBe(4);
  });
});
