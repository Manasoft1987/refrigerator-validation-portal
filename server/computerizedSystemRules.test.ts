import { describe, expect, it } from "vitest";
import { getComputerizedSystemReleaseReadiness, getComputerizedSystemRisk } from "@shared/computerizedSystem";

describe("computerized system validation rules", () => {
  it("assigns a high risk to patient-safety and release systems", () => {
    expect(getComputerizedSystemRisk({ patientSafety: true })).toBe("Высокий");
    expect(getComputerizedSystemRisk({ releaseDecision: true })).toBe("Высокий");
  });

  it("blocks release until a critical URS has a passed test", () => {
    const base = {
      systemName: "LIMS",
      intendedUse: "Управление результатами контроля",
      screening: { gxpRecords: true },
      requirements: [{ id: "URS-001", text: "Audit trail", criticality: "high" }],
      supplierAssessment: { documentation: true, changeNotification: true, incidentManagement: true, backup: true, security: true },
      tests: [],
    };
    expect(getComputerizedSystemReleaseReadiness(base).ready).toBe(false);
    expect(getComputerizedSystemReleaseReadiness({ ...base, tests: [{ id: "TEST-001", requirementId: "URS-001", result: "pass", actual: "Соответствует", evidence: "Приложение 1" }] }).ready).toBe(true);
  });

  it("lists failed tests and missing supplier controls as blockers", () => {
    const result = getComputerizedSystemReleaseReadiness({
      systemName: "WMS",
      intendedUse: "Учёт",
      screening: { gxpRecords: true },
      requirements: [{ id: "URS-001", text: "Запись", criticality: "medium" }],
      supplierAssessment: {},
      tests: [{ id: "TEST-001", requirementId: "URS-001", result: "fail" }],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers.join(" ")).toContain("TEST-001");
    expect(result.missingSupplierControls).toHaveLength(5);
  });
});
