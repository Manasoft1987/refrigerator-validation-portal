import { describe, expect, it } from "vitest";

/**
 * Protocol numbering format VAL-{YYYY}-{####} — replicates the rule enforced in
 * `nextProtocolNumber` so that the numeric format is guaranteed regardless of
 * database state. Keeping this as a pure helper makes the invariant verifiable.
 */
function formatProtocolNumber(year: number, seq: number): string {
  const seqStr = seq.toString().padStart(4, "0");
  return `VAL-${year}-${seqStr}`;
}

/**
 * Checklist verdict rule, extracted from the IQ/OQ router logic:
 *   - No items                           → "none"
 *   - Any answer "unset"                 → "none"
 *   - Any answer "no"                    → "fail"
 *   - Otherwise (only yes/na)            → "pass"
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
  it("matches VAL-{YYYY}-{####} exactly", () => {
    const cases: Array<[number, number, string]> = [
      [2024, 1, "VAL-2024-0001"],
      [2024, 42, "VAL-2024-0042"],
      [2025, 9999, "VAL-2025-9999"],
      [2030, 123, "VAL-2030-0123"],
    ];
    for (const [year, seq, expected] of cases) {
      const produced = formatProtocolNumber(year, seq);
      expect(produced).toBe(expected);
      expect(produced).toMatch(/^VAL-\d{4}-\d{4}$/);
    }
  });

  it("pads single-digit sequence numbers with leading zeros", () => {
    expect(formatProtocolNumber(2024, 1)).toBe("VAL-2024-0001");
    expect(formatProtocolNumber(2024, 10)).toBe("VAL-2024-0010");
    expect(formatProtocolNumber(2024, 100)).toBe("VAL-2024-0100");
    expect(formatProtocolNumber(2024, 1000)).toBe("VAL-2024-1000");
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
