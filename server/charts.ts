/**
 * Pure-PDFKit vector chart renderer — no native dependencies.
 *
 * Rather than rasterising with Chart.js + node-canvas (which requires a native
 * build of `canvas` that is not available in the production container), we draw
 * temperature plots as native PDF vector graphics. The output is sharper,
 * smaller, searchable, and free of native compile issues.
 *
 * All exported `drawXxxChart` functions render onto a PDFKit document at its
 * current cursor (`doc.y`) and advance the cursor by `height + spacing`.
 */

export type Series = {
  name: string;
  ts: number[];
  temp: number[];
  color?: string;
};

const ACCENT_PALETTE = [
  "#0f172a", "#1e3a8a", "#1e40af", "#155e75", "#0f766e",
  "#15803d", "#a16207", "#b45309", "#9d174d", "#7e22ce",
  "#312e81", "#374151", "#0e7490", "#166534", "#92400e",
  "#9f1239", "#5b21b6", "#1e293b", "#075985", "#3f6212",
];

const HOT_COLOR = "#dc2626";
const COLD_COLOR = "#2563eb";
const BAND_FILL = "#ecfdf5";
const BAND_LINE = "#10b981";
const AXIS_LINE = "#cbd5e1";
const GRID_LINE = "#eef2f7";
const LABEL_COLOR = "#475569";
const TITLE_COLOR = "#0f172a";

function fmtTime(ms: number): string {
  const d = new Date(ms);
  // Format using UTC accessors so the chart matches the wall-clock from the source file.
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function niceStep(range: number, targetTicks = 6): number {
  if (range <= 0) return 1;
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * pow;
}

function tempRange(series: Series[], rangeMin: number, rangeMax: number) {
  let lo = rangeMin;
  let hi = rangeMax;
  for (const s of series) {
    for (const v of s.temp) {
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  // Pad 5% on each side
  const pad = Math.max(0.5, (hi - lo) * 0.08);
  return { lo: lo - pad, hi: hi + pad };
}

function ensureSpace(doc: any, h: number) {
  if (doc.y + h > doc.page.height - 72) {
    doc.addPage();
  }
}

/**
 * Renders an elegant line chart onto the PDF document.
 */
export type EventMarker = {
  ts: number;
  label: string;
  color: string;
};

function drawLineChart(
  doc: any,
  opts: {
    title: string;
    series: Series[];
    rangeMin: number;
    rangeMax: number;
    height?: number;
    showLegend?: boolean;
    eventMarkers?: EventMarker[];
  },
): void {
  const {
    title,
    series,
    rangeMin,
    rangeMax,
    height = 260,
    showLegend = true,
    eventMarkers = [],
  } = opts;

  const marginLeft = 56;
  const marginRight = 56;
  const x0 = marginLeft;
  const pageWidth = doc.page.width - marginLeft - marginRight;

  ensureSpace(doc, height + 20);
  const startY = doc.y;

  // Title
  doc.font("bold").fontSize(11).fillColor(TITLE_COLOR).text(title, x0, startY, {
    width: pageWidth,
    align: "left",
  });

  // Top padding gives space for chart title (top) AND event-marker label pills below it.
  // Each stacking level needs ~14pt; reserve 2 levels (28pt) plus 18pt base + 18pt title gap = 64pt.
  const plotTopPad = eventMarkers.length > 0 ? 64 : 18;
  const plotTop = startY + plotTopPad;
  const plotLeftPad = 42; // space for Y labels
  const plotBottomPad = showLegend ? 34 : 18; // space for X labels + legend
  const plotRightPad = 14;
  const plotWidth = pageWidth - plotLeftPad - plotRightPad;
  const plotHeight = height - plotTopPad - plotBottomPad;
  const plotLeft = x0 + plotLeftPad;
  const plotRight = plotLeft + plotWidth;
  const plotBottom = plotTop + plotHeight;

  // Determine time domain
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const s of series) {
    for (const t of s.ts) {
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin === tMax) {
    tMin = Date.now() - 3600_000;
    tMax = Date.now();
  }

  // Temperature domain
  const { lo, hi } = tempRange(series, rangeMin, rangeMax);

  const xFor = (t: number) =>
    plotLeft + ((t - tMin) / (tMax - tMin || 1)) * plotWidth;
  const yFor = (v: number) =>
    plotBottom - ((v - lo) / (hi - lo || 1)) * plotHeight;

  // Acceptance band
  const bandTop = yFor(rangeMax);
  const bandBottom = yFor(rangeMin);
  const bandY = Math.min(bandTop, bandBottom);
  const bandH = Math.abs(bandBottom - bandTop);
  doc.save();
  doc.rect(plotLeft, bandY, plotWidth, bandH).fill(BAND_FILL);
  doc.restore();

  // Y gridlines + labels
  const yStep = niceStep(hi - lo, 5);
  const yStart = Math.ceil(lo / yStep) * yStep;
  doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
  for (let v = yStart; v <= hi; v += yStep) {
    const y = yFor(v);
    doc.save();
    doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(plotLeft, y).lineTo(plotRight, y).stroke();
    doc.restore();
    doc.fillColor(LABEL_COLOR).text(
      v.toFixed(Math.abs(yStep) < 1 ? 1 : 0) + " °C",
      x0,
      y - 4,
      { width: plotLeftPad - 6, align: "right" },
    );
  }

  // X axis ticks (6 ticks)
  const xTicks = 6;
  for (let i = 0; i <= xTicks; i++) {
    const t = tMin + ((tMax - tMin) * i) / xTicks;
    const x = xFor(t);
    doc.save();
    doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(x, plotTop).lineTo(x, plotBottom).stroke();
    doc.restore();
    const label = fmtTime(t);
    doc.fillColor(LABEL_COLOR).fontSize(7).text(label, x - 26, plotBottom + 4, {
      width: 52,
      align: "center",
    });
  }

  // Plot border
  doc.save();
  doc.lineWidth(0.7).strokeColor(AXIS_LINE).rect(plotLeft, plotTop, plotWidth, plotHeight).stroke();
  doc.restore();

  // Acceptance band outline
  doc.save();
  doc
    .lineWidth(0.7)
    .dash(3, { space: 3 })
    .strokeColor(BAND_LINE)
    .moveTo(plotLeft, yFor(rangeMax))
    .lineTo(plotRight, yFor(rangeMax))
    .stroke()
    .moveTo(plotLeft, yFor(rangeMin))
    .lineTo(plotRight, yFor(rangeMin))
    .stroke();
  doc.undash();
  doc.restore();

  // Draw series
  series.forEach((s, i) => {
    const color = s.color || ACCENT_PALETTE[i % ACCENT_PALETTE.length];
    if (s.ts.length < 2) return;
    // Downsample
    const maxPts = 700;
    const step = Math.max(1, Math.ceil(s.ts.length / maxPts));

    doc.save();
    doc.lineWidth(0.9).strokeColor(color);
    let started = false;
    for (let k = 0; k < s.ts.length; k += step) {
      const x = xFor(s.ts[k]);
      const y = yFor(s.temp[k]);
      if (!Number.isFinite(y)) continue;
      if (!started) {
        doc.moveTo(x, y);
        started = true;
      } else {
        doc.lineTo(x, y);
      }
    }
    // Ensure last point
    const last = s.ts.length - 1;
    if (last > 0 && (last % step) !== 0) {
      const x = xFor(s.ts[last]);
      const y = yFor(s.temp[last]);
      if (Number.isFinite(y)) doc.lineTo(x, y);
    }
    if (started) doc.stroke();
    doc.restore();
  });

  // Event markers (vertical dashed lines with labels)
  if (eventMarkers.length > 0) {
    const placedLabels: Array<{ lx: number; lw: number; level: number }> = [];
    for (const m of eventMarkers) {
      if (m.ts < tMin || m.ts > tMax) continue;
      const x = xFor(m.ts);
      doc.save();
      doc.lineWidth(1.2).dash(4, { space: 3 }).strokeColor(m.color);
      doc.moveTo(x, plotTop).lineTo(x, plotBottom).stroke();
      doc.undash();
      doc.restore();
      // Compute label box (will be drawn after collision-detection pass)
      doc.font("body").fontSize(7);
      const lw = doc.widthOfString(m.label) + 8;
      const lh = 12;
      const lx = Math.min(Math.max(x - lw / 2, plotLeft), plotRight - lw);
      // Stack vertically if this label's x-rect overlaps a previously placed label
      let level = 0;
      // Find the smallest level where no horizontal overlap with placed labels
      while (placedLabels.some(p => p.level === level && lx < p.lx + p.lw && lx + lw > p.lx)) {
        level++;
      }
      placedLabels.push({ lx, lw, level });
      const ly = plotTop - 15 - level * (lh + 2);
      doc.save();
      // White background pill
      doc.fillColor("white").roundedRect(lx - 1, ly - 1, lw + 2, lh + 2, 2).fill();
      // Colored border
      doc.lineWidth(0.5).strokeColor(m.color).roundedRect(lx - 1, ly - 1, lw + 2, lh + 2, 2).stroke();
      // Label text
      doc.fillColor(m.color).text(m.label, lx + 2, ly + 1, { width: lw, lineBreak: false });
      doc.restore();
    }
  }

  // Legend (multi-row support)
  if (showLegend) {
    let legendY = plotBottom + 18;
    let lx = plotLeft;
    doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
    const entries = [
      ...series.map((s, i) => ({
        name: s.name,
        color: s.color || ACCENT_PALETTE[i % ACCENT_PALETTE.length],
      })),
      { name: `Диапазон ${rangeMin}…${rangeMax} °C`, color: BAND_LINE },
    ];
    let legendRowCount = 1;
    for (const e of entries) {
      const textWidth = doc.widthOfString(e.name);
      const entryWidth = 10 + 4 + textWidth + 12;
      // If entry doesn't fit in current row, wrap to next row
      if (lx + entryWidth > plotRight && lx > plotLeft) {
        legendY += 14; // Move to next row
        lx = plotLeft;
        legendRowCount++;
      }
      // Draw legend entry (color box + text)
      doc.save();
      doc.rect(lx, legendY + 1, 10, 6).fill(e.color);
      doc.restore();
      doc.fillColor(LABEL_COLOR).text(e.name, lx + 14, legendY - 1, {
        width: textWidth + 2,
        lineBreak: false,
      });
      lx += entryWidth;
    }
    // Adjust doc.y to account for multi-row legend
    doc.y = plotBottom + 18 + legendRowCount * 14;
  } else {
    doc.y = startY + height + 8;
  }
  doc.fillColor("#000000");
}

/**
 * Horizontal bar chart used for "heatmap" view.
 */
function drawHorizontalBarChart(
  doc: any,
  opts: {
    title: string;
    rows: Array<{ name: string; value: number; color: string }>;
    valueUnit: string;
    height?: number;
  },
): void {
  const { title, rows, valueUnit, height = 260 } = opts;
  const marginLeft = 56;
  const marginRight = 56;
  const x0 = marginLeft;
  const pageWidth = doc.page.width - marginLeft - marginRight;

  ensureSpace(doc, height + 20);
  const startY = doc.y;

  doc.font("bold").fontSize(11).fillColor(TITLE_COLOR).text(title, x0, startY, {
    width: pageWidth,
    align: "left",
  });

  const plotTop = startY + 18;
  const labelWidth = 110;
  const plotLeftPad = labelWidth + 6;
  const plotRightPad = 40;
  const plotWidth = pageWidth - plotLeftPad - plotRightPad;
  const plotHeight = height - 18 - 18;
  const plotLeft = x0 + plotLeftPad;
  const plotBottom = plotTop + plotHeight;

  const vals = rows.map(r => r.value).filter(v => Number.isFinite(v));
  const vMin = Math.min(...vals, 0);
  const vMax = Math.max(...vals, 1);
  const span = vMax - vMin || 1;

  const rowH = Math.min(24, plotHeight / Math.max(1, rows.length));
  const gap = 4;

  rows.forEach((r, i) => {
    const y = plotTop + i * (rowH + gap);
    // Label
    doc.font("body").fontSize(9).fillColor(LABEL_COLOR).text(r.name, x0, y + (rowH - 10) / 2, {
      width: labelWidth,
      align: "right",
      lineBreak: false,
    });
    // Bar background
    doc.save();
    doc.rect(plotLeft, y, plotWidth, rowH).fill("#f1f5f9");
    doc.restore();
    // Bar
    const w = Math.max(2, ((r.value - vMin) / span) * plotWidth);
    doc.save();
    doc.rect(plotLeft, y, w, rowH).fill(r.color);
    doc.restore();
    // Value label
    doc
      .font("bold")
      .fontSize(9)
      .fillColor(TITLE_COLOR)
      .text(
        `${r.value.toFixed(2)} ${valueUnit}`,
        plotLeft + w + 4,
        y + (rowH - 10) / 2,
        { lineBreak: false },
      );
  });

  // Axis line
  doc.save();
  doc.lineWidth(0.5).strokeColor(AXIS_LINE).moveTo(plotLeft, plotBottom).lineTo(plotLeft + plotWidth, plotBottom).stroke();
  doc.restore();

  doc.y = startY + height + 8;
  doc.fillColor("#000000");
}

/**
 * Grouped vertical bar chart for min/avg/max/MKT across sensors.
 */
function drawGroupedBarChart(
  doc: any,
  opts: {
    title: string;
    labels: string[];
    groups: Array<{ label: string; color: string; data: number[] }>;
    valueUnit: string;
    height?: number;
  },
): void {
  const { title, labels, groups, valueUnit, height = 280 } = opts;
  const marginLeft = 56;
  const marginRight = 56;
  const x0 = marginLeft;
  const pageWidth = doc.page.width - marginLeft - marginRight;

  ensureSpace(doc, height + 20);
  const startY = doc.y;

  doc.font("bold").fontSize(11).fillColor(TITLE_COLOR).text(title, x0, startY, {
    width: pageWidth,
    align: "left",
  });

  const plotTop = startY + 18;
  const plotLeftPad = 40;
  const plotRightPad = 14;
  const plotBottomPad = 42;
  const plotWidth = pageWidth - plotLeftPad - plotRightPad;
  const plotHeight = height - 18 - plotBottomPad;
  const plotLeft = x0 + plotLeftPad;
  const plotRight = plotLeft + plotWidth;
  const plotBottom = plotTop + plotHeight;

  const allValues: number[] = [];
  groups.forEach(g => g.data.forEach(v => { if (Number.isFinite(v)) allValues.push(v); }));
  const vMin = Math.min(...allValues, 0);
  const vMax = Math.max(...allValues, 1);
  const pad = (vMax - vMin) * 0.1 || 0.5;
  const lo = vMin - pad;
  const hi = vMax + pad;

  const yFor = (v: number) =>
    plotBottom - ((v - lo) / (hi - lo || 1)) * plotHeight;

  // Gridlines + Y labels
  const yStep = niceStep(hi - lo, 5);
  const yStart = Math.ceil(lo / yStep) * yStep;
  doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
  for (let v = yStart; v <= hi; v += yStep) {
    const y = yFor(v);
    doc.save();
    doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(plotLeft, y).lineTo(plotRight, y).stroke();
    doc.restore();
    doc.fillColor(LABEL_COLOR).text(
      v.toFixed(Math.abs(yStep) < 1 ? 1 : 0),
      x0,
      y - 4,
      { width: plotLeftPad - 4, align: "right" },
    );
  }

  // Plot border
  doc.save();
  doc.lineWidth(0.7).strokeColor(AXIS_LINE).rect(plotLeft, plotTop, plotWidth, plotHeight).stroke();
  doc.restore();

  // Bars
  const categoryCount = labels.length || 1;
  const groupCount = groups.length;
  const groupPad = 8;
  const groupSlot = (plotWidth - groupPad * (categoryCount + 1)) / categoryCount;
  const barWidth = Math.max(2, groupSlot / Math.max(groupCount, 1) - 1);

  labels.forEach((lbl, ci) => {
    const groupLeft = plotLeft + groupPad + ci * (groupSlot + groupPad);
    groups.forEach((g, gi) => {
      const val = g.data[ci];
      if (!Number.isFinite(val)) return;
      const yTop = yFor(val);
      const yBase = yFor(Math.max(lo, 0));
      const barX = groupLeft + gi * (barWidth + 1);
      const top = Math.min(yTop, yBase);
      const h = Math.abs(yBase - yTop);
      doc.save();
      doc.rect(barX, top, barWidth, Math.max(1, h)).fill(g.color);
      doc.restore();
    });
    // X label
    doc.font("body").fontSize(8).fillColor(LABEL_COLOR).text(
      lbl,
      groupLeft - 4,
      plotBottom + 4,
      { width: groupSlot + 8, align: "center", lineBreak: false },
    );
  });

  // Legend
  const legendY = plotBottom + 22;
  let lx = plotLeft;
  doc.font("body").fontSize(8).fillColor(LABEL_COLOR);
  for (const g of groups) {
    const label = `${g.label} (${valueUnit})`;
    const tw = doc.widthOfString(label);
    doc.save();
    doc.rect(lx, legendY + 1, 10, 6).fill(g.color);
    doc.restore();
    doc.fillColor(LABEL_COLOR).text(label, lx + 14, legendY - 1, { lineBreak: false });
    lx += 14 + tw + 14;
  }

  doc.y = startY + height + 8;
  doc.fillColor("#000000");
}

/* ------------------------------------------------------------------ */
/* Public API — drawXxxChart(doc, ...)                                 */
/* ------------------------------------------------------------------ */

export function drawOverviewChart(
  doc: any,
  series: Series[],
  rangeMin: number,
  rangeMax: number,
): void {
  drawLineChart(doc, {
    title: "Температура внутренних датчиков",
    series,
    rangeMin,
    rangeMax,
    height: 220,
  });
}

export function drawExternalChart(
  doc: any,
  s: Series,
  rangeMin: number,
  rangeMax: number,
): void {
  drawLineChart(doc, {
    title: `Внешний датчик «${s.name}»`,
    series: [{ ...s, color: "#475569" }],
    rangeMin,
    rangeMax,
    height: 190,
  });
}

export function drawHotChart(
  doc: any,
  s: Series,
  rangeMin: number,
  rangeMax: number,
): void {
  drawLineChart(doc, {
    title: `Критический «горячий» датчик — ${s.name}`,
    series: [{ ...s, color: HOT_COLOR }],
    rangeMin,
    rangeMax,
    height: 190,
  });
}

export function drawColdChart(
  doc: any,
  s: Series,
  rangeMin: number,
  rangeMax: number,
): void {
  drawLineChart(doc, {
    title: `Критический «холодный» датчик — ${s.name}`,
    series: [{ ...s, color: COLD_COLOR }],
    rangeMin,
    rangeMax,
    height: 190,
  });
}

export function drawStatsBarChart(
  doc: any,
  rows: Array<{ name: string; min: number; avg: number; max: number; mkt: number }>,
): void {
  drawGroupedBarChart(doc, {
    title: "Min / Avg / Max / MKT по датчикам",
    labels: rows.map(r => r.name),
    groups: [
      { label: "Min", color: "#3b82f6", data: rows.map(r => r.min) },
      { label: "Avg", color: "#10b981", data: rows.map(r => r.avg) },
      { label: "Max", color: "#ef4444", data: rows.map(r => r.max) },
      { label: "MKT", color: "#a855f7", data: rows.map(r => r.mkt) },
    ],
    valueUnit: "°C",
    height: 200,
  });
}

export function drawHeatmapChart(
  doc: any,
  rows: Array<{ name: string; avg: number }>,
  rangeMin: number,
  rangeMax: number,
): void {
  // Calculate actual data range from sensor values
  const dataMin = Math.min(...rows.map(r => r.avg));
  const dataMax = Math.max(...rows.map(r => r.avg));
  const dataSpan = dataMax - dataMin;
  
  // Use data range if it's narrower than the protocol range (better color differentiation)
  // Add 10% margin to show color gradient
  const margin = Math.max(0.5, dataSpan * 0.1);
  const effectiveMin = dataMin - margin;
  const effectiveMax = dataMax + margin;
  
  drawHorizontalBarChart(doc, {
    title: "Тепловая карта: средняя температура по датчикам",
    rows: rows.map(r => ({
      name: r.name,
      value: r.avg,
      color: colorForTemp(r.avg, effectiveMin, effectiveMax),
    })),
    valueUnit: "°C",
    height: Math.max(120, 26 * rows.length + 50),
  });
}

function colorForTemp(t: number, lo: number, hi: number): string {
  const span = hi - lo;
  const norm = Math.max(0, Math.min(1, (t - lo) / (span || 1)));
  const stops = [
    { p: 0, c: [37, 99, 235] },
    { p: 0.5, c: [16, 185, 129] },
    { p: 1, c: [220, 38, 38] },
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (norm >= stops[i].p && norm <= stops[i + 1].p) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const range = upper.p - lower.p || 1;
  const k = (norm - lower.p) / range;
  const r = Math.round(lower.c[0] + (upper.c[0] - lower.c[0]) * k);
  const g = Math.round(lower.c[1] + (upper.c[1] - lower.c[1]) * k);
  const b = Math.round(lower.c[2] + (upper.c[2] - lower.c[2]) * k);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Chart for Temperature Excursion Study — all sensor series with event markers.
 */
export function drawExcursionChart(
  doc: any,
  series: Series[],
  rangeMin: number,
  rangeMax: number,
  eventMarkers: EventMarker[],
): void {
  drawLineChart(doc, {
    title: "Температура датчиков в ходе испытания на отклонение",
    series,
    rangeMin,
    rangeMax,
    height: 240,
    eventMarkers,
  });
}
/**
 * Refrigerator sensor placement diagram.
 * Draws a schematic side-view of a refrigerator cabinet with sensor badges.
 *
 * Internal sensors are placed inside the cabinet at their stored (posX, posY)
 * coordinates (0-100 %) or at a named snap position.
 * External sensors are drawn to the right of the cabinet with a dashed connector.
 */
export type DiagramSensor = {
  id: number;
  label: string;
  customName?: string | null;
  role: "internal" | "external";
  position?: string | null;
  posX?: number | string | null;
  posY?: number | string | null;
};

const SNAP_POS: Record<string, { x: number; y: number }> = {
  top:    { x: 50, y: 20 },
  middle: { x: 50, y: 50 },
  bottom: { x: 50, y: 78 },
  door:   { x: 88, y: 50 },
};

const BADGE_PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#7c3aed", "#0891b2", "#be185d", "#65a30d",
];

function sensorBadgeColor(idx: number): string {
  return BADGE_PALETTE[idx % BADGE_PALETTE.length];
}

function refrigeratorBadgeLabel(sensor: DiagramSensor): string {
  const serial = String(sensor.label ?? "").trim();
  const digits = serial.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  if (serial.length > 0) return serial.length > 6 ? serial.slice(-6) : serial;
  const fallback = String(sensor.customName ?? "").trim();
  return fallback.length > 6 ? fallback.slice(0, 6) : fallback;
}

export function drawRefrigeratorDiagram(
  doc: any,
  sensors: DiagramSensor[],
  pageMargin: number,
  coolingUnitPos?: { x: number; y: number } | null,
  doorPos?: { x: number; y: number } | null,
  title?: string,
): void {
  const internals = sensors.filter(s => s.role === "internal");
  const externals = sensors.filter(s => s.role === "external");

  const diagH = 190;
  const cabW = 200;
  const cabH = diagH;
  // Outer wall thickness (represents insulation)
  const wallT = 10;
  const outerW = cabW + wallT * 2;
  const outerH = cabH + wallT * 2;
  const BADGE_W = 36;
  const BADGE_H = 20;
  const extBlockH = externals.length > 0 ? 30 + (externals.length - 1) * 45 + BADGE_H + 18 : 0;
  const titleH = title ? 28 : 0;
  const blockH = titleH + Math.max(outerH, extBlockH) + 18;

  ensureSpace(doc, blockH);

  if (title) {
    doc.save();
    doc.font("bold").fontSize(11).fillColor("#1f2937");
    doc.text(title, pageMargin, doc.y, { width: doc.page.width - pageMargin * 2, lineBreak: false });
    doc.restore();
    doc.y = (doc.y as number) + 10;
  }

  // Outer body is larger than inner chamber by wallT on each side.
  // Coordinates must be calculated after ensureSpace because it can add a page.
  const totalW = outerW + (externals.length > 0 ? 80 : 0);
  const outerX = pageMargin + Math.max(0, (doc.page.width - pageMargin * 2 - totalW) / 2);
  const outerY = doc.y;
  // Inner chamber starts at offset
  const cabX = outerX + wallT;
  const cabY = outerY + wallT;

  // Door strip
  const doorW = 36;
  const doorX = cabX + cabW - doorW;

  // Shelf Y positions
  const shelf1Y = cabY + cabH * 0.33;
  const shelf2Y = cabY + cabH * 0.66;

  // --- Outer refrigerator body (insulated walls) ---
  doc.save();
  doc.roundedRect(outerX, outerY, outerW, outerH, 6).fill("#e2e8f0");
  doc.roundedRect(outerX, outerY, outerW, outerH, 6).lineWidth(1.5).strokeColor("#64748b").stroke();
  // Label: outer body
  doc.font("body").fontSize(6).fillColor("#94a3b8");
  doc.text("Корпус", outerX + 2, outerY + 2, { lineBreak: false });
  doc.restore();

  // --- Cabinet body (inner chamber) ---
  doc.save();
  doc.roundedRect(cabX, cabY, cabW, cabH, 4).fill("#f8fafc");
  doc.roundedRect(cabX, cabY, cabW, cabH, 4).lineWidth(1.2).strokeColor("#94a3b8").stroke();

  // Door strip
  doc.rect(doorX, cabY, doorW, cabH).fill("#e2e8f0");
  doc.rect(doorX, cabY, doorW, cabH).lineWidth(0.8).strokeColor("#94a3b8").stroke();

  // Door handle
  doc.roundedRect(doorX + doorW - 8, cabY + cabH * 0.35, 4, cabH * 0.3, 2).fill("#94a3b8");

  // Shelves (dashed)
  doc.lineWidth(1).strokeColor("#cbd5e1").dash(5, { space: 3 });
  doc.moveTo(cabX + 4, shelf1Y).lineTo(doorX - 4, shelf1Y).stroke();
  doc.moveTo(cabX + 4, shelf2Y).lineTo(doorX - 4, shelf2Y).stroke();
  doc.undash();

  // Shelf labels
  doc.font("body").fontSize(7).fillColor("#94a3b8");
  doc.text("Верхняя полка", cabX + 5, shelf1Y - 10, { lineBreak: false });
  doc.text("Нижняя полка", cabX + 5, shelf2Y - 10, { lineBreak: false });

  // Door label
  doc.fontSize(7).fillColor("#94a3b8");
  doc.text("Дверь", doorX + 2, cabY + cabH / 2 - 10, {
    width: doorW - 4,
    align: "center",
    lineBreak: true,
  });
  doc.restore();

  // --- Internal sensor badges (rectangles) ---
  internals.forEach((s, idx) => {
    const color = sensorBadgeColor(idx);
    const name = refrigeratorBadgeLabel(s);

    let pctX = 40;
    let pctY = 50;
    if (s.posX != null && s.posY != null) {
      pctX = Number(s.posX);
      pctY = Number(s.posY);
    } else if (s.position && SNAP_POS[s.position]) {
      pctX = SNAP_POS[s.position].x;
      pctY = SNAP_POS[s.position].y;
    } else {
      const total = internals.length;
      pctX = 40;
      pctY = total <= 1 ? 50 : 15 + (idx / (total - 1)) * 70;
    }

    const innerW = doorX - cabX - 8;
    const bx = cabX + (pctX / 100) * innerW;
    const by = cabY + (pctY / 100) * cabH;

    doc.save();
    doc.roundedRect(bx - BADGE_W / 2, by - BADGE_H / 2, BADGE_W, BADGE_H, 3).fill(color);
    doc.roundedRect(bx - BADGE_W / 2, by - BADGE_H / 2, BADGE_W, BADGE_H, 3).lineWidth(1.5).strokeColor("white").stroke();
    doc.font("bold").fontSize(8).fillColor("white");
    doc.text(name, bx - BADGE_W / 2, by - 5, {
      width: BADGE_W,
      align: "center",
      lineBreak: false,
    });
    doc.restore();
  });

  // --- External sensor badges (right of cabinet) ---
  const extStartX = cabX + cabW + 20;
  externals.forEach((s, idx) => {
    const color = sensorBadgeColor(internals.length + idx);
    const name = refrigeratorBadgeLabel(s);
    const ey = cabY + 28 + idx * 45;

    // Connector line
    doc.save();
    doc.lineWidth(0.8).strokeColor(color).dash(3, { space: 2 });
    doc.moveTo(cabX + cabW + 2, ey).lineTo(extStartX + 8, ey).stroke();
    doc.undash();

    const badgeCx = extStartX + 8 + BADGE_W / 2;
    doc.roundedRect(badgeCx - BADGE_W / 2, ey - BADGE_H / 2, BADGE_W, BADGE_H, 3).fill(color);
    doc.roundedRect(badgeCx - BADGE_W / 2, ey - BADGE_H / 2, BADGE_W, BADGE_H, 3).lineWidth(1.5).strokeColor("white").stroke();
    doc.font("bold").fontSize(8).fillColor("white");
    doc.text(name, badgeCx - BADGE_W / 2, ey - 5, {
      width: BADGE_W,
      align: "center",
      lineBreak: false,
    });
    doc.font("body").fontSize(6.5).fillColor("#64748b");
    doc.text("Внешний", badgeCx - BADGE_W / 2, ey + BADGE_H / 2 + 2, {
      width: BADGE_W,
      align: "center",
      lineBreak: false,
    });
    doc.restore();
  });

  // Advance cursor (use outer dimensions so content below doesn't overlap)
  doc.y = outerY + Math.max(outerH, extBlockH) + 12;
  doc.fillColor("#000000");
}

// ─── Reefer Truck 3D Isometric Diagram ────────────────────────────────────────
// Draws an isometric parallelepiped (cargo body of a reefer truck) with
// 15 ISPE-compliant sensor positions: 8 corners, 4 wall centres, 3 volume centres.

const REEFER_SENSOR_POSITIONS: {
  id: string;
  label: string;
  x: number; // fraction of box width  [0..1]
  y: number; // fraction of box depth  [0..1]
  z: number; // fraction of box height [0..1]
  group: "corner" | "wall" | "center";
}[] = [
  // 8 corners
  { id: "C1", label: "Передняя часть, левый нижний угол",   x: 0,   y: 0,   z: 0,   group: "corner" },
  { id: "C2", label: "Передняя часть, правый нижний угол",  x: 1,   y: 0,   z: 0,   group: "corner" },
  { id: "C3", label: "Задняя часть, правый нижний угол",    x: 1,   y: 1,   z: 0,   group: "corner" },
  { id: "C4", label: "Задняя часть, левый нижний угол",     x: 0,   y: 1,   z: 0,   group: "corner" },
  { id: "C5", label: "Передняя часть, левый верхний угол",  x: 0,   y: 0,   z: 1,   group: "corner" },
  { id: "C6", label: "Передняя часть, правый верхний угол", x: 1,   y: 0,   z: 1,   group: "corner" },
  { id: "C7", label: "Задняя часть, правый верхний угол",   x: 1,   y: 1,   z: 1,   group: "corner" },
  { id: "C8", label: "Задняя часть, левый верхний угол",    x: 0,   y: 1,   z: 1,   group: "corner" },
  // 4 wall centres
  { id: "W1", label: "Центр передней стенки",     x: 0.5, y: 0,   z: 0.5, group: "wall" },
  { id: "W2", label: "Центр задней стенки",       x: 0.5, y: 1,   z: 0.5, group: "wall" },
  { id: "W3", label: "Центр левой стенки",        x: 0,   y: 0.5, z: 0.5, group: "wall" },
  { id: "W4", label: "Центр правой стенки",       x: 1,   y: 0.5, z: 0.5, group: "wall" },
  // 3 volume centres
  { id: "V1", label: "Центр объёма, нижний уровень",        x: 0.5, y: 0.5, z: 0,   group: "center" },
  { id: "V2", label: "Центр объёма, средний уровень",   x: 0.5, y: 0.5, z: 0.5, group: "center" },
  { id: "V3", label: "Центр объёма, верхний уровень",       x: 0.5, y: 0.5, z: 1,   group: "center" },
];

const REEFER_GROUP_COLORS: Record<string, string> = {
  corner: "#2563eb",
  wall:   "#16a34a",
  center: "#dc2626",
};


/**
 * Draw a filled star at position (cx, cy) with given size and color
 */
function drawStar(doc: any, cx: number, cy: number, size: number, color: string): void {
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? size : size * 0.4;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  doc.polygon(...points).fill(color).stroke();
}

function drawDiamond(doc: any, cx: number, cy: number, size: number, color: string): void {
  const points: [number, number][] = [
    [cx, cy - size],      // top
    [cx + size, cy],      // right
    [cx, cy + size],      // bottom
    [cx - size, cy],      // left
  ];
  doc.polygon(...points).fill(color).stroke();
}

export function drawReeferTruckDiagram3D(
  doc: PDFKit.PDFDocument,
  sensors: DiagramSensor[],
  pageMargin: number,
  coolingUnitPos?: { x: number; y: number } | null,
  doorPos?: { x: number; y: number } | null,
  labelOnly = false,
  title?: string,
  hotLabel?: string | null,
  coldLabel?: string | null,
): void {
  // Box world dimensions (arbitrary units, scaled to SVG-like coords via scale)
  const BW = 1.6; // width  (X)
  const BD = 3.2; // depth  (Y)
  const BH = 1.4; // height (Z)

  // Scale and origin in PDF points
  // A4 usable width = 595 - 2*56 = 483pt
  // Diagram horizontal span = (BW + BD) * cos30 * scale
  // External badge area needs ~70pt on the right
  // So: (BW + BD) * cos30 * scale ≈ 483 - 70 = 413 → scale ≈ 413 / (4.8 * 0.866) ≈ 99
  // Use scale=78 for comfortable fit with labels
  const scale = 78;
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  // Centre the diagram: leftmost point is pt(0, BD, 0), rightmost is pt(BW, 0, 0)
  // Horizontal span = (BW + BD) * cos30 * scale
  const diagSpanX = (BW + BD) * cos30 * scale;
  const pageWidth = doc.page.width;
  // ox is the isometric origin (front-left-bottom corner)
  // leftmost SVG x = ox + (0 - BD) * cos30 * scale = ox - BD * cos30 * scale
  // We want leftmost x = pageMargin, so ox = pageMargin + BD * cos30 * scale
  const ox = pageMargin + BD * cos30 * scale + 10 + 57; // +57pt ≈ 2cm shift to the right
  const oy = (doc.y as number) + 20 + BH * scale + (BD + BW) * scale * 0.5;

  function isoXY(wx: number, wy: number, wz: number): [number, number] {
    return [
      ox + (wx - wy) * cos30 * scale,
      oy - (wx + wy) * sin30 * scale - wz * scale,
    ];
  }

  // Total height needed in PDF
  // Include title height (~20pt) and 3cm top gap (~85pt) in space requirement
  const diagH = (BH + (BW + BD) * sin30) * scale + 60;
  ensureSpace(doc, diagH + 20 + (title ? 20 : 0) + 85);

  // Draw title on the same page as the diagram (after ensureSpace)
  if (title) {
    doc.font("bold").fontSize(11).fillColor("#1f2937");
    doc.text(title, pageMargin, doc.y, { lineBreak: false });
    doc.moveDown(0.4);
  }

  // 1.5cm (~43pt) top gap before the diagram (reduced from 85pt)
  doc.y = (doc.y as number) + 43;

  // Recalculate oy after ensureSpace and title (doc.y may have changed)
  const oyFinal = (doc.y as number) + 20 + BH * scale + (BD + BW) * scale * 0.5;
  function pt(wx: number, wy: number, wz: number): [number, number] {
    return [
      ox + (wx - wy) * cos30 * scale,
      oyFinal - (wx + wy) * sin30 * scale - wz * scale,
    ];
  }

  // 8 box vertices
  const b0 = pt(0,  0,  0);
  const b1 = pt(BW, 0,  0);
  const b2 = pt(BW, BD, 0);
  const b3 = pt(0,  BD, 0);
  const t0 = pt(0,  0,  BH);
  const t1 = pt(BW, 0,  BH);
  const t2 = pt(BW, BD, BH);
  const t3 = pt(0,  BD, BH);

  function ptsStr(arr: [number, number][]): string {
    return arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  }

  // Ground shadow removed per user request

  // ── Draw faces (painter's algorithm: back → sides → top → front) ──
  doc.save();

  // Back face (зад)
  doc.polygon(b3, b2, t2, t3).fill("#c8d8e8").stroke();
  doc.polygon(b3, b2, t2, t3).lineWidth(0.8).strokeColor("#7a9ab5").stroke();

  // Left face
  doc.polygon(b0, b3, t3, t0).fill("#d8e8f4").stroke();
  doc.polygon(b0, b3, t3, t0).lineWidth(0.8).strokeColor("#7a9ab5").stroke();

  // Right face
  doc.polygon(b1, b2, t2, t1).fill("#dce8f0").stroke();
  doc.polygon(b1, b2, t2, t1).lineWidth(0.8).strokeColor("#7a9ab5").stroke();

  // Top face
  doc.polygon(t0, t1, t2, t3).fill("#eef4fa").stroke();
  doc.polygon(t0, t1, t2, t3).lineWidth(0.8).strokeColor("#7a9ab5").stroke();

  // Front face (door)
  doc.polygon(b0, b1, t1, t0).fill("#dbeafe").stroke();
  doc.polygon(b0, b1, t1, t0).lineWidth(0.8).strokeColor("#7a9ab5").stroke();

  // Door split line
  const dm0 = pt(BW / 2, 0, 0);
  const dm1 = pt(BW / 2, 0, BH);
  doc.moveTo(dm0[0], dm0[1]).lineTo(dm1[0], dm1[1])
    .lineWidth(0.6).strokeColor("#93c5fd").dash(3, { space: 2 }).stroke();
  doc.undash();

  // Door handle
  const dh0 = pt(BW * 0.54, 0.02, BH * 0.42);
  const dh1 = pt(BW * 0.54, 0.02, BH * 0.58);
  doc.moveTo(dh0[0], dh0[1]).lineTo(dh1[0], dh1[1])
    .lineWidth(2).strokeColor("#64748b").stroke();

  // Strong outline edges
  doc.lineWidth(1.2).strokeColor("#4a6a85");
  // Bottom
  doc.moveTo(b0[0], b0[1]).lineTo(b1[0], b1[1]).stroke();
  doc.moveTo(b1[0], b1[1]).lineTo(b2[0], b2[1]).stroke();
  doc.moveTo(b2[0], b2[1]).lineTo(b3[0], b3[1]).stroke();
  doc.moveTo(b3[0], b3[1]).lineTo(b0[0], b0[1]).stroke();
  // Top
  doc.moveTo(t0[0], t0[1]).lineTo(t1[0], t1[1]).stroke();
  doc.moveTo(t1[0], t1[1]).lineTo(t2[0], t2[1]).stroke();
  doc.moveTo(t2[0], t2[1]).lineTo(t3[0], t3[1]).stroke();
  doc.moveTo(t3[0], t3[1]).lineTo(t0[0], t0[1]).stroke();
  // Verticals
  [[b0, t0], [b1, t1], [b2, t2], [b3, t3]].forEach(([a, b]) => {
    doc.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke();
  });

  // Refrigeration unit on top-front
  const ruH = 0.20, ruD = 0.16;
  const ru_bl  = pt(BW * 0.15, 0,    BH);
  const ru_br  = pt(BW * 0.85, 0,    BH);
  const ru_tr  = pt(BW * 0.85, 0,    BH + ruH);
  const ru_tl  = pt(BW * 0.15, 0,    BH + ruH);
  const ru_blb = pt(BW * 0.15, ruD,  BH);
  const ru_brb = pt(BW * 0.85, ruD,  BH);
  const ru_trb = pt(BW * 0.85, ruD,  BH + ruH);
  const ru_tlb = pt(BW * 0.15, ruD,  BH + ruH);
  doc.polygon(ru_bl, ru_br, ru_tr, ru_tl).fill("#bfdbfe").stroke();
  doc.polygon(ru_bl, ru_br, ru_tr, ru_tl).lineWidth(0.6).strokeColor("#93c5fd").stroke();
  doc.polygon(ru_tl, ru_tr, ru_trb, ru_tlb).fill("#dbeafe").stroke();
  doc.polygon(ru_tl, ru_tr, ru_trb, ru_tlb).lineWidth(0.6).strokeColor("#93c5fd").stroke();
  doc.polygon(ru_blb, ru_brb, ru_trb, ru_tlb).fill("#eff6ff").stroke();
  doc.polygon(ru_blb, ru_brb, ru_trb, ru_tlb).lineWidth(0.6).strokeColor("#93c5fd").stroke();

  doc.restore(); // close main box drawing save()

  // ── Cooling unit and door overlays (user-positioned) ──
  // SVG coordinate system: ORIGIN_X=330, ORIGIN_Y=380, SVG_SCALE=93.6
  // PDF coordinate system: ox, oyFinal, scale=52
  // Conversion: pdfX = ox + (svgX - 330) * (52/93.6)
  //             pdfY = oyFinal + (svgY - 380) * (52/93.6)
  const SVG_ORIGIN_X = 330;
  const SVG_ORIGIN_Y = 380;
  const SVG_SCALE = 93.6;
  const pdfScale = scale; // 52
  const scaleRatio = pdfScale / SVG_SCALE;

  function svgToPdf(svgX: number, svgY: number): [number, number] {
    return [
      ox + (svgX - SVG_ORIGIN_X) * scaleRatio,
      oyFinal + (svgY - SVG_ORIGIN_Y) * scaleRatio,
    ];
  }

  if (!labelOnly && coolingUnitPos) {
    const [cx, cy] = svgToPdf(coolingUnitPos.x, coolingUnitPos.y);
    doc.save();
    // Shadow
    doc.ellipse(cx, cy + 14, 18, 4).fill("rgba(0,0,0,0.10)");
    // Body rectangle
    doc.roundedRect(cx - 18, cy - 12, 36, 24, 4).fill("#1e40af").stroke();
    doc.roundedRect(cx - 18, cy - 12, 36, 24, 4).lineWidth(1).strokeColor("#1d4ed8").stroke();
    // Vertical vent lines
    [-8, -3, 2, 7].forEach(lx => {
      doc.moveTo(cx + lx, cy - 8).lineTo(cx + lx, cy + 8)
        .lineWidth(1).strokeColor("#3b82f6").stroke();
    });
    // Fan circle
    doc.circle(cx + 12, cy, 7).fill("none").lineWidth(1).strokeColor("#93c5fd").stroke();
    doc.circle(cx + 12, cy, 2).fill("#93c5fd");
    // Label
    doc.font("bold").fontSize(7).fillColor("#1e40af");
    doc.text("Агрегат", cx - 20, cy + 14, { width: 40, align: "center", lineBreak: false });
    doc.restore();
  }

  if (!labelOnly && doorPos) {
    const [dx, dy] = svgToPdf(doorPos.x, doorPos.y);
    doc.save();
    // Shadow
    doc.ellipse(dx, dy + 22, 14, 4).fill("rgba(0,0,0,0.10)");
    // Door frame
    doc.roundedRect(dx - 12, dy - 22, 24, 44, 3).fill("#dbeafe").stroke();
    doc.roundedRect(dx - 12, dy - 22, 24, 44, 3).lineWidth(1.2).strokeColor("#3b82f6").stroke();
    // Inner panel
    doc.roundedRect(dx - 8, dy - 18, 16, 36, 2).fill("none").lineWidth(0.7).strokeColor("#93c5fd").stroke();
    // Handle
    doc.roundedRect(dx + 4, dy - 5, 3, 10, 1.5).fill("#3b82f6");
    // Label
    doc.font("bold").fontSize(7).fillColor("#1d4ed8");
    doc.text("Дверь", dx - 14, dy + 24, { width: 28, align: "center", lineBreak: false });
    doc.restore();
  }

  // ── Sensor dots ──
  // Build position map from sensors
  const posMap: Record<string, DiagramSensor> = {};
  sensors.forEach(s => { if (s.position) posMap[s.position] = s; });

  // Rounded-rectangle badge dimensions (matching the UI component)
  const BX = 13; // half-width of badge
  const BY = 8;  // half-height of badge
  const BRAD = 3; // corner radius

  REEFER_SENSOR_POSITIONS.forEach((sp, idx) => {
    const wx = sp.x * BW;
    const wy = sp.y * BD;
    const wz = sp.z * BH;
    const [sx, sy] = pt(wx, wy, wz);

    // Always use group colour (blue=corner, green=wall, red=center) for consistent look
    const assigned = labelOnly ? undefined : posMap[sp.id];
    const color = REEFER_GROUP_COLORS[sp.group];
    
    // Check if this is a critical sensor (hot or cold) by comparing labels
    const isCriticalHot = hotLabel && assigned && assigned.label === hotLabel;
    const isCriticalCold = coldLabel && assigned && assigned.label === coldLabel;
    const isCritical = isCriticalHot || isCriticalCold;

    const label = assigned
      ? shortLabelStr(assigned.label)
      : sp.id;

    doc.save();
    
    // Draw symbol for critical sensors
    if (isCritical) {
      const symbolColor = isCriticalHot ? "#ef4444" : "#3b82f6"; // red for hot, blue for cold
      const symbolSize = 10;
      // Draw star for hot, diamond for cold
      if (isCriticalHot) {
        drawStar(doc, sx, sy - BY - 10, symbolSize, symbolColor);
      } else {
        drawDiamond(doc, sx, sy - BY - 10, symbolSize, symbolColor);
      }
    }
    
    // White border rect
    doc.roundedRect(sx - BX - 2, sy - BY - 2, (BX + 2) * 2, (BY + 2) * 2, BRAD + 1)
      .fill("white").stroke();
    
    // For critical sensors, use thicker border
    const borderWidth = isCritical ? 2.0 : 1.2;
    doc.roundedRect(sx - BX - 2, sy - BY - 2, (BX + 2) * 2, (BY + 2) * 2, BRAD + 1)
      .lineWidth(borderWidth).strokeColor(color).stroke();
    
    // Filled badge
    doc.roundedRect(sx - BX, sy - BY, BX * 2, BY * 2, BRAD).fill(color);
    // Label
    doc.font("bold").fontSize(8).fillColor("white");
    doc.text(label, sx - BX, sy - BY + 1, { width: BX * 2, align: "center", lineBreak: false });
    doc.restore();
  });

  // ── External sensor badges (right of isometric box) — only in full mode ──
  const externals = !labelOnly ? sensors.filter(s => s.role === "external") : [];
  if (externals.length > 0) {
    // External sensors are placed behind the rear wall (left side in isometric view).
    // The rear-left edge of the box in isometric is at pt(0, BD, z).
    // We anchor the connector to the rear-left face mid-height: pt(0, BD, BH*0.5)
    const [anchorX, anchorY] = pt(0, BD, BH * 0.5);
    const EXT_OFFSET_X = -28; // offset to the LEFT of the anchor (behind rear wall)
    const EXT_BADGE_W = 26;   // half-width of external badge
    const EXT_BADGE_H = 9;    // half-height of external badge
    const EXT_BRAD = 3;
    const EXT_SPACING = EXT_BADGE_H * 2 + 8; // vertical spacing between badges
    // Stack badges vertically centred around anchorY
    const totalExtH = externals.length * EXT_BADGE_H * 2 + (externals.length - 1) * 8;
    const extStartY = anchorY - totalExtH / 2;
    externals.forEach((s, idx) => {
      const bx = anchorX + EXT_OFFSET_X; // badge centre X (to the left = behind rear wall)
      const by = extStartY + idx * EXT_SPACING + EXT_BADGE_H; // badge centre Y
      const color = "#475569"; // slate-600 — consistent color for external sensors
      const label = shortLabelStr(s.label);
      // Dashed connector line from rear-left face to badge
      doc.save();
      doc.moveTo(anchorX - 2, anchorY)
        .lineTo(bx + EXT_BADGE_W + 4, by)
        .lineWidth(0.8).strokeColor(color)
        .dash(3, { space: 2 }).stroke();
      doc.undash();
      // White outer border
      doc.roundedRect(bx - EXT_BADGE_W - 2, by - EXT_BADGE_H - 2, (EXT_BADGE_W + 2) * 2, (EXT_BADGE_H + 2) * 2, EXT_BRAD + 1)
        .fill("white").stroke();
      doc.roundedRect(bx - EXT_BADGE_W - 2, by - EXT_BADGE_H - 2, (EXT_BADGE_W + 2) * 2, (EXT_BADGE_H + 2) * 2, EXT_BRAD + 1)
        .lineWidth(1.2).strokeColor(color).stroke();
      // Filled badge
      doc.roundedRect(bx - EXT_BADGE_W, by - EXT_BADGE_H, EXT_BADGE_W * 2, EXT_BADGE_H * 2, EXT_BRAD).fill(color);
      // Label
      doc.font("bold").fontSize(7).fillColor("white");
      doc.text(label, bx - EXT_BADGE_W, by - EXT_BADGE_H + 2, { width: EXT_BADGE_W * 2, align: "center", lineBreak: false });
      // "ВН" tag below badge
      doc.font("body").fontSize(6).fillColor("#64748b");
      doc.text("ВН", bx - EXT_BADGE_W, by + EXT_BADGE_H + 2, { width: EXT_BADGE_W * 2, align: "center", lineBreak: false });
      doc.restore();
    });
  }

  // ── Legend ──
  // Moved 42pt (~1.5cm) closer to the diagram (was +8, now -34)
  const legendY = oyFinal + (BW + BD) * sin30 * scale * 0.5 - 34;
  const legendItems = [
    { color: REEFER_GROUP_COLORS.corner, label: "Угол (8 шт.)" },
    { color: REEFER_GROUP_COLORS.wall,   label: "Центр стенки (4 шт.)" },
    { color: REEFER_GROUP_COLORS.center, label: "Центр объёма (3 шт.)" },
  ];
  legendItems.forEach((item, i) => {
    const lx = pageMargin + i * 145;
    const ly = legendY + 6;
    doc.save();
    doc.circle(lx + 5, ly, 5).fill(item.color);
    doc.font("body").fontSize(8).fillColor("#374151");
    doc.text(item.label, lx + 14, ly - 4, { lineBreak: false });
    doc.restore();
  });

  // Add critical point symbols legend
  doc.save();
  const symbolLegendY = legendY + 18;
  // Diamond for cold point
  drawDiamond(doc, pageMargin + 5, symbolLegendY, 4, "#3b82f6");
  doc.font("body").fontSize(8).fillColor("#374151");
  doc.text("Холодная точка", pageMargin + 14, symbolLegendY - 4, { lineBreak: false });
  
  // Star for hot point
  drawStar(doc, pageMargin + 145 + 5, symbolLegendY, 4, "#ef4444");
  doc.text("Горячая точка", pageMargin + 145 + 14, symbolLegendY - 4, { lineBreak: false });
  doc.restore();

  // ── ISPE reference ──
  doc.font("body").fontSize(7).fillColor("#94a3b8");
  doc.text("ISPE Good Practice Guide: Cold Chain Management", pageMargin, legendY + 32, {
    align: "right",
    width: doc.page.width - pageMargin * 2,
    lineBreak: false,
  });

  // Sensor Registry Table — only in full (non-labelOnly) mode
  if (!labelOnly) {
    const tableY = legendY + 46;
    // Set doc.y to tableY so ensureSpace uses the correct position
    doc.y = tableY;
    ensureSpace(doc, 150);
    const actualTableY = (doc.y as number);

    // Table dimensions — 4 columns: Position | Description | Serial | Role
    const totalW = doc.page.width - pageMargin * 2;
    const posColW = totalW * 0.08;
    const descColW = totalW * 0.38;
    const serialColW = totalW * 0.35;
    const roleColW = totalW * 0.19;
    const rowH = 16;

    // Header background
    doc.rect(pageMargin, actualTableY, posColW, rowH).fill("#f3f4f6");
    doc.rect(pageMargin + posColW, actualTableY, descColW, rowH).fill("#f3f4f6");
    doc.rect(pageMargin + posColW + descColW, actualTableY, serialColW, rowH).fill("#f3f4f6");
    doc.rect(pageMargin + posColW + descColW + serialColW, actualTableY, roleColW, rowH).fill("#f3f4f6");

    // Header text
    doc.font("bold").fontSize(9).fillColor("#1f2937");
    doc.text("Поз.", pageMargin + 4, actualTableY + 3, { width: posColW - 8, align: "left" });
    doc.text("Описание", pageMargin + posColW + 4, actualTableY + 3, { width: descColW - 8, align: "left" });
    doc.text("Серийный номер", pageMargin + posColW + descColW + 4, actualTableY + 3, { width: serialColW - 8, align: "left" });
    doc.text("Роль", pageMargin + posColW + descColW + serialColW + 4, actualTableY + 3, { width: roleColW - 8, align: "left" });

    // Table rows
    doc.font("body").fontSize(8).fillColor("#374151");
    let rowY = actualTableY + rowH;
    let rowIdx = 0;
    REEFER_SENSOR_POSITIONS.forEach((sp) => {
      const assigned = posMap[sp.id];
      if (assigned) {
        if (rowIdx % 2 === 1) {
          doc.rect(pageMargin, rowY, posColW, rowH).fill("#f9fafb");
          doc.rect(pageMargin + posColW, rowY, descColW, rowH).fill("#f9fafb");
          doc.rect(pageMargin + posColW + descColW, rowY, serialColW, rowH).fill("#f9fafb");
          doc.rect(pageMargin + posColW + descColW + serialColW, rowY, roleColW, rowH).fill("#f9fafb");
        }
        doc.lineWidth(0.5).strokeColor("#e5e7eb");
        doc.rect(pageMargin, rowY, posColW, rowH).stroke();
        doc.rect(pageMargin + posColW, rowY, descColW, rowH).stroke();
        doc.rect(pageMargin + posColW + descColW, rowY, serialColW, rowH).stroke();
        doc.rect(pageMargin + posColW + descColW + serialColW, rowY, roleColW, rowH).stroke();
        doc.fillColor("#374151");
        doc.text(sp.id, pageMargin + 4, rowY + 4, { width: posColW - 8, align: "left", lineBreak: false });
        doc.text(sp.label, pageMargin + posColW + 4, rowY + 4, { width: descColW - 8, align: "left", lineBreak: false });
        doc.text(assigned.label, pageMargin + posColW + descColW + 4, rowY + 4, { width: serialColW - 8, align: "left", lineBreak: false });
        doc.text(assigned.role === "internal" ? "Внутренний" : "Внешний", pageMargin + posColW + descColW + serialColW + 4, rowY + 4, { width: roleColW - 8, align: "left", lineBreak: false });
        rowY += rowH;
        rowIdx++;
      }
    });

    doc.y = rowY + 10;
  } else {
    doc.y = legendY + 44;
  }
  doc.fillColor("#000000");
}

/** Returns last 4 chars of a serial number label */
function shortLabelStr(label: string): string {
  return label.length > 4 ? label.slice(-4) : label;
}
