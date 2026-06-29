/*
 * FloorPlanEditor — Interactive SVG floor plan editor
 *
 * Objects are stored as % of room dimensions (0–100) for scale-independence.
 * heightM is stored directly in meters (not as %).
 *
 * Features:
 *  - Drag objects anywhere including to walls (no clamp preventing edge placement)
 *  - 4-corner resize handles
 *  - 90° rotation
 *  - Side panel with precise numeric inputs (meters)
 *  - Height field per object (stored in heightM)
 *  - Per-object sensor slots (up to 4): each has sensorId + heightFromFloor
 *  - Size labels rendered on canvas (Д×Ш×В)
 *  - Zoom and pan controls (Ctrl+Scroll to zoom, Ctrl+Drag to pan)
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCw, Trash2, Plus, Move, Layers, X, ChevronRight } from "lucide-react";
import { nanoid } from "nanoid";

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
}

// ─── Object shape renderer ────────────────────────────────────────────────────

function ObjectShape({
  obj,
  planX, planY, drawW, drawH,
  roomLengthM, roomWidthM,
  showDimensions,
  selected,
  onPointerDown,
  onResizePointerDown,
  onDoubleClick,
}: {
  obj: FloorPlanObject;
  planX: number; planY: number; drawW: number; drawH: number;
  roomLengthM: number; roomWidthM: number;
  showDimensions: boolean;
  selected: boolean;
  onPointerDown: (id: string, e: React.PointerEvent) => void;
  onResizePointerDown: (id: string, corner: "nw"|"ne"|"se"|"sw", e: React.PointerEvent) => void;
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

  const HR = 6; // handle radius

  // Sensor point: render as circle with ID label + height below
  if (obj.type === "sensor_point") {
    // Fixed radius: ~14px so 4 digits are readable but not huge
    const r = 14;
    const cx2 = x + w / 2;
    const cy2 = y + h / 2;
    const shortId = (obj.label || "?").slice(0, 6);
    const htLabel = (obj.heightM ?? 0) > 0 ? `${(obj.heightM as number).toFixed(1)}м` : "";
    return (
      <g
        style={{ cursor: "move", userSelect: "none" }}
        onPointerDown={e => { e.stopPropagation(); onPointerDown(obj.id, e); }}
        onDoubleClick={e => { e.stopPropagation(); onDoubleClick(obj.id); }}
      >
        <circle cx={cx2} cy={cy2} r={r} fill="#0ea5e9" stroke={selected ? "#f59e0b" : "#0369a1"} strokeWidth={selected ? 2.5 : 1.5} />
        {selected && <circle cx={cx2} cy={cy2} r={r + 4} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />}
        <text x={cx2} y={cy2 + 4} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1e3a8a" style={{ pointerEvents: "none", userSelect: "none" }}>
          {shortId}
        </text>
        {htLabel && (
          <text x={cx2} y={cy2 + r + 9} textAnchor="middle" fontSize={7} fill="#1e3a8a" fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>
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

      {/* Resize handles (when selected) */}
      {selected && (
        <>
          {([[x,y],[x+w,y],[x+w,y+h],[x,y+h]] as [number,number][]).map(([handleX, handleY], i) => (
            <circle key={i} cx={handleX} cy={handleY} r={HR} fill="white" stroke="#f59e0b" strokeWidth={1.5}
              style={{ cursor: "nwse-resize", pointerEvents: "all" }}
              onPointerDown={ev => { ev.stopPropagation(); onResizePointerDown(obj.id, (["nw","ne","se","sw"][i] as "nw"|"ne"|"se"|"sw"), ev); }}
            />
          ))}
        </>
      )}
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
  | { kind: "resize"; id: string; corner: "nw"|"ne"|"se"|"sw" };

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

  const svgRef = useRef<SVGSVGElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Active drag/resize state stored in ref to avoid stale closure issues
  const dragState = useRef<{
    mode: DragMode;
    startSvgX: number;
    startSvgY: number;
    snapshot: FloorPlanObject;
  } | null>(null);

  // Compute draw area dimensions
  const planW = SVG_W - PAD * 2;
  const planH = SVG_H - PAD * 2;
  const aspect = roomLengthM > 0 && roomWidthM > 0 ? roomLengthM / roomWidthM : 1;
  let drawW = planW;
  let drawH = planW / aspect;
  if (drawH > planH) { drawH = planH; drawW = planH * aspect; }
  const planX = PAD + (planW - drawW) / 2;
  const planY = PAD + (planH - drawH) / 2;

  const drawRef = useRef({ planX, planY, drawW, drawH });
  drawRef.current = { planX, planY, drawW, drawH };

  // Convert client coords → SVG coords
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (SVG_W / rect.width),
      y: (clientY - rect.top)  * (SVG_H / rect.height),
    };
  }, []);

  // Convert SVG coords → room % (clamped 0–100)
  const svgToRoomPct = useCallback((svgX: number, svgY: number) => {
    const { planX, planY, drawW, drawH } = drawRef.current;
    return {
      x: clamp(((svgX - planX) / drawW) * 100, 0, 100),
      y: clamp(((svgY - planY) / drawH) * 100, 0, 100),
    };
  }, []);

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
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    dragState.current = {
      mode: { kind: "move", id },
      startSvgX: x,
      startSvgY: y,
      snapshot: { ...obj },
    };
  }, [readOnly, objects, clientToSvg, selectedId]);

  const handleResizePointerDown = useCallback((id: string, corner: "nw"|"ne"|"se"|"sw", e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const obj = objects.find(o => o.id === id);
    if (!obj) return;
    dragState.current = {
      mode: { kind: "resize", id, corner },
      startSvgX: x,
      startSvgY: y,
      snapshot: { ...obj },
    };
  }, [readOnly, objects, clientToSvg]);

  // ── Global pointer move / up ───────────────────────────────────────────────

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const { drawW, drawH } = drawRef.current;
      const { x: svgX, y: svgY } = (() => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const rect = svg.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * (SVG_W / rect.width),
          y: (e.clientY - rect.top)  * (SVG_H / rect.height),
        };
      })();

      const dxPct = ((svgX - ds.startSvgX) / drawW) * 100;
      const dyPct = ((svgY - ds.startSvgY) / drawH) * 100;
      const snap  = ds.snapshot;
      const MIN   = 1.5; // minimum size in %

      if (ds.mode.kind === "move") {
        // Allow objects to reach walls: clamp so object stays within 0–100%
        // No wall snap — allow precise positioning at any edge
        let newX = clamp(snap.xPct + dxPct, 0, Math.max(0, 100 - snap.widthPct));
        let newY = clamp(snap.yPct + dyPct, 0, Math.max(0, 100 - snap.heightPct));
        onChange(objects.map(o => o.id === ds.mode.id ? { ...o, xPct: newX, yPct: newY } : o));
      } else {
        const { corner } = ds.mode;
        let nx = snap.xPct, ny = snap.yPct, nw = snap.widthPct, nh = snap.heightPct;

        if (corner === "se") {
          nw = Math.max(MIN, snap.widthPct  + dxPct);
          nh = Math.max(MIN, snap.heightPct + dyPct);
        } else if (corner === "sw") {
          const w2 = Math.max(MIN, snap.widthPct - dxPct);
          nx = snap.xPct + (snap.widthPct - w2);
          nw = w2;
          nh = Math.max(MIN, snap.heightPct + dyPct);
        } else if (corner === "ne") {
          nw = Math.max(MIN, snap.widthPct + dxPct);
          const h2 = Math.max(MIN, snap.heightPct - dyPct);
          ny = snap.yPct + (snap.heightPct - h2);
          nh = h2;
        } else { // nw
          const w2 = Math.max(MIN, snap.widthPct - dxPct);
          nx = snap.xPct + (snap.widthPct - w2);
          nw = w2;
          const h2 = Math.max(MIN, snap.heightPct - dyPct);
          ny = snap.yPct + (snap.heightPct - h2);
          nh = h2;
        }
        // Allow resize to reach walls
        nw = Math.min(nw, 100 - nx);
        nh = Math.min(nh, 100 - ny);
        nx = clamp(nx, 0, 100);
        ny = clamp(ny, 0, 100);
        onChange(objects.map(o => o.id === ds.mode.id ? { ...o, xPct: nx, yPct: ny, widthPct: nw, heightPct: nh } : o));
      }
    };

    const onUp = () => { dragState.current = null; };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [objects, onChange]);

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
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX,
        panY,
      };
    }
  }, [panX, panY]);

  const handleSvgPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanX(panStartRef.current.panX + dx / zoomLevel);
      setPanY(panStartRef.current.panY + dy / zoomLevel);
    }
  }, [isPanning, zoomLevel]);

  const handleSvgPointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── Place new object on canvas click ──────────────────────────────────────

  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    if (!placingType || readOnly) return;
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const { x: xPct, y: yPct } = svgToRoomPct(x, y);
    const def = getDef(placingType);
    const newObj: FloorPlanObject = {
      id: nanoid(),
      type: placingType,
      xPct,
      yPct,
      widthPct: def.defaultW,
      heightPct: def.defaultH,
      heightM: 0,
      rotation: 0,
      label: def.ruLabel,
    };
    onChange([...objects, newObj]);
    setPlacingType(null);
  }, [placingType, readOnly, clientToSvg, svgToRoomPct, objects, onChange]);

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
    <div className="space-y-2">
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
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {OBJECT_DEFS.map(def => (
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
          )}

          {placingType && (
            <div className="px-3 py-1.5 bg-amber-50 border-t text-xs text-amber-800 flex items-center gap-2">
              <Move className="h-3.5 w-3.5" />
              Кликните по плану для размещения: <b>{getDef(placingType).ruLabel}</b>
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
          className="w-full max-w-3xl mx-auto bg-white rounded-md border"
          style={{ touchAction: "none", cursor: isPanning ? "grabbing" : (placingType ? "crosshair" : "default"), display: "block" }}
          onClick={() => { if (!placingType) { setSelectedId(null); setPickerForCell(null); } }}
          onWheel={handleWheel}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={handleSvgPointerUp}
        >
          {/* Zoom and pan group */}
          <g transform={`translate(${panX}, ${panY}) scale(${zoomLevel})`}>
            {/* Room outline */}
            <rect x={planX} y={planY} width={drawW} height={drawH} fill="#f8fafc" stroke="#0f172a" strokeWidth={1.5} />

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

            {/* Floor plan objects (rendered first, below sensors) */}
            {objects.map(obj => (
              <ObjectShape
                key={obj.id}
                obj={obj}
                planX={planX} planY={planY} drawW={drawW} drawH={drawH}
                roomLengthM={roomLengthM || 1} roomWidthM={roomWidthM || 1}
                showDimensions={showDimensions}
                selected={selectedId === obj.id}
                onPointerDown={handleObjectPointerDown}
                onResizePointerDown={handleResizePointerDown}
                onDoubleClick={(id) => { setSelectedId(id); setPanelOpen(true); }}
              />
            ))}

            {/* Sensor positions overlay removed — sensors are now attached to objects */}

            {/* Transparent click overlay for placing objects */}
            {placingType && (
              <rect
                x={planX} y={planY} width={drawW} height={drawH}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onClick={handleCanvasClick}
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
      <div className="text-[11px] text-muted-foreground px-1">
        💡 Совет: Используйте <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Scroll</kbd> для масштабирования, <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Drag</kbd> для перемещения
      </div>
    </div>
  );
}

export default FloorPlanEditor;
