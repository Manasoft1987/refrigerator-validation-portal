/**
 * ReeferTruckDiagram3D
 *
 * Clean isometric 3D SVG diagram of a refrigerator truck cargo body.
 * Uses a standard isometric projection:
 *   - X axis goes right-and-down  (world right)
 *   - Y axis goes left-and-down   (world depth / into screen)
 *   - Z axis goes straight up     (world height)
 *
 * 15 ISPE-compliant sensor positions:
 *   C1–C8  — 8 corners
 *   W1–W4  — 4 wall centers (front, back, left, right)
 *   V1–V3  — 3 vertical center points (bottom, middle, top)
 */

import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useRef, useState } from "react";

type Logger = {
  id: number;
  label: string;
  customName?: string | null;
  role: "internal" | "external";
  position?: string | null;
  posX?: string | number | null;
  posY?: string | number | null;
};

type DragPos = { x: number; y: number };

type Props = {
  loggers: Logger[];
  protocolId: number;
  readOnly?: boolean;
  showDraggables?: boolean;
  coolingUnitPos?: DragPos | null;
  doorPos?: DragPos | null;
  onCoolingUnitPosChange?: (pos: DragPos) => void;
  onDoorPosChange?: (pos: DragPos) => void;
};

// ─── Isometric projection ─────────────────────────────────────────────────────
// Standard isometric: 30° angles.
// World: X = right, Y = depth (into screen), Z = up
// Screen: sx = ox + (X - Y) * cos30 * scale
//         sy = oy - (X + Y) * sin30 * scale - Z * scale

const SCALE  = 93.6;  // world unit → SVG pixels (72 * 1.3, enlarged 30%)
const ORIGIN_X = 330; // SVG anchor
const ORIGIN_Y = 380;

const COS30 = Math.cos(Math.PI / 6); // ≈ 0.866
const SIN30 = Math.sin(Math.PI / 6); // = 0.5

function iso(x: number, y: number, z: number): [number, number] {
  return [
    ORIGIN_X + (x - y) * COS30 * SCALE,
    ORIGIN_Y - (x + y) * SIN30 * SCALE - z * SCALE,
  ];
}

// ─── Box dimensions (world units) ────────────────────────────────────────────
// Realistic reefer truck cargo body: long, moderate width, moderate height
const W = 1.6;  // width  (X: left → right)
const D = 3.2;  // depth  (Y: front → back)
const H = 1.4;  // height (Z: bottom → top)

// ─── 15 ISPE sensor positions ─────────────────────────────────────────────────
const SENSOR_POSITIONS: {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  group: "corner" | "wall" | "center";
}[] = [
  // 8 corners (bottom 4 first, then top 4)
  { id: "C1", label: "Угол 1 (перед-лево-низ)",   x: 0,   y: 0,   z: 0,   group: "corner" },
  { id: "C2", label: "Угол 2 (перед-право-низ)",  x: W,   y: 0,   z: 0,   group: "corner" },
  { id: "C3", label: "Угол 3 (зад-право-низ)",    x: W,   y: D,   z: 0,   group: "corner" },
  { id: "C4", label: "Угол 4 (зад-лево-низ)",     x: 0,   y: D,   z: 0,   group: "corner" },
  { id: "C5", label: "Угол 5 (перед-лево-верх)",  x: 0,   y: 0,   z: H,   group: "corner" },
  { id: "C6", label: "Угол 6 (перед-право-верх)", x: W,   y: 0,   z: H,   group: "corner" },
  { id: "C7", label: "Угол 7 (зад-право-верх)",   x: W,   y: D,   z: H,   group: "corner" },
  { id: "C8", label: "Угол 8 (зад-лево-верх)",    x: 0,   y: D,   z: H,   group: "corner" },
  // 4 wall centers
  { id: "W1", label: "Центр передней стенки",     x: W/2, y: 0,   z: H/2, group: "wall" },
  { id: "W2", label: "Центр задней стенки",       x: W/2, y: D,   z: H/2, group: "wall" },
  { id: "W3", label: "Центр левой стенки",        x: 0,   y: D/2, z: H/2, group: "wall" },
  { id: "W4", label: "Центр правой стенки",       x: W,   y: D/2, z: H/2, group: "wall" },
  // 3 vertical center points
  { id: "V1", label: "Центр объёма (низ)",        x: W/2, y: D/2, z: 0,   group: "center" },
  { id: "V2", label: "Центр объёма (середина)",   x: W/2, y: D/2, z: H/2, group: "center" },
  { id: "V3", label: "Центр объёма (верх)",       x: W/2, y: D/2, z: H,   group: "center" },
];

// ─── Colors ───────────────────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  corner: "#2563eb",
  wall:   "#16a34a",
  center: "#dc2626",
};

const LOGGER_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#7c3aed", "#0891b2", "#be185d", "#65a30d",
  "#9333ea", "#0d9488", "#ea580c", "#4f46e5",
  "#b45309", "#0369a1", "#15803d",
];

function loggerColor(idx: number) {
  return LOGGER_COLORS[idx % LOGGER_COLORS.length];
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function pts(points: [number, number][]) {
  return points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

// ─── Component ────────────────────────────────────────────────────────────────
function defaultCoolingUnitPos(): DragPos {
  const [cx, cy] = iso(W / 2, 0.1, H + 0.11);
  return { x: cx, y: cy };
}

function defaultDoorPos(): DragPos {
  const [cx, cy] = iso(W * 0.75, 0, H * 0.5);
  return { x: cx, y: cy };
}

export default function ReeferTruckDiagram3D({
  loggers,
  protocolId,
  readOnly = false,
  showDraggables = false,
  coolingUnitPos,
  doorPos,
  onCoolingUnitPosChange,
  onDoorPosChange,
}: Props) {
  const utils = trpc.useUtils();
  const updateLogger = trpc.pv.updateLogger.useMutation({
    onSuccess: () => utils.pv.get.invalidate({ protocolId }),
  });

  const [tooltip, setTooltip] = useState<string | null>(null);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingElement, setDraggingElement] = useState<"coolingUnit" | "door" | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [localCoolingUnitPos, setLocalCoolingUnitPos] = useState<DragPos | null>(null);
  const [localDoorPos, setLocalDoorPos] = useState<DragPos | null>(null);

  const effectiveCoolingUnitPos = localCoolingUnitPos ?? coolingUnitPos ?? defaultCoolingUnitPos();
  const effectiveDoorPos = localDoorPos ?? doorPos ?? defaultDoorPos();

  // positionId → logger
  const positionMap: Record<string, Logger> = {};
  loggers.forEach(l => { if (l.position) positionMap[l.position] = l; });

  const handleSensorClick = (posId: string) => {
    if (readOnly) return;
    setAssigningTo(prev => (prev === posId ? null : posId));
  };

  const handleAssign = (posId: string, loggerId: number | null) => {
    if (loggerId === null) {
      const existing = positionMap[posId];
      if (existing) {
        updateLogger.mutate({ protocolId, loggerId: existing.id, position: null as any, posX: null, posY: null });
      }
    } else {
      updateLogger.mutate({ protocolId, loggerId, position: posId as any, posX: null, posY: null });
    }
    setAssigningTo(null);
  };

  const getSvgCoords = useCallback((clientX: number, clientY: number): DragPos => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const vb = svgRef.current.viewBox.baseVal;
    const scaleX = vb.width / rect.width;
    const scaleY = vb.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const handleDragStart = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    element: "coolingUnit" | "door",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const svgCoords = getSvgCoords(clientX, clientY);
    const currentPos = element === "coolingUnit" ? effectiveCoolingUnitPos : effectiveDoorPos;
    setDraggingElement(element);
    setDragOffset({ dx: svgCoords.x - currentPos.x, dy: svgCoords.y - currentPos.y });
  }, [readOnly, showDraggables, effectiveCoolingUnitPos, effectiveDoorPos, getSvgCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingElement) return;
    const svgCoords = getSvgCoords(e.clientX, e.clientY);
    const newPos = { x: svgCoords.x - dragOffset.dx, y: svgCoords.y - dragOffset.dy };
    if (draggingElement === "coolingUnit") {
      setLocalCoolingUnitPos(newPos);
    } else {
      setLocalDoorPos(newPos);
    }
  }, [draggingElement, dragOffset, getSvgCoords]);
  const handleMouseUp = useCallback(() => {
    if (!draggingElement) return;
    if (draggingElement === "coolingUnit" && localCoolingUnitPos) {
      onCoolingUnitPosChange?.(localCoolingUnitPos);
    } else if (draggingElement === "door" && localDoorPos) {
      onDoorPosChange?.(localDoorPos);
    }
    setDraggingElement(null);
  }, [draggingElement, localCoolingUnitPos, localDoorPos, onCoolingUnitPosChange, onDoorPosChange]);
  // Attach mouseup/touchend to window so drag always completes even if cursor
  // leaves the SVG element during fast movement.
  useEffect(() => {
    const onWindowMouseUp = () => handleMouseUp();
    const onWindowTouchEnd = () => handleMouseUp();
    const onWindowTouchMove = (e: TouchEvent) => {
      if (!draggingElement) return;
      e.preventDefault();
      const touch = e.touches[0];
      const svgCoords = getSvgCoords(touch.clientX, touch.clientY);
      const newPos = { x: svgCoords.x - dragOffset.dx, y: svgCoords.y - dragOffset.dy };
      if (draggingElement === "coolingUnit") setLocalCoolingUnitPos(newPos);
      else setLocalDoorPos(newPos);
    };
    window.addEventListener("mouseup", onWindowMouseUp);
    window.addEventListener("touchend", onWindowTouchEnd);
    window.addEventListener("touchmove", onWindowTouchMove, { passive: false });
    return () => {
      window.removeEventListener("mouseup", onWindowMouseUp);
      window.removeEventListener("touchend", onWindowTouchEnd);
      window.removeEventListener("touchmove", onWindowTouchMove);
    };
  }, [draggingElement, dragOffset, getSvgCoords, handleMouseUp]);;

  // ─── Pre-compute all 8 box vertices ─────────────────────────────────────────
  // Bottom face: b0=front-left, b1=front-right, b2=back-right, b3=back-left
  const b0 = iso(0, 0, 0);
  const b1 = iso(W, 0, 0);
  const b2 = iso(W, D, 0);
  const b3 = iso(0, D, 0);
  // Top face
  const t0 = iso(0, 0, H);
  const t1 = iso(W, 0, H);
  const t2 = iso(W, D, H);
  const t3 = iso(0, D, H);

  // ─── Refrigeration unit on top-front ────────────────────────────────────────
  const ruH = 0.22; // height of the unit
  const ruD = 0.18; // depth of the unit
  const ruX0 = W * 0.15, ruX1 = W * 0.85;
  const ru_bl  = iso(ruX0, 0,     H);
  const ru_br  = iso(ruX1, 0,     H);
  const ru_tr  = iso(ruX1, 0,     H + ruH);
  const ru_tl  = iso(ruX0, 0,     H + ruH);
  const ru_blb = iso(ruX0, ruD,   H);
  const ru_brb = iso(ruX1, ruD,   H);
  const ru_trb = iso(ruX1, ruD,   H + ruH);
  const ru_tlb = iso(ruX0, ruD,   H + ruH);

  // ─── SVG viewBox ─────────────────────────────────────────────────────────────
  // The box spans roughly from x≈100 to x≈550, y≈60 to y≈420 in SVG coords.
  // We use a fixed viewBox that comfortably contains everything.

  return (
    <div className="w-full select-none relative">
      <svg
        ref={svgRef}
        viewBox="0 0 760 560"
        className="w-full max-w-3xl mx-auto"
        style={{ touchAction: "none", cursor: draggingElement ? "grabbing" : "default" }}
        onClick={() => setAssigningTo(null)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* ── Ground shadow ── */}
        <ellipse
          cx={(b0[0] + b1[0] + b2[0] + b3[0]) / 4}
          cy={(b0[1] + b1[1] + b2[1] + b3[1]) / 4 + 12}
          rx={200} ry={18}
          fill="rgba(0,0,0,0.08)"
        />

        {/* ══ CARGO BODY ══════════════════════════════════════════════════════ */}
        {/* Painter's algorithm: back faces first, then sides, then top/front   */}

        {/* Back face (зад: b3-b2-t2-t3) — darkest */}
        <polygon
          points={pts([b3, b2, t2, t3])}
          fill="#c8d8e8" stroke="#7a9ab5" strokeWidth={1.2}
        />

        {/* Left face (лево: b0-b3-t3-t0) */}
        <polygon
          points={pts([b0, b3, t3, t0])}
          fill="#d8e8f4" stroke="#7a9ab5" strokeWidth={1.2}
        />

        {/* Right face (право: b1-b2-t2-t1) */}
        <polygon
          points={pts([b1, b2, t2, t1])}
          fill="#dce8f0" stroke="#7a9ab5" strokeWidth={1.2}
        />

        {/* Top face (крыша: t0-t1-t2-t3) — lightest */}
        <polygon
          points={pts([t0, t1, t2, t3])}
          fill="#eef4fa" stroke="#7a9ab5" strokeWidth={1.2}
        />

        {/* Front face / door (перед: b0-b1-t1-t0) — slightly blue tint */}
        <polygon
          points={pts([b0, b1, t1, t0])}
          fill="#dbeafe" stroke="#7a9ab5" strokeWidth={1.2}
        />

        {/* Door vertical split line */}
        {(() => {
          const dm = iso(W / 2, 0, 0);
          const dm2 = iso(W / 2, 0, H);
          return <line x1={dm[0]} y1={dm[1]} x2={dm2[0]} y2={dm2[1]} stroke="#93c5fd" strokeWidth={0.8} strokeDasharray="4,3" />;
        })()}

        {/* Door handle */}
        {(() => {
          const dh1 = iso(W * 0.54, 0.02, H * 0.42);
          const dh2 = iso(W * 0.54, 0.02, H * 0.58);
          return <line x1={dh1[0]} y1={dh1[1]} x2={dh2[0]} y2={dh2[1]} stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" />;
        })()}

        {/* ── Refrigeration unit ── */}
        {/* front face */}
        <polygon points={pts([ru_bl, ru_br, ru_tr, ru_tl])} fill="#bfdbfe" stroke="#93c5fd" strokeWidth={0.8} />
        {/* top face */}
        <polygon points={pts([ru_tl, ru_tr, ru_trb, ru_tlb])} fill="#dbeafe" stroke="#93c5fd" strokeWidth={0.8} />
        {/* back face */}
        <polygon points={pts([ru_blb, ru_brb, ru_trb, ru_tlb])} fill="#eff6ff" stroke="#93c5fd" strokeWidth={0.8} />

        {/* ── Strong outline edges ── */}
        {/* Bottom rectangle */}
        <polyline points={pts([b0, b1, b2, b3, b0])} fill="none" stroke="#4a6a85" strokeWidth={1.4} />
        {/* Top rectangle */}
        <polyline points={pts([t0, t1, t2, t3, t0])} fill="none" stroke="#4a6a85" strokeWidth={1.4} />
        {/* Vertical edges */}
        {[[b0, t0], [b1, t1], [b2, t2], [b3, t3]].map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#4a6a85" strokeWidth={1.4} />
        ))}

        {/* ══ DRAGGABLE ELEMENTS (rendered BEFORE sensors so sensors appear on top) ══ */}
        {showDraggables && (
          <>
            {/* Cooling unit */}
            <g
              style={{ cursor: readOnly ? "default" : "grab" }}
              onMouseDown={e => handleDragStart(e, "coolingUnit")}
              onTouchStart={e => handleDragStart(e, "coolingUnit")}
              transform={`translate(${effectiveCoolingUnitPos.x}, ${effectiveCoolingUnitPos.y})`}
            >
              <ellipse cx={0} cy={24} rx={30} ry={7} fill="rgba(0,0,0,0.12)" />
              <rect x={-28} y={-20} width={56} height={38} rx={6} fill="#1e40af" stroke="#1d4ed8" strokeWidth={1.5} />
              {[-12, -5, 2, 9].map(lx => (
                <line key={lx} x1={lx} y1={-13} x2={lx} y2={13} stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" />
              ))}
              <circle cx={18} cy={0} r={11} fill="none" stroke="#93c5fd" strokeWidth={1.5} />
              <circle cx={18} cy={0} r={3} fill="#93c5fd" />
              <text x={0} y={34} textAnchor="middle" fontSize={11} fontWeight="700"
                fill="#1e40af" style={{ userSelect: "none", pointerEvents: "none" }}>
                Агрегат
              </text>
              {!readOnly && (
                <text x={0} y={46} textAnchor="middle" fontSize={9}
                  fill="#64748b" style={{ userSelect: "none", pointerEvents: "none" }}>
                  ↕ перетащить
                </text>
              )}
            </g>
            {/* Door */}
            <g
              style={{ cursor: readOnly ? "default" : "grab" }}
              onMouseDown={e => handleDragStart(e, "door")}
              onTouchStart={e => handleDragStart(e, "door")}
              transform={`translate(${effectiveDoorPos.x}, ${effectiveDoorPos.y})`}
            >
              <ellipse cx={0} cy={40} rx={22} ry={6} fill="rgba(0,0,0,0.10)" />
              <rect x={-18} y={-34} width={36} height={68} rx={4} fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} />
              <rect x={-12} y={-28} width={24} height={56} rx={2} fill="none" stroke="#93c5fd" strokeWidth={1} />
              <rect x={8} y={-7} width={4} height={14} rx={2} fill="#3b82f6" />
              <text x={0} y={50} textAnchor="middle" fontSize={11} fontWeight="700"
                fill="#1d4ed8" style={{ userSelect: "none", pointerEvents: "none" }}>
                Дверь
              </text>
              {!readOnly && (
                <text x={0} y={62} textAnchor="middle" fontSize={9}
                  fill="#64748b" style={{ userSelect: "none", pointerEvents: "none" }}>
                  ↕ перетащить
                </text>
              )}
            </g>
          </>
        )}
        {/* ══ SENSOR DOTS ═════════════════════════════════════════════════════ */}
        {SENSOR_POSITIONS.map(sp => {
          const [sx, sy] = iso(sp.x, sp.y, sp.z);
          const assigned = positionMap[sp.id];
          const loggerIdx = assigned ? loggers.findIndex(l => l.id === assigned.id) : -1;
          const color = GROUP_COLORS[sp.group]; // always use group colour (blue/green/red)
          const isAssigning = assigningTo === sp.id;
          const isHovered = tooltip === sp.id;
          // Rounded rectangle dimensions
          const BW = assigned ? 30 : 24; // box width
          const BH = 18;                  // box height
          const RX = 4;                   // corner radius
          const displayName = assigned
            ? (assigned.label.length > 4 ? assigned.label.slice(-4) : assigned.label)
            : sp.id;
          return (
            <g
              key={sp.id}
              style={{ cursor: readOnly ? "default" : "pointer" }}
              onClick={e => { e.stopPropagation(); handleSensorClick(sp.id); }}
              onMouseEnter={() => setTooltip(sp.id)}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Animated dashed ring when active */}
              {isAssigning && (
                <rect
                  x={sx - BW / 2 - 5} y={sy - BH / 2 - 5}
                  width={BW + 10} height={BH + 10} rx={RX + 3}
                  fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5,3"
                >
                  <animate attributeName="stroke-dashoffset" from="0" to="16" dur="0.9s" repeatCount="indefinite" />
                </rect>
              )}
              {/* Hover highlight */}
              {isHovered && !isAssigning && (
                <rect
                  x={sx - BW / 2 - 4} y={sy - BH / 2 - 4}
                  width={BW + 8} height={BH + 8} rx={RX + 2}
                  fill={color} opacity={0.18}
                />
              )}
              {/* White border */}
              <rect
                x={sx - BW / 2 - 2} y={sy - BH / 2 - 2}
                width={BW + 4} height={BH + 4} rx={RX + 1}
                fill="white" stroke={color} strokeWidth={1.5}
              />
              {/* Filled box */}
              <rect
                x={sx - BW / 2} y={sy - BH / 2}
                width={BW} height={BH} rx={RX}
                fill={color}
              />
              {/* Label inside box */}
              <text
                x={sx} y={sy}
                textAnchor="middle" dominantBaseline="central"
                fontSize={assigned ? 8 : 9} fontWeight="700" fill="white"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {displayName}
              </text>
            </g>
          );
        })}

        {/* (draggable elements moved above sensor dots — see above) */}
        {/* ══ LEGEND ══════════════════════════════════════════════════════════ */}
        {[
          { color: GROUP_COLORS.corner, label: "Угол (8 шт.)" },
          { color: GROUP_COLORS.wall,   label: "Центр стенки (4 шт.)" },
          { color: GROUP_COLORS.center, label: "Центр объёма (3 шт.)" },
        ].map((item, i) => (
          <g key={i} transform={`translate(12, ${378 + i * 24})`}>
            <circle cx={9} cy={9} r={8} fill={item.color} />
            <text x={22} y={14} fontSize={12} fill="#374151" fontFamily="sans-serif">{item.label}</text>
          </g>
        ))}

        {/* ISPE reference */}
        <text x={748} y={552} textAnchor="end" fontSize={8} fill="#94a3b8" fontFamily="sans-serif">
          ISPE Good Practice Guide: Cold Chain Management
        </text>
      </svg>

      {/* ── Tooltip ── */}
      {tooltip && (() => {
        const sp = SENSOR_POSITIONS.find(s => s.id === tooltip);
        if (!sp) return null;
        const assigned = positionMap[sp.id];
        return (
          <div
            className="absolute z-20 pointer-events-none bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs max-w-[200px]"
            style={{ left: "50%", top: 8, transform: "translateX(-50%)" }}
          >
            <div className="font-semibold">{sp.id} — {sp.label}</div>
            {assigned ? (
              <div className="mt-1 text-emerald-600 font-medium">
                ✓ {assigned.customName || assigned.label}
              </div>
            ) : (
              <div className="mt-1 text-muted-foreground">Датчик не назначен</div>
            )}
            {!readOnly && <div className="mt-1 text-amber-600">Нажмите для назначения</div>}
          </div>
        );
      })()}

      {/* ── Assignment dropdown ── */}
      {assigningTo && !readOnly && (() => {
        const sp = SENSOR_POSITIONS.find(s => s.id === assigningTo);
        if (!sp) return null;
        const assigned = positionMap[assigningTo];
        return (
          <div
            className="mt-3 p-3 border rounded-lg bg-card shadow-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-2">
              Назначить датчик на позицию{" "}
              <span className="text-primary">{assigningTo}</span>
              {" — "}{sp.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {assigned && (
                <button
                  onClick={() => handleAssign(assigningTo, null)}
                  className="text-xs px-3 py-1.5 rounded border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                >
                  ✕ Убрать датчик
                </button>
              )}
              {loggers.filter(l => l.role === "internal").map((l, idx) => {
                const name = l.customName || l.label;
                const isAssigned = assigned?.id === l.id;
                const alreadyElsewhere = !isAssigned && Object.values(positionMap).some(m => m.id === l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => handleAssign(assigningTo, l.id)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1.5 ${
                      isAssigned
                        ? "bg-primary text-primary-foreground border-primary"
                        : alreadyElsewhere
                          ? "bg-muted text-muted-foreground border-border opacity-60"
                          : "bg-background text-foreground border-border hover:bg-accent"
                    }`}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: loggerColor(idx) }}
                    />
                    {name}
                    {alreadyElsewhere && " (занят)"}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Position summary table ── */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-2 py-1.5 border border-border font-medium">Позиция</th>
              <th className="text-left px-2 py-1.5 border border-border font-medium">Описание</th>
              <th className="text-left px-2 py-1.5 border border-border font-medium">Тип</th>
              <th className="text-left px-2 py-1.5 border border-border font-medium">Датчик</th>
            </tr>
          </thead>
          <tbody>
            {SENSOR_POSITIONS.map(sp => {
              const assigned = positionMap[sp.id];
              const loggerIdx = assigned ? loggers.findIndex(l => l.id === assigned.id) : -1;
              return (
                <tr
                  key={sp.id}
                  className={`hover:bg-muted/30 transition-colors ${!readOnly ? "cursor-pointer" : ""}`}
                  onClick={() => !readOnly && handleSensorClick(sp.id)}
                >
                  <td className="px-2 py-1.5 border border-border font-mono font-semibold">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold mr-1"
                      style={{ background: GROUP_COLORS[sp.group] }}
                    >
                      {sp.id.slice(0, 2)}
                    </span>
                    {sp.id}
                  </td>
                  <td className="px-2 py-1.5 border border-border text-muted-foreground">{sp.label}</td>
                  <td className="px-2 py-1.5 border border-border">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      sp.group === "corner" ? "bg-blue-100 text-blue-700" :
                      sp.group === "wall"   ? "bg-emerald-100 text-emerald-700" :
                                              "bg-rose-100 text-rose-700"
                    }`}>
                      {sp.group === "corner" ? "Угол" : sp.group === "wall" ? "Стенка" : "Центр"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 border border-border">
                    {assigned ? (
                      <span className="font-medium" style={{ color: loggerColor(loggerIdx) }}>
                        {assigned.customName || assigned.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        {readOnly ? "—" : "Нажмите для назначения"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
