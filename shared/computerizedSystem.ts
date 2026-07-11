export type ComputerizedSystemRisk = "Не GxP" | "Низкий" | "Средний" | "Высокий";

export type ComputerizedSystemRequirement = {
  id: string;
  text: string;
  type?: string;
  criticality: "low" | "medium" | "high";
  acceptanceCriteria?: string;
};

export type ComputerizedSystemTest = {
  id: string;
  requirementId?: string;
  result?: "none" | "pass" | "fail";
  actual?: string;
  evidence?: string;
};

export function getComputerizedSystemRisk(screening: Record<string, unknown> = {}): ComputerizedSystemRisk {
  const s = screening;
  const isGxp = Object.values(s).some(Boolean);
  if (!isGxp) return "Не GxP";
  if (s.patientSafety || s.releaseDecision || (s.gxpRecords && s.electronicSignatures)) return "Высокий";
  if (s.productQuality || s.gxpRecords || s.calculations || s.editableRecords || s.integrations) return "Средний";
  return "Низкий";
}

export function getComputerizedSystemReleaseReadiness(config: any) {
  const screening = config?.screening || {};
  const riskLevel = getComputerizedSystemRisk(screening);
  const isGxp = riskLevel !== "Не GxP";
  const requirements: ComputerizedSystemRequirement[] = config?.requirements || [];
  const tests: ComputerizedSystemTest[] = config?.tests || [];
  const passed = new Set(tests.filter(test => test.result === "pass").map(test => test.requirementId));
  const untracedCritical = requirements.filter(requirement => requirement.criticality === "high" && !passed.has(requirement.id));
  const failedTests = tests.filter(test => test.result === "fail");
  const incompletePassedTests = tests.filter(test => test.result === "pass" && (!test.requirementId || !String(test.actual || "").trim() || !String(test.evidence || "").trim()));
  const supplier = config?.supplierAssessment || {};
  const missingSupplierControls = riskLevel === "Не GxP"
    ? []
    : ["documentation", "changeNotification", "incidentManagement", "backup", "security"].filter(key => !supplier[key]);
  const blockers: string[] = [];
  if (!String(config?.systemName || "").trim()) blockers.push("не указано наименование системы");
  if (!String(config?.intendedUse || "").trim()) blockers.push("не описано предполагаемое использование");
  if (isGxp && requirements.length === 0) blockers.push("не зарегистрированы требования URS");
  if (untracedCritical.length) blockers.push(`нет успешно выполненных тестов для критичных URS: ${untracedCritical.map(r => r.id).join(", ")}`);
  if (failedTests.length) blockers.push(`имеются непройденные тесты: ${failedTests.map(t => t.id).join(", ")}`);
  if (incompletePassedTests.length) blockers.push(`не заполнены результат или доказательство для тестов: ${incompletePassedTests.map(t => t.id).join(", ")}`);
  if (missingSupplierControls.length) blockers.push("не подтверждены обязательные средства контроля поставщика");
  return { ready: blockers.length === 0, blockers, riskLevel, isGxp, untracedCritical, failedTests, incompletePassedTests, missingSupplierControls };
}
