import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_SENSOR_ACCURACY_C,
  TEMP_MODES,
  applySensorAccuracyGuardBand,
} from "@shared/validation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Save,
  Sparkles,
  Thermometer,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import SensorChart from "./SensorChart";
import { InteractiveSensorDiagram } from "@/components/InteractiveSensorDiagram";
import RefrigeratorDiagram from "@/components/RefrigeratorDiagram";
import ReeferTruckDiagram3D from "@/components/ReeferTruckDiagram3D";

// datetime-local helpers — treat the entered wall-clock as UTC so it lines up
// with logger file timestamps (which are also stored as wall-clock UTC).
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

export default function PVStep({
  protocolId,
  onDone,
  onBack,
}: {
  protocolId: number;
  onDone: () => void;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const pvQ = trpc.pv.get.useQuery({ protocolId });
  const giQ = trpc.generalInfo.get.useQuery({ protocolId });
  const protocolQ = trpc.protocols.get.useQuery({ id: protocolId });
  const equipmentType = protocolQ.data?.equipmentType ?? "refrigerator";
  const isWarehouse = equipmentType === "warehouse";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedLogger, setSelectedLogger] = useState<number | null>(null);

  const session = pvQ.data?.session;
  const loggers = pvQ.data?.loggers || [];

  // local editable session state
  const [form, setForm] = useState<any>(null);
  // Local state for custom name inputs (keyed by logger id) so typing works
  const [customNames, setCustomNames] = useState<Record<number, string>>({});
  useEffect(() => {
    if (session && !form) {
      setForm({
        tempMode: session.tempMode || giQ.data?.tempMode || "2-8",
        startAt: localInputFromUtcMs(session.startAt as any),
        endAt: localInputFromUtcMs(session.endAt as any),
        minDurationHours: session.minDurationHours || 72,
        minSensorCount: session.minSensorCount || 9,
        samplingStepMinutes: session.samplingStepMinutes ? String(session.samplingStepMinutes) : "0",
        customMin: session.customMin ?? "",
        customMax: session.customMax ?? "",
      });
    }
  }, [session, giQ.data, form]);

  // auto-infer start/end from uploaded data (only if not already set)
  useEffect(() => {
    if (!form || !loggers.length) return;
    if (form.startAt && form.endAt) return;
    // The logger response in list is without series to keep size small.
    // We use pointCount as heuristic, but no ts available here.
    // Users can set manually - skip auto-infer in this view.
  }, [loggers, form]);

  const saveSession = trpc.pv.saveSession.useMutation({
    onSuccess: () => {
      utils.pv.get.invalidate({ protocolId });
      toast.success("Параметры PV сохранены");
    },
    onError: e => toast.error(e.message),
  });
  const uploadLogger = trpc.pv.uploadLogger.useMutation();
  const updateLogger = trpc.pv.updateLogger.useMutation({
    onSuccess: () => utils.pv.get.invalidate({ protocolId }),
    onError: e => toast.error(e.message),
  });
  const deleteLogger = trpc.pv.deleteLogger.useMutation({
    onSuccess: () => {
      utils.pv.get.invalidate({ protocolId });
      toast.success("Датчик удалён");
    },
    onError: e => toast.error(e.message),
  });
  const autoDetect = trpc.pv.autoDetectExternal.useMutation({
    onSuccess: ({ externals }) => {
      utils.pv.get.invalidate({ protocolId });
      toast.success(
        externals.length
          ? `Найдено внешних датчиков: ${externals.length}`
          : "Внешние датчики не обнаружены",
      );
    },
    onError: e => toast.error(e.message),
  });
  const analyze = trpc.pv.analyze.useMutation({
    onSuccess: res => {
      utils.pv.get.invalidate({ protocolId });
      utils.protocols.get.invalidate({ id: protocolId });
      if (res.verdict === "pass") toast.success("PV пройден. Можно формировать итоговый отчёт.");
      else toast.warning(`PV не пройден: ${res.failureReasons[0] || "см. замечания"}`);
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  // Optimal window suggestion state
  const [windowSuggestion, setWindowSuggestion] = useState<{
    startAt: number;
    endAt: number;
    explanation: string;
    gapCount: number;
    outOfRangeCount: number;
    stdDev: number;
  } | null>(null);

  const findOptimalWindow = trpc.pv.findOptimalWindow.useMutation({
    onSuccess: result => {
      setWindowSuggestion(result);
    },
    onError: e => toast.error(e.message),
  });

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 20 * 1024 * 1024) {
          toast.error(`${f.name}: файл больше 20 МБ — пропуск`);
          continue;
        }
        const b64 = await fileToBase64(f);
        try {
          await uploadLogger.mutateAsync({
            protocolId,
            fileName: f.name,
            contentType: f.type,
            base64: b64,
          });
          toast.success(`Файл загружен: ${f.name}`);
        } catch (e: any) {
          toast.error(`${f.name}: ${e.message}`);
        }
      }
      utils.pv.get.invalidate({ protocolId });
    } finally {
      setUploading(false);
    }
  };

  const { min: rangeMin, max: rangeMax, rawMin, rawMax, sensorAccuracy } = useMemo(() => {
    const mode = TEMP_MODES.find(m => m.id === (form?.tempMode || session?.tempMode || "2-8"));
    const customMin = form?.customMin !== "" && form?.customMin !== null && form?.customMin !== undefined
      ? Number(form.customMin)
      : null;
    const customMax = form?.customMax !== "" && form?.customMax !== null && form?.customMax !== undefined
      ? Number(form.customMax)
      : null;
    return applySensorAccuracyGuardBand(
      customMin ?? mode?.min ?? 2,
      customMax ?? mode?.max ?? 8,
      DEFAULT_SENSOR_ACCURACY_C,
    );
  }, [form, session]);

  const internals = loggers.filter(l => l.role === "internal");
  const normalizedDurationHours = (value: unknown) => {
    const parsed = Number(value);
    const fallback = Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
    return isWarehouse ? Math.max(72, fallback) : fallback;
  };

  if (pvQ.isLoading || !form) {
    return <div className="h-80 rounded-xl bg-muted animate-pulse" />;
  }

  const saveFormPatch = () => {
    const step = Number(form.samplingStepMinutes);
    saveSession.mutate({
      protocolId,
      tempMode: form.tempMode,
      startAt: utcMsFromLocalInput(form.startAt),
      endAt: utcMsFromLocalInput(form.endAt),
      minDurationHours: normalizedDurationHours(form.minDurationHours),
      minSensorCount: Number(form.minSensorCount) || 9,
      samplingStepMinutes: Number.isFinite(step) && step > 0 ? step : null,
      customMin: form.customMin !== "" ? Number(form.customMin) : null,
      customMax: form.customMax !== "" ? Number(form.customMax) : null,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Эксплуатационная квалификация (PV)
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                Загрузите файлы калиброванных логгеров (CSV / XLSX), настройте режим и период
                испытания. Портал рассчитает MKT, отклонения и критические точки автоматически.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Field label="Режим">
              <Select
                value={form.tempMode}
                onValueChange={v => setForm({ ...form, tempMode: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMP_MODES.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Минимум, °C">
              <Input
                type="number"
                step="0.1"
                value={form.customMin}
                onChange={e => setForm({ ...form, customMin: e.target.value })}
                placeholder="по умолчанию режима"
              />
            </Field>
            <Field label="Максимум, °C">
              <Input
                type="number"
                step="0.1"
                value={form.customMax}
                onChange={e => setForm({ ...form, customMax: e.target.value })}
                placeholder="по умолчанию режима"
              />
            </Field>
            <Field
              label={isWarehouse ? "Минимальная длительность, ч" : "Мин. длит., ч"}
              hint={isWarehouse ? "Для помещения хранения: от 72 ч (от 3 суток и далее)." : undefined}
            >
              <Input
                type="number"
                min={isWarehouse ? 72 : 1}
                value={form.minDurationHours}
                onChange={e => setForm({ ...form, minDurationHours: e.target.value })}
                onBlur={e => {
                  if (isWarehouse) {
                    setForm({ ...form, minDurationHours: normalizedDurationHours(e.target.value) });
                  }
                }}
              />
            </Field>
            <Field label="Мин. внутренних датчиков">
              <Input
                type="number"
                value={form.minSensorCount}
                onChange={e => setForm({ ...form, minSensorCount: e.target.value })}
              />
            </Field>
            <Field label="Начало испытания">
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={e => setForm({ ...form, startAt: e.target.value })}
              />
            </Field>
            <Field label="Окончание испытания">
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={e => setForm({ ...form, endAt: e.target.value })}
              />
            </Field>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="bg-background w-full gap-2 border-violet-300 text-violet-700 hover:bg-violet-50"
                onClick={() => {
                  setWindowSuggestion(null);
                  findOptimalWindow.mutate({
                    protocolId,
                    durationHours: normalizedDurationHours(form.minDurationHours),
                  });
                }}
                disabled={findOptimalWindow.isPending || loggers.length === 0}
                title="Анализирует загруженные данные и находит наиболее стабильное окно заданной длительности"
              >
                {findOptimalWindow.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Wand2 className="h-4 w-4" />}
                Найти оптимальное окно
              </Button>
            </div>
            <Field
              label="Шаг выборки"
              hint="Прореживание рядов до общего шага (полезно, когда внешний логгер пишет реже внутренних)."
            >
              <Select
                value={form.samplingStepMinutes ?? "0"}
                onValueChange={v => setForm({ ...form, samplingStepMinutes: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Как в файле</SelectItem>
                  <SelectItem value="1">1 мин</SelectItem>
                  <SelectItem value="5">5 мин</SelectItem>
                  <SelectItem value="10">10 мин</SelectItem>
                  <SelectItem value="15">15 мин</SelectItem>
                  <SelectItem value="30">30 мин</SelectItem>
                  <SelectItem value="60">1 час</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="bg-background w-full"
                onClick={saveFormPatch}
                disabled={saveSession.isPending}
              >
                <Save className="h-4 w-4" /> Сохранить
              </Button>
            </div>
          </div>

          {/* Optimal window suggestion card */}
          {windowSuggestion && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-violet-600 shrink-0" />
                  <span className="font-medium text-violet-900 text-sm">Оптимальное окно найдено</span>
                </div>
                <button
                  onClick={() => setWindowSuggestion(null)}
                  className="text-violet-400 hover:text-violet-700 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-violet-600 font-medium">Начало: </span>
                  <span className="text-violet-900 font-mono">{localInputFromUtcMs(windowSuggestion.startAt).replace('T', ' ')}</span>
                </div>
                <div>
                  <span className="text-violet-600 font-medium">Окончание: </span>
                  <span className="text-violet-900 font-mono">{localInputFromUtcMs(windowSuggestion.endAt).replace('T', ' ')}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  windowSuggestion.gapCount === 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {windowSuggestion.gapCount === 0 ? '✓ Пропусков нет' : `⚠️ Пропусков: ${windowSuggestion.gapCount}`}
                </span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  windowSuggestion.outOfRangeCount === 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {windowSuggestion.outOfRangeCount === 0 ? '✓ Все в диапазоне' : `✕ Вне диапазона: ${windowSuggestion.outOfRangeCount} точек`}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                  ±{windowSuggestion.stdDev.toFixed(2)} °C
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => {
                    setForm({
                      ...form,
                      startAt: localInputFromUtcMs(windowSuggestion.startAt),
                      endAt: localInputFromUtcMs(windowSuggestion.endAt),
                    });
                    setWindowSuggestion(null);
                    toast.success('Окно применено. Нажмите «Сохранить» для применения.');
                  }}
                >
                  Применить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-background"
                  onClick={() => setWindowSuggestion(null)}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">Файлы логгеров</h3>
              <p className="text-xs text-muted-foreground">
                CSV или XLSX. Первая строка — заголовки. Поддерживаемые столбцы: дата/время и
                температура.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="bg-background"
                onClick={() => autoDetect.mutate({ protocolId })}
                disabled={autoDetect.isPending || loggers.length === 0}
              >
                <Sparkles className="h-4 w-4" /> Авто‑определить внешние
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={e => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Загрузить файлы
              </Button>
            </div>
          </div>

          {loggers.length === 0 ? (
            <div className="border border-dashed rounded-lg p-10 text-center">
              <Thermometer className="h-6 w-6 mx-auto text-muted-foreground" />
              <h4 className="mt-2 font-medium">Датчики не загружены</h4>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Загрузите минимум {form.minSensorCount} внутренних логгеров — их показания станут
                основой расчёта MKT и отклонений.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-4 py-2.5 font-medium">Датчик</th>
                    <th className="text-left px-3 py-2.5 font-medium">Пользовательское имя</th>
                    <th className="text-left px-3 py-2.5 font-medium">Роль</th>
                    <th className="text-right px-3 py-2.5 font-medium">Точки</th>
                    <th className="text-right px-3 py-2.5 font-medium">Min</th>
                    <th className="text-right px-3 py-2.5 font-medium">Avg</th>
                    <th className="text-right px-3 py-2.5 font-medium">Max</th>
                    <th className="text-right px-3 py-2.5 font-medium">MKT</th>
                    <th className="text-right px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loggers.map(l => {
                    const mkt = Number(l.mktVal || 0);
                    const outOfRange =
                      l.role === "internal" && (mkt < rangeMin || mkt > rangeMax);
                    return (
                      <tr
                        key={l.id}
                        className={`hover:bg-accent/30 transition-colors ${selectedLogger === l.id ? "bg-accent/40" : ""}`}
                      >
                        <td className="px-4 py-2 font-medium tracking-tight num">{l.label}</td>
                        <td className="px-3 py-2">
                          <Input
                            value={customNames[l.id] ?? (l.customName || "")}
                            onChange={e =>
                              setCustomNames(prev => ({ ...prev, [l.id]: e.target.value }))
                            }
                            onBlur={e => {
                              const val = e.target.value.trim();
                              updateLogger.mutate({
                                protocolId,
                                loggerId: l.id,
                                customName: val || null,
                              });
                            }}
                            className="h-8 bg-background"
                            placeholder="Например, верхняя полка, левая стенка"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={l.role}
                            onValueChange={v =>
                              updateLogger.mutate({
                                protocolId,
                                loggerId: l.id,
                                role: v as "internal" | "external",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="internal">Внутренний</SelectItem>
                              <SelectItem value="external">Внешний</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-right num text-muted-foreground">
                          {l.pointCount?.toLocaleString("ru-RU") ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right num">{fmt(l.minVal)}</td>
                        <td className="px-3 py-2 text-right num">{fmt(l.avgVal)}</td>
                        <td className="px-3 py-2 text-right num">{fmt(l.maxVal)}</td>
                        <td
                          className={`px-3 py-2 text-right num font-semibold ${
                            outOfRange ? "text-rose-600" : ""
                          }`}
                        >
                          {fmt(l.mktVal)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-background"
                              onClick={() =>
                                setSelectedLogger(selectedLogger === l.id ? null : l.id)
                              }
                            >
                              График
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-background text-destructive hover:text-destructive"
                              onClick={() =>
                                deleteLogger.mutate({ protocolId, loggerId: l.id })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selectedLogger != null && (
            <SensorChart
              protocolId={protocolId}
              loggerId={selectedLogger}
              rangeMin={rangeMin}
              rangeMax={rangeMax}
            />
          )}

          <div className="grid md:grid-cols-3 gap-3">
            <Stat title="Внутренних датчиков" value={internals.length} />
            <Stat title="Мин. по требованиям" value={form.minSensorCount} />
            <Stat
              title="Расчётный режим °C"
              value={`${rangeMin}–${rangeMax}`}
              hint={`Номинально ${rawMin}–${rawMax}, погрешность ±${sensorAccuracy} °C`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sensor placement diagram — link to dedicated page */}
      {loggers.length > 0 && (
        <SensorPlacementCard
          protocolId={protocolId}
          loggers={loggers as any}
        />
      )}

      {/* Analyze + verdict */}
      {session?.verdict && session.verdict !== "none" && (
        <Card
          className={`border ${
            session.verdict === "pass"
              ? "bg-emerald-50/60 border-emerald-200"
              : "bg-rose-50/60 border-rose-200"
          }`}
        >
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              {session.verdict === "pass" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> PV пройден
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-rose-600" /> PV не пройден
                </>
              )}
            </div>
            {Array.isArray(session.deviations) && (session.deviations as string[]).length > 0 && (
              <ul className="text-sm text-rose-700 list-disc pl-5 space-y-1">
                {(session.deviations as string[]).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" className="bg-background" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Назад
        </Button>
        <div className="flex gap-2">
          <Button
            disabled={analyze.isPending || saveSession.isPending || loggers.length === 0}
            onClick={async () => {
              // Always save current form state before running analysis
              // so startAt/endAt/tempMode/minDurationHours are up to date
              const step = Number(form.samplingStepMinutes);
              await saveSession.mutateAsync({
                protocolId,
                tempMode: form.tempMode,
                startAt: utcMsFromLocalInput(form.startAt),
                endAt: utcMsFromLocalInput(form.endAt),
                minDurationHours: normalizedDurationHours(form.minDurationHours),
                minSensorCount: Number(form.minSensorCount) || 9,
                samplingStepMinutes: Number.isFinite(step) && step > 0 ? step : null,
                customMin: form.customMin !== "" ? Number(form.customMin) : null,
                customMax: form.customMax !== "" ? Number(form.customMax) : null,
              });
              analyze.mutate({ protocolId });
            }}
          >
            {analyze.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Провести анализ PV
          </Button>
          <Button
            disabled={!session?.verdict || session.verdict === "none"}
            onClick={onDone}
          >
            К итоговому отчёту <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p> : null}
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border bg-accent/20 p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-xl font-semibold tracking-tight num">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{hint}</div> : null}
    </div>
  );
}

function fmt(v: any) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function SensorPlacementCard({
  protocolId,
  loggers,
}: {
  protocolId: number;
  loggers: Array<{ id: number; label: string; customName?: string | null; role: string; position?: string | null }>;
}) {
  const [, setLocation] = useLocation();
  const internals = loggers.filter(l => l.role === "internal");
  const placed = internals.filter(l => l.position);
  return (
    <Card className="border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold tracking-tight flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Схема расстановки датчиков
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Укажите позицию каждого датчика на схеме. Схема войдёт в PDF-протокол.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0 ml-4 bg-background"
            onClick={() => {
              try {
                window.sessionStorage.setItem(`protocolWizardStep:${protocolId}`, "pv");
              } catch {
                // Session storage is optional; the query param below is the main return path.
              }
              setLocation(`/protocols/${protocolId}/sensor-placement?from=pv`);
            }}
          >
            <MapPin className="h-4 w-4 mr-1" />
            Открыть схему
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {internals.map(l => (
            <span
              key={l.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                l.position
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                l.position ? "bg-emerald-500" : "bg-slate-400"
              }`} />
              {l.customName || l.label}
              {l.position && <span className="font-mono ml-0.5 opacity-70">({l.position})</span>}
            </span>
          ))}
        </div>
        {internals.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Назначено позиций: {placed.length} / {internals.length}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
