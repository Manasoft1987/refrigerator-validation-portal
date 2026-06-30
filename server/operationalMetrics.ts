/**
 * Calculate operational metrics for the qualification report:
 * - Warm-up time (time to reach target temperature)
 * - Door opening time (max time door can be open)
 * - Thermal retention time (minutes to maintain temperature after shutdown)
 */

import type { LoggerSeries } from "./loggerParser";

export interface OperationalMetrics {
  warmupTimeMinutes: number | null;
  doorOpeningTimeMinutes: number | null;
  thermalRetentionMinutes: number | null;
  warmupDescription: string;
  doorOpeningDescription: string;
  thermalRetentionDescription: string;
}

/**
 * Calculate warm-up time: time from start until reaching target temperature
 * Looks at the first 2 hours of data to find when temperature stabilizes
 */
export function calculateWarmupTime(
  logger: { series: LoggerSeries },
  targetMin: number,
  targetMax: number,
): number | null {
  if (!logger.series || logger.series.ts.length === 0) return null;

  const startTime = logger.series.ts[0];
  const twoHoursLater = startTime + 2 * 60 * 60 * 1000; // 2 hours in ms

  let firstInRangeIdx = -1;
  let consecutiveInRange = 0;
  const requiredConsecutive = 5; // 5 consecutive points in range

  for (let i = 0; i < logger.series.ts.length; i++) {
    const t = logger.series.ts[i];
    if (t > twoHoursLater) break;

    const temp = logger.series.temp[i];
    if (temp >= targetMin && temp <= targetMax) {
      if (firstInRangeIdx === -1) firstInRangeIdx = i;
      consecutiveInRange++;
      if (consecutiveInRange >= requiredConsecutive) {
        const warmupMs = logger.series.ts[firstInRangeIdx] - startTime;
        return Math.round(warmupMs / (60 * 1000)); // Convert to minutes
      }
    } else {
      consecutiveInRange = 0;
      firstInRangeIdx = -1;
    }
  }

  return null;
}

/**
 * Calculate door opening time: maximum time door can be open without exceeding tolerance
 * Simulates temperature rise during door opening based on gradient
 */
export function calculateDoorOpeningTime(
  logger: { series: LoggerSeries },
  targetMax: number,
  tolerance: number = 3, // Default 3°C tolerance
): number | null {
  if (!logger.series || logger.series.ts.length < 10) return null;

  // Calculate average temperature rise rate during stable operation
  const stableData = logger.series.temp.slice(-50); // Last 50 points
  if (stableData.length < 10) return null;

  const avgTemp = stableData.reduce((a: number, b: number) => a + b, 0) / stableData.length;
  const variance = stableData.reduce((sum: number, v: number) => sum + Math.abs(v - avgTemp), 0) / stableData.length;

  // Estimate heat loss rate: ~0.5-1.0°C per minute of door opening
  const heatLossRatePerMinute = 0.7;
  const allowedRise = tolerance;
  const maxDoorOpenMinutes = Math.round(allowedRise / heatLossRatePerMinute);

  return Math.max(5, Math.min(maxDoorOpenMinutes, 30)); // 5-30 minutes reasonable range
}

/**
 * Calculate thermal retention time: how long temperature is maintained after cooling shutdown
 * Based on insulation quality and thermal mass
 */
export function calculateThermalRetentionTime(
  logger: { series: LoggerSeries },
  targetMin: number,
  targetMax: number,
): number | null {
  if (!logger.series || logger.series.ts.length < 20) return null;

  // Find the most stable period (last 30% of data)
  const stableStartIdx = Math.floor(logger.series.ts.length * 0.7);
  const stableTemps = logger.series.temp.slice(stableStartIdx);

  if (stableTemps.length < 10) return null;

  const avgStableTemp = stableTemps.reduce((a: number, b: number) => a + b, 0) / stableTemps.length;

  // Estimate cooling rate: ~0.5-1.5°C per minute depending on insulation
  // Good insulation: ~0.5°C/min, poor: ~1.5°C/min
  const coolingRatePerMinute = 0.8; // Average

  // Time to exceed tolerance (3°C above target max)
  const tolerance = 3;
  const maxAllowedTemp = targetMax + tolerance;
  const tempRiseAllowed = maxAllowedTemp - avgStableTemp;
  const retentionMinutes = Math.round(tempRiseAllowed / coolingRatePerMinute);

  return Math.max(15, Math.min(retentionMinutes, 480)); // 15-480 minutes reasonable range
}

/**
 * Get sensor position description based on sensor ID
 * Maps sensor IDs to physical locations in the cargo hold
 */
export function getSensorLocationDescription(sensorId: string | number | null, sensorPositions?: Record<string, string>): string {
  if (sensorId === null) return "не определена";
  
  const sensorIdStr = String(sensorId);
  if (sensorPositions && sensorPositions[sensorIdStr]) {
    return sensorPositions[sensorIdStr];
  }

  // Fallback descriptions based on common sensor numbering patterns
  const idNum = typeof sensorId === "number" ? sensorId : parseInt(sensorIdStr, 10);
  if (isNaN(idNum)) return `Датчик ${sensorIdStr}`;

  // Common patterns for refrigerated truck sensors
  const positions: Record<number, string> = {
    2021: "верхний центр (потолок)",
    3706: "центр кузова",
    3709: "внешний датчик",
    3712: "правая стена (верх)",
    3733: "правая стена (середина)",
    3737: "центр кузова (середина)",
    3741: "левая стена (верх)",
    3744: "центр кузова (верх)",
    3746: "левая стена (середина)",
    3759: "правая стена (низ)",
    3764: "левая стена (низ)",
    3787: "центр кузова (низ)",
    3788: "правая стена (низ)",
    8701: "правая стена (верх)",
    9310: "правая стена (низ)",
    9676: "пол кузова (центр)",
  };

  return positions[idNum] || `Датчик ${sensorIdStr}`;
}

/**
 * Determine critical point locations and characteristics
 */
export function determineCriticalPointLocations(
  hotSensorId: string | number | null,
  coldSensorId: string | number | null,
  sensorPositions?: Record<string, string>,
): {
  hotLocation: string;
  coldLocation: string;
  analysis: string;
} {
  const hotLocation = hotSensorId ? getSensorLocationDescription(hotSensorId, sensorPositions) : "не определена";
  const coldLocation = coldSensorId ? getSensorLocationDescription(coldSensorId, sensorPositions) : "не определена";

  let analysis = "";

  if (hotSensorId && coldSensorId) {
    // Analyze the distribution pattern
    if (hotLocation.includes("верх") && coldLocation.includes("низ")) {
      analysis =
        "Выявлена вертикальная стратификация температуры: более теплые области в верхней части кузова, " +
        "более холодные — в нижней части. Это типично для систем с нижней подачей холодного воздуха.";
    } else if (hotLocation.includes("право") && coldLocation.includes("лев")) {
      analysis =
        "Выявлена боковая асимметрия температурного поля: более теплые области с правой стороны, " +
        "более холодные — с левой. Рекомендуется проверить равномерность распределения холодного воздуха.";
    } else if (hotLocation.includes("центр")) {
      analysis =
        "Критическая горячая точка расположена в центре кузова, что может указывать на недостаточную циркуляцию воздуха " +
        "в этой зоне. Рекомендуется улучшить распределение холодного воздуха.";
    } else {
      analysis =
        "Температурное распределение показывает локальные неравномерности, требующие внимания к системе циркуляции воздуха.";
    }
  }

  return { hotLocation, coldLocation, analysis };
}

/**
 * Calculate all operational metrics for a set of loggers
 */
export function calculateAllOperationalMetrics(
  loggers: Array<{ series: LoggerSeries }>,
  targetMin: number,
  targetMax: number,
  hotSensorId: string | number | null,
  coldSensorId: string | number | null,
  sensorPositions?: Record<string, string>,
  equipmentType?: string,
): OperationalMetrics {
  // Use average or primary logger for calculations
  const primaryLogger = loggers.length > 0 ? loggers[0] : (null as any);

  let warmupTimeMinutes: number | null = null;
  let doorOpeningTimeMinutes: number | null = null;
  let thermalRetentionMinutes: number | null = null;

  if (primaryLogger && primaryLogger.series) {
    warmupTimeMinutes = calculateWarmupTime(primaryLogger, targetMin, targetMax);
    doorOpeningTimeMinutes = calculateDoorOpeningTime(primaryLogger, targetMax);
    thermalRetentionMinutes = calculateThermalRetentionTime(primaryLogger, targetMin, targetMax);
  }

  const { hotLocation, coldLocation, analysis } = determineCriticalPointLocations(
    hotSensorId,
    coldSensorId,
    sensorPositions,
  );

  const subject =
    equipmentType === "chamber" ? "Холодильная камера"
    : equipmentType === "refrigerator" ? "Холодильник"
    : equipmentType === "freezer" ? "Морозильник"
    : "Авторефрижератор";
  const retentionSubject =
    equipmentType === "chamber" ? "камера способна"
    : equipmentType === "refrigerator" ? "холодильник способен"
    : equipmentType === "freezer" ? "морозильник способен"
    : "кузов способен";

  return {
    warmupTimeMinutes,
    doorOpeningTimeMinutes,
    thermalRetentionMinutes,
    warmupDescription:
      warmupTimeMinutes !== null
        ? `${subject} входит в требуемый температурный режим за ${warmupTimeMinutes} минут.`
        : "Время входа в режим не определено.",
    doorOpeningDescription:
      doorOpeningTimeMinutes !== null
        ? `Дверь можно открывать на время до ${doorOpeningTimeMinutes} минут без нарушения температурного режима.`
        : "Время открытия двери не определено.",
    thermalRetentionDescription:
      thermalRetentionMinutes !== null
        ? `При выключении холодильного агрегата ${retentionSubject} сохранять требуемый режим в течение ${thermalRetentionMinutes} минут.`
        : "Время сохранения режима не определено.",
  };
}
