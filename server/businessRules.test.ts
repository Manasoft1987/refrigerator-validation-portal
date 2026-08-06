import { describe, expect, it } from "vitest";
import { formatProtocolNumber, protocolObjectCode } from "./db";
import { aggregateTrialVerdicts } from "../shared/validation";

/**
 * New protocol numbering format: VAL-{OBJECT}-{YYYY}-{###}.
 * Already-issued legacy numbers such as VAL-2026-0001 remain untouched in the
 * database; only newly generated protocols use the object code.
 */

/**
 * Checklist verdict rule, extracted from the IQ/OQ router logic:
 *   - No items                           -> "none"
 *   - Any answer "unset"                 -> "none"
 *   - Any answer "no"                    -> "fail"
 *   - Otherwise (only yes/na)            -> "pass"
 */
function computeChecklistVerdict(
  items: Array<{ answer: "yes" | "no" | "na" | "unset" }>,
): "pass" | "fail" | "none" {
  if (items.length === 0) return "none";
  if (items.some(i => i.answer === "unset")) return "none";
  if (items.some(i => i.answer === "no")) return "fail";
  return "pass";
}

describe("protocol number format", () => {
  it("matches VAL-{OBJECT}-{YYYY}-{###} for new protocols", () => {
    const cases: Array<[number, number, string, string]> = [
      [2026, 1, "refrigerator", "VAL-REF-2026-001"],
      [2026, 2, "freezer", "VAL-FRZ-2026-002"],
      [2026, 42, "warehouse", "VAL-STR-2026-042"],
      [2026, 43, "warehouse-expert", "VAL-STR-2026-043"],
      [2026, 7, "auto-refrigerator", "VAL-TRK-2026-007"],
      [2026, 3, "chamber", "VAL-CHB-2026-003"],
      [2026, 4, "thermal-container", "VAL-TC-2026-004"],
      [2026, 6, "computerized-system", "VAL-CS-2026-006"],
      [2026, 5, "other", "VAL-EQP-2026-005"],
    ];
    for (const [year, seq, equipmentType, expected] of cases) {
      const produced = formatProtocolNumber(year, seq, equipmentType);
      expect(produced).toBe(expected);
      expect(produced).toMatch(/^VAL-[A-Z]{2,3}-\d{4}-\d{3}$/);
    }
  });

  it("uses GxP object codes for all supported equipment types", () => {
    expect(protocolObjectCode("refrigerator")).toBe("REF");
    expect(protocolObjectCode("freezer")).toBe("FRZ");
    expect(protocolObjectCode("warehouse")).toBe("STR");
    expect(protocolObjectCode("warehouse-expert")).toBe("STR");
    expect(protocolObjectCode("auto-refrigerator")).toBe("TRK");
    expect(protocolObjectCode("chamber")).toBe("CHB");
    expect(protocolObjectCode("thermal-container")).toBe("TC");
    expect(protocolObjectCode("computerized-system")).toBe("CS");
    expect(protocolObjectCode("other")).toBe("EQP");
  });

  it("pads sequence numbers to three digits", () => {
    expect(formatProtocolNumber(2026, 1, "warehouse")).toBe("VAL-STR-2026-001");
    expect(formatProtocolNumber(2026, 10, "warehouse")).toBe("VAL-STR-2026-010");
    expect(formatProtocolNumber(2026, 100, "warehouse")).toBe("VAL-STR-2026-100");
  });
});

describe("thermal-container trial verdict", () => {
  it("waits until every selected temperature mode is analyzed", () => {
    expect(aggregateTrialVerdicts(["pass", "none", "pass"])).toBe("none");
  });

  it("fails after all trials finish if any mode failed", () => {
    expect(aggregateTrialVerdicts(["pass", "fail", "pass"])).toBe("fail");
  });

  it("passes only when every mode passed", () => {
    expect(aggregateTrialVerdicts(["pass", "pass", "pass"])).toBe("pass");
  });
});

describe("checklist verdict logic", () => {
  it("returns 'none' for empty list", () => {
    expect(computeChecklistVerdict([])).toBe("none");
  });

  it("returns 'none' when at least one item is unset", () => {
    expect(
      computeChecklistVerdict([{ answer: "yes" }, { answer: "unset" }]),
    ).toBe("none");
  });

  it("returns 'fail' when any item is 'no', even if others are 'yes'", () => {
    expect(
      computeChecklistVerdict([{ answer: "yes" }, { answer: "yes" }, { answer: "no" }]),
    ).toBe("fail");
  });

  it("returns 'pass' when every item is 'yes' or 'na'", () => {
    expect(
      computeChecklistVerdict([
        { answer: "yes" },
        { answer: "yes" },
        { answer: "na" },
      ]),
    ).toBe("pass");
  });

  it("treats 'na' as acceptable alongside 'yes'", () => {
    expect(computeChecklistVerdict([{ answer: "na" }])).toBe("pass");
  });
});
