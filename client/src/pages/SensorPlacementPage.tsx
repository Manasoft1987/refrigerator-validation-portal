/**
 * SensorPlacementPage
 *
 * Separate page for sensor placement diagram at /protocols/:id/sensor-placement
 *
 * Warehouse: Single unified diagram showing both floor plan objects AND sensor
 *   positions on the same canvas. Tier selector tabs appear above the canvas.
 *
 * Refrigerator: Cabinet diagram with direct sensor placement.
 * Reefer: ISPE position reference plus full interactive ReeferTruckDiagram3D.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Camera, Info, MapPin, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useParams, useLocation } from "wouter";
import { toPng } from "html-to-image";
import ReeferTruckDiagram3D from "@/components/ReeferTruckDiagram3D";
import RefrigeratorDiagram from "@/components/RefrigeratorDiagram";
import FloorPlanEditor, { FloorPlanObject, SensorPosition, SensorLogger } from "@/components/FloorPlanEditor";
import { buildWarehousePositions } from "@/components/WarehouseLayoutDiagram";
import { computeWarehouseSensorCount } from "@shared/validation";

// --- Isometric helpers (same as ReeferTruckDiagram3D) -------------------------
const SCALE   = 93.6;
const ORIGIN_X = 330;
const ORIGIN_Y = 380;
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

function iso(x: number, y: number, z: number): [number, number] {
  return [
    ORIGIN_X + (x - y) * COS30 * SCALE,
    ORIGIN_Y - (x + y) * SIN30 * SCALE - z * SCALE,
  ];
}

function pts(points: [number, number][]) {
  return points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

const W = 1.6;
const D = 3.2;
const H = 1.4;

const SENSOR_POSITIONS = [
  { id: "C1", x: 0,   y: 0,   z: 0,   group: "corner" as const },
  { id: "C2", x: W,   y: 0,   z: 0,   group: "corner" as const },
  { id: "C3", x: W,   y: D,   z: 0,   group: "corner" as const },
  { id: "C4", x: 0,   y: D,   z: 0,   group: "corner" as const },
  { id: "C5", x: 0,   y: 0,   z: H,   group: "corner" as const },
  { id: "C6", x: W,   y: 0,   z: H,   group: "corner" as const },
  { id: "C7", x: W,   y: D,   z: H,   group: "corner" as const },
  { id: "C8", x: 0,   y: D,   z: H,   group: "corner" as const },
  { id: "W1", x: W/2, y: 0,   z: H/2, group: "wall" as const },
  { id: "W2", x: W/2, y: D,   z: H/2, group: "wall" as const },
  { id: "W3", x: 0,   y: D/2, z: H/2, group: "wall" as const },
  { id: "W4", x: W,   y: D/2, z: H/2, group: "wall" as const },
  { id: "V1", x: W/2, y: D/2, z: 0,   group: "center" as const },
  { id: "V2", x: W/2, y: D/2, z: H/2, group: "center" as const },
  { id: "V3", x: W/2, y: D/2, z: H,   group: "center" as const },
];

const GROUP_COLORS = {
  corner: "#2563eb",
  wall:   "#16a34a",
  center: "#dc2626",
};

// --- Read-only ISPE Position Diagram -----------------------------------------
function ISPEPositionDiagram() {
  const b0 = iso(0, 0, 0), b1 = iso(W, 0, 0), b2 = iso(W, D, 0), b3 = iso(0, D, 0);
  const t0 = iso(0, 0, H), t1 = iso(W, 0, H), t2 = iso(W, D, H), t3 = iso(0, D, H);
  const ruH = 0.22, ruD = 0.18;
  const ruX0 = W * 0.15, ruX1 = W * 0.85;
  const ru_bl = iso(ruX0, 0, H), ru_br = iso(ruX1, 0, H);
  const ru_tr = iso(ruX1, 0, H + ruH), ru_tl = iso(ruX0, 0, H + ruH);
  const ru_blb = iso(ruX0, ruD, H), ru_brb = iso(ruX1, ruD, H);
  const ru_trb = iso(ruX1, ruD, H + ruH), ru_tlb = iso(ruX0, ruD, H + ruH);

  return (
    <div className="w-full select-none">
      <svg viewBox="0 0 760 560" className="w-full max-w-3xl mx-auto" style={{ touchAction: "none" }}>
        <ellipse
          cx={(b0[0] + b1[0] + b2[0] + b3[0]) / 4}
          cy={(b0[1] + b1[1] + b2[1] + b3[1]) / 4 + 12}
          rx={200} ry={18} fill="rgba(0,0,0,0.08)"
        />
        <polygon points={pts([b3, b2, t2, t3])} fill="#c8d8e8" stroke="#7a9ab5" strokeWidth={1.2} />
        <polygon points={pts([b0, b3, t3, t0])} fill="#d8e8f4" stroke="#7a9ab5" strokeWidth={1.2} />
        <polygon points={pts([b1, b2, t2, t1])} fill="#dce8f0" stroke="#7a9ab5" strokeWidth={1.2} />
        <polygon points={pts([t0, t1, t2, t3])} fill="#eef4fa" stroke="#7a9ab5" strokeWidth={1.2} />
        <polygon points={pts([b0, b1, t1, t0])} fill="#dbeafe" stroke="#7a9ab5" strokeWidth={1.2} />
        {(() => {
          const dm = iso(W / 2, 0, 0), dm2 = iso(W / 2, 0, H);
          return <line x1={dm[0]} y1={dm[1]} x2={dm2[0]} y2={dm2[1]} stroke="#93c5fd" strokeWidth={0.8} strokeDasharray="4,3" />;
        })()}
        <polygon points={pts([ru_bl, ru_br, ru_tr, ru_tl])} fill="#bfdbfe" stroke="#93c5fd" strokeWidth={0.8} />
        <polygon points={pts([ru_tl, ru_tr, ru_trb, ru_tlb])} fill="#dbeafe" stroke="#93c5fd" strokeWidth={0.8} />
        <polygon points={pts([ru_blb, ru_brb, ru_trb, ru_tlb])} fill="#eff6ff" stroke="#93c5fd" strokeWidth={0.8} />
        <polyline points={pts([b0, b1, b2, b3, b0])} fill="none" stroke="#4a6a85" strokeWidth={1.4} />
        <polyline points={pts([t0, t1, t2, t3, t0])} fill="none" stroke="#4a6a85" strokeWidth={1.4} />
        {([[b0, t0], [b1, t1], [b2, t2], [b3, t3]] as [[number,number],[number,number]][]).map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#4a6a85" strokeWidth={1.4} />
        ))}
        {SENSOR_POSITIONS.map(sp => {
          const [sx, sy] = iso(sp.x, sp.y, sp.z);
          const color = GROUP_COLORS[sp.group];
          const BW = 24, BH = 18, RX = 4;
          return (
            <g key={sp.id}>
              <rect x={sx - BW / 2 - 2} y={sy - BH / 2 - 2} width={BW + 4} height={BH + 4} rx={RX + 1}
                fill="white" stroke={color} strokeWidth={1.5} />
              <rect x={sx - BW / 2} y={sy - BH / 2} width={BW} height={BH} rx={RX} fill={color} />
              <text x={sx} y={sy} textAnchor="middle" dominantBaseline="central"
                fontSize={9} fontWeight="700" fill="white"
                style={{ pointerEvents: "none", userSelect: "none" }}>
                {sp.id}
              </text>
            </g>
          );
        })}
        {[
          { color: GROUP_COLORS.corner, label: "Угол (C1–C8, 8 шт.)" },
          { color: GROUP_COLORS.wall,   label: "Центр стенки (W1–W4, 4 шт.)" },
          { color: GROUP_COLORS.center, label: "Центр объёма (V1–V3, 3 шт.)" },
        ].map((item, i) => (
          <g key={i} transform={`translate(12, ${440 + i * 26})`}>
            <circle cx={9} cy={9} r={8} fill={item.color} />
            <text x={22} y={14} fontSize={12} fill="#374151" fontFamily="sans-serif">{item.label}</text>
          </g>
        ))}
        <text x={748} y={552} textAnchor="end" fontSize={8} fill="#94a3b8" fontFamily="sans-serif">
          ISPE Good Practice Guide: Cold Chain Management
        </text>
      </svg>
    </div>
  );
}

// ─── Tier label helper ────────────────────────────────────────────────────────
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

// --- Main Page ----------------------------------------------------------------
export default function SensorPlacementPage() {
  const params = useParams<{ id: string }>();
  const protocolId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const returnToProtocol = useCallback(() => {
    try {
      window.sessionStorage.setItem(`protocolWizardStep:${protocolId}`, "pv");
    } catch {
      // Session storage is optional; the query param below is enough for normal navigation.
    }
    navigate(`/protocols/${protocolId}?step=pv`);
  }, [navigate, protocolId]);

  const pvQ = trpc.pv.get.useQuery({ protocolId });
  const saveSession = trpc.pv.saveSession.useMutation({
    onSuccess: () => {
      toast.success("Схема сохранена");
      pvQ.refetch();
    },
    onError: (e) => toast.error("Ошибка сохранения: " + e.message),
  });

  const session = pvQ.data?.session;
  const loggers = pvQ.data?.loggers ?? [];
  const protocolQ = trpc.protocols.get.useQuery({ id: protocolId });
  const giQ = trpc.generalInfo.get.useQuery({ protocolId });
  const equipmentType = (giQ.data?.equipmentType || protocolQ.data?.equipmentType || "refrigerator") as string;
  const isWarehouse = equipmentType === "warehouse";
  const isAutoRefrigerator = equipmentType === "auto-refrigerator";

  const updateLogger = trpc.pv.updateLogger.useMutation({
    onSuccess: () => pvQ.refetch(),
    onError: (e) => toast.error("Не удалось сохранить позицию: " + e.message),
  });

  const [coolingUnitPos, setCoolingUnitPos] = useState<{ x: number; y: number } | null>(null);
  const [doorPos, setDoorPos] = useState<{ x: number; y: number } | null>(null);
  const [floorPlanObjects, setFloorPlanObjects] = useState<FloorPlanObject[]>([]);
  const [activeTier, setActiveTier] = useState<number>(1);
  const [initialized, setInitialized] = useState(false);

  // Uncontrolled refs for room dimensions — immune to React re-renders
  const lengthRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const [, setDimsTick] = useState(0);
  const planRef = useRef<HTMLDivElement>(null);
  const dimsSeededRef = useRef(false);
  const readDim = (r: React.RefObject<HTMLInputElement | null>) => {
    const v = r.current?.value?.trim() ?? "";
    return v === "" ? null : Number(v);
  };

  if (session && !initialized) {
    setInitialized(true);
    if ((session as any).coolingUnitPos) setCoolingUnitPos((session as any).coolingUnitPos);
    if ((session as any).doorPos) setDoorPos((session as any).doorPos);
    if ((session as any).floorPlanObjects) setFloorPlanObjects((session as any).floorPlanObjects);
  }

  // Seed room dim inputs once from server data (pvSession.roomXxx → fallback to generalInfo.whXxx)
  useEffect(() => {
    if (dimsSeededRef.current) return;
    if (!session && !giQ.data) return;
    dimsSeededRef.current = true;
    const sL = (session as any)?.roomLengthM ?? giQ.data?.whLengthM ?? null;
    const sW = (session as any)?.roomWidthM ?? giQ.data?.whWidthM ?? null;
    const sH = (session as any)?.roomHeightM ?? giQ.data?.whHeightM ?? null;
    if (lengthRef.current) lengthRef.current.value = sL != null ? String(sL) : "";
    if (widthRef.current) widthRef.current.value = sW != null ? String(sW) : "";
    if (heightRef.current) heightRef.current.value = sH != null ? String(sH) : "";
    setDimsTick(t => t + 1);
  }, [session, giQ.data]);

  const savePlanImage = trpc.pv.savePlanImage.useMutation({
    onError: (e) => toast.error("Ошибка загрузки изображения: " + e.message),
  });

  const captureAndSavePlan = useCallback(async (): Promise<{ ok: boolean; url?: string }> => {
    if (!planRef.current) return { ok: false };
    try {
      const dataUrl = await toPng(planRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const res = await savePlanImage.mutateAsync({ protocolId, dataUrl });
      return { ok: true, url: res.url };
    } catch (err: any) {
      console.error("plan capture failed:", err);
      toast.error("Не удалось снять снимок схемы: " + (err?.message ?? "unknown"));
      return { ok: false };
    }
  }, [protocolId, savePlanImage]);

  const handleSave = useCallback(async () => {
    const L = readDim(lengthRef);
    const W = readDim(widthRef);
    const H = readDim(heightRef);
    // Capture plan PNG only if room dims look set (otherwise the SVG would be a useless square).
    let planResult: { ok: boolean; url?: string } = { ok: false };
    if (isWarehouse && L && W && H && planRef.current) {
      planResult = await captureAndSavePlan();
    }
    saveSession.mutate({
      protocolId,
      coolingUnitPos: coolingUnitPos ?? undefined,
      doorPos: doorPos ?? undefined,
      floorPlanObjects: floorPlanObjects,
      roomLengthM: L,
      roomWidthM: W,
      roomHeightM: H,
      // planImageKey/Url are persisted by savePlanImage itself; no need to send again here
    } as any, {
      onSuccess: () => {
        if (isWarehouse) {
          if (planResult.ok) toast.success("Схема и размеры сохранены");
          else if (L && W && H) toast.success("Размеры сохранены (снимок схемы не удалось получить)");
          else toast.warning("Размеры помещения не указаны — снимок схемы не сохранён");
        } else {
          toast.success("Сохранено");
        }
      },
    });
  }, [protocolId, coolingUnitPos, doorPos, floorPlanObjects, saveSession, isWarehouse, captureAndSavePlan]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="bg-background"
          onClick={returnToProtocol}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад к протоколу
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Схема расстановки датчиков
          </h1>
          <p className="text-sm text-muted-foreground">
            Протокол #{protocolId} — {isWarehouse ? "помещение / зона хранения" : isAutoRefrigerator ? "авторефрижератор" : "холодильник"}
          </p>
        </div>
      </div>

      {/* ── WAREHOUSE: unified floor plan + sensor diagram ── */}
      {isWarehouse && (() => {
        // Read live values from refs (updated on each keystroke via onChange)
        const liveL = readDim(lengthRef) ?? 0;
        const liveW = readDim(widthRef) ?? 0;
        const liveH = readDim(heightRef) ?? 0;
        const calc = computeWarehouseSensorCount({
          lengthM: liveL, widthM: liveW, heightM: liveH, externalEnv: !!giQ.data?.whExternalEnv,
        });
        const ready = calc.total > 0;
        const allSensorPositions: SensorPosition[] = ready
          ? buildWarehousePositions({ lengthM: liveL, widthM: liveW, heightM: liveH, nL: calc.nL, nW: calc.nW, nV: calc.nV, externalEnv: !!giQ.data?.whExternalEnv })
          : [];
        const tiers = Array.from({ length: Math.max(1, calc.nV) }, (_, i) => i + 1);

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Схема помещения — объекты и датчики
                  </CardTitle>
                  {ready ? (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Сетка по Рек. ЕАЭК №8 (п. 16д): {calc.nL}×{calc.nW}×{calc.nV}; всего <b>{calc.total}</b> регистраторов.
                      Кликните по кружку датчика для назначения. Перетащите объект мышью.
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 mt-1">
                      Укажите размеры помещения ниже, затем нажмите «Сохранить».
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={handleSave} disabled={saveSession.isPending || savePlanImage.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Сохранить схему
                </Button>
              </div>

              {/* ── Room dimension inputs (single source of truth) ── */}
              <div className="mt-4 p-3 rounded-lg border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Размеры зоны хранения</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dim-length" className="text-sm whitespace-nowrap">Длина, м</Label>
                    <Input
                      id="dim-length"
                      ref={lengthRef}
                      type="number"
                      min={0}
                      step={0.1}
                      className="w-24 h-8 text-sm"
                      placeholder="0"
                      onChange={() => setDimsTick(t => t + 1)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dim-width" className="text-sm whitespace-nowrap">Ширина, м</Label>
                    <Input
                      id="dim-width"
                      ref={widthRef}
                      type="number"
                      min={0}
                      step={0.1}
                      className="w-24 h-8 text-sm"
                      placeholder="0"
                      onChange={() => setDimsTick(t => t + 1)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="dim-height" className="text-sm whitespace-nowrap">Высота, м</Label>
                    <Input
                      id="dim-height"
                      ref={heightRef}
                      type="number"
                      min={0}
                      step={0.1}
                      className="w-24 h-8 text-sm"
                      placeholder="0"
                      onChange={() => setDimsTick(t => t + 1)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  <Camera className="inline h-3 w-3 mr-1" />
                  При сохранении автоматически создаётся снимок схемы для PDF
                </p>
              </div>

              {/* Tier tabs */}
              {ready && tiers.length > 1 && (
                <div className="mt-3">
                  <Tabs value={String(activeTier)} onValueChange={v => setActiveTier(Number(v))}>
                    <TabsList className="flex flex-wrap gap-1">
                      {tiers.map(t => (
                        <TabsTrigger key={t} value={String(t)}>
                          {tierLabel(t, calc.nV, liveH)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </CardHeader>

            <CardContent>
              {/* planRef wraps the editor so toPng captures it */}
              <div ref={planRef}>
                <FloorPlanEditor
                  objects={floorPlanObjects}
                  onChange={setFloorPlanObjects}
                  roomLengthM={liveL || 1}
                  roomWidthM={liveW || 1}
                  sensorPositions={allSensorPositions}
                  sensorLoggers={loggers as SensorLogger[]}
                  activeTier={activeTier}
                  onAssignLogger={(objId: string, loggerId: number) => {
                    updateLogger.mutate({ protocolId, loggerId, position: objId ?? null });
                  }}
                />
              </div>

              {/* Sensor legend */}
              {ready && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
                    Датчик назначен
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-full bg-slate-300" />
                    Позиция свободна
                  </span>
                  <span className="flex items-center gap-1.5 ml-auto text-[11px] italic">
                    Кликните по позиции для назначения датчика
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── REFRIGERATOR: cabinet diagram ── */}
      {!isWarehouse && !isAutoRefrigerator && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Схема расстановки датчиков холодильника
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Расстановка датчиков внутри холодильной камеры.
            </p>
          </CardHeader>
          <CardContent>
            <RefrigeratorDiagram loggers={loggers as any} protocolId={protocolId} />
          </CardContent>
        </Card>
      )}

      {/* ── AUTO-REFRIGERATOR: ISPE diagram + 3D assignment ── */}
      {!isWarehouse && isAutoRefrigerator && (
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="positions">Схема позиций ISPE</TabsTrigger>
          <TabsTrigger value="assignment">Расстановка датчиков</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Стандартные позиции ISPE
              </CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Схема показывает 15 стандартных позиций размещения датчиков согласно ISPE Good Practice Guide:
                8 угловых позиций (C1–C8), 4 центра стенок (W1–W4) и 3 центра объёма (V1–V3).
                Это справочная схема — реальные серийные номера датчиков назначаются на вкладке «Расстановка датчиков».
              </p>
            </CardHeader>
            <CardContent>
              <ISPEPositionDiagram />
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2 py-1.5 border border-border font-medium">Позиция</th>
                      <th className="text-left px-2 py-1.5 border border-border font-medium">Описание</th>
                      <th className="text-left px-2 py-1.5 border border-border font-medium">Группа</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "C1", desc: "Угол 1 — перед, лево, низ",    group: "corner" },
                      { id: "C2", desc: "Угол 2 — перед, право, низ",   group: "corner" },
                      { id: "C3", desc: "Угол 3 — зад, право, низ",     group: "corner" },
                      { id: "C4", desc: "Угол 4 — зад, лево, низ",      group: "corner" },
                      { id: "C5", desc: "Угол 5 — перед, лево, верх",   group: "corner" },
                      { id: "C6", desc: "Угол 6 — перед, право, верх",  group: "corner" },
                      { id: "C7", desc: "Угол 7 — зад, право, верх",    group: "corner" },
                      { id: "C8", desc: "Угол 8 — зад, лево, верх",     group: "corner" },
                      { id: "W1", desc: "Центр передней стенки",         group: "wall" },
                      { id: "W2", desc: "Центр задней стенки",           group: "wall" },
                      { id: "W3", desc: "Центр левой стенки",            group: "wall" },
                      { id: "W4", desc: "Центр правой стенки",           group: "wall" },
                      { id: "V1", desc: "Центр объёма — низ",            group: "center" },
                      { id: "V2", desc: "Центр объёма — середина",       group: "center" },
                      { id: "V3", desc: "Центр объёма — верх",           group: "center" },
                    ].map(row => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className="px-2 py-1.5 border border-border font-mono font-semibold">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold mr-1"
                            style={{ background: GROUP_COLORS[row.group as keyof typeof GROUP_COLORS] }}
                          >
                            {row.id.slice(0, 1)}
                          </span>
                          {row.id}
                        </td>
                        <td className="px-2 py-1.5 border border-border text-muted-foreground">{row.desc}</td>
                        <td className="px-2 py-1.5 border border-border">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            row.group === "corner" ? "bg-blue-100 text-blue-700" :
                            row.group === "wall"   ? "bg-emerald-100 text-emerald-700" :
                                                    "bg-rose-100 text-rose-700"
                          }`}>
                            {row.group === "corner" ? "Угол" : row.group === "wall" ? "Стенка" : "Центр"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignment" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Расстановка датчиков</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Интерактивная схема — перетащите датчики на нужные позиции.
                  </p>
                </div>
                <Button size="sm" onClick={handleSave} disabled={saveSession.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Сохранить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ReeferTruckDiagram3D
                loggers={loggers as any}
                protocolId={protocolId}
                coolingUnitPos={coolingUnitPos ?? (session as any)?.coolingUnitPos}
                doorPos={doorPos ?? (session as any)?.doorPos}
                onCoolingUnitPosChange={setCoolingUnitPos}
                onDoorPosChange={setDoorPos}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
