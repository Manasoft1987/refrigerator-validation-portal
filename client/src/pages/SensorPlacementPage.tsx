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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Camera, FileImage, Info, MapPin, Save, Trash2, Upload, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useParams, useLocation } from "wouter";
import { toPng } from "html-to-image";
import { nanoid } from "nanoid";
import ReeferTruckDiagram3D from "@/components/ReeferTruckDiagram3D";
import RefrigeratorDiagram from "@/components/RefrigeratorDiagram";
import FloorPlanEditor, { FloorPlanObject, SensorPosition, SensorLogger } from "@/components/FloorPlanEditor";
import { buildWarehousePositions } from "@/components/WarehouseLayoutDiagram";
import { computeWarehouseSensorCount, isWarehouseEaeu, isWarehouseLike, TEMP_MODES } from "@shared/validation";

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

function loggerDisplayName(logger: SensorLogger): string {
  return String(logger.customName || logger.label || `Датчик ${logger.id}`).trim();
}

function normalizeLoggerName(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function readNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

async function renderPdfFirstPageToPng(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const maxSide = 1800;
  const scale = Math.min(2.5, Math.max(1, maxSide / Math.max(baseViewport.width, baseViewport.height)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

async function planBackgroundFileToDataUrl(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return renderPdfFirstPageToPng(file);
  }
  if (file.type.startsWith("image/")) {
    return readFileAsDataUrl(file);
  }
  throw new Error("Поддерживаются PDF, PNG, JPG и WebP");
}

// --- Main Page ----------------------------------------------------------------
export default function SensorPlacementPage() {
  const params = useParams<{ id: string }>();
  const protocolId = parseInt(params.id ?? "0", 10);
  const trialKey = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("trial") || "default"
    : "default";
  const [, navigate] = useLocation();
  const returnToProtocol = useCallback(() => {
    try {
      window.sessionStorage.setItem(`protocolWizardStep:${protocolId}`, "pv");
    } catch {
      // Session storage is optional; the query param below is enough for normal navigation.
    }
    navigate(`/protocols/${protocolId}?step=pv`);
  }, [navigate, protocolId]);

  const pvQ = trpc.pv.get.useQuery({ protocolId, trialKey });
  const saveSession = trpc.pv.saveSession.useMutation({
    onSuccess: () => {
      toast.success("Схема сохранена");
      pvQ.refetch();
    },
    onError: (e) => toast.error("Ошибка сохранения: " + e.message),
  });
  const savePlanBackgroundImage = trpc.pv.savePlanBackgroundImage.useMutation({
    onError: (e) => toast.error("Не удалось загрузить фон схемы: " + e.message),
  });

  const session = pvQ.data?.session;
  const loggers = pvQ.data?.loggers ?? [];
  const refrigeratorCriticalLoggers = useMemo(() => {
    let hotLoggerId: number | null = null;
    let coldLoggerId: number | null = null;
    let hotAvg = -Infinity;
    let coldMin = Infinity;
    for (const logger of loggers as any[]) {
      if (logger.role !== "internal") continue;
      const avg = readNumber(logger.avgVal);
      const min = readNumber(logger.minVal);
      if (avg !== null && avg > hotAvg) {
        hotAvg = avg;
        hotLoggerId = logger.id;
      }
      if (min !== null && min < coldMin) {
        coldMin = min;
        coldLoggerId = logger.id;
      }
    }
    return { hotLoggerId, coldLoggerId };
  }, [loggers]);
  const protocolQ = trpc.protocols.get.useQuery({ id: protocolId });
  const giQ = trpc.generalInfo.get.useQuery({ protocolId });
  const protocolEquipmentType = protocolQ.data?.customEquipmentName === "__equipmentType:chamber" ? "chamber" : protocolQ.data?.equipmentType;
  const equipmentType = (giQ.data?.equipmentType || protocolEquipmentType || "refrigerator") as string;
  const isWarehouse = isWarehouseLike(equipmentType);
  const isWarehouseByEaeu = isWarehouseEaeu(equipmentType);
  const isAutoRefrigerator = equipmentType === "auto-refrigerator" || equipmentType === "chamber" || equipmentType === "thermal-container";
  const planTempMode = String((session as any)?.tempMode || giQ.data?.tempMode || "2-8");
  const planModeDef = TEMP_MODES.find(mode => mode.id === planTempMode);
  const planRangeMin = readNumber((session as any)?.customMin ?? (giQ.data as any)?.customMin) ?? planModeDef?.min ?? null;
  const planRangeMax = readNumber((session as any)?.customMax ?? (giQ.data as any)?.customMax) ?? planModeDef?.max ?? null;

  const updateLogger = trpc.pv.updateLogger.useMutation({
    onSuccess: () => pvQ.refetch(),
    onError: (e) => toast.error("Не удалось сохранить позицию: " + e.message),
  });

  const [coolingUnitPos, setCoolingUnitPos] = useState<{ x: number; y: number } | null>(null);
  const [doorPos, setDoorPos] = useState<{ x: number; y: number } | null>(null);
  const [floorPlanObjects, setFloorPlanObjects] = useState<FloorPlanObject[]>([]);
  const [refrigeratorLevelCount, setRefrigeratorLevelCount] = useState<number>(7);
  const [refrigeratorDrawerCount, setRefrigeratorDrawerCount] = useState<0 | 1 | 2>(2);
  const [activeTier, setActiveTier] = useState<number>(1);
  const [showDimensions, setShowDimensions] = useState(false);
  const [planBackgroundImageUrl, setPlanBackgroundImageUrl] = useState<string | null>(null);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Uncontrolled refs for room dimensions — immune to React re-renders
  const lengthRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const [, setDimsTick] = useState(0);
  const planRef = useRef<HTMLDivElement>(null);
  const backgroundFileRef = useRef<HTMLInputElement>(null);
  const dimsSeededRef = useRef(false);
  const readDim = (r: React.RefObject<HTMLInputElement | null>) => {
    const v = r.current?.value?.trim() ?? "";
    return v === "" ? null : Number(v);
  };

  if (session && !initialized) {
    setInitialized(true);
    if ((session as any).coolingUnitPos) setCoolingUnitPos((session as any).coolingUnitPos);
    if ((session as any).doorPos) setDoorPos((session as any).doorPos);
    if ((session as any).floorPlanObjects) {
      setFloorPlanObjects((session as any).floorPlanObjects.map((obj: FloorPlanObject) =>
        obj.type === "cooling_unit" ? { ...obj, label: "Кондиционер" } : obj,
      ));
    }
    if ((session as any).planBackgroundImageUrl) {
      setPlanBackgroundImageUrl((session as any).planBackgroundImageUrl);
    }
    const savedDrawerCount = Number((session as any).refrigeratorDrawerCount);
    if (Number.isFinite(savedDrawerCount)) {
      setRefrigeratorDrawerCount(Math.max(0, Math.min(2, Math.round(savedDrawerCount))) as 0 | 1 | 2);
    }
    const savedLevelCount = Number((session as any).refrigeratorLevelCount);
    if (Number.isFinite(savedLevelCount)) {
      setRefrigeratorLevelCount(Math.max(3, Math.min(9, Math.round(savedLevelCount))));
    }
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
      const res = await savePlanImage.mutateAsync({ protocolId, trialKey, dataUrl });
      return { ok: true, url: res.url };
    } catch (err: any) {
      console.error("plan capture failed:", err);
      toast.error("Не удалось снять снимок схемы: " + (err?.message ?? "unknown"));
      return { ok: false };
    }
  }, [protocolId, savePlanImage]);

  const handleBackgroundFile = useCallback(async (file: File) => {
    if (!isWarehouse) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Файл фона больше 25 МБ");
      return;
    }
    setBackgroundUploading(true);
    try {
      const dataUrl = await planBackgroundFileToDataUrl(file);
      const res = await savePlanBackgroundImage.mutateAsync({
        protocolId,
        dataUrl,
        sourceName: file.name,
      });
      setPlanBackgroundImageUrl(res.url);
      await pvQ.refetch();
      toast.success(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        ? "PDF загружен как фон схемы (1-я страница)"
        : "Фон схемы загружен");
    } catch (err: any) {
      toast.error(err?.message ? `Не удалось загрузить фон: ${err.message}` : "Не удалось загрузить фон");
    } finally {
      setBackgroundUploading(false);
      if (backgroundFileRef.current) backgroundFileRef.current.value = "";
    }
  }, [isWarehouse, protocolId, pvQ, savePlanBackgroundImage]);

  const clearBackground = useCallback(() => {
    setPlanBackgroundImageUrl(null);
    saveSession.mutate({
      protocolId,
      trialKey,
      planBackgroundImageKey: null,
      planBackgroundImageUrl: null,
    } as any);
  }, [protocolId, saveSession]);

  const handleAutoPlaceSensors = useCallback(() => {
    if (!isWarehouse) return;
    const internalLoggers = (loggers as SensorLogger[]).filter(logger => logger.role !== "external");
    if (internalLoggers.length === 0) {
      toast.warning("Сначала загрузите внутренние датчики");
      return;
    }

    const nextObjects = [...floorPlanObjects];
    const existingById = new Map(nextObjects.map(obj => [obj.id, obj]));
    const sensorObjects = nextObjects.filter(obj => obj.type === "sensor_point");
    const sensorByLabel = new Map<string, FloorPlanObject[]>();
    sensorObjects.forEach(obj => {
      const key = normalizeLoggerName(obj.label);
      sensorByLabel.set(key, [...(sensorByLabel.get(key) ?? []), obj]);
    });
    const usedSensorObjectIds = new Set<string>();
    const createdAssignments: Array<{ loggerId: number; objectId: string }> = [];
    const missingLoggers: SensorLogger[] = [];

    internalLoggers.forEach(logger => {
      const existingPosition = logger.position ? existingById.get(logger.position) : undefined;
      if (existingPosition?.type === "sensor_point") {
        usedSensorObjectIds.add(existingPosition.id);
        return;
      }

      const matchedByLabel = [
        ...(sensorByLabel.get(normalizeLoggerName(loggerDisplayName(logger))) ?? []),
        ...(sensorByLabel.get(normalizeLoggerName(logger.label)) ?? []),
      ].find(obj => !usedSensorObjectIds.has(obj.id));
      if (matchedByLabel) {
        usedSensorObjectIds.add(matchedByLabel.id);
        createdAssignments.push({ loggerId: logger.id, objectId: matchedByLabel.id });
        return;
      }

      missingLoggers.push(logger);
    });

    const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, missingLoggers.length) * 1.4)));
    const rows = Math.max(1, Math.ceil(Math.max(1, missingLoggers.length) / cols));
    const sensorSizePct = 3;
    missingLoggers.forEach((logger, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const xPct = Math.min(96, Math.max(1, 10 + ((col + 0.5) * 80) / cols - sensorSizePct / 2));
      const yPct = Math.min(96, Math.max(1, 12 + ((row + 0.5) * 76) / rows - sensorSizePct / 2));
      const objectId = nanoid();
      nextObjects.push({
        id: objectId,
        type: "sensor_point",
        xPct,
        yPct,
        widthPct: sensorSizePct,
        heightPct: sensorSizePct,
        heightM: 0,
        rotation: 0,
        label: loggerDisplayName(logger),
      });
      createdAssignments.push({ loggerId: logger.id, objectId });
    });

    setFloorPlanObjects(nextObjects);
    createdAssignments.forEach(item => {
      updateLogger.mutate({ protocolId, loggerId: item.loggerId, position: item.objectId });
    });
    saveSession.mutate({
      protocolId,
      trialKey,
      floorPlanObjects: nextObjects,
      roomLengthM: readDim(lengthRef),
      roomWidthM: readDim(widthRef),
      roomHeightM: readDim(heightRef),
    } as any);
    toast.success(
      missingLoggers.length > 0
        ? `Добавлено точек датчиков: ${missingLoggers.length}. Теперь их можно перетащить на план.`
        : "Все датчики уже есть на схеме. Привязки обновлены.",
    );
  }, [isWarehouse, loggers, floorPlanObjects, updateLogger, protocolId, saveSession, trialKey]);

  const handleSave = useCallback(async () => {
    const L = readDim(lengthRef);
    const W = readDim(widthRef);
    const H = readDim(heightRef);
    let planResult: { ok: boolean; url?: string } = { ok: false };
    if (isWarehouse && planRef.current) {
      planResult = await captureAndSavePlan();
    }
    saveSession.mutate({
      protocolId,
      trialKey,
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
          if (planResult.ok) toast.success("Схема сохранена");
          else toast.warning("Данные схемы сохранены, но снимок для PDF создать не удалось");
        } else {
          toast.success("Сохранено");
        }
      },
    });
  }, [protocolId, coolingUnitPos, doorPos, floorPlanObjects, saveSession, isWarehouse, captureAndSavePlan]);

  const handleRefrigeratorDrawerCountChange = useCallback((count: number) => {
    const normalized = Math.max(0, Math.min(2, Math.round(count))) as 0 | 1 | 2;
    setRefrigeratorDrawerCount(normalized);
    saveSession.mutate({
      protocolId,
      trialKey,
      refrigeratorDrawerCount: normalized,
    } as any);
  }, [protocolId, saveSession, trialKey]);

  const handleRefrigeratorLevelCountChange = useCallback((count: number) => {
    const normalized = Math.max(3, Math.min(9, Math.round(count)));
    setRefrigeratorLevelCount(normalized);
    saveSession.mutate({
      protocolId,
      trialKey,
      refrigeratorLevelCount: normalized,
    } as any);
  }, [protocolId, saveSession, trialKey]);

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
            {"\u041f\u0440\u043e\u0442\u043e\u043a\u043e\u043b #"}{protocolId}{"\u0020\u2014\u0020"}{isWarehouse ? (isWarehouseByEaeu ? "\u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0435 / \u0437\u043e\u043d\u0430 \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f (\u0415\u0410\u042d\u041a \u21168)" : "\u043f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0435 / \u0437\u043e\u043d\u0430 \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f (\u044d\u043a\u0441\u043f\u0435\u0440\u0442\u043d\u043e\u0435)") : equipmentType === "chamber" ? "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u043c\u0435\u0440\u0430" : isAutoRefrigerator ? "\u0430\u0432\u0442\u043e\u0440\u0435\u0444\u0440\u0438\u0436\u0435\u0440\u0430\u0442\u043e\u0440" : "\u0445\u043e\u043b\u043e\u0434\u0438\u043b\u044c\u043d\u0438\u043a"}
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
        const ready = isWarehouseByEaeu && calc.total > 0;
        const canShowDimensions = liveL > 0 && liveW > 0;
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
                  {isWarehouseByEaeu && ready ? (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Сетка по Рек. ЕАЭК №8 (п. 16д): {calc.nL}×{calc.nW}×{calc.nV}; всего <b>{calc.total}</b> регистраторов.
                      Кликните по кружку датчика для назначения. Перетащите объект мышью.
                    </p>
                  ) : !isWarehouseByEaeu ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Экспертный режим: количество и точки размещения датчиков задаются вручную специалистом. Размеры нужны только для масштаба схемы.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      Размеры необязательны. Без них схема сохраняется без масштаба и расчётной сетки.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-background"
                    onClick={handleAutoPlaceSensors}
                    disabled={saveSession.isPending || updateLogger.isPending || loggers.length === 0}
                  >
                    <Wand2 className="h-4 w-4 mr-1" /> Расставить датчики
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saveSession.isPending || savePlanImage.isPending || backgroundUploading || savePlanBackgroundImage.isPending}>
                    <Save className="h-4 w-4 mr-1" /> Сохранить схему
                  </Button>
                </div>
              </div>

              {/* ── Room dimension inputs (single source of truth) ── */}
              <div className="mt-4 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Размеры зоны хранения (необязательно)
                  </p>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="show-plan-dimensions"
                      checked={showDimensions && canShowDimensions}
                      disabled={!canShowDimensions}
                      onCheckedChange={setShowDimensions}
                    />
                    <Label htmlFor="show-plan-dimensions" className="text-xs">
                      Показывать на схеме
                    </Label>
                  </div>
                </div>
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
                      placeholder="не указано"
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
                      placeholder="не указано"
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
                      placeholder="не указано"
                      onChange={() => setDimsTick(t => t + 1)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  <Camera className="inline h-3 w-3 mr-1" />
                  При сохранении автоматически создаётся снимок схемы для PDF
                </p>
              </div>

              <div className="mt-3 p-3 rounded-lg border bg-blue-50/60">
                <input
                  ref={backgroundFileRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleBackgroundFile(file);
                  }}
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-2">
                    <FileImage className="h-4 w-4 mt-0.5 text-blue-700" />
                    <div>
                      <p className="text-xs font-semibold text-blue-900">
                        Фон схемы помещения
                      </p>
                      <p className="text-[11px] text-blue-800/80">
                        Можно оставить ручную схему или загрузить PDF/фото плана и расставлять датчики поверх него.
                        Для PDF используется первая страница.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-background"
                      disabled={backgroundUploading || savePlanBackgroundImage.isPending}
                      onClick={() => backgroundFileRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      {backgroundUploading || savePlanBackgroundImage.isPending ? "Загрузка..." : "Загрузить фон"}
                    </Button>
                    {planBackgroundImageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-background text-destructive hover:text-destructive"
                        onClick={clearBackground}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Убрать фон
                      </Button>
                    )}
                  </div>
                </div>
                {planBackgroundImageUrl && (
                  <p className="mt-2 text-[11px] text-blue-900">
                    Фон загружен. Все объекты и датчики будут сохранены поверх него и попадут в PDF-снимок схемы.
                  </p>
                )}
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
                  roomLengthM={liveL}
                  roomWidthM={liveW}
                  showDimensions={showDimensions && canShowDimensions}
                  sensorPositions={allSensorPositions}
                  sensorLoggers={loggers as SensorLogger[]}
                  activeTier={activeTier}
                  backgroundImageUrl={planBackgroundImageUrl}
                  rangeMin={planRangeMin}
                  rangeMax={planRangeMax}
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
            <RefrigeratorDiagram
              loggers={loggers as any}
              protocolId={protocolId}
              levelCount={refrigeratorLevelCount}
              onLevelCountChange={handleRefrigeratorLevelCountChange}
              drawerCount={refrigeratorDrawerCount}
              onDrawerCountChange={handleRefrigeratorDrawerCountChange}
              hotLoggerId={refrigeratorCriticalLoggers.hotLoggerId}
              coldLoggerId={refrigeratorCriticalLoggers.coldLoggerId}
            />
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
                objectType={equipmentType === "auto-refrigerator" ? "truck" : equipmentType === "thermal-container" ? "thermal-container" : "chamber"}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
