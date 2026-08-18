export type CriticalDeviation = {
  durationMs: number;
  value: number;
  type: "high" | "low";
};

export type CriticalLoggerInput = {
  role?: string | null;
  min?: number | string | null;
  max?: number | string | null;
  avg?: number | string | null;
  mkt?: number | string | null;
  deviations?: CriticalDeviation[] | null;
};

function finiteMetric(value: number | string | null | undefined, fallback = 0): number {
  const numeric = typeof value === "string" ? Number(value) : value;
  return numeric == null || !Number.isFinite(numeric) ? fallback : numeric;
}

function hasAnyMetric(logger: CriticalLoggerInput): boolean {
  return [logger.min, logger.max, logger.avg, logger.mkt].some(value => {
    const numeric = typeof value === "string" ? Number(value) : value;
    return numeric != null && Number.isFinite(numeric);
  });
}

function compareMetricTuples(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (Math.abs(diff) > 1e-9) return diff;
  }
  return 0;
}

export function criticalLoggerScore(logger: CriticalLoggerInput, kind: "hot" | "cold"): number[] {
  const deviations = logger.deviations ?? [];
  const relevantDeviations = deviations.filter(dev => (
    kind === "hot" ? dev.type === "high" : dev.type === "low"
  ));
  const deviationDurationMs = relevantDeviations.reduce((sum, dev) => sum + Math.max(0, dev.durationMs), 0);
  const deviationWorstValue = relevantDeviations.reduce((best, dev) => {
    if (kind === "hot") return Math.max(best, finiteMetric(dev.value, -Infinity));
    return Math.max(best, -finiteMetric(dev.value, Infinity));
  }, relevantDeviations.length > 0 ? -Infinity : 0);
  const avg = finiteMetric(logger.avg);
  const mkt = finiteMetric(logger.mkt, avg);
  const max = finiteMetric(logger.max, avg);
  const min = finiteMetric(logger.min, avg);

  if (kind === "hot") {
    return [
      relevantDeviations.length > 0 ? 1 : 0,
      deviationDurationMs,
      deviationWorstValue,
      max,
      mkt,
      avg,
    ];
  }

  return [
    relevantDeviations.length > 0 ? 1 : 0,
    deviationDurationMs,
    deviationWorstValue,
    -min,
    -avg,
  ];
}

export function pickCriticalLoggerIndex(loggers: CriticalLoggerInput[], kind: "hot" | "cold"): number | null {
  let bestIndex: number | null = null;
  let bestScore: number[] | null = null;

  loggers.forEach((logger, index) => {
    if (logger.role !== "internal" || !hasAnyMetric(logger)) return;
    const score = criticalLoggerScore(logger, kind);
    if (!bestScore || compareMetricTuples(score, bestScore) > 0) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestIndex;
}

export function calculateCriticalLoggerIndices(loggers: CriticalLoggerInput[]): {
  hotIdx: number | null;
  coldIdx: number | null;
} {
  return {
    hotIdx: pickCriticalLoggerIndex(loggers, "hot"),
    coldIdx: pickCriticalLoggerIndex(loggers, "cold"),
  };
}
