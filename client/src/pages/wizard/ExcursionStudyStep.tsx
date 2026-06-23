import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_SENSOR_ACCURACY_C,
  applySensorAccuracyGuardBand,
} from "@shared/validation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function utcMsFromLocalInput(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}
function localInputFromUtcMs(ms: number | null | undefined): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function fmtTs(ms: number | null | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const totalMinutes = Math.floor(sec / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}
function parseTempRange(mode: string): [number, number] {
  const p = mode.split("-").map(Number);
  if (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) return [p[0], p[1]];
  return [2, 8];
}

const SENSOR_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

type ExcursionFormState = {
  enabled: boolean;
  test1Enabled: boolean;
  test2Enabled: boolean;
  test3Enabled: boolean;
  recordStartAt: string;
  recordEndAt: string;
  t1PowerOnAt: string;
  t1StabilizationThresholdMinutes: string;
  t2DoorOpenAt: string;
  t2DoorCloseAt: string;
  t3PowerOffAt: string;
  t3TestEndAt: string;
};

/* ------------------------------------------------------------------ */
/* Combined chart for all excursion loggers                           */
/* ------------------------------------------------------------------ */
function ExcursionChart({
  loggers,
  rangeMin,
  rangeMax,
  markers,
}: {
  loggers: Array<{ id: number; label: string; customName?: string | null; series?: any }>;
  rangeMin: number;
  rangeMax: number;
  markers?: Array<{ ts: number; label: string; color: string }>;
}) {
  const data = useMemo(() => {
    if (!loggers.length) return [];
    // Merge all series by timestamp
    const tsSet = new Set<number>();
    const seriesMap: Record<string, Record<number, number>> = {};
    for (const l of loggers) {
      const s = l.series as { ts: number[]; temp: number[] } | null;
      if (!s?.ts?.length) continue;
      const name = l.customName || l.label;
      seriesMap[name] = {};
      const step = Math.max(1, Math.ceil(s.ts.length / 2000));
      for (let i = 0; i < s.ts.length; i += step) {
        tsSet.add(s.ts[i]);
        seriesMap[name][s.ts[i]] = s.temp[i];
      }
    }
    const sorted = Array.from(tsSet).sort((a, b) => a - b);
    return sorted.map(ts => {
      const row: Record<string, number | string> = { ts };
      for (const [name, map] of Object.entries(seriesMap)) {
        if (map[ts] !== undefined) row[name] = map[ts];
      }
      return row;
    });
  }, [loggers]);

  const names = loggers.map(l => l.customName || l.label);

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground rounded-xl border bg-muted/20">
        Загрузите файлы логгеров для отображения графика
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="ts"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={v => {
            const d = new Date(v);
            return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
          }}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          domain={[rangeMin - 3, rangeMax + 5]}
          tickFormatter={v => `${v}°`}
          tick={{ fontSize: 11 }}
          width={36}
        />
        <Tooltip
          labelFormatter={v => fmtTs(v as number)}
          formatter={(v: any, name: string) => [`${Number(v).toFixed(1)} °C`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={rangeMin} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: `${rangeMin}°C`, fontSize: 10, fill: "#3b82f6" }} />
        <ReferenceLine y={rangeMax} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `${rangeMax}°C`, fontSize: 10, fill: "#ef4444" }} />
        {markers?.map((m, i) => (
          <ReferenceLine key={i} x={m.ts} stroke={m.color} strokeWidth={2} label={{ value: m.label, fontSize: 10, fill: m.color }} />
        ))}
        {names.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={SENSOR_COLORS[i % SENSOR_COLORS.length]}
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export default function ExcursionStudyStep({
  protocolId,
  onDone,
  onBack,
}: {
  protocolId: number;
  onDone: () => void;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const sessionQ = trpc.excursion.getSession.useQuery({ protocolId });
  const loggersQ = trpc.excursion.listLoggers.useQuery({ protocolId });
  const giQ = trpc.generalInfo.get.useQuery({ protocolId });
  const fileRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPayloadRef = useRef<string | null>(null);
  const latestFormRef = useRef<ExcursionFormState | null>(null);
  const saveSessionRef = useRef<any>(null);
  const [uploading, setUploading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [expandedTest, setExpandedTest] = useState<1 | 2 | 3 | null>(1);

  const session = sessionQ.data;
  const loggers = loggersQ.data ?? [];
  const tempMode = giQ.data?.tempMode ?? "2-8";
  const [rawRangeMin, rawRangeMax] = parseTempRange(tempMode);
  const guardedRange = applySensorAccuracyGuardBand(
    rawRangeMin,
    rawRangeMax,
    DEFAULT_SENSOR_ACCURACY_C,
  );
  const rangeMin = guardedRange.min;
  const rangeMax = guardedRange.max;

  const [form, setForm] = useState<ExcursionFormState | null>(null);

  function buildSessionPayload(formState: ExcursionFormState) {
    return {
      protocolId,
      enabled: formState.enabled,
      test1Enabled: formState.test1Enabled,
      test2Enabled: formState.test2Enabled,
      test3Enabled: formState.test3Enabled,
      recordStartAt: utcMsFromLocalInput(formState.recordStartAt),
      recordEndAt: utcMsFromLocalInput(formState.recordEndAt),
      t1PowerOnAt: utcMsFromLocalInput(formState.t1PowerOnAt),
      t1StabilizationThresholdMinutes: Number(formState.t1StabilizationThresholdMinutes) || 15,
      t2DoorOpenAt: utcMsFromLocalInput(formState.t2DoorOpenAt),
      t2DoorCloseAt: utcMsFromLocalInput(formState.t2DoorCloseAt),
      t3PowerOffAt: utcMsFromLocalInput(formState.t3PowerOffAt),
      t3TestEndAt: utcMsFromLocalInput(formState.t3TestEndAt),
    };
  }

  function rememberSaved(formState: ExcursionFormState) {
    lastSavedPayloadRef.current = JSON.stringify(buildSessionPayload(formState));
  }

  useEffect(() => {
    if (!sessionQ.isSuccess || form) return;
    if (session) {
      const nextForm: ExcursionFormState = {
        enabled: !!session.enabled,
        test1Enabled: !!session.test1Enabled,
        test2Enabled: !!session.test2Enabled,
        test3Enabled: !!session.test3Enabled,
        recordStartAt: localInputFromUtcMs(session.recordStartAt as any),
        recordEndAt: localInputFromUtcMs(session.recordEndAt as any),
        t1PowerOnAt: localInputFromUtcMs(session.t1PowerOnAt as any),
        t1StabilizationThresholdMinutes: String(session.t1StabilizationThresholdMinutes ?? 15),
        t2DoorOpenAt: localInputFromUtcMs(session.t2DoorOpenAt as any),
        t2DoorCloseAt: localInputFromUtcMs(session.t2DoorCloseAt as any),
        t3PowerOffAt: localInputFromUtcMs(session.t3PowerOffAt as any),
        t3TestEndAt: localInputFromUtcMs((session as any).t3TestEndAt as any),
      };
      setForm(nextForm);
      rememberSaved(nextForm);
    } else {
      const nextForm: ExcursionFormState = {
        enabled: false,
        test1Enabled: true,
        test2Enabled: true,
        test3Enabled: true,
        recordStartAt: "",
        recordEndAt: "",
        t1PowerOnAt: "",
        t1StabilizationThresholdMinutes: "15",
        t2DoorOpenAt: "",
        t2DoorCloseAt: "",
        t3PowerOffAt: "",
        t3TestEndAt: "",
      };
      setForm(nextForm);
      rememberSaved(nextForm);
    }
  }, [sessionQ.isSuccess, session, form]);

  const updateLoggerRole = trpc.excursion.updateLogger.useMutation({
    onMutate: async ({ id, role }) => {
      await utils.excursion.listLoggers.cancel({ protocolId });
      const prev = utils.excursion.listLoggers.getData({ protocolId });
      utils.excursion.listLoggers.setData({ protocolId }, old =>
        old ? old.map(l => l.id === id ? { ...l, role: role ?? l.role } : l) : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.excursion.listLoggers.setData({ protocolId }, ctx.prev);
    },
    onSettled: () => utils.excursion.listLoggers.invalidate({ protocolId }),
  });
  const saveSession = trpc.excursion.saveSession.useMutation({
    onSuccess: () => utils.excursion.getSession.invalidate({ protocolId }),
  });
  saveSessionRef.current = saveSession;

  useEffect(() => {
    if (!form) return;
    latestFormRef.current = form;
    const payload = buildSessionPayload(form);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedPayloadRef.current) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      lastSavedPayloadRef.current = serialized;
      saveSession.mutate(payload);
    }, 700);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [form, saveSession]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const latestForm = latestFormRef.current;
      if (!latestForm) return;
      const payload = buildSessionPayload(latestForm);
      const serialized = JSON.stringify(payload);
      if (serialized !== lastSavedPayloadRef.current) {
        lastSavedPayloadRef.current = serialized;
        saveSessionRef.current?.mutate(payload);
      }
    };
  }, []);

  const uploadLogger = trpc.excursion.uploadLogger.useMutation({
    onSuccess: () => utils.excursion.listLoggers.invalidate({ protocolId }),
  });
  const deleteLogger = trpc.excursion.deleteLogger.useMutation({
    onSuccess: () => utils.excursion.listLoggers.invalidate({ protocolId }),
  });
  const runCalc = trpc.excursion.runCalculations.useMutation({
    onSuccess: () => {
      utils.excursion.getSession.invalidate({ protocolId });
      toast.success("Расчёты выполнены");
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleSave() {
    if (!form) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const payload = buildSessionPayload(form);
    await saveSession.mutateAsync(payload);
    lastSavedPayloadRef.current = JSON.stringify(payload);
    toast.success("Параметры сохранены");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadLogger.mutateAsync({
        protocolId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        base64,
      });
      toast.success(`Файл «${file.name}» загружен`);
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleCalc() {
    setCalculating(true);
    try {
      await handleSave();
      await runCalc.mutateAsync({ protocolId });
    } finally {
      setCalculating(false);
    }
  }

  // Build chart markers from session events
  const chartMarkers = useMemo(() => {
    if (!session) return [];
    const m: Array<{ ts: number; label: string; color: string }> = [];
    if (session.t1PowerOnAt) m.push({ ts: Number(session.t1PowerOnAt), label: "Вкл.", color: "#22c55e" });
    if (session.t1TStableAt) m.push({ ts: Number(session.t1TStableAt), label: "T_стаб", color: "#3b82f6" });
    if (session.t2DoorOpenAt) m.push({ ts: Number(session.t2DoorOpenAt), label: "Дверь↑", color: "#f59e0b" });
    if (session.t2DoorCloseAt) m.push({ ts: Number(session.t2DoorCloseAt), label: "Дверь↓", color: "#f59e0b" });
    if (session.t2TBreakAt) m.push({ ts: Number(session.t2TBreakAt), label: "Откл.T2", color: "#ef4444" });
    if (session.t3PowerOffAt) m.push({ ts: Number(session.t3PowerOffAt), label: "Выкл.", color: "#8b5cf6" });
    if (session.t3TBreakAt) m.push({ ts: Number(session.t3TBreakAt), label: "Откл.T3", color: "#ef4444" });
    return m;
  }, [session]);

  if (sessionQ.isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Загрузка…
      </div>
    );
  }

  const warnings: string[] = (session?.warnings as any) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Испытания на температурное отклонение</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Temperature Excursion Study — Режим А (единая запись)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Номинально {rawRangeMin}–{rawRangeMax} °C, погрешность ±{guardedRange.sensorAccuracy} °C:
            расчётный диапазон {rangeMin}–{rangeMax} °C.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="excursion-enabled" className="text-sm font-medium">Включить этап</Label>
          <Switch
            id="excursion-enabled"
            checked={form.enabled}
            onCheckedChange={v => setForm(f => f ? { ...f, enabled: v } : f)}
          />
        </div>
      </div>

      {!form.enabled && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Этап отключён. Включите переключатель выше, чтобы добавить испытания на температурное отклонение в протокол.
          </CardContent>
        </Card>
      )}

      {form.enabled && (
        <>
          {/* Record window */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Период записи данных</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Начало записи</Label>
                <Input
                  type="datetime-local"
                  value={form.recordStartAt}
                  onChange={e => setForm(f => f ? { ...f, recordStartAt: e.target.value } : f)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Конец записи</Label>
                <Input
                  type="datetime-local"
                  value={form.recordEndAt}
                  onChange={e => setForm(f => f ? { ...f, recordEndAt: e.target.value } : f)}
                />
              </div>
            </CardContent>
          </Card>

          {/* File upload */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Файлы логгеров</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loggers.length > 0 && (
                <div className="space-y-2">
                  {loggers.map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm font-medium">{l.customName || l.label}</span>
                        <span className="text-xs text-muted-foreground truncate">{l.fileName}</span>
                        <Badge variant="outline" className="text-xs">{l.pointCount} точек</Badge>
                        <button
                          type="button"
                          title="Нажмите для смены роли (Внутренний / Внешний)"
                          onClick={() => updateLoggerRole.mutate({
                            id: l.id,
                            protocolId,
                            role: l.role === "external" ? "internal" : "external",
                          })}
                          className="cursor-pointer focus:outline-none"
                        >
                          <Badge
                            variant={l.role === "external" ? "secondary" : "default"}
                            className="text-xs hover:opacity-75 transition-opacity select-none"
                          >
                            {l.role === "external" ? "Внешний ⇄" : "Внутренний ⇄"}
                          </Badge>
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteLogger.mutateAsync({ id: l.id, protocolId })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Загрузить файл логгера
              </Button>
            </CardContent>
          </Card>

          {/* Chart */}
          {loggers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">График температуры</CardTitle>
              </CardHeader>
              <CardContent>
                <ExcursionChart
                  loggers={loggers as any}
                  rangeMin={rangeMin}
                  rangeMax={rangeMax}
                  markers={chartMarkers}
                />
              </CardContent>
            </Card>
          )}

          {/* Tests */}
          {/* Test 1 */}
          <Card>
            <CardHeader
              className="pb-2 cursor-pointer select-none"
              onClick={() => setExpandedTest(expandedTest === 1 ? null : 1)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.test1Enabled}
                    onCheckedChange={v => setForm(f => f ? { ...f, test1Enabled: v } : f)}
                    onClick={e => e.stopPropagation()}
                  />
                  <CardTitle className="text-base">Тест 1 — Время выхода на режим (Power-on)</CardTitle>
                  {session?.t1DurationSec != null && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />{fmtDuration(session.t1DurationSec)}
                    </Badge>
                  )}
                </div>
                {expandedTest === 1 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {expandedTest === 1 && form.test1Enabled && (
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Фиксируется момент включения холодильника и определяется время, за которое все внутренние датчики
                  стабилизируются в целевом диапазоне {rangeMin}–{rangeMax} °C.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Момент включения (Power-on)</Label>
                    <Input
                      type="datetime-local"
                      value={form.t1PowerOnAt}
                      onChange={e => setForm(f => f ? { ...f, t1PowerOnAt: e.target.value } : f)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Порог стабилизации (мин)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.t1StabilizationThresholdMinutes}
                      onChange={e => setForm(f => f ? { ...f, t1StabilizationThresholdMinutes: e.target.value } : f)}
                    />
                  </div>
                </div>
                {session?.t1DurationSec != null && (
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 space-y-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">Результат Теста 1</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Время стабилизации:</span><br /><strong>{fmtDuration(session.t1DurationSec)}</strong></div>
                      <div><span className="text-muted-foreground">Критический датчик:</span><br /><strong>{session.t1CriticalSensor ?? "—"}</strong></div>
                      <div><span className="text-muted-foreground">T_стаб:</span><br /><strong>{fmtTs(session.t1TStableAt as any)}</strong></div>
                    </div>
                    {Array.isArray(session.t1SensorEntries) && (session.t1SensorEntries as any[]).length > 0 && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-1 pr-3">Датчик</th>
                              <th className="text-left py-1 pr-3">T при включении</th>
                              <th className="text-left py-1 pr-3">Время входа в диапазон</th>
                              <th className="text-left py-1">Длительность</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(session.t1SensorEntries as any[]).map((e: any) => (
                              <tr key={e.label} className="border-b last:border-0">
                                <td className="py-1 pr-3 font-mono">{e.label}</td>
                                <td className="py-1 pr-3">{e.tempAtOn != null ? `${e.tempAtOn.toFixed(1)} °C` : "—"}</td>
                                <td className="py-1 pr-3">{fmtTs(e.entryAt)}</td>
                                <td className="py-1">{fmtDuration(e.durationSec)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Test 2 */}
          <Card>
            <CardHeader
              className="pb-2 cursor-pointer select-none"
              onClick={() => setExpandedTest(expandedTest === 2 ? null : 2)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.test2Enabled}
                    onCheckedChange={v => setForm(f => f ? { ...f, test2Enabled: v } : f)}
                    onClick={e => e.stopPropagation()}
                  />
                  <CardTitle className="text-base">Тест 2 — Открытие двери (Door-open)</CardTitle>
                  {session?.t2DurationSec != null && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      {session.t2NoBreak ? "Режим сохранён" : fmtDuration(session.t2DurationSec)}
                    </Badge>
                  )}
                </div>
                {expandedTest === 2 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {expandedTest === 2 && form.test2Enabled && (
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Дверь холодильника открывается на фиксированное время. Определяется момент, когда температура
                  хотя бы одного внутреннего датчика выходит за пределы {rangeMin}–{rangeMax} °C.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Дверь открыта</Label>
                    <Input
                      type="datetime-local"
                      value={form.t2DoorOpenAt}
                      onChange={e => setForm(f => f ? { ...f, t2DoorOpenAt: e.target.value } : f)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Дверь закрыта</Label>
                    <Input
                      type="datetime-local"
                      value={form.t2DoorCloseAt}
                      onChange={e => setForm(f => f ? { ...f, t2DoorCloseAt: e.target.value } : f)}
                    />
                  </div>
                </div>
                {session?.t2DurationSec != null && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Результат Теста 2</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Время до отклонения:</span><br /><strong>{session.t2NoBreak ? "Отклонения нет" : fmtDuration(session.t2DurationSec)}</strong></div>
                      <div><span className="text-muted-foreground">Критический датчик:</span><br /><strong>{session.t2CriticalSensor ?? "—"}</strong></div>
                      <div><span className="text-muted-foreground">Момент отклонения:</span><br /><strong>{session.t2NoBreak ? "—" : fmtTs(session.t2TBreakAt as any)}</strong></div>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Test 3 */}
          <Card>
            <CardHeader
              className="pb-2 cursor-pointer select-none"
              onClick={() => setExpandedTest(expandedTest === 3 ? null : 3)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.test3Enabled}
                    onCheckedChange={v => setForm(f => f ? { ...f, test3Enabled: v } : f)}
                    onClick={e => e.stopPropagation()}
                  />
                  <CardTitle className="text-base">Тест 3 — Отключение питания (Power-off)</CardTitle>
                  {session?.t3DurationSec != null && (
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                      {session.t3NoBreak ? "Режим сохранён" : fmtDuration(session.t3DurationSec)}
                    </Badge>
                  )}
                </div>
                {expandedTest === 3 ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {expandedTest === 3 && form.test3Enabled && (
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Питание холодильника отключается. Определяется время, за которое температура хотя бы одного
                  внутреннего датчика выходит за пределы {rangeMin}–{rangeMax} °C.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Момент отключения питания</Label>
                    <Input
                      type="datetime-local"
                      value={form.t3PowerOffAt}
                      onChange={e => setForm(f => f ? { ...f, t3PowerOffAt: e.target.value } : f)}
                    />
                  </div>
                  {session?.t3NoBreak && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Время завершения испытания
                        <span className="ml-1 text-amber-600 font-medium">(режим сохранён — укажите для расчёта)</span>
                      </Label>
                      <Input
                        type="datetime-local"
                        value={form.t3TestEndAt}
                        onChange={e => setForm(f => f ? { ...f, t3TestEndAt: e.target.value } : f)}
                      />
                    </div>
                  )}
                </div>
                {session?.t3DurationSec != null && (
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 space-y-1">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-300">Результат Теста 3</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Время до отклонения:</span><br /><strong>{session.t3NoBreak ? "Отклонения нет" : fmtDuration(session.t3DurationSec)}</strong></div>
                      <div><span className="text-muted-foreground">Критический датчик:</span><br /><strong>{session.t3CriticalSensor ?? "—"}</strong></div>
                      <div><span className="text-muted-foreground">Момент отклонения:</span><br /><strong>{session.t3NoBreak ? "—" : fmtTs(session.t3TBreakAt as any)}</strong></div>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Warnings */}
          {warnings.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="pt-4 space-y-1">
                {warnings.map((w, i) => {
                  const isInfo = w.startsWith('[INFO]');
                  const text = isInfo ? w.replace(/^\[INFO\]\s*/, '') : w;
                  return isInfo ? (
                    <div key={i} className="flex gap-2 text-sm text-blue-700 dark:text-blue-300">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{text}</span>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-2 text-sm text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{text}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Run calculations button */}
          <div className="flex justify-end">
            <Button
              onClick={handleCalc}
              disabled={calculating || !loggers.length}
              className="gap-2"
            >
              {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Рассчитать результаты
            </Button>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Назад
        </Button>
        <Button
          onClick={async () => {
            if (form?.enabled) await handleSave();
            onDone();
          }}
          className="gap-2"
        >
          Далее <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
