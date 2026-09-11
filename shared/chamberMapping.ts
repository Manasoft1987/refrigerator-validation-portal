/** The chamber's single placement/scene model, used by both the portal and PDF.
 * Coordinates describe the working storage volume, not the metal enclosure.
 * Existing C/W/V position IDs are retained; no automatic reassignment is made.
 */
export const CHAMBER_INTERNAL_COUNT = 15;
export const CHAMBER_POSITIONS = [
  { id: "C1", name: "Передний левый, нижний", x: 0, y: 0, z: 0 },
  { id: "C2", name: "Передний правый, нижний", x: 1, y: 0, z: 0 },
  { id: "C3", name: "Задний правый, нижний", x: 1, y: 1, z: 0 },
  { id: "C4", name: "Задний левый, нижний", x: 0, y: 1, z: 0 },
  { id: "C5", name: "Передний левый, верхний", x: 0, y: 0, z: 1 },
  { id: "C6", name: "Передний правый, верхний", x: 1, y: 0, z: 1 },
  { id: "C7", name: "Задний правый, верхний", x: 1, y: 1, z: 1 },
  { id: "C8", name: "Задний левый, верхний", x: 0, y: 1, z: 1 },
  { id: "W1", name: "Передняя грань, средний", x: 0.5, y: 0, z: 0.5 },
  { id: "W2", name: "Задняя грань, средний", x: 0.5, y: 1, z: 0.5 },
  { id: "W3", name: "Левая грань, средний", x: 0, y: 0.5, z: 0.5 },
  { id: "W4", name: "Правая грань, средний", x: 1, y: 0.5, z: 0.5 },
  { id: "V1", name: "Центр нижней грани", x: 0.5, y: 0.5, z: 0 },
  { id: "V2", name: "Центр рабочего объёма", x: 0.5, y: 0.5, z: 0.5 },
  { id: "V3", name: "Центр верхней грани", x: 0.5, y: 0.5, z: 1 },
] as const;

export type ChamberLogger = {
  id?: number;
  label: string;
  customName?: string | null;
  role: string;
  position?: string | null;
  avg?: number | string | null;
};
export type ChamberMode = "plan" | "actual" | "temperature";
export type ChamberFeatures = {
  door?: string;
  cooling?: string;
  cooling2?: string;
  racks?: string;
};
export function chamberFeatures(
  objects?: Array<{ id: string; label: string }> | null
): ChamberFeatures {
  return Object.fromEntries(
    ["door", "cooling", "cooling2", "racks"].map(key => [
      key,
      objects?.find(o => o.id === `chamber-${key}`)?.label || "none",
    ])
  );
}
export const chamberShortId = (value: string) => value.trim().slice(-4);
export function chamberPlacementIssues(loggers: ChamberLogger[]): string[] {
  const internal = loggers.filter(l => l.role === "internal");
  const ids = new Set<string>(CHAMBER_POSITIONS.map(p => p.id));
  const occupied = internal
    .map(l => l.position)
    .filter((p): p is string => !!p && ids.has(p));
  const issues: string[] = [];
  if (internal.length < 15)
    issues.push(
      `Внутренних регистраторов ${internal.length}; план предусматривает не менее 15.`
    );
  const missing = CHAMBER_POSITIONS.filter(p => !occupied.includes(p.id));
  if (missing.length)
    issues.push(`Не назначены точки: ${missing.map(p => p.id).join(", ")}.`);
  if (new Set(occupied).size !== occupied.length)
    issues.push(
      "Несколько регистраторов назначены в одну точку; проверьте расстановку."
    );
  if (internal.some(l => !l.position || !ids.has(l.position)))
    issues.push(
      "Есть внутренние регистраторы без подтверждённой позиции в схеме 15 точек."
    );
  if (!loggers.some(l => l.role === "external"))
    issues.push(
      "Не назначен внешний регистратор температуры окружающей среды."
    );
  return issues;
}

/** Same metrological gate in the portal analysis and the generated report. */
export function chamberMetrologyIssues(
  loggers: ChamberLogger[],
  sensors: Array<{
    number: string;
    calibrationDate?: string | Date | null;
    nextCalibrationDate?: string | Date | null;
    accuracyC?: string | number | null;
  }>,
  referenceDate: string | Date,
  defaultAccuracy = 0.2
): string[] {
  const day = (v: string | Date | null | undefined) => {
    if (!v) return NaN;
    const d = new Date(v);
    return Number.isFinite(d.getTime())
      ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      : NaN;
  };
  const reference = day(referenceDate);
  const norm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return loggers.flatMap(logger => {
    const key = norm(logger.label),
      name = norm(logger.customName || "");
    const matches = sensors.filter(
      sensor =>
        key === norm(sensor.number) ||
        name === norm(sensor.number) ||
        (key.includes(norm(sensor.number)) && norm(sensor.number).length > 4)
    );
    const sensor = matches.length === 1 ? matches[0] : null;
    if (
      !sensor ||
      !Number.isFinite(reference) ||
      !Number.isFinite(day(sensor.calibrationDate)) ||
      day(sensor.calibrationDate) > reference ||
      !Number.isFinite(day(sensor.nextCalibrationDate)) ||
      day(sensor.nextCalibrationDate) < reference
    )
      return [
        `Регистратор ${logger.label}: метрологическая пригодность на дату испытания не подтверждена.`,
      ];
    const accuracy =
      sensor.accuracyC == null
        ? defaultAccuracy
        : Number(String(sensor.accuracyC).replace(",", "."));
    return !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 0.5
      ? [
          `Регистратор ${logger.label}: погрешность должна быть подтверждена и не превышать ±0,5 °C.`,
        ]
      : [];
  });
}

type Point = [number, number];
export type ChamberPrimitive =
  | {
      kind: "poly";
      points: Point[];
      fill: string;
      stroke?: string;
      opacity?: number;
    }
  | {
      kind: "line";
      points: Point[];
      stroke: string;
      width?: number;
      dash?: boolean;
    }
  | {
      kind: "circle";
      x: number;
      y: number;
      r: number;
      fill: string;
      stroke: string;
      width?: number;
      position?: string;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      bold?: boolean;
    };
export const CHAMBER_VIEW = { width: 900, height: 930 };
export function chamberProject(x: number, y: number, z: number): Point {
  // Enlarged, elongated cutaway rather than a cube. Only the illustration's
  // projection changes: persisted positions and interpolation remain untouched.
  return [260 + 520 * x - 130 * y, 650 - 135 * x - 115 * y - 280 * z];
}
const palette = [
  [29, 78, 216],
  [0, 174, 239],
  [16, 185, 129],
  [250, 204, 21],
  [249, 115, 22],
  [220, 38, 38],
];
export function chamberTemperatureColor(t: number): string {
  const u = Math.max(0, Math.min(1, t)) * (palette.length - 1);
  const a = Math.min(palette.length - 2, Math.floor(u)),
    f = u - a;
  return (
    "#" +
    palette[a]
      .map((v, c) =>
        Math.round(v + (palette[a + 1][c] - v) * f)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}
export function chamberSamples(loggers: ChamberLogger[]) {
  return loggers.flatMap(l => {
    const pos = CHAMBER_POSITIONS.find(p => p.id === l.position);
    const avg = l.avg == null || l.avg === "" ? NaN : Number(l.avg);
    return l.role === "internal" && pos && Number.isFinite(avg)
      ? [{ ...pos, avg }]
      : [];
  });
}
export function chamberInterpolate(
  samples: ReturnType<typeof chamberSamples>,
  x: number,
  y: number,
  z: number
): number | null {
  let sum = 0,
    weights = 0;
  for (const p of samples) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2;
    if (d2 < 1e-12) return p.avg;
    const w = 1 / (d2 * d2);
    sum += p.avg * w;
    weights += w;
  }
  return weights ? sum / weights : null;
}

export function buildChamberScene(
  loggers: ChamberLogger[],
  mode: ChamberMode,
  hotLabel?: string | null,
  coldLabel?: string | null,
  heights?: Record<string, string>,
  features: ChamberFeatures = {}
): ChamberPrimitive[] {
  const out: ChamberPrimitive[] = [];
  const text = (
    x: number,
    y: number,
    value: string,
    size = 16,
    color = "#0f172a",
    bold = false
  ) => out.push({ kind: "text", x, y, text: value, size, color, bold });
  const poly = (
    coords: number[][],
    fill: string,
    opacity = 1,
    stroke?: string
  ) =>
    out.push({
      kind: "poly",
      points: coords.map(p => chamberProject(p[0], p[1], p[2])),
      fill,
      opacity,
      stroke,
    });
  // Open-front technical cutaway: back/side shell and floor.
  poly(
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    "#e2e8f0",
    1,
    "#94a3b8"
  );
  poly(
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [0, 1, 1],
    ],
    "#eff6ff",
    1,
    "#94a3b8"
  );
  poly(
    [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    "#dbeafe",
    0.75,
    "#94a3b8"
  );
  const samples = chamberSamples(loggers);
  const values = samples.map(p => p.avg);
  const lo = values.length ? Math.min(...values) : 0,
    hi = values.length ? Math.max(...values) : 0;
  // Three horizontal slices of a common 3D field. Coordinates are measurement
  // points; marker label offsets below never affect interpolation.
  for (const z of [0, 0.5, 1]) {
    if (mode === "temperature" && samples.length) {
      const n = 28;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const avg = chamberInterpolate(
            samples,
            (i + 0.5) / n,
            (j + 0.5) / n,
            z
          )!;
          poly(
            [
              [i / n, j / n, z],
              [(i + 1) / n, j / n, z],
              [(i + 1) / n, (j + 1) / n, z],
              [i / n, (j + 1) / n, z],
            ],
            chamberTemperatureColor(hi === lo ? 0.5 : (avg - lo) / (hi - lo)),
            0.86
          );
        }
    }
    out.push({
      kind: "line",
      points: [
        [0, 0, z],
        [1, 0, z],
        [1, 1, z],
        [0, 1, z],
        [0, 0, z],
      ].map(p => chamberProject(p[0], p[1], p[2])),
      stroke: "#64748b",
      width: 1.5,
      dash: z === 0.5,
    });
  }
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ])
    out.push({
      kind: "line",
      points: [chamberProject(x, y, 0), chamberProject(x, y, 1)],
      stroke: "#64748b",
      width: 1.5,
    });
  // Features are drawn only when the user has confirmed their location.
  // They share the same projection as the logger positions and the PDF.
  const faces: Record<string, [number, number]> = {
    front: [0.5, 0],
    back: [0.5, 1],
    left: [0, 0.5],
    right: [1, 0.5],
  };
  const featureNames = {
    door: "Дверь",
    cooling: "Испаритель 1",
    cooling2: "Испаритель 2",
  };
  (["door", "cooling", "cooling2"] as const).forEach((key, i) => {
    const face = faces[features[key] || ""];
    if (!face) return;
    const pt = chamberProject(face[0], face[1], key === "door" ? 0.25 : 0.8),
      cx = 200 + i * 250,
      cy = 62;
    out.push({
      kind: "line",
      points: [[cx, cy + 19], pt],
      stroke: "#6366f1",
      width: 1.5,
      dash: true,
    });
    out.push({
      kind: "circle",
      x: pt[0],
      y: pt[1],
      r: 6,
      fill: "#6366f1",
      stroke: "#ffffff",
      width: 2,
    });
    out.push({
      kind: "poly",
      points: [
        [cx - 65, cy - 19],
        [cx + 65, cy - 19],
        [cx + 65, cy + 19],
        [cx - 65, cy + 19],
      ],
      fill: "#eef2ff",
      stroke: "#a5b4fc",
    });
    text(cx, cy - 9, featureNames[key], 14, "#3730a3", true);
  });
  if (features.racks && features.racks !== "none") {
    const sides =
      features.racks === "both"
        ? [0.12, 0.88]
        : features.racks === "left"
          ? [0.12]
          : features.racks === "right"
            ? [0.88]
            : [];
    for (const x of sides)
      for (const z of [0.1, 0.5, 0.9])
        out.push({
          kind: "line",
          points: [
            [x - 0.08, 0.15, z],
            [x + 0.08, 0.15, z],
            [x + 0.08, 0.85, z],
            [x - 0.08, 0.85, z],
            [x - 0.08, 0.15, z],
          ].map(p => chamberProject(p[0], p[1], p[2])),
          stroke: "#475569",
          width: 1.2,
        });
  }
  text(455, 740, "Открытая передняя сторона · рабочий объём", 17, "#475569");
  // Label displacements keep IDs/averages readable and leave true locations fixed.
  const offsets: Record<string, Point> = {
    C1: [-25, 24],
    C2: [40, 14],
    C3: [150, -5],
    C4: [-35, 10],
    C5: [-65, -10],
    C6: [38, -4],
    C7: [15, -10],
    C8: [-38, -6],
    W1: [25, 28],
    W2: [-10, -15],
    W3: [-30, 0],
    W4: [35, 0],
    V1: [0, 32],
    V2: [0, 20],
    V3: [0, -12],
  };
  const annotations: ChamberPrimitive[] = [];
  const labelText = (
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    bold = true
  ) => annotations.push({ kind: "text", x, y, text: value, size, color, bold });
  for (const pos of CHAMBER_POSITIONS) {
    const logger = loggers.find(
      l => l.role === "internal" && l.position === pos.id
    );
    const [px, py] = chamberProject(pos.x, pos.y, pos.z),
      [dx, dy] = offsets[pos.id];
    const x = px + dx,
      y = py + dy;
    out.push({
      kind: "line",
      points: [
        [x, y],
        [px, py],
      ],
      stroke: "#334155",
      width: 1.4,
    });
    out.push({
      kind: "circle",
      x: px,
      y: py,
      r: 3,
      fill: "#0f172a",
      stroke: "#ffffff",
    });
    const avg =
      logger?.avg == null || logger.avg === "" ? NaN : Number(logger.avg);
    const color =
      mode === "temperature" && Number.isFinite(avg)
        ? chamberTemperatureColor(hi === lo ? 0.5 : (avg - lo) / (hi - lo))
        : logger || mode === "plan"
          ? "#0284c7"
          : "#94a3b8";
    if (
      mode === "temperature" &&
      logger &&
      (logger.label === hotLabel || logger.label === coldLabel)
    ) {
      annotations.push({
        kind: "circle",
        x,
        y,
        r: 25,
        fill: "#ffffff",
        stroke: logger.label === hotLabel ? "#ef4444" : "#2563eb",
        width: 4,
      });
      annotations.push({
        kind: "circle",
        x: x + 27,
        y: y - 27,
        r: 11,
        fill: "#ffffff",
        stroke: logger.label === hotLabel ? "#dc2626" : "#1d4ed8",
        width: 1.5,
      });
      labelText(
        x + 27,
        y - 35,
        logger.label === hotLabel ? "Г" : "Х",
        16,
        logger.label === hotLabel ? "#dc2626" : "#1d4ed8"
      );
    }
    annotations.push({
      kind: "circle",
      x,
      y,
      r: 20,
      fill: mode === "plan" || !logger ? "#ffffff" : color,
      stroke: color,
      width: 2.5,
      position: pos.id,
    });
    const brightness = [1, 3, 5].reduce(
      (sum, start, i) =>
        sum +
        parseInt(color.slice(start, start + 2), 16) * [0.299, 0.587, 0.114][i],
      0
    );
    labelText(
      x,
      y - 8,
      mode === "plan" ? pos.id : logger ? chamberShortId(logger.label) : pos.id,
      15,
      mode === "plan" || !logger
        ? "#0369a1"
        : brightness > 155
          ? "#0f172a"
          : "#ffffff"
    );
    if (mode === "temperature" && Number.isFinite(avg)) {
      annotations.push({
        kind: "poly",
        points: [
          [x - 42, y + 24],
          [x + 42, y + 24],
          [x + 42, y + 43],
          [x - 42, y + 43],
        ],
        fill: "#ffffff",
        opacity: 0.94,
      });
      labelText(
        x,
        y + 25,
        `(${avg.toFixed(1).replace(".", ",")} °C)`,
        15,
        "#0f172a"
      );
    } else if (mode !== "temperature" && heights?.[String(pos.z)]) {
      annotations.push({
        kind: "poly",
        points: [
          [x - 42, y + 24],
          [x + 42, y + 24],
          [x + 42, y + 43],
          [x - 42, y + 43],
        ],
        fill: "#ffffff",
        opacity: 0.94,
      });
      labelText(x, y + 25, heights[String(pos.z)], 14, "#334155");
    }
  }
  out.push(...annotations);
  text(
    450,
    12,
    "ХОЛОДИЛЬНАЯ КАМЕРА · 15 ВНУТРЕННИХ ТОЧЕК",
    18,
    "#0f172a",
    true
  );
  const external = loggers.filter(l => l.role === "external");
  text(
    450,
    780,
    mode === "plan"
      ? "EXT · 1 внешний регистратор рядом с камерой"
      : `EXT · ${external.length ? external.map(l => chamberShortId(l.label)).join(", ") : "не назначен"} · среда вокруг камеры`,
    16,
    "#475569"
  );
  if (mode === "temperature" && values.length) {
    for (let i = 0; i < 100; i++)
      out.push({
        kind: "poly",
        points: [
          [250 + i * 4, 823],
          [254 + i * 4, 823],
          [254 + i * 4, 837],
          [250 + i * 4, 837],
        ],
        fill: chamberTemperatureColor(i / 99),
      });
    text(250, 850, `${lo.toFixed(1)} °C`, 15);
    text(650, 850, `${hi.toFixed(1)} °C`, 15);
    text(
      450,
      885,
      "Цвет — средняя температура; Г / Х — критические точки",
      14,
      "#475569"
    );
  } else
    text(
      450,
      835,
      "C — углы · W — центры стенок · V — центральная вертикаль",
      16,
      "#475569"
    );
  return out;
}
