/**
 * RefrigeratorDiagram
 *
 * Renders an SVG schematic of a refrigerator with sensor badges.
 *
 * ≤ 2 internal sensors → snap-to-position buttons (top / bottom shelf)
 * ≥ 3 internal sensors → free drag-and-drop inside the cabinet
 * External sensor      → shown outside the cabinet (right side)
 *
 * Props:
 *   loggers        – array of pvLogger rows (need id, label, customName, role, position, posX, posY)
 *   protocolId     – used when calling updateLogger mutation
 *   readOnly       – if true, no editing (used in PDF preview mode)
 */

import { trpc } from "@/lib/trpc";
import { useCallback, useRef, useState } from "react";

type Logger = {
  id: number;
  label: string;
  customName?: string | null;
  role: "internal" | "external";
  position?: string | null;
  posX?: string | number | null;
  posY?: string | number | null;
};

type Props = {
  loggers: Logger[];
  protocolId: number;
  readOnly?: boolean;
};

// Named snap positions inside the SVG viewport (0-100 %)
const SNAP_POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  top:    { x: 50, y: 22, label: "Верхняя полка" },
  middle: { x: 50, y: 50, label: "Средняя полка" },
  bottom: { x: 50, y: 76, label: "Нижняя полка" },
  door:   { x: 88, y: 50, label: "Дверь" },
};

// Colours per sensor index
const BADGE_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#7c3aed", "#0891b2", "#be185d", "#65a30d",
];

function badgeColor(idx: number) {
  return BADGE_COLORS[idx % BADGE_COLORS.length];
}

function badgeLabel(logger: Logger): string {
  const serial = String(logger.label ?? "").trim();
  const digits = serial.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  if (serial.length > 0) return serial.length > 6 ? serial.slice(-6) : serial;
  const fallback = String(logger.customName ?? "").trim();
  return fallback.length > 6 ? fallback.slice(0, 6) : fallback;
}

export default function RefrigeratorDiagram({ loggers, protocolId, readOnly = false }: Props) {
  const utils = trpc.useUtils();
  const updateLogger = trpc.pv.updateLogger.useMutation({
    onSuccess: () => utils.pv.get.invalidate({ protocolId }),
  });

  const svgRef = useRef<SVGSVGElement>(null);

  // Dragging state for free-drag mode
  const [dragging, setDragging] = useState<{ id: number; startX: number; startY: number } | null>(null);
  const [localPos, setLocalPos] = useState<Record<number, { x: number; y: number }>>({});

  const internals = loggers.filter(l => l.role === "internal");
  const externals = loggers.filter(l => l.role === "external");
  const freeMode = internals.length >= 3;

  // Convert SVG-relative mouse position to 0-100 % coordinates
  const toPercent = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 50, y: 50 };
    const rect = svgRef.current.getBoundingClientRect();
    // Cabinet occupies x: 5%-75%, y: 5%-95% of SVG
    const cabLeft = rect.left + rect.width * 0.05;
    const cabRight = rect.left + rect.width * 0.75;
    const cabTop = rect.top + rect.height * 0.05;
    const cabBottom = rect.top + rect.height * 0.95;
    const x = Math.max(0, Math.min(100, ((clientX - cabLeft) / (cabRight - cabLeft)) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - cabTop) / (cabBottom - cabTop)) * 100));
    return { x, y };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || readOnly) return;
    const pct = toPercent(e.clientX, e.clientY);
    setLocalPos(prev => ({ ...prev, [dragging.id]: pct }));
  }, [dragging, readOnly, toPercent]);

  const handleMouseUp = useCallback(() => {
    if (!dragging || readOnly) return;
    const pos = localPos[dragging.id];
    if (pos) {
      updateLogger.mutate({
        protocolId,
        loggerId: dragging.id,
        position: "unset",
        posX: pos.x,
        posY: pos.y,
      });
    }
    setDragging(null);
  }, [dragging, localPos, protocolId, readOnly, updateLogger]);

  const handleSnapPosition = (loggerId: number, snap: string) => {
    if (readOnly) return;
    updateLogger.mutate({
      protocolId,
      loggerId,
      position: snap as any,
      posX: null,
      posY: null,
    });
  };

  // Resolve display position for a logger (0-100 %)
  const getDisplayPos = (l: Logger, idx: number): { x: number; y: number } => {
    // Dragging override
    if (localPos[l.id]) return localPos[l.id];
    // Free-drag stored position
    if (l.posX != null && l.posY != null) {
      return { x: Number(l.posX), y: Number(l.posY) };
    }
    // Named snap position
    if (l.position && l.position !== "unset" && SNAP_POSITIONS[l.position]) {
      return SNAP_POSITIONS[l.position];
    }
    // Default: distribute vertically
    const total = internals.length;
    const rank = internals.findIndex(i => i.id === l.id);
    return { x: 50, y: total <= 1 ? 50 : 15 + (rank / (total - 1)) * 70 };
  };

  // SVG viewport: 400 x 340
  // Cabinet: x=20, y=17, w=300, h=306
  // Door: x=290, y=17, w=50, h=306 (part of cabinet)
  const W = 400;
  const H = 340;
  const CAB_X = 20, CAB_Y = 17, CAB_W = 300, CAB_H = 306;
  const DOOR_X = CAB_X + CAB_W - 50;
  const SHELF1_Y = CAB_Y + CAB_H * 0.33;
  const SHELF2_Y = CAB_Y + CAB_H * 0.66;

  // Convert 0-100% to SVG coords inside cabinet (excluding door area)
  const toSvgXY = (px: number, py: number) => ({
    sx: CAB_X + (px / 100) * (DOOR_X - CAB_X - 10),
    sy: CAB_Y + (py / 100) * CAB_H,
  });

  const BADGE_R = 18;

  return (
    <div className="w-full select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-lg mx-auto"
        style={{ touchAction: "none" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Cabinet body */}
        <rect
          x={CAB_X} y={CAB_Y} width={CAB_W} height={CAB_H}
          rx={8} ry={8}
          fill="#f1f5f9" stroke="#94a3b8" strokeWidth={2}
        />
        {/* Door */}
        <rect
          x={DOOR_X} y={CAB_Y} width={50} height={CAB_H}
          rx={4} ry={4}
          fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5}
        />
        <text x={DOOR_X + 25} y={CAB_Y + CAB_H / 2} textAnchor="middle"
          fontSize={10} fill="#64748b" transform={`rotate(-90,${DOOR_X + 25},${CAB_Y + CAB_H / 2})`}>
          Дверь
        </text>
        {/* Door handle */}
        <rect x={DOOR_X + 38} y={CAB_Y + CAB_H * 0.35} width={6} height={CAB_H * 0.3}
          rx={3} fill="#94a3b8" />
        {/* Shelves */}
        <line x1={CAB_X + 4} y1={SHELF1_Y} x2={DOOR_X - 4} y2={SHELF1_Y}
          stroke="#94a3b8" strokeWidth={2} strokeDasharray="6,3" />
        <line x1={CAB_X + 4} y1={SHELF2_Y} x2={DOOR_X - 4} y2={SHELF2_Y}
          stroke="#94a3b8" strokeWidth={2} strokeDasharray="6,3" />
        {/* Shelf labels */}
        <text x={CAB_X + 6} y={SHELF1_Y - 5} fontSize={9} fill="#94a3b8">Верхняя полка</text>
        <text x={CAB_X + 6} y={SHELF2_Y - 5} fontSize={9} fill="#94a3b8">Нижняя полка</text>

        {/* Internal sensor badges */}
        {internals.map((l, idx) => {
          const pos = getDisplayPos(l, idx);
          const { sx, sy } = toSvgXY(pos.x, pos.y);
          const color = badgeColor(idx);
          const name = badgeLabel(l);
          const isDragging = dragging?.id === l.id;
          return (
            <g
              key={l.id}
              style={{ cursor: freeMode && !readOnly ? "grab" : "default" }}
              onMouseDown={freeMode && !readOnly ? (e) => {
                e.preventDefault();
                setDragging({ id: l.id, startX: e.clientX, startY: e.clientY });
              } : undefined}
            >
              <circle
                cx={sx} cy={sy} r={BADGE_R}
                fill={color}
                stroke={isDragging ? "#1e293b" : "white"}
                strokeWidth={isDragging ? 2.5 : 2}
                opacity={0.92}
              />
              <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fontWeight="700" fill="white" style={{ pointerEvents: "none" }}>
                {name.length > 6 ? name.slice(0, 5) + "…" : name}
              </text>
            </g>
          );
        })}

        {/* External sensor badges — outside the cabinet on the right */}
        {externals.map((l, idx) => {
          const color = badgeColor(internals.length + idx);
          const name = badgeLabel(l);
          const ey = CAB_Y + 40 + idx * 55;
          return (
            <g key={l.id}>
              {/* Connector line */}
              <line x1={CAB_X + CAB_W + 10} y1={ey} x2={CAB_X + CAB_W + 30} y2={ey}
                stroke={color} strokeWidth={1.5} strokeDasharray="4,2" />
              <circle cx={CAB_X + CAB_W + 48} cy={ey} r={BADGE_R}
                fill={color} stroke="white" strokeWidth={2} opacity={0.92} />
              <text x={CAB_X + CAB_W + 48} y={ey + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fontWeight="700" fill="white" style={{ pointerEvents: "none" }}>
                {name.length > 6 ? name.slice(0, 5) + "…" : name}
              </text>
              <text x={CAB_X + CAB_W + 48} y={ey + BADGE_R + 10} textAnchor="middle"
                fontSize={8} fill="#64748b">
                Внешний
              </text>
            </g>
          );
        })}
      </svg>

      {/* Snap-to-position buttons for ≤ 2 internal sensors */}
      {!freeMode && !readOnly && internals.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Назначьте позицию каждому датчику:
          </p>
          {internals.map((l, idx) => {
            const color = badgeColor(idx);
            const name = l.customName || l.label;
            return (
              <div key={l.id} className="flex items-center gap-2 flex-wrap justify-center">
                <span
                  className="inline-flex items-center justify-center rounded-full text-white text-xs font-bold px-2 py-0.5"
                  style={{ background: color, minWidth: 60 }}
                >
                  {name}
                </span>
                {Object.entries(SNAP_POSITIONS).map(([key, sp]) => (
                  <button
                    key={key}
                    onClick={() => handleSnapPosition(l.id, key)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      l.position === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {freeMode && !readOnly && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Перетащите датчики на нужное место внутри холодильника
        </p>
      )}
    </div>
  );
}
