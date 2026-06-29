/**
 * WarehouseLayoutDiagram
 *
 * 2D top-view plan of a storage zone with the grid of recommended logger
 * positions according to EAEU Recommendation №8 (clause 16d):
 *   • horizontal points: 2 (≤10 m), 3 (≤40 m), 4 (≤60 m), 5 (>60 m);
 *   • vertical points:   1 (≤1.5 m), 2 (<5 m), 3 (≥5 m).
 *
 * The component renders one plan per vertical tier so the user can assign
 * each logger to a specific cell on a specific tier. Sensor positions are
 * encoded as ids of the form `Lr{row}-c{col}-t{tier}` (1-based indices) and
 * stored in the existing `pvLoggers.position` column.
 */
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Snowflake, DoorOpen } from "lucide-react";

export type WarehouseLogger = {
  id: number;
  label: string;
  customName?: string | null;
  role: "internal" | "external" | string;
  position?: string | null;
};

export type WarehouseGeometry = {
  lengthM: number;
  widthM: number;
  heightM: number;
  nL: number; // points along length (rows)
  nW: number; // points along width (cols)
  nV: number; // tiers
  externalEnv: boolean;
};

export function buildWarehousePositions(g: WarehouseGeometry): {
  id: string;
  row: number;
  col: number;
  tier: number;
  xPct: number; // 0..100 within plan
  yPct: number;
}[] {
  const out: ReturnType<typeof buildWarehousePositions> = [];
  if (!g.nL || !g.nW || !g.nV) return out;
  for (let t = 1; t <= g.nV; t++) {
    for (let r = 1; r <= g.nL; r++) {
      for (let c = 1; c <= g.nW; c++) {
        // distribute uniformly within plan with margin 8%
        const margin = 8;
        const span = 100 - margin * 2;
        // nL = points along length (horizontal/x), nW = points along width (vertical/y)
        const xPct = g.nL === 1 ? 50 : margin + ((r - 1) / (g.nL - 1)) * span;
        const yPct = g.nW === 1 ? 50 : margin + ((c - 1) / (g.nW - 1)) * span;
        out.push({ id: `L${r}-c${c}-t${t}`, row: r, col: c, tier: t, xPct, yPct });
      }
    }
  }
  return out;
}

function tierLabel(tier: number, nV: number, heightM: number): string {
  if (nV === 1) return `Ярус 1 — низ (≤1.5 м)`;
  if (nV === 2) return tier === 1 ? "Ярус 1 — низ" : "Ярус 2 — верх";
  if (nV === 3) {
    if (tier === 1) return "Ярус 1 — низ";
    if (tier === 2) return `Ярус 2 — середина (~${(heightM / 2).toFixed(1)} м)`;
    return `Ярус 3 — верх (${heightM.toFixed(1)} м)`;
  }
  return `Ярус ${tier}`;
}

export type DoorMark = { x: number; y: number } | null;
export type CoolingMark = { x: number; y: number } | null;

interface Props {
  geometry: WarehouseGeometry;
  loggers: WarehouseLogger[];
  doorPos?: DoorMark;
  coolingUnitPos?: CoolingMark;
  onAssignLogger?: (loggerId: number, positionId: string | null) => void;
  onDoorMove?: (pos: DoorMark) => void;
  onCoolingMove?: (pos: CoolingMark) => void;
  readOnly?: boolean;
}

export default function WarehouseLayoutDiagram({
  geometry,
  loggers,
  doorPos,
  coolingUnitPos,
  onAssignLogger,
  onDoorMove,
  onCoolingMove,
  readOnly = false,
}: Props) {
  const positions = useMemo(() => buildWarehousePositions(geometry), [geometry]);
  const [activeTier, setActiveTier] = useState<number>(1);
  const [pickerForCell, setPickerForCell] = useState<string | null>(null);

  const tiers = Array.from({ length: Math.max(1, geometry.nV) }, (_, i) => i + 1);

  const internals = loggers.filter(l => l.role === "internal");
  const placedMap = new Map<string, WarehouseLogger>();
  internals.forEach(l => {
    if (l.position && l.position.startsWith("L")) placedMap.set(l.position, l);
  });

  const handleCellClick = (cellId: string) => {
    if (readOnly || !onAssignLogger) return;
    setPickerForCell(prev => (prev === cellId ? null : cellId));
  };

  const handlePick = (loggerId: number, cellId: string) => {
    onAssignLogger?.(loggerId, cellId);
    setPickerForCell(null);
  };

  const handleClear = (cellId: string) => {
    const placed = placedMap.get(cellId);
    if (placed) onAssignLogger?.(placed.id, null);
    setPickerForCell(null);
  };

  // SVG plan: 700x460, scaled to keep aspect ratio
  const SVG_W = 700;
  const SVG_H = 460;
  const PAD = 30;
  const planW = SVG_W - PAD * 2;
  const planH = SVG_H - PAD * 2;
  // length = horizontal axis (x), width = vertical axis (y)
  const aspect = geometry.lengthM / geometry.widthM || 1;
  let drawW = planW;
  let drawH = planW / aspect;
  if (drawH > planH) {
    drawH = planH;
    drawW = planH * aspect;
  }
  const planX = PAD + (planW - drawW) / 2;
  const planY = PAD + (planH - drawH) / 2;

  const handleSvgPlace = (
    e: React.MouseEvent<SVGRectElement>,
    target: "door" | "cooling",
  ) => {
    if (readOnly) return;
    const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement | null);
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const yRel = ((e.clientY - rect.top) / rect.height) * SVG_H;
    // Convert to 0..100 within draw area
    const x = Math.max(0, Math.min(100, ((xRel - planX) / drawW) * 100));
    const y = Math.max(0, Math.min(100, ((yRel - planY) / drawH) * 100));
    if (target === "door") onDoorMove?.({ x, y });
    else onCoolingMove?.({ x, y });
  };

  return (
    <div className="space-y-3">
      <Tabs value={String(activeTier)} onValueChange={v => setActiveTier(Number(v))}>
        <TabsList className="flex flex-wrap gap-1">
          {tiers.map(t => (
            <TabsTrigger key={t} value={String(t)}>
              {tierLabel(t, geometry.nV, geometry.heightM)}
            </TabsTrigger>
          ))}
        </TabsList>
        {tiers.map(t => (
          <TabsContent key={t} value={String(t)} className="mt-3">
            <div className="text-[11px] text-muted-foreground mb-2">
              План помещения (вид сверху). Размеры: {geometry.lengthM.toFixed(1)} × {geometry.widthM.toFixed(1)} м.
              Сетка регистраторов: <b>{geometry.nL}</b> по длине × <b>{geometry.nW}</b> по ширине.
              Кликните по точке, чтобы назначить датчик. Перетащите «Дверь» и «Кондиционер» для отметки положения.
            </div>
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full max-w-3xl mx-auto bg-white rounded-md border"
              style={{ touchAction: "none" }}
            >
              {/* Compass */}
              <g transform={`translate(${SVG_W - 60}, 30)`}>
                <circle r={18} fill="#f1f5f9" stroke="#cbd5e1" />
                <text textAnchor="middle" y={-22} fontSize={10} fill="#475569">С</text>
                <text textAnchor="middle" y={32} fontSize={10} fill="#475569">Ю</text>
                <text textAnchor="end" x={-22} y={4} fontSize={10} fill="#475569">З</text>
                <text textAnchor="start" x={22} y={4} fontSize={10} fill="#475569">В</text>
                <polygon points="0,-12 4,0 0,12 -4,0" fill="#0f766e" />
              </g>

              {/* Plan rectangle */}
              <rect
                x={planX}
                y={planY}
                width={drawW}
                height={drawH}
                fill="#f8fafc"
                stroke="#0f172a"
                strokeWidth={1.5}
              />

              {/* Rulers */}
              <text x={planX + drawW / 2} y={planY - 8} textAnchor="middle" fontSize={11} fill="#475569">
                {geometry.lengthM.toFixed(1)} м (длина)
              </text>
              <text
                x={planX - 14}
                y={planY + drawH / 2}
                textAnchor="middle"
                fontSize={11}
                fill="#475569"
                transform={`rotate(-90, ${planX - 14}, ${planY + drawH / 2})`}
              >
                {geometry.widthM.toFixed(1)} м (ширина)
              </text>

              {/* Grid hints */}
              {/* Horizontal grid lines: nW points along width (vertical axis) */}
              {Array.from({ length: geometry.nW }).map((_, i) => {
                const yPct = geometry.nW === 1 ? 50 : 8 + (i / (geometry.nW - 1)) * 84;
                const y = planY + (yPct / 100) * drawH;
                return (
                  <line key={`gh-${i}`} x1={planX} y1={y} x2={planX + drawW} y2={y}
                    stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
                );
              })}
              {/* Vertical grid lines: nL points along length (horizontal axis) */}
              {Array.from({ length: geometry.nL }).map((_, i) => {
                const xPct = geometry.nL === 1 ? 50 : 8 + (i / (geometry.nL - 1)) * 84;
                const x = planX + (xPct / 100) * drawW;
                return (
                  <line key={`gv-${i}`} x1={x} y1={planY} x2={x} y2={planY + drawH}
                    stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
                );
              })}

              {/* Door marker */}
              {doorPos && (
                <g
                  transform={`translate(${planX + (doorPos.x / 100) * drawW}, ${planY + (doorPos.y / 100) * drawH})`}
                  style={{ cursor: readOnly ? "default" : "move" }}
                >
                  <rect x={-16} y={-12} width={32} height={24} rx={4} fill="#fde68a" stroke="#b45309" />
                  <text textAnchor="middle" y={4} fontSize={10} fill="#92400e" fontWeight="700">Дверь</text>
                </g>
              )}
              {/* Cooling unit marker */}
              {coolingUnitPos && (
                <g
                  transform={`translate(${planX + (coolingUnitPos.x / 100) * drawW}, ${planY + (coolingUnitPos.y / 100) * drawH})`}
                  style={{ cursor: readOnly ? "default" : "move" }}
                >
                  <rect x={-22} y={-12} width={44} height={24} rx={4} fill="#bae6fd" stroke="#0369a1" />
                  <text textAnchor="middle" y={4} fontSize={10} fill="#075985" fontWeight="700">Кондиционер</text>
                </g>
              )}

              {/* Sensor cells for current tier */}
              {positions
                .filter(p => p.tier === activeTier)
                .map(p => {
                  const cx = planX + (p.xPct / 100) * drawW;
                  const cy = planY + (p.yPct / 100) * drawH;
                  const placed = placedMap.get(p.id);
                  const fill = placed ? "#10b981" : "#e2e8f0";
                  const stroke = placed ? "#047857" : "#94a3b8";
                  const text = placed ? (placed.customName || placed.label) : `${p.row}-${p.col}`;
                  return (
                    <g key={p.id} style={{ cursor: readOnly ? "default" : "pointer" }}
                       onClick={() => handleCellClick(p.id)}>
                      <circle cx={cx} cy={cy} r={18} fill={fill} stroke={stroke} strokeWidth={2} />
                      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10}
                            fontWeight={700} fill={placed ? "white" : "#475569"}>
                        {text.slice(0, 6)}
                      </text>
                    </g>
                  );
                })}

              {/* Click area for placing door/cooling via toolbar (handled separately) */}
              <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="transparent"
                onClick={(e) => {
                  // suppress
                  void e;
                }}
                onMouseDown={(e) => {
                  // not used
                  void e;
                }}
                onDoubleClick={(e) => handleSvgPlace(e, "cooling")}
                onContextMenu={(e) => { e.preventDefault(); handleSvgPlace(e, "door"); }}
              />
            </svg>

            {/* Picker for cell assignment */}
            {pickerForCell && !readOnly && (
              <div className="mt-3 rounded-md border bg-card p-3">
                <div className="text-xs font-medium mb-2">
                  Назначить датчик в позицию <span className="font-mono">{pickerForCell}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {internals
                    .filter(l => !l.position || l.position === pickerForCell)
                    .map(l => (
                      <Button
                        key={l.id}
                        variant="outline"
                        size="sm"
                        className="bg-background"
                        onClick={() => handlePick(l.id, pickerForCell)}
                      >
                        {l.customName || l.label}
                      </Button>
                    ))}
                  {placedMap.has(pickerForCell) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background text-destructive hover:text-destructive"
                      onClick={() => handleClear(pickerForCell)}
                    >
                      Снять датчик
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickerForCell(null)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {!readOnly && (
        <div className="rounded-md border bg-amber-50/40 p-3 text-xs text-amber-900 leading-relaxed flex items-center gap-3">
          <Snowflake className="h-4 w-4 text-sky-600" />
          <span>Двойной клик по плану — поставить «Кондиционер». Клик правой кнопкой — поставить «Дверь».</span>
          <DoorOpen className="h-4 w-4 text-amber-700" />
        </div>
      )}
    </div>
  );
}
