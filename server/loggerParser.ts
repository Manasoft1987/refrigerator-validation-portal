// Parser for refrigerator data-logger files (CSV / XLSX).
// Goal: extract a clean { ts: number[], temp: number[] } series from the large
// variety of real-world logger exports (Elitech, testo, RC-5, Freshliance, generic).

import * as XLSX from "xlsx";

export type LoggerSeries = {
  ts: number[]; // ms epoch
  temp: number[]; // °C
  sensorName?: string; // extracted from file header (Logger Name / Serial Number / device ID)
};

/* ------------------------------------------------------------------ */
/* Header detection                                                    */
/* ------------------------------------------------------------------ */

// Tokens that identify a TIME column (after normKey).
const TIME_TOKENS = [
  "time", "datetime", "date", "timestamp", "recordtime", "logtime",
  "дата", "время", "датаивремя", "датавремя",
];

// Tokens that identify a TEMPERATURE column.
const TEMP_TOKENS = [
  "temperature", "temp", "celsius",
  "температура", "темп",
  "ntc", "probe", "sensor", "channel", "канал", "датчик",
  "ch1", "ch2",
];

// Tokens that must *disqualify* a column from being considered as the
// primary temperature column (alarm/limit/setpoint columns).
const TEMP_EXCLUDE_TOKENS = [
  "ll", "hl", "lo", "hi", "low", "high", "min", "max",
  "limit", "alarm", "threshold", "setpoint", "set",
  "upper", "lower",
  "нижн", "верхн", "мин", "макс", "порог", "уставк", "тревог",
  "serial", "name", "logger", "device", "id", "№", "index", "номер",
];

function normKey(k: string): string {
  return String(k || "")
    .toLowerCase()
    .replace(/[\s_:°"'().\[\]\-,/\\]/g, "")
    .trim();
}

function containsAny(hay: string, needles: string[]): boolean {
  for (const n of needles) {
    if (!n) continue;
    if (hay.includes(n)) return true;
  }
  return false;
}

function scoreAsTime(header: string, columnValues: any[]): number {
  const h = normKey(header);
  let s = 0;
  if (containsAny(h, TIME_TOKENS)) s += 10;
  // Reward columns whose sample values parse as timestamps.
  const sample = columnValues.slice(0, 10);
  let ok = 0;
  let checked = 0;
  for (const v of sample) {
    if (v === null || v === undefined || v === "") continue;
    checked++;
    if (parseTimestamp(v) !== null) ok++;
  }
  if (checked > 0 && ok / checked > 0.6) s += 8;
  return s;
}

function scoreAsTemp(header: string, columnValues: any[]): number {
  const h = normKey(header);
  let s = 0;

  // Disqualify limit/alarm/metadata columns outright — return a large negative.
  if (containsAny(h, TEMP_EXCLUDE_TOKENS)) {
    // But keep minor credit if it still says "temp" (super rare)
    if (containsAny(h, ["temperature", "температура"])) return 1;
    return -100;
  }
  if (containsAny(h, TEMP_TOKENS)) s += 10;
  // "°C" / "celsius" / "c" units are strong signals even without a token.
  const rawLower = String(header || "").toLowerCase();
  if (rawLower.includes("°c") || rawLower.includes("\u00b0c") || /\(\s*c\s*\)/.test(rawLower)) s += 5;

  // Reward columns whose sample values parse as realistic temperatures
  // (floats in a plausible fridge/room range).
  const sample = columnValues.slice(0, 20);
  let plausible = 0;
  let checked = 0;
  for (const v of sample) {
    if (v === null || v === undefined || v === "") continue;
    checked++;
    const n = parseNumber(v);
    if (n !== null && n > -80 && n < 80) plausible++;
  }
  if (checked > 0 && plausible / checked > 0.7) s += 4;

  return s;
}

/**
 * Select the best TIME and TEMPERATURE column indices for a grid of rows
 * whose first row is the header.
 */
function selectColumns(
  header: any[],
  dataRows: any[][],
): { timeIdx: number; tempIdx: number } {
  const colCount = header.length;
  const timeScores: number[] = [];
  const tempScores: number[] = [];

  for (let c = 0; c < colCount; c++) {
    const vals = dataRows.map(r => (r ? r[c] : undefined));
    timeScores.push(scoreAsTime(String(header[c] ?? ""), vals));
    tempScores.push(scoreAsTemp(String(header[c] ?? ""), vals));
  }

  // Find best time column
  let timeIdx = -1;
  let bestTime = 4; // threshold: need at least some evidence
  for (let c = 0; c < colCount; c++) {
    if (timeScores[c] > bestTime) {
      bestTime = timeScores[c];
      timeIdx = c;
    }
  }

  // Find best temperature column, disallowing the time column.
  let tempIdx = -1;
  let bestTemp = 4;
  for (let c = 0; c < colCount; c++) {
    if (c === timeIdx) continue;
    if (tempScores[c] > bestTemp) {
      bestTemp = tempScores[c];
      tempIdx = c;
    }
  }

  return { timeIdx, tempIdx };
}

/* ------------------------------------------------------------------ */
/* Value parsing                                                       */
/* ------------------------------------------------------------------ */

function parseNumber(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s) return null;
  // Strip units & everything that's not part of a number.
  s = s.replace(/[^\d,.\-+eE]/g, "");
  // European decimal separator: replace last comma with dot if no dot present.
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  // Strip thousands separators (commas between digits when a dot is also present).
  // Only a very rough heuristic — we expect logger readings, not accounting numbers.
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseTimestamp(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel serial number heuristic (days since 1899-12-30)
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    return ms;
  }

  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : null;
  }

  let s = String(raw).trim();
  if (!s) return null;

  // Normalise common quirks: double spaces, "T" separator, trailing Z
  s = s.replace(/\s+/g, " ");

  // Common European format: DD.MM.YYYY HH:MM[:SS]  or  DD/MM/YYYY HH:MM[:SS]  or  DD-MM-YYYY
  let m = s.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?/,
  );
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    const year = yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy);
    // Treat naive timestamps from file as wall-clock (UTC) so display matches the file regardless of server TZ.
    const t = Date.UTC(year, Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss || "0"));
    if (Number.isFinite(t)) return t;
  }

  // Date only
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const year = yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy);
    const t = Date.UTC(year, Number(mm) - 1, Number(dd));
    if (Number.isFinite(t)) return t;
  }

  // ISO-style: YYYY-MM-DD HH:MM[:SS] (no timezone marker → treat as wall-clock UTC)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) {
    const [, yyyy, mm, dd, hh, mi, ss] = m;
    const t = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss || "0"));
    if (Number.isFinite(t)) return t;
  }

  // Fallback to the browser Date parser (handles ISO with explicit Z/offset)
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getTime();

  return null;
}

/* ------------------------------------------------------------------ */
/* CSV parsing                                                         */
/* ------------------------------------------------------------------ */

function detectDelimiter(lines: string[]): string {
  const candidates = [";", "\t", "|", ","];
  const sample = lines.slice(0, Math.min(lines.length, 8));
  let best: { delim: string; score: number } = { delim: ",", score: -1 };
  for (const d of candidates) {
    const regex = new RegExp(d === "|" ? "\\|" : d === "\t" ? "\t" : d, "g");
    const perLine = sample.map(l => (l.match(regex) || []).length);
    if (perLine.every(c => c === 0)) continue;
    const base = perLine[0] || 0;
    const consistent = perLine.filter(c => c === base && c > 0).length;
    const score = base * 10 + consistent;
    if (score > best.score) best = { delim: d, score };
  }
  return best.score > 0 ? best.delim : ",";
}

function splitCsv(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsvText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines);
  return lines.map(l => splitCsv(l, delim));
}

/* ------------------------------------------------------------------ */
/* Header row detection                                                */
/* ------------------------------------------------------------------ */

/**
 * Scan the first N rows and find the one that looks most like a header.
 * Criteria: many non-empty text cells, at least one cell containing a
 * time-like or temperature-like token.
 */
function findHeaderRowIndex(rows: any[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const r = rows[i] || [];
    let textCells = 0;
    let tokenHits = 0;
    for (const cell of r) {
      const s = String(cell ?? "").trim();
      if (!s) continue;
      // Header cells are usually text, not pure numbers / dates.
      if (parseNumber(cell) === null && parseTimestamp(cell) === null) textCells++;
      const nk = normKey(s);
      if (containsAny(nk, TIME_TOKENS)) tokenHits += 2;
      if (containsAny(nk, TEMP_TOKENS)) tokenHits += 2;
      const lower = s.toLowerCase();
      if (lower.includes("°c") || /\(\s*c\s*\)/.test(lower)) tokenHits += 1;
    }
    const score = textCells + tokenHits * 3;
    if (score > bestScore && tokenHits > 0) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore > 0 ? bestIdx : 0;
}

/* ------------------------------------------------------------------ */
/* Sensor name extraction from metadata rows                          */
/* ------------------------------------------------------------------ */

// Column header tokens that indicate a sensor name / serial number field.
const SENSOR_NAME_TOKENS = [
  "loggername", "loggernam", "devicename", "sensorname", "sensorid",
  "serialnumber", "serialno", "serial", "deviceid", "loggerid",
  "loggerno", "deviceno", "name", "id",
  "имядатчика", "датчик", "серийныйномер", "серийный", "наименование",
];

/**
 * Scan rows before the header row (metadata block) and the header row itself
 * for a sensor name / serial number value.
 * Returns the first non-empty, non-numeric value found in a cell whose column
 * header (or the cell to the left) matches a sensor-name token.
 */
function extractSensorName(rows: any[][], headerIdx: number): string | undefined {
  // Strategy 1: look in pre-header metadata rows (key: value pairs)
  // e.g. "Logger Name" | "RC-5+" or "Serial Number" | "SN12345"
  for (let i = 0; i < headerIdx; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < r.length - 1; c++) {
      const key = normKey(String(r[c] ?? ""));
      if (!key) continue;
      if (containsAny(key, SENSOR_NAME_TOKENS)) {
        // Value is in the next non-empty cell in the same row
        for (let v = c + 1; v < r.length; v++) {
          const val = String(r[v] ?? "").trim();
          if (val && parseNumber(r[v]) === null && parseTimestamp(r[v]) === null) {
            return val;
          }
        }
      }
    }
  }

  // Strategy 2: look in the header row itself for a column whose header is a
  // sensor-name token and whose first data row has a text value.
  const header = rows[headerIdx] || [];
  const dataRows = rows.slice(headerIdx + 1).filter(r => Array.isArray(r) && r.length > 0);
  for (let c = 0; c < header.length; c++) {
    const key = normKey(String(header[c] ?? ""));
    if (!key) continue;
    if (containsAny(key, SENSOR_NAME_TOKENS)) {
      // Find first non-empty value in this column.
      // Accept numeric values too (e.g. Logger Name = 2048).
      for (const dr of dataRows.slice(0, 5)) {
        const val = String(dr[c] ?? "").trim();
        if (val && parseTimestamp(dr[c]) === null) {
          return val;
        }
      }
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

export function parseLoggerBuffer(
  buffer: Buffer,
  fileName: string,
): LoggerSeries {
  const ext = (fileName.toLowerCase().split(".").pop() || "").trim();
  let rows: any[][] = [];

  const isXlsxLike = ["xlsx", "xls", "xlsm", "xlsb", "ods"].includes(ext);

  // Many loggers (Elitech, Freshliance, etc.) export files with a `.xls`
  // extension whose content is actually UTF-16 LE plain text with tab
  // separators. A real XLS begins with 0xD0CF11E0, and a real XLSX begins
  // with 0x504B ("PK"). If neither magic is present, parse as text first.
  const isRealXls =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;
  const isRealXlsx =
    buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isUtf16Le =
    buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const isUtf16Be =
    buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;

  if (isUtf16Le || isUtf16Be) {
    // Plain-text export disguised as .xls — decode as UTF-16, then parse
    // as delimited text (tabs or semicolons, with comma decimals).
    const enc = isUtf16Le ? "utf16le" : "utf16le"; // node only has utf16le
    let text: string;
    if (isUtf16Be) {
      // Swap byte order so utf16le decoder produces correct chars.
      const swapped = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i + 1 < buffer.length; i += 2) {
        swapped[i - 2] = buffer[i + 1];
        swapped[i - 1] = buffer[i];
      }
      text = swapped.toString(enc);
    } else {
      text = buffer.slice(2).toString(enc);
    }
    text = text.replace(/^\uFEFF/, "");
    rows = parseCsvText(text);
  } else if (isXlsxLike && (isRealXls || isRealXlsx)) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    }) as any[][];
  } else if (isXlsxLike) {
    // Has .xls/.xlsx extension but doesn't look like a real Excel binary,
    // and isn't UTF-16. Try utf-8 text first (some tools export plain TSV),
    // and fall back to XLSX as a last resort.
    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const csvRows = parseCsvText(text);
    if (csvRows.length >= 2) {
      rows = csvRows;
    } else {
      try {
        const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: true,
          defval: "",
          blankrows: false,
        }) as any[][];
      } catch {
        rows = csvRows;
      }
    }
  } else {
    // Treat as CSV/TSV/TXT (strip UTF-8 BOM).
    let text: string;
    try {
      text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    } catch {
      text = buffer.toString();
    }
    rows = parseCsvText(text);
  }

  // Trim trailing whitespace from every cell — Elitech pads cells with
  // spaces to fixed widths, which breaks number parsing later.
  rows = rows.map(r =>
    (r || []).map(c => (typeof c === "string" ? c.trim() : c))
  );

  if (rows.length < 2) return { ts: [], temp: [] };

  const headerIdx = findHeaderRowIndex(rows);
  const header = rows[headerIdx] || [];
  const dataRows = rows.slice(headerIdx + 1).filter(r => Array.isArray(r) && r.length > 0);

  // Extract sensor name from metadata block or header columns
  const sensorName = extractSensorName(rows, headerIdx);

  let { timeIdx, tempIdx } = selectColumns(header, dataRows);

  const ts: number[] = [];
  const temp: number[] = [];

  if (timeIdx === -1 || tempIdx === -1) {
    // Fallback A: look column-wise on data rows, without the header row,
    // for the first column that is mostly timestamps and the first that is
    // mostly realistic temperatures (excluding the time column).
    const { timeIdx: tA, tempIdx: tB } = heuristicColumnsFromData(dataRows);
    timeIdx = timeIdx === -1 ? tA : timeIdx;
    tempIdx = tempIdx === -1 ? tB : tempIdx;
  }

  if (timeIdx === -1 || tempIdx === -1) {
    return { ts: [], temp: [], sensorName };
  }

  for (const r of dataRows) {
    const t = parseTimestamp(r[timeIdx]);
    const v = parseNumber(r[tempIdx]);
    if (t !== null && v !== null && v > -80 && v < 80) {
      ts.push(t);
      temp.push(v);
    }
  }

  // Sort by timestamp ascending
  const order = ts.map((_, i) => i).sort((a, b) => ts[a] - ts[b]);
  const sortedTs = order.map(i => ts[i]);
  const sortedTemp = order.map(i => temp[i]);

  return { ts: sortedTs, temp: sortedTemp, sensorName };
}

/**
 * Last-resort: pick columns based purely on data shape.
 */
function heuristicColumnsFromData(rows: any[][]): { timeIdx: number; tempIdx: number } {
  if (rows.length === 0) return { timeIdx: -1, tempIdx: -1 };
  const colCount = Math.max(...rows.map(r => (r ? r.length : 0)));
  const timeHits: number[] = new Array(colCount).fill(0);
  const tempHits: number[] = new Array(colCount).fill(0);
  const N = Math.min(rows.length, 40);
  for (let i = 0; i < N; i++) {
    const r = rows[i] || [];
    for (let c = 0; c < colCount; c++) {
      const v = r[c];
      if (parseTimestamp(v) !== null) timeHits[c]++;
      const n = parseNumber(v);
      if (n !== null && n > -80 && n < 80 && !Number.isInteger(n * 1)) {
        // prefer non-integer (real measurements)
        tempHits[c] += 2;
      } else if (n !== null && n > -80 && n < 80) {
        tempHits[c] += 1;
      }
    }
  }
  let timeIdx = -1, bestT = N * 0.5;
  for (let c = 0; c < colCount; c++) {
    if (timeHits[c] > bestT) { bestT = timeHits[c]; timeIdx = c; }
  }
  let tempIdx = -1, bestV = 0;
  for (let c = 0; c < colCount; c++) {
    if (c === timeIdx) continue;
    if (tempHits[c] > bestV) { bestV = tempHits[c]; tempIdx = c; }
  }
  return { timeIdx, tempIdx };
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

export function computeStats(temps: number[]): {
  min: number;
  max: number;
  avg: number;
  std: number;
  mkt: number;
} | null {
  if (!temps.length) return null;
  let min = temps[0], max = temps[0], sum = 0;
  for (const t of temps) {
    if (t < min) min = t;
    if (t > max) max = t;
    sum += t;
  }
  const avg = sum / temps.length;
  let sq = 0;
  for (const t of temps) sq += (t - avg) ** 2;
  const std = Math.sqrt(sq / temps.length);

  // Mean Kinetic Temperature, Arrhenius form, dH = 83.144 kJ/mol
  const dH = 83144; // J/mol
  const R = 8.314; // J/(mol·K)
  let expSum = 0;
  for (const t of temps) {
    const Tk = t + 273.15;
    expSum += Math.exp(-dH / (R * Tk));
  }
  const mean = expSum / temps.length;
  const mktK = -dH / R / Math.log(mean);
  const mkt = mktK - 273.15;

  return {
    min: round(min),
    max: round(max),
    avg: round(avg),
    std: round(std),
    mkt: round(mkt),
  };
}

function round(n: number, decimals = 3): number {
  const k = 10 ** decimals;
  return Math.round(n * k) / k;
}

export function findDeviations(
  ts: number[],
  temp: number[],
  min: number,
  max: number,
): Array<{ start: number; end: number; durationMs: number; value: number; type: "high" | "low" }> {
  const out: Array<{
    start: number; end: number; durationMs: number; value: number; type: "high" | "low";
  }> = [];
  let i = 0;
  while (i < temp.length) {
    if (temp[i] > max || temp[i] < min) {
      const type = temp[i] > max ? "high" : "low";
      const start = ts[i];
      let extreme = temp[i];
      let j = i;
      while (j < temp.length) {
        const cur = temp[j];
        const isOut = type === "high" ? cur > max : cur < min;
        if (!isOut) break;
        if (type === "high" && cur > extreme) extreme = cur;
        if (type === "low" && cur < extreme) extreme = cur;
        j++;
      }
      const end = ts[Math.min(j, ts.length - 1)];
      out.push({
        start,
        end,
        durationMs: Math.max(0, end - start),
        value: round(extreme, 2),
        type,
      });
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
}

export function clipSeries(series: LoggerSeries, startMs?: number | null, endMs?: number | null): LoggerSeries {
  if (!startMs && !endMs) return series;
  const ts: number[] = [];
  const temp: number[] = [];
  for (let i = 0; i < series.ts.length; i++) {
    const t = series.ts[i];
    if (startMs && t < startMs) continue;
    if (endMs && t > endMs) continue;
    ts.push(t);
    temp.push(series.temp[i]);
  }
  return { ts, temp };
}

/**
 * Resample a time series onto a fixed-step grid by nearest-earlier point.
 * Useful when loggers recorded at different intervals must be aligned.
 * stepMinutes = null/undefined/0 => return series unchanged.
 */
export function resampleSeries(series: LoggerSeries, stepMinutes?: number | null): LoggerSeries {
  if (!stepMinutes || stepMinutes <= 0) return series;
  if (series.ts.length === 0) return series;
  const stepMs = stepMinutes * 60_000;
  const start = series.ts[0];
  const end = series.ts[series.ts.length - 1];
  
  // Merge original data points with grid points to preserve all data
  const pointsSet = new Set<number>();
  
  // Add all original data points
  for (const t of series.ts) {
    pointsSet.add(t);
  }
  
  // Add grid points for interpolation
  const firstTick = Math.ceil(start / stepMs) * stepMs;
  for (let g = firstTick; g <= end; g += stepMs) {
    pointsSet.add(g);
  }
  
  const allPoints = Array.from(pointsSet).sort((a, b) => a - b);
  const outTs: number[] = [];
  const outTemp: number[] = [];
  
  // Build lookup map for original data
  const originalMap = new Map<number, number>();
  for (let i = 0; i < series.ts.length; i++) {
    originalMap.set(series.ts[i], series.temp[i]);
  }
  
  // For each point, use original value if exists, otherwise interpolate
  for (const t of allPoints) {
    if (originalMap.has(t)) {
      // Use original data point
      outTs.push(t);
      outTemp.push(originalMap.get(t)!);
    } else {
      // Interpolate from neighbors
      let before: { ts: number; temp: number } | null = null;
      let after: { ts: number; temp: number } | null = null;
      
      for (let i = 0; i < series.ts.length; i++) {
        if (series.ts[i] < t) {
          before = { ts: series.ts[i], temp: series.temp[i] };
        } else if (series.ts[i] > t && !after) {
          after = { ts: series.ts[i], temp: series.temp[i] };
          break;
        }
      }
      
      if (before && after) {
        // Linear interpolation
        const ratio = (t - before.ts) / (after.ts - before.ts);
        const interpTemp = before.temp + (after.temp - before.temp) * ratio;
        outTs.push(t);
        outTemp.push(interpTemp);
      } else if (before) {
        // Use forward fill
        outTs.push(t);
        outTemp.push(before.temp);
      } else if (after) {
        // Use backward fill
        outTs.push(t);
        outTemp.push(after.temp);
      }
    }
  }
  
  // Check if span is shorter than one step
  if (end - start < stepMs) {
    // Series span is shorter than one step — keep original to avoid losing data.
    return series;
  }
  
  if (outTs.length === 0) {
    // Fallback: no valid points generated
    return series;
  }
  return { ts: outTs, temp: outTemp };
}

/**
 * Detect external sensors automatically.
 * Heuristic: compute median of per-sensor average temperatures. Any sensor whose average
 * is more than 5°C away from the cohort median AND falls outside the configured range is
 * classified as "external". Returns indices of suggested external sensors.
 */
export function detectExternalSensors(
  sensors: Array<{ avg: number }>,
  rangeMin: number,
  rangeMax: number,
): number[] {
  if (sensors.length === 0) return [];
  const avgs = sensors.map(s => s.avg).slice().sort((a, b) => a - b);
  const median = avgs[Math.floor(avgs.length / 2)];
  const out: number[] = [];
  for (let i = 0; i < sensors.length; i++) {
    const a = sensors[i].avg;
    const farFromCohort = Math.abs(a - median) > 5;
    const outsideRange = a < rangeMin - 1 || a > rangeMax + 1;
    if (farFromCohort && outsideRange) out.push(i);
  }
  return out;
}
