import { describe, expect, it } from "vitest";
import { generateComputerizedSystemPdf } from "./computerizedSystemPdf";

describe("computerized system GAMP report", () => {
  it("generates a PDF with URS, tests and release decision", async () => {
    const buffer = await generateComputerizedSystemPdf({
      protocol: { number: "VAL-CS-2026-001" },
      org: { name: "ТОО Тест" },
      config: {
        systemName: "eQMS", version: "1.0", supplier: "Vendor", intendedUse: "Управление документами",
        riskLevel: "Высокий", screening: { gxpRecords: true, electronicSignatures: true },
        requirements: [{ id: "URS-001", text: "Система ведёт audit trail", criticality: "high" }],
        supplierAssessment: { sla: true, documentation: true, backup: true, security: true },
        tests: [{ id: "TEST-001", requirementId: "URS-001", steps: "Изменить запись", expected: "Событие записано", actual: "Событие записано", result: "pass" }],
        releaseDecision: "approved", periodicReviewMonths: "12",
      },
    });
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(3000);
  });
});
