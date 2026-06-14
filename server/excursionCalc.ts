/**
 * Temperature Excursion Study — calculation logic (Mode A)
 *
 * Test 1: Time to reach stable temperature (power-on)
 * Test 2: Temperature stability with open door
 * Test 3: Temperature stability after power-off
 */

export interface SensorSeries {
  label: string;
  ts: number[]; // ms epoch
  temp: number[];
  role: "internal" | "external";
}

/** Parse [lo, hi] from tempMode string like "2-8" or "8-15" */
export function parseTempRange(tempMode: string): [number, number] {
  const parts = tempMode.split("-").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  return [2, 8];
}

/** Get temperature at a given timestamp (nearest point) */
function tempAt(series: SensorSeries, ts: number): number | null {
  if (!series.ts.length) return null;
  let best = 0;
  let bestDiff = Math.abs(series.ts[0] - ts);
  for (let i = 1; i < series.ts.length; i++) {
    const d = Math.abs(series.ts[i] - ts);
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return series.temp[best];
}

/** Check if temp is within [lo, hi] */
function inRange(t: number, lo: number, hi: number): boolean {
  return t >= lo && t <= hi;
}

/* ------------------------------------------------------------------ */
/* Test 1: Power-on — time to stable temperature                      */
/* ------------------------------------------------------------------ */

export interface T1SensorEntry {
  label: string;
  tempAtOn: number | null;
  entryAt: number | null; // ms epoch, null if never entered
  durationSec: number | null;
}

export interface T1Result {
  tStableAt: number | null; // ms epoch — when last sensor stabilised
  durationSec: number | null;
  criticalSensor: string | null;
  sensorEntries: T1SensorEntry[];
  warnings: string[];
}

export function calcTest1(
  sensors: SensorSeries[],
  powerOnAt: number,
  stabilizationThresholdMinutes: number,
  tempRange: [number, number],
  stableUntilAt?: number | null,
): T1Result {
  const [lo, hi] = tempRange;
  void stabilizationThresholdMinutes;
  const internals = sensors.filter(s => s.role === "internal");
  const warnings: string[] = [];
  const entries: T1SensorEntry[] = [];
  const observationEndAt = stableUntilAt ?? Math.max(...internals.flatMap(s => s.ts), powerOnAt);

  for (const s of internals) {
    const tempAtOn = tempAt(s, powerOnAt);

    // If already in range at power-on — duration = 0, this is an info message, not an error
    const alreadyInRange = tempAtOn !== null && inRange(tempAtOn, lo, hi);

    // Find first stable entry after powerOnAt
    let entryAt: number | null = null;
    const afterOn = s.ts
      .map((t, i) => ({ t, temp: s.temp[i] }))
      .filter(p => p.t >= powerOnAt && p.t <= observationEndAt);
    const remainsInRangeAfterOn = afterOn.length > 0 && afterOn.every(p => inRange(p.temp, lo, hi));

    if (alreadyInRange && remainsInRangeAfterOn) {
      // Sensor was already in range — treat as instant stabilization (0 sec)
      entryAt = powerOnAt;
      warnings.push(
        `[INFO] Датчик ${s.label}: при включении уже находился в целевом диапазоне. Время набора температуры — 0 сек.`,
      );
    } else {
      for (let i = 0; i < afterOn.length; i++) {
        if (!inRange(afterOn[i].temp, lo, hi)) continue;
        // Check if it stays in range for threshold duration
        const windowPoints = afterOn.slice(i);
        if (windowPoints.every(p => inRange(p.temp, lo, hi))) {
          entryAt = afterOn[i].t;
          break;
        }
      }

      if (entryAt === null) {
        warnings.push(
          `Тест 1 не завершён: датчик ${s.label} не вошёл в целевой диапазон. ` +
          `Рекомендуется увеличить длительность испытания.`,
        );
      }
    }

    entries.push({
      label: s.label,
      tempAtOn,
      entryAt,
      durationSec: entryAt !== null ? Math.round((entryAt - powerOnAt) / 1000) : null,
    });
  }

  // T_stable = max(entryAt) across all internal sensors
  const validEntries = entries.filter(e => e.entryAt !== null);
  if (!validEntries.length) {
    return { tStableAt: null, durationSec: null, criticalSensor: null, sensorEntries: entries, warnings };
  }

  const critical = validEntries.reduce((a, b) => (a.entryAt! > b.entryAt! ? a : b));
  return {
    tStableAt: critical.entryAt,
    durationSec: Math.round((critical.entryAt! - powerOnAt) / 1000),
    criticalSensor: critical.label,
    sensorEntries: entries,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Test 2: Open door — time until temperature break                   */
/* ------------------------------------------------------------------ */

export interface SensorBreakEntry {
  label: string;
  tBreakAt: number | null; // null if sensor never exited range
  durationSec: number | null;
}

export interface T2Result {
  tBreakAt: number | null; // first moment ANY internal sensor exits range
  durationSec: number | null; // from door open to first break
  criticalSensor: string | null; // sensor that exited first
  noBreak: boolean; // true if no sensor exited range during door-open period
  sensorBreaks: SensorBreakEntry[]; // per-sensor break info
  warnings: string[];
}

export function calcTest2(
  sensors: SensorSeries[],
  doorOpenAt: number,
  doorCloseAt: number,
  tempRange: [number, number],
): T2Result {
  const [lo, hi] = tempRange;
  const internals = sensors.filter(s => s.role === "internal");
  const warnings: string[] = [];

  const sensorBreaks: SensorBreakEntry[] = [];
  let tBreakAt: number | null = null;
  let criticalSensor: string | null = null;

  for (const s of internals) {
    const windowPoints = s.ts
      .map((t, i) => ({ t, temp: s.temp[i] }))
      .filter(p => p.t >= doorOpenAt && p.t <= doorCloseAt);

    let sBreakAt: number | null = null;
    for (const p of windowPoints) {
      if (!inRange(p.temp, lo, hi)) {
        sBreakAt = p.t;
        break;
      }
    }

    sensorBreaks.push({
      label: s.label,
      tBreakAt: sBreakAt,
      durationSec: sBreakAt !== null ? Math.round((sBreakAt - doorOpenAt) / 1000) : null,
    });

    // Track the FIRST sensor to exit range (smallest tBreakAt)
    if (sBreakAt !== null && (tBreakAt === null || sBreakAt < tBreakAt)) {
      tBreakAt = sBreakAt;
      criticalSensor = s.label;
    }
  }

  const noBreak = tBreakAt === null;
  const doorOpenDurationSec = Math.round((doorCloseAt - doorOpenAt) / 1000);
  if (noBreak) {
    const mins = Math.round(doorOpenDurationSec / 60);
    warnings.push(
      `[INFO] Тест 2: ни один внутренний датчик не вышел за пределы целевого диапазона ` +
      `в период открытой двери. Допустимое время открытия двери — ${mins} мин (${doorOpenDurationSec} сек).`,
    );
  }

  return {
    tBreakAt,
    durationSec: noBreak ? doorOpenDurationSec : (tBreakAt !== null ? Math.round((tBreakAt - doorOpenAt) / 1000) : null),
    criticalSensor,
    noBreak,
    sensorBreaks,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Test 3: Power-off — time until temperature break                   */
/* ------------------------------------------------------------------ */

export interface T3Result {
  tBreakAt: number | null;
  durationSec: number | null;
  criticalSensor: string | null;
  noBreak: boolean;
  sensorBreaks: SensorBreakEntry[];
  warnings: string[];
}

export function calcTest3(
  sensors: SensorSeries[],
  powerOffAt: number,
  recordEndAt: number,
  tempRange: [number, number],
  testEndAt?: number,
): T3Result {
  const [lo, hi] = tempRange;
  const internals = sensors.filter(s => s.role === "internal");
  const warnings: string[] = [];

  const sensorBreaks: SensorBreakEntry[] = [];
  let tBreakAt: number | null = null;
  let criticalSensor: string | null = null;

  for (const s of internals) {
    const windowPoints = s.ts
      .map((t, i) => ({ t, temp: s.temp[i] }))
      .filter(p => p.t >= powerOffAt && p.t <= recordEndAt);

    let sBreakAt: number | null = null;
    for (const p of windowPoints) {
      if (!inRange(p.temp, lo, hi)) {
        sBreakAt = p.t;
        break;
      }
    }

    sensorBreaks.push({
      label: s.label,
      tBreakAt: sBreakAt,
      durationSec: sBreakAt !== null ? Math.round((sBreakAt - powerOffAt) / 1000) : null,
    });

    // Track the FIRST sensor to exit range (smallest tBreakAt)
    if (sBreakAt !== null && (tBreakAt === null || sBreakAt < tBreakAt)) {
      tBreakAt = sBreakAt;
      criticalSensor = s.label;
    }
  }

  const noBreak = tBreakAt === null;
  // When no break occurred, compute observation duration from power-off to testEndAt (if provided)
  const observationDurationSec =
    noBreak && testEndAt != null
      ? Math.round((testEndAt - powerOffAt) / 1000)
      : tBreakAt !== null
        ? Math.round((tBreakAt - powerOffAt) / 1000)
        : null;

  if (noBreak) {
    if (testEndAt != null) {
      warnings.push(
        `[INFO] Тест 3: ни один внутренний датчик не вышел за пределы целевого диапазона ` +
        `после отключения питания. Время сохранения температуры — ${Math.round((testEndAt - powerOffAt) / 60000)} мин.`,
      );
    } else {
      warnings.push(
        `[INFO] Тест 3: ни один внутренний датчик не вышел за пределы целевого диапазона ` +
        `после отключения питания. Укажите время завершения испытания для расчёта времени сохранения.`,
      );
    }
  }

  return {
    tBreakAt,
    durationSec: observationDurationSec,
    criticalSensor,
    noBreak,
    sensorBreaks,
    warnings,
  };
}

/** Format seconds as "X ч Y мин" */
export function formatDuration(sec: number | null): string {
  if (sec === null) return "не определено";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h} ч ${m} мин`;
}
