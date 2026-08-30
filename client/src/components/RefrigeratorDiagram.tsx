/**
 * RefrigeratorDiagram
 *
 * 3D-like refrigerator shelf diagram for sensor placement.
 * Positions are stored in pvLoggers.position as short stable codes:
 *   RF:S{shelf}:{zone}
 * where zone is BL/BC/BR (back) or FL/FC/FR (front / door side).
 */

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";

type Logger = {
  id: number;
  label: string;
  customName?: string | null;
  role: "internal" | "external";
  position?: string | null;
  posX?: string | number | null;
  posY?: string | number | null;
  minVal?: string | number | null;
  avgVal?: string | number | null;
};

type Props = {
  loggers: Logger[];
  protocolId: number;
  readOnly?: boolean;
  levelCount?: number | null;
  onLevelCountChange?: (count: number) => void;
  drawerCount?: number | null;
  onDrawerCountChange?: (count: number) => void;
  hotLoggerId?: number | null;
  coldLoggerId?: number | null;
};

type ZoneCode = "BL" | "BC" | "BR" | "FL" | "FC" | "FR";
type Placement = { shelf: number; zone: ZoneCode };

const ZONES: Array<{ code: ZoneCode; x: number; depth: number; label: string; short: string }> = [
  { code: "BL", x: 14, depth: 84, label: "у задней стенки слева", short: "зад. слева" },
  { code: "BC", x: 50, depth: 84, label: "у задней стенки по середине", short: "зад. центр" },
  { code: "BR", x: 86, depth: 84, label: "у задней стенки справа", short: "зад. справа" },
  { code: "FL", x: 14, depth: 20, label: "у дверцы слева", short: "дверь слева" },
  { code: "FC", x: 50, depth: 20, label: "у дверцы по середине", short: "дверь центр" },
  { code: "FR", x: 86, depth: 20, label: "у дверцы справа", short: "дверь справа" },
];

const PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#7c3aed", "#0891b2", "#be185d", "#65a30d", "#0f766e", "#b45309",
];

function colorFor(idx: number) {
  return PALETTE[idx % PALETTE.length];
}

function loggerTitle(logger: Logger): string {
  return String(logger.customName || logger.label || `Датчик ${logger.id}`).trim();
}

function badgeLabel(logger: Logger): string {
  const src = String(logger.label || logger.customName || loggerTitle(logger)).trim();
  const compact = src.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length >= 4) return compact.slice(-4);
  return src.length > 4 ? src.slice(-4) : src;
}

function avgLabel(logger: Logger): string | null {
  const raw = logger.avgVal;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1).replace(".", ",") + "°C";
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

function parsePlacement(position: string | null | undefined): Placement | null {
  const match = String(position || "").match(/^RF:S(\d+):(BL|BC|BR|FL|FC|FR)$/);
  if (!match) return null;
  return { shelf: Math.max(1, Number(match[1])), zone: match[2] as ZoneCode };
}

function placementCode(p: Placement): string {
  return `RF:S${p.shelf}:${p.zone}`;
}

function legacyPlacement(logger: Logger, index: number, total: number): Placement {
  if (logger.position === "top") return { shelf: 1, zone: "FC" };
  if (logger.position === "middle") return { shelf: Math.max(2, Math.ceil(total / 2)), zone: "FC" };
  if (logger.position === "bottom") return { shelf: Math.max(3, total), zone: "FC" };
  if (logger.position === "door") return { shelf: Math.max(1, Math.ceil(total / 2)), zone: "FR" };

  if (logger.posX != null && logger.posY != null) {
    const x = Number(logger.posX);
    const y = Number(logger.posY);
    const shelf = Math.max(1, Math.min(9, Math.round((y / 100) * Math.max(1, total - 1)) + 1));
    const zone: ZoneCode = x < 33 ? "FL" : x > 66 ? "FR" : "FC";
    return { shelf, zone };
  }

  const shelf = total <= 1 ? 1 : Math.round((index / (total - 1)) * Math.max(1, total - 1)) + 1;
  const pattern: ZoneCode[] = ["FL", "FR", "BC"];
  return { shelf, zone: pattern[index % pattern.length] };
}

function shelfTitle(shelf: number, total: number, drawerCount = 0): string {
  if (drawerCount > 0 && shelf === total) {
    return drawerCount === 1 ? `${shelf} уровень (лоток)` : `${shelf} уровень (лотки)`;
  }
  if (shelf === 1) return `${shelf} полка (верхняя)`;
  if (shelf === total) return `${shelf} полка (нижняя)`;
  return `${shelf} полка`;
}

function normalizeDrawerCount(value: number | null | undefined): 0 | 1 | 2 {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(2, Math.round(n))) as 0 | 1 | 2;
}

function normalizeLevelCount(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 7;
  return Math.max(3, Math.min(9, Math.round(n)));
}

export default function RefrigeratorDiagram({
  loggers,
  protocolId,
  readOnly = false,
  levelCount,
  onLevelCountChange,
  drawerCount,
  onDrawerCountChange,
  hotLoggerId,
  coldLoggerId,
}: Props) {
  const utils = trpc.useUtils();
  const updateLogger = trpc.pv.updateLogger.useMutation({
    onSuccess: () => utils.pv.get.invalidate({ protocolId }),
  });
  const internals = loggers.filter(l => l.role === "internal");
  const externals = loggers.filter(l => l.role === "external");
  const maxPlacedShelf = Math.max(0, ...internals.map(l => parsePlacement(l.position)?.shelf ?? 0));
  const [visibleShelves, setVisibleShelves] = useState(normalizeLevelCount(levelCount ?? Math.max(7, maxPlacedShelf)));
  const [localDrawerCount, setLocalDrawerCount] = useState<0 | 1 | 2>(normalizeDrawerCount(drawerCount));
  const shelfCount = normalizeLevelCount(levelCount ?? visibleShelves);
  const effectiveDrawerCount = normalizeDrawerCount(drawerCount ?? localDrawerCount);
  const [assigningTo, setAssigningTo] = useState<Placement | null>(null);
  const isDrawerLevel = (shelf: number) => effectiveDrawerCount > 0 && shelf === shelfCount;

  const placements = useMemo(() => {
    const map = new Map<string, Logger>();
    internals.forEach((logger, idx) => {
      const parsed = parsePlacement(logger.position);
      const placement = parsed
        ? { ...parsed, shelf: Math.min(parsed.shelf, shelfCount) }
        : legacyPlacement(logger, idx, Math.max(3, shelfCount));
      map.set(placementCode(placement), logger);
    });
    return map;
  }, [internals, shelfCount]);

  const unassigned = internals.filter(logger => {
    const parsed = parsePlacement(logger.position);
    return !parsed || !placements.get(placementCode(parsed)) || placements.get(placementCode(parsed))?.id === logger.id;
  });

  const assignLogger = (loggerId: number | null) => {
    if (!assigningTo || readOnly) return;
    const code = placementCode(assigningTo);
    const already = placements.get(code);
    if (already && loggerId !== already.id) {
      updateLogger.mutate({ protocolId, loggerId: already.id, position: "unset" as any, posX: null, posY: null });
    }
    if (loggerId != null) {
      updateLogger.mutate({ protocolId, loggerId, position: code as any, posX: null, posY: null });
    }
    setAssigningTo(null);
  };

  const clearPlacement = () => {
    if (!assigningTo || readOnly) return;
    const logger = placements.get(placementCode(assigningTo));
    if (logger) {
      updateLogger.mutate({ protocolId, loggerId: logger.id, position: "unset" as any, posX: null, posY: null });
    }
    setAssigningTo(null);
  };

  const W = 760;
  const H = 640;
  const cab = { x: 70, y: 42, w: 420, h: 540, d: 82 };
  const topGap = 48;
  const bottomGap = effectiveDrawerCount > 0 ? 68 : 30;
  const shelfAreaH = cab.h - topGap - bottomGap;
  const shelfPitch = shelfCount > 1 ? shelfAreaH / (shelfCount - 1) : 0;
  const shelfY = (shelf: number) => cab.y + topGap + (shelf - 1) * shelfPitch;
  const project = (shelf: number, zone: ZoneCode) => {
    const z = ZONES.find(item => item.code === zone) ?? ZONES[0];
    const depthShift = (z.depth / 100) * cab.d;
    return {
      x: cab.x + (z.x / 100) * cab.w - depthShift * 0.45,
      y: shelfY(shelf) + depthShift * 0.30,
    };
  };
  const setDrawerCount = (count: 0 | 1 | 2) => {
    setLocalDrawerCount(count);
    onDrawerCountChange?.(count);
  };
  const setLevelCount = (count: number) => {
    const normalized = normalizeLevelCount(count);
    setVisibleShelves(normalized);
    onLevelCountChange?.(normalized);
    internals.forEach(logger => {
      const parsed = parsePlacement(logger.position);
      if (parsed && parsed.shelf > normalized) {
        updateLogger.mutate({
          protocolId,
          loggerId: logger.id,
          position: placementCode({ ...parsed, shelf: normalized }) as any,
          posX: null,
          posY: null,
        });
      }
    });
  };

  return (
    <div className="w-full select-none space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <div>
            <div className="text-sm font-medium">3D-схема холодильника</div>
            <div className="text-xs text-muted-foreground">
              Выберите количество полок, затем кликайте по точкам на полках и назначайте датчики.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Уровней:</span>
            {[3, 4, 5, 6, 7, 9].map(count => (
              <Button
                key={count}
                type="button"
                size="sm"
                variant={shelfCount === count ? "default" : "outline"}
                className={shelfCount === count ? "" : "bg-background"}
                onClick={() => setLevelCount(count)}
              >
                {count}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Лотков:</span>
            {([0, 1, 2] as const).map(count => (
              <Button
                key={count}
                type="button"
                size="sm"
                variant={effectiveDrawerCount === count ? "default" : "outline"}
                className={effectiveDrawerCount === count ? "" : "bg-background"}
                onClick={() => setDrawerCount(count)}
              >
                {count === 0 ? "нет" : count}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-5xl mx-auto rounded-lg border bg-white">
          <defs>
            <linearGradient id="rf-body" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <linearGradient id="rf-shelf" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Outer 3D cabinet */}
          <polygon points={`${cab.x},${cab.y} ${cab.x + cab.w},${cab.y} ${cab.x + cab.w + cab.d * 0.55},${cab.y + cab.d * 0.25} ${cab.x + cab.d * 0.55},${cab.y + cab.d * 0.25}`}
            fill="#f8fafc" stroke="#334155" strokeWidth={1.8} />
          <polygon points={`${cab.x + cab.w},${cab.y} ${cab.x + cab.w + cab.d * 0.55},${cab.y + cab.d * 0.25} ${cab.x + cab.w + cab.d * 0.55},${cab.y + cab.h + cab.d * 0.25} ${cab.x + cab.w},${cab.y + cab.h}`}
            fill="#e2e8f0" stroke="#334155" strokeWidth={1.8} />
          <rect x={cab.x} y={cab.y} width={cab.w} height={cab.h} rx={5} fill="url(#rf-body)" stroke="#111827" strokeWidth={2.2} />
          <rect x={cab.x + 18} y={cab.y + 24} width={cab.w - 36} height={cab.h - 42} rx={4} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.4} />

          {/* Cooling grill */}
          <rect x={cab.x + cab.w * 0.38} y={cab.y + 42} width={cab.w * 0.25} height={30} rx={3} fill="#f1f5f9" stroke="#64748b" />
          {Array.from({ length: 5 }, (_, i) => (
            <line key={i} x1={cab.x + cab.w * 0.40} y1={cab.y + 49 + i * 5} x2={cab.x + cab.w * 0.61} y2={cab.y + 49 + i * 5} stroke="#64748b" strokeWidth={1.2} />
          ))}

          {/* Shelf rails and shelves */}
          {Array.from({ length: shelfCount }, (_, i) => i + 1).filter(shelf => !isDrawerLevel(shelf)).map(shelf => {
            const y = shelfY(shelf);
            const frontY = y + cab.d * 0.30;
            const leftBackX = cab.x + 38;
            const rightBackX = cab.x + cab.w - 36;
            const leftFrontX = leftBackX - cab.d * 0.45;
            const rightFrontX = rightBackX - cab.d * 0.45;
            return (
              <g key={shelf}>
                <polygon
                  points={`${leftBackX},${y} ${rightBackX},${y} ${rightFrontX},${frontY} ${leftFrontX},${frontY}`}
                  fill="url(#rf-shelf)"
                  stroke="#64748b"
                  strokeWidth={1.3}
                />
                <line x1={leftFrontX} y1={frontY + 5} x2={rightFrontX} y2={frontY + 5} stroke="#334155" strokeWidth={2} opacity={0.55} />
                <text x={cab.x + cab.w + 34} y={frontY + 4} fontSize={12} fill="#64748b" fontWeight={700}>
                  {shelf}
                </text>
              </g>
            );
          })}

          {/* Optional lower drawers */}
          {effectiveDrawerCount === 1 && (
            <>
              <rect x={cab.x + 58} y={cab.y + cab.h - 74} width={320} height={46} rx={7} fill="#f8fafc" stroke="#94a3b8" opacity={0.9} />
              <text x={cab.x + 218} y={cab.y + cab.h - 47} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={700}>Лоток</text>
            </>
          )}
          {effectiveDrawerCount === 2 && (
            <>
              <rect x={cab.x + 58} y={cab.y + cab.h - 74} width={150} height={46} rx={7} fill="#f8fafc" stroke="#94a3b8" opacity={0.9} />
              <rect x={cab.x + 228} y={cab.y + cab.h - 74} width={150} height={46} rx={7} fill="#f8fafc" stroke="#94a3b8" opacity={0.9} />
              <text x={cab.x + 133} y={cab.y + cab.h - 47} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={700}>Лоток</text>
              <text x={cab.x + 303} y={cab.y + cab.h - 47} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={700}>Лоток</text>
            </>
          )}

          {/* Clickable slots */}
          {Array.from({ length: shelfCount }, (_, i) => i + 1).flatMap(shelf =>
            ZONES.map(zone => {
              const p = project(shelf, zone.code);
              const code = placementCode({ shelf, zone: zone.code });
              const logger = placements.get(code);
              const loggerIdx = logger ? internals.findIndex(item => item.id === logger.id) : -1;
              const color = logger ? colorFor(loggerIdx) : "#94a3b8";
              const label = logger ? badgeLabel(logger) : "";
              const avg = logger ? avgLabel(logger) : null;
              const isCriticalHot = logger?.id === hotLoggerId;
              const isCriticalCold = logger?.id === coldLoggerId;
              const isCritical = isCriticalHot || isCriticalCold;
              const isFront = zone.code.startsWith("F");
              return (
                <g
                  key={code}
                  onClick={() => !readOnly && setAssigningTo({ shelf, zone: zone.code })}
                  style={{ cursor: readOnly ? "default" : "pointer" }}
                >
                  {!logger && !readOnly && (
                    <circle cx={p.x} cy={p.y} r={7} fill="#ffffff" stroke={color} strokeWidth={1.2} strokeDasharray={isFront ? "0" : "3 2"} opacity={0.85} />
                  )}
                  {logger && (
                    <>
                      {isCritical && (
                        <>
                          {isCriticalHot && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={18.8}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth={2.6}
                              pointerEvents="none"
                            />
                          )}
                          {isCriticalCold && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isCriticalHot ? 21.8 : 18.8}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth={2.4}
                              pointerEvents="none"
                            />
                          )}
                          {isCriticalHot && (
                            <polygon
                              points={starPoints(p.x + 20, p.y - 22, 7)}
                              fill="#ef4444"
                              stroke="#ffffff"
                              strokeWidth={1.3}
                              pointerEvents="none"
                            />
                          )}
                          {isCriticalCold && (
                            <polygon
                              points={diamondPoints(p.x + 20, p.y + (isCriticalHot ? -8 : -22), 7)}
                              fill="#2563eb"
                              stroke="#ffffff"
                              strokeWidth={1.3}
                              pointerEvents="none"
                            />
                          )}
                        </>
                      )}
                      <circle cx={p.x} cy={p.y} r={16} fill={color} stroke="white" strokeWidth={2.2} />
                      <text x={p.x} y={p.y - (avg ? 1 : -4)} textAnchor="middle" fontSize={8} fontWeight={800} fill="white" pointerEvents="none">
                        {label}
                      </text>
                      {avg && (
                        <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="white" pointerEvents="none">
                          {avg}
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            }),
          )}

          {/* Legend */}
          <g transform={`translate(${cab.x + cab.w + 86}, ${cab.y + 14})`}>
            <rect x={0} y={0} width={160} height={126} rx={8} fill="#ffffff" stroke="#cbd5e1" />
            <circle cx={18} cy={22} r={7} fill="#2563eb" />
            <text x={34} y={26} fontSize={12} fill="#0f172a">T — точка измерения</text>
            <circle cx={18} cy={48} r={6} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.2} />
            <text x={34} y={52} fontSize={11} fill="#64748b">свободная позиция</text>
            <polygon points={starPoints(18, 74, 6)} fill="#ef4444" stroke="#ffffff" strokeWidth={1.1} />
            <text x={34} y={78} fontSize={11} fill="#64748b">{"\u0433\u043e\u0440\u044f\u0447\u0430\u044f \u0442\u043e\u0447\u043a\u0430"}</text>
            <polygon points={diamondPoints(18, 100, 6)} fill="#2563eb" stroke="#ffffff" strokeWidth={1.1} />
            <text x={34} y={104} fontSize={11} fill="#64748b">{"\u0445\u043e\u043b\u043e\u0434\u043d\u0430\u044f \u0442\u043e\u0447\u043a\u0430"}</text>
          </g>

          {externals.map((logger, idx) => {
            const y = cab.y + 184 + idx * 42;
            const color = colorFor(internals.length + idx);
            return (
              <g key={logger.id} transform={`translate(${cab.x + cab.w + 104}, ${y})`}>
                <line x1={-52} y1={0} x2={-12} y2={0} stroke={color} strokeWidth={1.3} strokeDasharray="4 3" />
                <circle cx={8} cy={0} r={15} fill={color} stroke="white" strokeWidth={2} />
                <text x={8} y={4} textAnchor="middle" fontSize={8} fontWeight={800} fill="white">{badgeLabel(logger)}</text>
                <text x={32} y={4} fontSize={11} fill="#64748b">внешний</text>
              </g>
            );
          })}
        </svg>

        <div className="space-y-2">
          {Array.from({ length: shelfCount }, (_, i) => i + 1).map(shelf => {
            const rows = ZONES
              .map(zone => ({ zone, logger: placements.get(placementCode({ shelf, zone: zone.code })) }))
              .filter(row => row.logger);
            return (
              <div key={shelf} className="rounded-lg border bg-white p-3 text-sm">
                <div className="font-semibold text-center mb-1">{shelfTitle(shelf, shelfCount, effectiveDrawerCount)}</div>
                {rows.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs">(без логгеров)</div>
                ) : (
                  <div className="space-y-1">
                    {rows.map(({ zone, logger }) => (
                      <div key={zone.code} className="text-xs">
                        <span className="font-semibold text-primary">{badgeLabel(logger!)}</span>
                        {" — "}
                        <span className="text-muted-foreground">{zone.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {assigningTo && !readOnly && (
        <div className="rounded-lg border bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="font-semibold text-sm">
                {shelfTitle(assigningTo.shelf, shelfCount, effectiveDrawerCount)} — {ZONES.find(z => z.code === assigningTo.zone)?.label}
              </div>
              <div className="text-xs text-muted-foreground">Выберите логгер для этой точки.</div>
            </div>
            <Button size="sm" variant="outline" className="bg-background" onClick={() => setAssigningTo(null)}>
              Закрыть
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((logger, idx) => {
              const assignedHere = placements.get(placementCode(assigningTo))?.id === logger.id;
              const alreadyAssigned = parsePlacement(logger.position) && !assignedHere;
              return (
                <Button
                  key={logger.id}
                  size="sm"
                  variant={assignedHere ? "default" : "outline"}
                  className={assignedHere ? "" : "bg-background"}
                  disabled={!!alreadyAssigned}
                  onClick={() => assignLogger(logger.id)}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: colorFor(idx) }} />
                  {loggerTitle(logger)}
                </Button>
              );
            })}
            {placements.get(placementCode(assigningTo)) && (
              <Button size="sm" variant="outline" className="bg-background text-destructive hover:text-destructive" onClick={clearPlacement}>
                Очистить точку
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
