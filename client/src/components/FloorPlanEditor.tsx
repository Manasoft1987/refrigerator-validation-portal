/*
 * FloorPlanEditor — Interactive SVG floor plan editor
 *
 * Objects are stored as % of room dimensions (0–100) for scale-independence.
 * heightM is stored directly in meters (not as %).
 *
 * Features:
 *  - Drag objects anywhere including to walls (no clamp preventing edge placement)
 *  - 8 resize handles (corners + sides)
 *  - Draw new objects by dragging
 *  - 90° rotation
 *  - Side panel with precise numeric inputs (meters)
 *  - Height field per object (stored in heightM)
 *  - Per-object sensor slots (up to 4): each has sensorId + heightFromFloor
 *  - Size labels rendered on canvas (Д×Ш×В)
 *  - Zoom and pan controls (Ctrl+Scroll to zoom, Ctrl+Drag to pan)
 */
import { useState, useRef, useCallback, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCw, Trash2, Plus, Move, Layers, X, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { nanoid } from "nanoid";
import {
  resizeFloorPlanRect,
  viewportToCanvasPoint,
  type FloorPlanResizeHandle,
} from "../lib/floorPlanGeometry";

export interface ObjectSensor {
  sensorId: string;     // user-entered ID/serial of the sensor
  heightFromFloor: number; // metres above floor
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FloorObjectType =
  | "shelf" | "pallet" | "cabinet" | "display_case" | "refrigerator"
  | "table" | "window" | "radiator" | "vent" | "door_obj" | "cooling_unit"
  | "partition" | "sensor_point";

export interface FloorPlanObject {
  id: string;
  type: FloorObjectType;
  xPct: number;       // left edge % of room length (0–100)
  yPct: number;       // top edge % of room width  (0–100)
  widthPct: number;   // width  % of room length
  heightPct: number;  // depth  % of room width
  heightM: number;    // physical height above floor (metres), default 0
  rotation: number;   // 0 | 90 | 180 | 270
  label: string;
  sensors?: ObjectSensor[]; // up to 4 sensors attached to this object
}

// ─── Object catalogue ─────────────────────────────────────────────────────────

interface ObjectDef {
  type: FloorObjectType;
  ruLabel: string;
  defaultW: number; // % of room length
  defaultH: number; // % of room width
  fill: string;
  stroke: string;
  textColor: string;
  icon: string;
}

const OBJECT_DEFS: ObjectDef[] = [
  { type: "shelf",        ruLabel: "Стеллаж",    defaultW: 12, defaultH: 4,  fill: "#dbeafe", stroke: "#1d4ed8", textColor: "#1e3a8a", icon: "▤" },
  { type: "pallet",       ruLabel: "Поддон",      defaultW: 5,  defaultH: 5,  fill: "#fef3c7", stroke: "#b45309", textColor: "#78350f", icon: "⬛" },
  { type: "cabinet",      ruLabel: "Шкаф",        defaultW: 5,  defaultH: 3,  fill: "#e0e7ff", stroke: "#4338ca", textColor: "#312e81", icon: "🗄" },
  { type: "display_case", ruLabel: "Витрина",     defaultW: 10, defaultH: 3,  fill: "#cffafe", stroke: "#0e7490", textColor: "#164e63", icon: "🪟" },
  { type: "refrigerator", ruLabel: "Холодильник", defaultW: 5,  defaultH: 4,  fill: "#bae6fd", stroke: "#0369a1", textColor: "#0c4a6e", icon: "❄" },
  { type: "table",        ruLabel: "Стол",        defaultW: 8,  defaultH: 4,  fill: "#d1fae5", stroke: "#059669", textColor: "#064e3b", icon: "▭" },
  { type: "window",       ruLabel: "Окно",        defaultW: 6,  defaultH: 1,  fill: "#e0f2fe", stroke: "#0284c7", textColor: "#0c4a6e", icon: "⬜" },
  { type: "radiator",     ruLabel: "Радиатор",    defaultW: 5,  defaultH: 1,  fill: "#fee2e2", stroke: "#dc2626", textColor: "#7f1d1d", icon: "♨" },
  { type: "vent",         ruLabel: "Вентшахта",   defaultW: 3,  defaultH: 3,  fill: "#f3e8ff", stroke: "#7c3aed", textColor: "#4c1d95", icon: "⊕" },
  { type: "door_obj",     ruLabel: "Дверь",       defaultW: 4,  defaultH: 1,  fill: "#fde68a", stroke: "#b45309", textColor: "#78350f", icon: "🚪" },
  { type: "cooling_unit", ruLabel: "Кондиционер", defaultW: 6,  defaultH: 4,  fill: "#a5f3fc", stroke: "#0891b2", textColor: "#164e63", icon: "❄" },
  { type: "partition",    ruLabel: "Стена / перегородка", defaultW: 18, defaultH: 1.5, fill: "#64748b", stroke: "#334155", textColor: "#0f172a", icon: "▰" },
  { type: "sensor_point",  ruLabel: "Датчик",      defaultW: 3,  defaultH: 3,  fill: "#e0f2fe", stroke: "#0369a1", textColor: "#1e3a8a", icon: "●" },
];

function getDef(type: FloorObjectType): ObjectDef {
  return OBJECT_DEFS.find(d => d.type === type) ?? OBJECT_DEFS[0];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** Snap a value to the nearest multiple of `step` (no-op when step <= 0). */
function snapVal(v: number, step: number): number {
  return step > 0 ? Math.round(v / step) * step : v;
}

// Resize handle identifiers: 4 corners + 4 side midpoints
type ResizeCorner = FloorPlanResizeHandle;

// Minimum object size, in % of room dimension
const MIN_SIZE_PCT = 1.5;

// ─── SVG constants ────────────────────────────────────────────────────────────

const SVG_W = 700;
const SVG_H = 480;
const PAD   = 40;

// ─── Sensor overlay types ─────────────────────────────────────────────────────

export interface SensorPosition {
  id: string;
  xPct: number;
  yPct: number;
  tier: number;
  row: number;
  col: number;
}

export interface SensorLogger {
  id: number;
  label: string;
  customName?: string | null;
  role: string;
  position?: string | null;
  minVal?: string | number | null;
  avgVal?: string | number | null;
  maxVal?: string | number | null;
  mktVal?: string | number | null;
}

function numericValue(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatTemp(value: string | number | null | undefined): string | null {
  const n = numericValue(value);
  if (n == null) return null;
  return n.toFixed(1).replace(".", ",");
}

function loggerName(logger: SensorLogger | undefined): string {
  if (!logger) return "";
  return String(logger.customName || logger.label || "").trim();
}

function shortSensorCode(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length >= 4) return compact.slice(-4);
  return raw.length > 4 ? raw.slice(-4) : raw;
}

function sensorTokenVariants(value: string | number | null | undefined): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const tokens = new Set<string>();
  const compact = raw.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
  if (compact) tokens.add(compact);
  const compactAlnum = raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (compactAlnum) tokens.add(compactAlnum);
  if (compactAlnum.length >= 4) tokens.add(compactAlnum.slice(-4));
  const digits = raw.replace(/\D/g, "");
  if (digits) tokens.add(digits);
  if (digits.length >= 4) tokens.add(digits.slice(-4));
  return Array.from(tokens);
}

function loggerTokens(logger: SensorLogger): string[] {
  return [
    ...sensorTokenVariants(logger.label),
    ...sensorTokenVariants(logger.customName),
  ];
}

function sensorPointLogger(obj: FloorPlanObject, sensorLoggers: SensorLogger[]): SensorLogger | undefined {
  const objectLabel = String(obj.label || "").trim().toLowerCase();
  const objectTokens = sensorTokenVariants(obj.label);
  return sensorLoggers.find(logger => logger.position === obj.id)
    || sensorLoggers.find(logger => loggerName(logger).toLowerCase() === objectLabel)
    || sensorLoggers.find(logger => {
      const tokens = loggerTokens(logger);
      return objectTokens.some(token => tokens.includes(token));
    });
}

function criticalSensorIds(sensorLoggers: SensorLogger[]): { hotId: number | null; coldId: number | null } {
  const internal = sensorLoggers.filter(logger => logger.role !== "external");
  let hot: SensorLogger | null = null;
  let cold: SensorLogger | null = null;
  for (const logger of internal) {
    const avg = numericValue(logger.avgVal);
    if (avg != null && (!hot || avg > (numericValue(hot.avgVal) ?? Number.NEGATIVE_INFINITY))) {
      hot = logger;
    }
    const min = numericValue(logger.minVal) ?? avg;
    if (min != null && (!cold || min < (numericValue(cold.minVal) ?? numericValue(cold.avgVal) ?? Number.POSITIVE_INFINITY))) {
      cold = logger;
    }
  }
  return { hotId: hot?.id ?? null, coldId: cold?.id ?? null };
}

function starPoints(cx: number, cy: number, outer: number, inner = outer * 0.42): string {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  }).join(" ");
}

function diamondPoints(cx: number, cy: number, size: number): string {
  return `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`;
}

function sensorPointColors(
  logger: SensorLogger | undefined,
  rangeMin: number | null | undefined,
  rangeMax: number | null | undefined,
  selected: boolean,
) {
  if (!logger) return { fill: "#e0f2fe", stroke: selected ? "#f59e0b" : "#0369a1", text: "#1e3a8a", badge: "#0284c7" };
  const avg = numericValue(logger?.avgVal);
  const min = numericValue(rangeMin);
  const max = numericValue(rangeMax);
  const outOfRange = avg != null && min != null && max != null && (avg < min || avg > max);
  if (outOfRange) return { fill: "#fee2e2", stroke: selected ? "#f59e0b" : "#dc2626", text: "#991b1b", badge: "#dc2626" };
  if (logger?.role === "external") return { fill: "#f1f5f9", stroke: selected ? "#f59e0b" : "#64748b", text: "#334155", badge: "#64748b" };
  return { fill: "#dcfce7", stroke: selected ? "#f59e0b" : "#16a34a", text: "#14532d", badge: "#16a34a" };
}

// ─── Object shape renderer ────────────────────────────────────────────────────

function ObjectShape({
  obj,
  planX, planY, drawW, drawH,
  roomLengthM, roomWidthM,
  showDimensions,
  sensorLoggers,
  rangeMin,
  rangeMax,
  selected,
  onPointerDown,
  onResizePointerDown,
  onDoubleClick,
}: {
  obj: FloorPlanObject;
  planX: number; planY: number; drawW: number; drawH: number;
  roomLengthM: number; roomWidthM: number;
  showDimensions: boolean;
  sensorLoggers: SensorLogger[];
  rangeMin?: number | null;
  rangeMax?: number | null;
  selected: boolean;
  onPointerDown: (id: string, e: React.PointerEvent) => void;
  onResizePointerDown: (id: string, corner: ResizeCorner, e: React.PointerEvent) => void;
  onDoubleClick: (id: string) => void;
}) {
  const def = getDef(obj.type);

  // Convert % → SVG absolute coords within the plan rect
  const x  = planX + (obj.xPct      / 100) * drawW;
  const y  = planY + (obj.yPct      / 100) * drawH;
  const w  = Math.max(4, (obj.widthPct  / 100) * drawW);
  const h  = Math.max(4, (obj.heightPct / 100) * drawH);
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Dimension label in meters (Д×Ш×В)
  const wM = roomLengthM > 0 ? ((obj.widthPct  / 100) * roomLengthM).toFixed(1) + "м" : obj.widthPct.toFixed(0) + "%";
  const hM = roomWidthM  > 0 ? ((obj.heightPct / 100) * roomWidthM).toFixed(1)  + "м" : obj.heightPct.toFixed(0) + "%";
  const htStr = obj.heightM > 0 ? `×${obj.heightM.toFixed(1)}м` : "";
  const dimStr = `${wM}×${hM}${htStr}`;
  // Sensor count badge
  const sensorCount = (obj.sensors ?? []).filter(s => s.sensorId.trim()).length;

  const HR = 7;  // visible handle radius (larger = easier to grab)
  const HIT = 15; // invisible hit-area radius around each handle

  // Sensor point: render as circle with ID label + height below
  if (obj.type === "sensor_point") {
    // Fixed radius: ~14px so 4 digits are readable but not huge
    const r = 17;
    const cx2 = x + w / 2;
    const cy2 = y + h / 2;
    const logger = sensorPointLogger(obj, sensorLoggers);
    const displayTitle = loggerName(logger) || String(obj.label || "?").trim() || "?";
    const shortId = displayTitle.length > 7 ? displayTitle.slice(-7) : displayTitle;
    const avgLabel = formatTemp(logger?.avgVal);
    const colors = sensorPointColors(logger, rangeMin, rangeMax, selected);
    const critical = criticalSensorIds(sensorLoggers);
    const isCriticalHot = !!logger && critical.hotId === logger.id;
    const isCriticalCold = !!logger && critical.coldId === logger.id;
    const htLabel = (obj.heightM ?? 0) > 0 ? `${(obj.heightM as number).toFixed(1)}м` : "";
    return (
      <g
        style={{ cursor: "move", userSelect: "none" }}
        onPointerDown={e => { e.stopPropagation(); onPointerDown(obj.id, e); }}
        onDoubleClick={e => { e.stopPropagation(); onDoubleClick(obj.id); }}
      >
        {isCriticalHot && <circle cx={cx2} cy={cy2} r={r + 3.2} fill="none" stroke="#ef4444" strokeWidth={2.2} />}
        {isCriticalCold && <circle cx={cx2} cy={cy2} r={r + (isCriticalHot ? 6.1 : 3.2)} fill="none" stroke="#2563eb" strokeWidth={2} />}
        <circle cx={cx2} cy={cy2} r={r} fill={colors.fill} stroke={colors.stroke} strokeWidth={selected ? 2.5 : 1.7} />
        {isCriticalHot && (
          <polygon
            points={starPoints(cx2 + r + 8, cy2 - r - 6, 6.4)}
            fill="#ef4444"
            stroke="white"
            strokeWidth={1.1}
            style={{ pointerEvents: "none" }}
          />
        )}
        {isCriticalCold && (
          <polygon
            points={diamondPoints(cx2 + r + 8, cy2 + r + 6, 6)}
            fill="#2563eb"
            stroke="white"
            strokeWidth={1.1}
            style={{ pointerEvents: "none" }}
          />
        )}
        <circle cx={cx2 - r + 5} cy={cy2 - r + 5} r={4.2} fill={colors.badge} opacity={0.95} />
        {selected && <circle cx={cx2} cy={cy2} r={r + 4} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />}
        <text x={cx2} y={cy2 + (avgLabel ? -1 : 4)} textAnchor="middle" fontSize={8} fontWeight={800} fill={colors.text} style={{ pointerEvents: "none", userSelect: "none" }}>
          {shortId}
        </text>
        {avgLabel && (
          <text x={cx2} y={cy2 + 9} textAnchor="middle" fontSize={7} fontWeight={700} fill={colors.text} style={{ pointerEvents: "none", userSelect: "none" }}>
            {avgLabel}°C
          </text>
        )}
        {htLabel && (
          <text x={cx2} y={cy2 + r + 9} textAnchor="middle" fontSize={7} fill={colors.text} fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>
            {htLabel}
          </text>
        )}
        {selected && (
          <>
            {([[-1,-1],[1,-1],[1,1],[-1,1]] as [number,number][]).map(([dx, dy], i) => (
              <circle key={i} cx={cx2 + dx * r * 0.8} cy={cy2 + dy * r * 0.8} r={HR} fill="white" stroke="#f59e0b" strokeWidth={1.5}
                style={{ cursor: "nwse-resize", pointerEvents: "all" }}
                onPointerDown={ev => { ev.stopPropagation(); onResizePointerDown(obj.id, (["nw","ne","se","sw"][i] as "nw"|"ne"|"se"|"sw"), ev); }}
              />
            ))}
          </>
        )}
      </g>
    );
  }

  return (
    <g transform={`rotate(${obj.rotation}, ${cx}, ${cy})`}>
      {/* Body — drag target */}
      <rect
        x={x} y={y} width={w} height={h}
        rx={3}
        fill={def.fill}
        stroke={selected ? "#f59e0b" : def.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
        opacity={0.93}
        style={{ cursor: "move", touchAction: "none" }}
        onPointerDown={e => { e.stopPropagation(); onPointerDown(obj.id, e); }}
        onDoubleClick={e => { e.stopPropagation(); onDoubleClick(obj.id); }}
      />

      {/* Shelf vertical lines */}
      {obj.type === "shelf" && w > 20 && (
        Array.from({ length: Math.max(1, Math.floor(w / 18)) }).map((_, i) => {
          const lx = x + (i + 1) * (w / (Math.floor(w / 18) + 1));
          return <line key={i} x1={lx} y1={y+2} x2={lx} y2={y+h-2} stroke={def.stroke} strokeWidth={0.8} opacity={0.45} style={{ pointerEvents: "none" }} />;
        })
      )}

      {/* Pallet grid */}
      {obj.type === "pallet" && (
        <>
          <line x1={x+w/3} y1={y} x2={x+w/3} y2={y+h} stroke={def.stroke} strokeWidth={0.8} opacity={0.45} style={{ pointerEvents: "none" }} />
          <line x1={x+2*w/3} y1={y} x2={x+2*w/3} y2={y+h} stroke={def.stroke} strokeWidth={0.8} opacity={0.45} style={{ pointerEvents: "none" }} />
          <line x1={x} y1={y+h/2} x2={x+w} y2={y+h/2} stroke={def.stroke} strokeWidth={0.8} opacity={0.45} style={{ pointerEvents: "none" }} />
        </>
      )}

      {/* Vent cross */}
      {obj.type === "vent" && w > 8 && h > 8 && (
        <>
          <line x1={x+4} y1={y+4} x2={x+w-4} y2={y+h-4} stroke={def.stroke} strokeWidth={1} opacity={0.55} style={{ pointerEvents: "none" }} />
          <line x1={x+w-4} y1={y+4} x2={x+4} y2={y+h-4} stroke={def.stroke} strokeWidth={1} opacity={0.55} style={{ pointerEvents: "none" }} />
          <circle cx={cx} cy={cy} r={Math.min(w,h)*0.25} fill="none" stroke={def.stroke} strokeWidth={0.8} opacity={0.45} style={{ pointerEvents: "none" }} />
        </>
      )}

      {/* Radiator fins */}
      {obj.type === "radiator" && w > 10 && (
        Array.from({ length: Math.max(2, Math.floor(w / 10)) }).map((_, i) => {
          const lx = x + (i+1) * (w / (Math.floor(w/10)+1));
          return <line key={i} x1={lx} y1={y+2} x2={lx} y2={y+h-2} stroke={def.stroke} strokeWidth={1.2} opacity={0.5} style={{ pointerEvents: "none" }} />;
        })
      )}

      {/* Refrigerator snowflake */}
      {obj.type === "refrigerator" && w > 14 && h > 14 && (
        <text x={cx} y={cy+3} textAnchor="middle" fontSize={Math.min(w,h)*0.45} fill={def.stroke} opacity={0.4} style={{ userSelect: "none", pointerEvents: "none" }}>❄</text>
      )}

      {/* Name label */}
      <text
        x={cx} y={h > 22 ? cy - 3 : cy + 4}
        textAnchor="middle"
        fontSize={Math.max(7, Math.min(11, Math.min(w, h) * 0.28))}
        fontWeight="600"
        fill={def.textColor}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {obj.label.slice(0, 12)}
      </text>

      {/* Dimension label */}
      {showDimensions && h > 18 && (
        <text
          x={cx} y={cy + 8}
          textAnchor="middle"
          fontSize={Math.max(6, Math.min(9, Math.min(w, h) * 0.2))}
          fontWeight="500"
          fill={def.textColor}
          opacity={0.7}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {dimStr.slice(0, 14)}
        </text>
      )}

      {/* Sensor count badge (if any) */}
      {sensorCount > 0 && (
        <circle cx={x + w - 4} cy={y + 4} r={5} fill="#ef4444" style={{ pointerEvents: "none" }} />
      )}
      {sensorCount > 0 && (
        <text x={x + w - 4} y={y + 5} textAnchor="middle" fontSize={7} fontWeight="700" fill="white" style={{ pointerEvents: "none", userSelect: "none" }}>
          {sensorCount}
        </text>
      )}

      {/* Resize handles (when selected): 4 corners + 4 side midpoints */}
      {selected && (() => {
        // Handles are drawn inside the rotated group, so their on-screen
        // orientation is rotated too. Rotate the resize cursor to match, so a
        // side handle on a 90°-rotated wall shows ↔ (not ↕).
        const rot = (((obj.rotation ?? 0) % 360) + 360) % 360;
        const rotateCursor = (c: string): string => {
          if (rot === 90 || rot === 270) {
            if (c === "ns-resize") return "ew-resize";
            if (c === "ew-resize") return "ns-resize";
            if (c === "nwse-resize") return "nesw-resize";
            if (c === "nesw-resize") return "nwse-resize";
          }
          return c;
        };
        const handles: Array<{ key: ResizeCorner; hx: number; hy: number; cursor: string }> = [
          { key: "nw", hx: x,         hy: y,         cursor: rotateCursor("nwse-resize") },
          { key: "ne", hx: x + w,     hy: y,         cursor: rotateCursor("nesw-resize") },
          { key: "se", hx: x + w,     hy: y + h,     cursor: rotateCursor("nwse-resize") },
          { key: "sw", hx: x,         hy: y + h,     cursor: rotateCursor("nesw-resize") },
          { key: "n",  hx: x + w / 2, hy: y,         cursor: rotateCursor("ns-resize") },
          { key: "e",  hx: x + w,     hy: y + h / 2, cursor: rotateCursor("ew-resize") },
          { key: "s",  hx: x + w / 2, hy: y + h,     cursor: rotateCursor("ns-resize") },
          { key: "w",  hx: x,         hy: y + h / 2, cursor: rotateCursor("ew-resize") },
        ];
        return (
          <>
            {handles.map(hd => (
              <g key={hd.key}>
                {/* large invisible hit target makes the handle easy to grab */}
                <circle
                  cx={hd.hx} cy={hd.hy} r={HIT}
                  fill="transparent"
                  style={{ cursor: hd.cursor, pointerEvents: "all", touchAction: "none" }}
                  onPointerDown={ev => { ev.stopPropagation(); onResizePointerDown(obj.id, hd.key, ev); }}
                />
                <circle
                  cx={hd.hx} cy={hd.hy} r={HR}
                  fill="white" stroke="#f59e0b" strokeWidth={1.5}
                  style={{ pointerEvents: "none" }}
                />
              </g>
            ))}
          </>
        );
      })()}
    </g>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function SidePanel({
  obj,
  roomLengthM,
  roomWidthM,
  onUpdate,
  onRotate,
  onDelete,
  onClose,
}: {
  obj: FloorPlanObject;
  roomLengthM: number;
  roomWidthM: number;
  onUpdate: (patch: Partial<FloorPlanObject>) => void;
  onRotate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const def = getDef(obj.type);

  // ── Sensor point: simplified panel ──────────────────────────────────────
  if (obj.type === "sensor_point") {
    const htFromFloor = (obj.heightM ?? 0).toFixed(2);
    return (
      <div className="absolute top-0 right-0 w-52 bg-white border rounded-lg shadow-lg p-3 space-y-2.5 z-10 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: "#0369a1" }}>
            <span style={{ color: "#0ea5e9" }}>●</span>
            <span>Датчик</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Номер / ID датчика</Label>
          <Input
            className="h-7 text-xs"
            defaultValue={obj.label}
            key={`sp-label-${obj.id}-${obj.label}`}
            onBlur={e => onUpdate({ label: e.target.value.trim() || "Датчик" })}
            onKeyDown={e => { if (e.key === "Enter") onUpdate({ label: (e.target as HTMLInputElement).value.trim() || "Датчик" }); }}
            maxLength={20}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Высота от пола (м)</Label>
          <Input
            className="h-7 text-xs"
            type="number" step="0.1" min="0"
            defaultValue={htFromFloor}
            key={`sp-ht-${obj.id}-${htFromFloor}`}
            onBlur={e => { const v = parseFloat(e.target.value.replace(",",".")); if (!isNaN(v)) onUpdate({ heightM: Math.max(0, v) }); }}
            onKeyDown={e => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value.replace(",",".")); if (!isNaN(v)) onUpdate({ heightM: Math.max(0, v) }); } }}
          />
        </div>
        <Button
          variant="outline" size="sm"
          className="w-full h-7 text-[11px] text-destructive hover:text-destructive bg-background"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3 mr-1" />Удалить датчик
        </Button>
      </div>
    );
  }

  // Convert % → meters for display
  const xM  = ((obj.xPct      / 100) * roomLengthM).toFixed(2);
  const yM  = ((obj.yPct      / 100) * roomWidthM).toFixed(2);
  const wM  = ((obj.widthPct  / 100) * roomLengthM).toFixed(2);
  const hM  = ((obj.heightPct / 100) * roomWidthM).toFixed(2);
  const htM = (obj.heightM ?? 0).toFixed(2);
  const handleNum = (field: "xM"|"yM"|"wM"|"hM"|"htM", raw: string) => {
    const v = parseFloat(raw.replace(",", "."));
    if (isNaN(v)) return;
    if (field === "xM")  onUpdate({ xPct:      clamp((v / (roomLengthM || 1)) * 100, 0, 100) });
    if (field === "yM")  onUpdate({ yPct:      clamp((v / (roomWidthM  || 1)) * 100, 0, 100) });
    if (field === "wM")  onUpdate({ widthPct:  clamp((v / (roomLengthM || 1)) * 100, 0.5, 100) });
    if (field === "hM")  onUpdate({ heightPct: clamp((v / (roomWidthM  || 1)) * 100, 0.5, 100) });
    if (field === "htM") onUpdate({ heightM: Math.max(0, v) });
  };

  return (
    <div className="absolute top-0 right-0 w-52 bg-white border rounded-lg shadow-lg p-3 space-y-2.5 z-10 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold" style={{ color: def.textColor }}>
          <span>{def.icon}</span>
          <span>{obj.label}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Label */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Подпись</Label>
        <Input
          className="h-7 text-xs"
          value={obj.label}
          onChange={e => onUpdate({ label: e.target.value })}
          maxLength={20}
        />
      </div>

      {/* Plan dimensions */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Длина (м)</Label>
          <Input
            className="h-7 text-xs"
            type="number" step="0.1" min="0.1"
            defaultValue={wM}
            key={`w-${obj.id}-${wM}`}
            onBlur={e => handleNum("wM", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleNum("wM", (e.target as HTMLInputElement).value); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Ширина (м)</Label>
          <Input
            className="h-7 text-xs"
            type="number" step="0.1" min="0.1"
            defaultValue={hM}
            key={`h-${obj.id}-${hM}`}
            onBlur={e => handleNum("hM", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleNum("hM", (e.target as HTMLInputElement).value); }}
          />
        </div>
      </div>

      {/* Height */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Высота (м)</Label>
        <Input
          className="h-7 text-xs"
          type="number" step="0.1" min="0"
          defaultValue={htM}
          key={`ht-${obj.id}-${htM}`}
          onBlur={e => handleNum("htM", e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleNum("htM", (e.target as HTMLInputElement).value); }}
        />
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">X (м)</Label>
          <Input
            className="h-7 text-xs"
            type="number" step="0.1" min="0"
            defaultValue={xM}
            key={`x-${obj.id}-${xM}`}
            onBlur={e => handleNum("xM", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleNum("xM", (e.target as HTMLInputElement).value); }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Y (м)</Label>
          <Input
            className="h-7 text-xs"
            type="number" step="0.1" min="0"
            defaultValue={yM}
            key={`y-${obj.id}-${yM}`}
            onBlur={e => handleNum("yM", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleNum("yM", (e.target as HTMLInputElement).value); }}
          />
        </div>
      </div>

      {/* Rotation (non-sensor objects) */}
      {(obj.type as string) !== "sensor_point" && (
        <Button
          variant="outline" size="sm"
          className="w-full h-7 text-[11px]"
          onClick={onRotate}
        >
          <RotateCw className="h-3 w-3 mr-1" />Повернуть 90°
        </Button>
      )}

      {/* Delete */}
      <Button
        variant="outline" size="sm"
        className="w-full h-7 text-[11px] text-destructive hover:text-destructive bg-background"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3 mr-1" />Удалить
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type DragMode =
  | { kind: "move"; id: string }
  | { kind: "resize"; id: string; corner: ResizeCorner };

export interface FloorPlanEditorProps {
  objects: FloorPlanObject[];
  onChange: (objs: FloorPlanObject[]) => void;
  roomLengthM: number;
  roomWidthM: number;
  showDimensions?: boolean;
  readOnly?: boolean;
  sensorPositions?: SensorPosition[];
  sensorLoggers?: SensorLogger[];
  activeTier?: number;
  onAssignLogger?: (objId: string, loggerId: number) => void;
  backgroundImageUrl?: string | null;
  rangeMin?: number | null;
  rangeMax?: number | null;
}

export function FloorPlanEditor({
  objects,
  onChange,
  roomLengthM,
  roomWidthM,
  showDimensions = false,
  readOnly = false,
  sensorPositions = [],
  sensorLoggers = [],
  activeTier,
  onAssignLogger,
  backgroundImageUrl = null,
  rangeMin = null,
  rangeMax = null,
}: FloorPlanEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [placingType, setPlacingType] = useState<FloorObjectType | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [pickerForCell, setPickerForCell] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Live preview rect while drawing a new object by dragging (in room %)
  const [draftRect, setDraftRect] = useState<{ xPct: number; yPct: number; wPct: number; hPct: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const roomClipId = useId().replace(/:/g, "");
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  // Drag-to-draw state: start point + last pointer point (room %) + object type
  const drawStateRef = useRef<{ startXPct: number; startYPct: number; lastXPct: number; lastYPct: number; type: FloorObjectType } | null>(null);
  // Suppresses the single canvas click that fires right after placing an object,
  // so the freshly created (and selected) object is not immediately deselected.
  const suppressCanvasClickRef = useRef(false);
  const externalLoggers = sensorLoggers.filter(logger => logger.role === "external");

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // Active drag/resize state stored in ref to avoid stale closure issues
  const dragState = useRef<{
    mode: DragMode;
    startSvgX: number;
    startSvgY: number;
    snapshot: FloorPlanObject;
  } | null>(null);

  // Compute draw area dimensions
  const externalPanelW = externalLoggers.length > 0 ? 130 : 0;
  const planW = SVG_W - PAD * 2 - externalPanelW;
  const planH = SVG_H - PAD * 2;
  const aspect = roomLengthM > 0 && roomWidthM > 0 ? roomLengthM / roomWidthM : 1;
  let drawW = planW;
  let drawH = planW / aspect;
  if (drawH > planH) { drawH = planH; drawW = planH * aspect; }
  const planX = PAD + (planW - drawW) / 2;
  const planY = PAD + (planH - drawH) / 2;

  const drawRef = useRef({ planX, planY, drawW, drawH });
  drawRef.current = { planX, planY, drawW, drawH };

  // Convert client coordinates to the outer, untransformed SVG viewport.
  const clientToViewportSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (SVG_W / rect.width),
      y: (clientY - rect.top)  * (SVG_H / rect.height),
    };
  }, []);

  // Convert client coordinates into the zoomed/panned canvas coordinate system.
  const clientToCanvasSvg = useCallback((clientX: number, clientY: number) => {
    const viewportPoint = clientToViewportSvg(clientX, clientY);
    return viewportToCanvasPoint(
      viewportPoint,
      { x: panX, y: panY },
      zoomLevel,
    );
  }, [clientToViewportSvg, panX, panY, zoomLevel]);

  // Convert SVG coords → room % (clamped 0–100)
  const svgToRoomPct = useCallback((svgX: number, svgY: number) => {
    const { planX, planY, drawW, drawH } = drawRef.current;
    return {
      x: clamp(((svgX - planX) / drawW) * 100, 0, 100),
      y: clamp(((svgY - planY) / drawH) * 100, 0, 100),
    };
  }, []);

  // Grid step in % for snapping: 0.1 m when the room dimension is known, else 1%.
  const gridStep = useCallback((axis: "x" | "y") => {
    const m = axis === "x" ? roomLengthM : roomWidthM;
    return m > 0 ? (0.1 / m) * 100 : 1;
  }, [roomLengthM, roomWidthM]);

  // ── Pointer events on SVG objects ──────────────────────────────────────────

  const dblClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleObjectPointerDown = useCallback((id: string, e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    // Double-click detection: two pointer-downs within 300ms → open panel
    if (dblClickTimer.current && selectedId === id) {
      clearTimeout(dblClickTimer.current);
      dblClickTimer.current = null;
      setPanelOpen(true);
    } else {
      setSelectedId(id);
      setPanelOpen(false);
      dblClickTimer.current = setTimeout(() => { dblClickTimer.current = null; }, 300);
    }
    const { x, y } = clientToCanvasSvg(e.clientX, e.clientY);
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    dragState.current = {
      mode: { kind: "move", id },
      startSvgX: x,
      startSvgY: y,
      snapshot: { ...obj },
    };
  }, [readOnly, objects, clientToCanvasSvg, selectedId]);

  const handleResizePointerDown = useCallback((id: string, corner: ResizeCorner, e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = clientToCanvasSvg(e.clientX, e.clientY);
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    dragState.current = {
      mode: { kind: "resize", id, corner },
      startSvgX: x,
      startSvgY: y,
      snapshot: { ...obj },
    };
  }, [readOnly, objects, clientToCanvasSvg]);

  // ── Global pointer move / up ───────────────────────────────────────────────

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // ── Drawing a new object by dragging ──────────────────────────────────
      const draw = drawStateRef.current;
      if (draw) {
        const { x: svgX, y: svgY } = clientToCanvasSvg(e.clientX, e.clientY);
        const { x: curX, y: curY } = svgToRoomPct(svgX, svgY);
        draw.lastXPct = curX;
        draw.lastYPct = curY;
        setDraftRect({
          xPct: Math.min(draw.startXPct, curX),
          yPct: Math.min(draw.startYPct, curY),
          wPct: Math.abs(curX - draw.startXPct),
          hPct: Math.abs(curY - draw.startYPct),
        });
        return;
      }

      const ds = dragState.current;
      if (!ds) return;
      const { drawW, drawH } = drawRef.current;
      const { x: svgX, y: svgY } = clientToCanvasSvg(e.clientX, e.clientY);

      const dxPct = ((svgX - ds.startSvgX) / drawW) * 100;
      const dyPct = ((svgY - ds.startSvgY) / drawH) * 100;
      const snap  = ds.snapshot;
      const stepX = gridStep("x");
      const stepY = gridStep("y");

      if (ds.mode.kind === "move") {
        // Snap position to the grid, keep object fully inside the room
        const newX = clamp(snapVal(snap.xPct + dxPct, stepX), 0, Math.max(0, 100 - snap.widthPct));
        const newY = clamp(snapVal(snap.yPct + dyPct, stepY), 0, Math.max(0, 100 - snap.heightPct));
        onChange(objects.map(o => o.id === ds.mode.id ? { ...o, xPct: newX, yPct: newY } : o));
      } else {
        const { corner } = ds.mode;
        const resized = resizeFloorPlanRect({
          rect: snap,
          handle: corner,
          delta: {
            x: svgX - ds.startSvgX,
            y: svgY - ds.startSvgY,
          },
          rotationDeg: snap.rotation || 0,
          drawWidth: drawW,
          drawHeight: drawH,
          stepXPct: stepX,
          stepYPct: stepY,
          minSizePct: MIN_SIZE_PCT,
        });
        onChange(objects.map(o => o.id === ds.mode.id ? { ...o, ...resized } : o));
      }
    };

    const onUp = () => {
      // ── Commit a drag-to-draw rectangle ───────────────────────────────────
      const draw = drawStateRef.current;
      if (draw) {
        drawStateRef.current = null;
        setDraftRect(null);
        const def = getDef(draw.type);
        const stepX = gridStep("x");
        const stepY = gridStep("y");
        let xPct = Math.min(draw.startXPct, draw.lastXPct);
        let yPct = Math.min(draw.startYPct, draw.lastYPct);
        let wPct = Math.abs(draw.lastXPct - draw.startXPct);
        let hPct = Math.abs(draw.lastYPct - draw.startYPct);

        if (wPct < MIN_SIZE_PCT || hPct < MIN_SIZE_PCT) {
          // Treated as a plain click → place a default-sized object centred on the click
          wPct = def.defaultW;
          hPct = def.defaultH;
          xPct = clamp(draw.startXPct - wPct / 2, 0, Math.max(0, 100 - wPct));
          yPct = clamp(draw.startYPct - hPct / 2, 0, Math.max(0, 100 - hPct));
        } else {
          xPct = snapVal(xPct, stepX);
          yPct = snapVal(yPct, stepY);
          wPct = Math.max(MIN_SIZE_PCT, snapVal(wPct, stepX));
          hPct = Math.max(MIN_SIZE_PCT, snapVal(hPct, stepY));
          wPct = Math.min(wPct, 100 - xPct);
          hPct = Math.min(hPct, 100 - yPct);
        }

        const newObj: FloorPlanObject = {
          id: nanoid(),
          type: draw.type,
          xPct, yPct,
          widthPct: wPct,
          heightPct: hPct,
          heightM: 0,
          rotation: 0,
          label: def.ruLabel,
        };
        onChange([...objects, newObj]);
        setPlacingType(null);
        setSelectedId(newObj.id);
        suppressCanvasClickRef.current = true;
        return;
      }
      dragState.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [objects, onChange, gridStep, svgToRoomPct, clientToCanvasSvg]);

  // ── Zoom and Pan handlers ──────────────────────────────────────────────────

  const handleZoom = useCallback((delta: number) => {
    setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      handleZoom(delta);
    }
  }, [handleZoom]);

  const handleSvgPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.button === 0) {
      e.preventDefault();
      setIsPanning(true);
      const start = clientToViewportSvg(e.clientX, e.clientY);
      panStartRef.current = {
        x: start.x,
        y: start.y,
        panX,
        panY,
      };
    }
  }, [clientToViewportSvg, panX, panY]);

  const handleSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      const current = clientToViewportSvg(e.clientX, e.clientY);
      const dx = current.x - panStartRef.current.x;
      const dy = current.y - panStartRef.current.y;
      setPanX(panStartRef.current.panX + dx);
      setPanY(panStartRef.current.panY + dy);
    }
  }, [clientToViewportSvg, isPanning]);

  const handleSvgPointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── Place new object: click to drop a default size, or drag to draw a size ──

  const handlePlacePointerDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!placingType || readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { x, y } = clientToCanvasSvg(e.clientX, e.clientY);
    const { x: xPct, y: yPct } = svgToRoomPct(x, y);
    drawStateRef.current = { startXPct: xPct, startYPct: yPct, lastXPct: xPct, lastYPct: yPct, type: placingType };
    setDraftRect({ xPct, yPct, wPct: 0, hPct: 0 });
  }, [placingType, readOnly, clientToCanvasSvg, svgToRoomPct]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const selectedObj = objects.find(o => o.id === selectedId);

  const updateSelected = useCallback((patch: Partial<FloorPlanObject>) => {
    if (!selectedId) return;
    onChange(objects.map(o => o.id === selectedId ? { ...o, ...patch } : o));
  }, [selectedId, objects, onChange]);

  const rotateSelected = useCallback(() => {
    if (!selectedId) return;
    onChange(objects.map(o => o.id === selectedId ? { ...o, rotation: (o.rotation + 90) % 360 } : o));
  }, [selectedId, objects, onChange]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    onChange(objects.filter(o => o.id !== selectedId));
    setSelectedId(null);
    setPanelOpen(false);
  }, [selectedId, objects, onChange]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-2 ${isFullscreen ? "fixed inset-0 z-50 overflow-auto bg-background p-4 sm:p-6" : ""}`}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="border rounded-md bg-muted/30 p-2">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setToolbarOpen(!toolbarOpen)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${toolbarOpen ? "rotate-90" : ""}`} />
              Объекты
            </button>
          </div>

          {toolbarOpen && (
            <>
              <button
                type="button"
                onClick={() => setPlacingType("sensor_point")}
                className={`w-full mb-2 px-3 py-2 text-xs rounded-md font-semibold transition-all flex items-center justify-center gap-2 ${
                  placingType === "sensor_point"
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                    : "bg-white border hover:bg-gray-50 text-primary"
                }`}
              >
                <span>●</span>
                Поставить датчик на план
              </button>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {OBJECT_DEFS.filter(def => def.type !== "sensor_point").map(def => (
                  <button
                    key={def.type}
                    onClick={() => setPlacingType(def.type)}
                    className={`px-2 py-1.5 text-xs rounded-md font-medium transition-all ${
                      placingType === def.type
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                        : "bg-white border hover:bg-gray-50"
                    }`}
                    title={def.ruLabel}
                  >
                    {def.icon}
                  </button>
                ))}
              </div>
            </>
          )}

          {placingType && (
            <div className="px-3 py-1.5 bg-amber-50 border-t text-xs text-amber-800 flex items-center gap-2">
              <Move className="h-3.5 w-3.5" />
              Кликните по плану, либо растяните мышью нужный размер: <b>{getDef(placingType).ruLabel}</b>
              <button className="ml-auto underline" onClick={() => setPlacingType(null)}>Отмена</button>
            </div>
          )}
        </div>
      )}

      {/* Canvas + side panel */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className={`w-full max-w-none bg-white rounded-md border ${readOnly ? "mx-auto" : isFullscreen ? "h-[calc(100vh-210px)] min-h-[520px]" : "min-h-[560px] max-h-[980px]"}`}
          style={{ touchAction: "none", cursor: isPanning ? "grabbing" : (placingType ? "crosshair" : "default"), display: "block" }}
          onClick={(e) => {
            if (suppressCanvasClickRef.current) { suppressCanvasClickRef.current = false; return; }
            const target = e.target as Element;
            const clickedCanvasBackground =
              e.target === e.currentTarget ||
              target.getAttribute("data-room-background") === "true";
            if (!clickedCanvasBackground) return;
            if (!placingType) { setSelectedId(null); setPickerForCell(null); }
          }}
          onWheel={handleWheel}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={handleSvgPointerUp}
        >
          {/* Zoom and pan group */}
          <g transform={`translate(${panX}, ${panY}) scale(${zoomLevel})`}>
            <defs>
              <clipPath id={roomClipId}>
                <rect x={planX} y={planY} width={drawW} height={drawH} />
              </clipPath>
            </defs>
            {/* Room outline */}
            <rect
              x={planX}
              y={planY}
              width={drawW}
              height={drawH}
              fill={backgroundImageUrl ? "#ffffff" : "#f8fafc"}
              stroke="#0f172a"
              strokeWidth={1.5}
              data-room-background="true"
            />
            {backgroundImageUrl && (
              <>
                <image
                  href={backgroundImageUrl}
                  x={planX}
                  y={planY}
                  width={drawW}
                  height={drawH}
                  preserveAspectRatio="xMidYMid meet"
                  clipPath={`url(#${roomClipId})`}
                  opacity={0.88}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                />
                <rect
                  x={planX}
                  y={planY}
                  width={drawW}
                  height={drawH}
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  data-room-background="true"
                />
              </>
            )}

            {/* Optional dimension labels */}
            {showDimensions && roomLengthM > 0 && roomWidthM > 0 && (
              <>
                <text x={planX + drawW/2} y={planY - 10} textAnchor="middle" fontSize={11} fill="#475569" style={{ userSelect: "none" }}>
                  {`${roomLengthM.toFixed(1)} м (длина)`}
                </text>
                <text
                  x={planX - 16} y={planY + drawH/2}
                  textAnchor="middle" fontSize={11} fill="#475569"
                  transform={`rotate(-90, ${planX - 16}, ${planY + drawH/2})`}
                  style={{ userSelect: "none" }}
                >
                  {`${roomWidthM.toFixed(1)} м (ширина)`}
                </text>
              </>
            )}

            {/* Compass */}
            <g transform={`translate(${SVG_W - 50}, 28)`}>
              <circle r={16} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={1} />
              <text textAnchor="middle" y={-19} fontSize={9} fill="#475569" style={{ userSelect: "none" }}>С</text>
              <text textAnchor="middle" y={28} fontSize={9} fill="#475569" style={{ userSelect: "none" }}>Ю</text>
              <text textAnchor="end" x={-19} y={4} fontSize={9} fill="#475569" style={{ userSelect: "none" }}>З</text>
              <text textAnchor="start" x={19} y={4} fontSize={9} fill="#475569" style={{ userSelect: "none" }}>В</text>
              <polygon points="0,-10 3,0 0,10 -3,0" fill="#0f766e" />
            </g>

            {/* External warehouse logger(s): shown automatically outside the storage zone */}
            {externalLoggers.length > 0 && (
              <g transform={`translate(${planX + drawW + 18}, ${planY + Math.min(52, drawH / 2)})`}>
                <line
                  x1={-18}
                  y1={0}
                  x2={0}
                  y2={0}
                  stroke="#64748b"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  style={{ pointerEvents: "none" }}
                />
                {externalLoggers.slice(0, 3).map((logger, idx) => {
                  const shortLabel = shortSensorCode(logger.label) || shortSensorCode(logger.customName) || loggerName(logger);
                  return (
                    <g key={logger.id} transform={`translate(0, ${idx * 30})`}>
                      <rect
                        x={0}
                        y={-11}
                        width={92}
                        height={22}
                        rx={11}
                        fill="#f1f5f9"
                        stroke="#64748b"
                        strokeWidth={1.2}
                      />
                      <circle cx={11} cy={0} r={6} fill="#64748b" />
                      <text
                        x={23}
                        y={-2}
                        fontSize={8}
                        fontWeight={700}
                        fill="#334155"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {shortLabel}
                      </text>
                      <text
                        x={23}
                        y={7}
                        fontSize={6}
                        fill="#64748b"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        внешний
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Floor plan objects (rendered first, below sensors) */}
            {objects.map(obj => (
              <ObjectShape
                key={obj.id}
                obj={obj}
                planX={planX} planY={planY} drawW={drawW} drawH={drawH}
                roomLengthM={roomLengthM || 1} roomWidthM={roomWidthM || 1}
                showDimensions={showDimensions}
                sensorLoggers={sensorLoggers}
                rangeMin={rangeMin}
                rangeMax={rangeMax}
                selected={selectedId === obj.id}
                onPointerDown={handleObjectPointerDown}
                onResizePointerDown={handleResizePointerDown}
                onDoubleClick={(id) => { setSelectedId(id); setPanelOpen(true); }}
              />
            ))}

            {/* Sensor positions overlay removed — sensors are now attached to objects */}

            {/* Transparent overlay for placing objects (click to drop, drag to draw) */}
            {placingType && (
              <rect
                x={planX} y={planY} width={drawW} height={drawH}
                fill="transparent"
                style={{ cursor: "crosshair", touchAction: "none" }}
                onPointerDown={handlePlacePointerDown}
              />
            )}

            {/* Live preview rect while drawing a new object */}
            {draftRect && draftRect.wPct > 0 && draftRect.hPct > 0 && (
              <rect
                x={planX + (draftRect.xPct / 100) * drawW}
                y={planY + (draftRect.yPct / 100) * drawH}
                width={(draftRect.wPct / 100) * drawW}
                height={(draftRect.hPct / 100) * drawH}
                rx={2}
                fill="rgba(245,158,11,0.12)"
                stroke="#f59e0b"
                strokeWidth={1.3}
                strokeDasharray="5 3"
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-2 right-2 flex gap-1 bg-white rounded-md border shadow-sm p-1 z-20">
          <button
            onClick={() => handleZoom(0.2)}
            className="px-2 py-1 text-xs font-medium hover:bg-gray-100 rounded transition-colors"
            title="Zoom in (Ctrl+Scroll)"
          >
            +
          </button>
          <div className="px-2 py-1 text-xs font-medium text-gray-600 min-w-[2.5rem] text-center">
            {(zoomLevel * 100).toFixed(0)}%
          </div>
          <button
            onClick={() => handleZoom(-0.2)}
            className="px-2 py-1 text-xs font-medium hover:bg-gray-100 rounded transition-colors"
            title="Zoom out (Ctrl+Scroll)"
          >
            −
          </button>
          <div className="w-px bg-gray-200" />
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs font-medium hover:bg-gray-100 rounded transition-colors"
            title="Reset zoom and pan"
          >
            Сброс
          </button>
        </div>

        {/* Side panel for selected object — opens on double-click */}
          {!readOnly && (
            <div className="absolute top-12 right-2 bg-white rounded-md border shadow-sm p-1 z-20">
              <button
                onClick={() => setIsFullscreen(v => !v)}
                className="px-2 py-1 text-xs font-medium hover:bg-gray-100 rounded transition-colors inline-flex items-center gap-1"
                title={isFullscreen ? "Выйти из полноэкранного режима" : "Открыть схему на весь экран"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {isFullscreen ? "Обычный" : "На весь экран"}
              </button>
            </div>
          )}
        {selectedObj && panelOpen && !readOnly && (
          <SidePanel
            obj={selectedObj}
            roomLengthM={roomLengthM || 1}
            roomWidthM={roomWidthM || 1}
            onUpdate={updateSelected}
            onRotate={rotateSelected}
            onDelete={deleteSelected}
            onClose={() => { setPanelOpen(false); setSelectedId(null); }}
          />
        )}
      </div>

      {/* Sensor picker removed — sensors are now managed via object side panel */}

      {/* Legend */}
      {objects.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-2">
          <div className="text-[11px] font-medium text-muted-foreground mb-1.5">Объекты на плане:</div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            {OBJECT_DEFS.filter(d => objects.some(o => o.type === d.type)).map(def => (
              <div key={def.type} className="flex items-center gap-1.5">
                <span>{def.icon}</span>
                <span className="text-muted-foreground">{def.ruLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zoom info */}
      <div className="text-[11px] text-muted-foreground px-1 space-y-1">
        <div>
          ✏️ Выберите объект на панели и <b>растяните мышью</b> нужный размер на плане (или просто кликните для стандартного). Выделенный объект можно тянуть за <b>ручки по углам и сторонам</b>; размеры привязываются к сетке 0,1 м.
        </div>
        <div>
          💡 <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Scroll</kbd> — масштаб, <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Drag</kbd> — перемещение холста
        </div>
      </div>
    </div>
  );
}

export default FloorPlanEditor;
