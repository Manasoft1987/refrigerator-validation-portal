import { describe, expect, it } from "vitest";
import { calculateAllOperationalMetrics } from "./operationalMetrics";

const start = Date.UTC(2026, 5, 28, 8, 0, 0);
const series = {
  ts: Array.from({ length: 40 }, (_, index) => start + index * 60_000),
  temp: Array.from({ length: 40 }, () => 5),
};

describe("operational metric wording", () => {
  it("uses chamber wording for a cold chamber", () => {
    const result = calculateAllOperationalMetrics(
      [{ series }],
      2.2,
      7.8,
      null,
      null,
      undefined,
      "chamber",
    );
    const text = [result.warmupDescription, result.thermalRetentionDescription].join(" ");
    expect(text).toContain("Холодильная камера");
    expect(text).toContain("камера способна");
    expect(text).not.toMatch(/авторефрижератор|кузов|кабина|транспортное средство/i);
  });

  it("uses refrigerator wording for a refrigerator", () => {
    const result = calculateAllOperationalMetrics(
      [{ series }],
      2.2,
      7.8,
      null,
      null,
      undefined,
      "refrigerator",
    );
    const text = [result.warmupDescription, result.thermalRetentionDescription].join(" ");
    expect(text).toContain("Холодильник");
    expect(text).toContain("холодильник способен");
    expect(text).not.toMatch(/авторефрижератор|кузов|кабина|транспортное средство/i);
  });

  it("keeps existing auto-refrigerator wording unchanged", () => {
    const result = calculateAllOperationalMetrics(
      [{ series }],
      2.2,
      7.8,
      null,
      null,
      undefined,
      "auto-refrigerator",
    );
    const text = [result.warmupDescription, result.thermalRetentionDescription].join(" ");
    expect(text).toContain("Авторефрижератор");
    expect(text).toContain("кузов способен");
  });
});
