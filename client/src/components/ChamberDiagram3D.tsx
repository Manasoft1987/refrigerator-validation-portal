import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { calculateCriticalLoggerIndices } from "@shared/pvCriticalPoints";
import { chamberFeatures } from "@shared/chamberMapping";
import {
  buildChamberScene,
  CHAMBER_POSITIONS,
  CHAMBER_VIEW,
  chamberPlacementIssues,
  type ChamberLogger,
  type ChamberMode,
} from "@shared/chamberMapping";

export default function ChamberDiagram3D({
  loggers,
  protocolId,
  readOnly = false,
}: {
  loggers: ChamberLogger[];
  protocolId: number;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<ChamberMode>("actual");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  const pv = trpc.pv.get.useQuery({ protocolId });
  const update = trpc.pv.updateLogger.useMutation({
    onSuccess: () => utils.pv.get.invalidate({ protocolId }),
  });
  const save = trpc.pv.saveSession.useMutation({
    onSuccess: () => utils.pv.get.invalidate({ protocolId }),
  });
  const currentLoggers = (pv.data?.loggers ?? loggers).map(l => ({
    ...l,
    avg:
      (l as any).pointCount === 0
        ? null
        : ((l as any).avgVal ?? (l as ChamberLogger).avg),
  }));
  const critical = calculateCriticalLoggerIndices(
    currentLoggers.map(l => ({
      ...l,
      min: (l as any).minVal,
      max: (l as any).maxVal,
      mkt: (l as any).mktVal,
      deviations: (l as any).deviations,
    }))
  );
  const session = pv.data?.session;
  const baseObjects = (session?.floorPlanObjects as any[] | null) ?? [];
  const scene = buildChamberScene(
    currentLoggers,
    mode,
    critical.hotIdx == null ? null : currentLoggers[critical.hotIdx]?.label,
    critical.coldIdx == null ? null : currentLoggers[critical.coldIdx]?.label,
    Object.fromEntries(
      ["lower", "middle", "upper"].map((key, i) => {
        const h = baseObjects.find(o => o.id === `chamber-${key}`)?.heightM;
        return [
          String([0, 0.5, 1][i]),
          h != null && Number.isFinite(Number(h))
            ? `${Number(h).toFixed(2)} м`
            : "h: —",
        ];
      })
    ),
    chamberFeatures(baseObjects)
  );
  const issues = chamberPlacementIssues(currentLoggers);
  const [config, setConfig] = useState<Record<string, string> | null>(null);
  const form: Record<string, string> = config ?? {
    length: String(session?.roomLengthM ?? ""),
    width: String(session?.roomWidthM ?? ""),
    height: String(session?.roomHeightM ?? ""),
    lower: String(
      baseObjects.find(o => o.id === "chamber-lower")?.heightM ?? ""
    ),
    middle: String(
      baseObjects.find(o => o.id === "chamber-middle")?.heightM ?? ""
    ),
    upper: String(
      baseObjects.find(o => o.id === "chamber-upper")?.heightM ?? ""
    ),
    notes: baseObjects.find(o => o.id === "chamber-notes")?.label ?? "",
    door: chamberFeatures(baseObjects).door || "none",
    cooling: chamberFeatures(baseObjects).cooling || "none",
    cooling2: chamberFeatures(baseObjects).cooling2 || "none",
    racks: chamberFeatures(baseObjects).racks || "none",
  };
  async function assign(value: string) {
    if (!selected) return;
    setError("");
    try {
      const previous = currentLoggers.find(
        l => l.position === selected && l.role === "internal"
      );
      if (previous?.id && String(previous.id) !== value)
        await update.mutateAsync({
          protocolId,
          loggerId: previous.id,
          position: "unset",
        });
      if (value)
        await update.mutateAsync({
          protocolId,
          loggerId: Number(value),
          position: selected,
        });
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function saveConfig() {
    setError("");
    const n = (key: string) =>
      form[key].trim() ? Number(form[key].replace(",", ".")) : null;
    const levels = [n("lower"), n("middle"), n("upper")];
    if (
      ["length", "width", "height"].some(
        k => n(k) !== null && (!Number.isFinite(n(k)) || n(k)! <= 0)
      ) ||
      levels.some(v => v !== null && (!Number.isFinite(v) || v < 0))
    ) {
      setError("Укажите корректные размеры и высоты в метрах.");
      return;
    }
    if (
      levels.every(v => v !== null) &&
      !(levels[0]! < levels[1]! && levels[1]! < levels[2]!)
    ) {
      setError(
        "Нижний уровень должен быть ниже среднего, средний — ниже верхнего."
      );
      return;
    }
    if (
      n("height") !== null &&
      levels.some(v => v !== null && v > n("height")!)
    ) {
      setError("Уровни хранения не могут быть выше камеры.");
      return;
    }
    const objects = baseObjects.filter(
      o => !String(o.id).startsWith("chamber-")
    );
    ["lower", "middle", "upper"].forEach(key => {
      if (n(key) !== null)
        objects.push({
          id: `chamber-${key}`,
          type: "chamber-level",
          xPct: 0,
          yPct: 0,
          widthPct: 0,
          heightPct: 0,
          heightM: n(key),
          rotation: 0,
          label: key,
        });
    });
    ["door", "cooling", "cooling2", "racks"].forEach(key => {
      if (form[key] && form[key] !== "none")
        objects.push({
          id: `chamber-${key}`,
          type: "chamber-feature",
          xPct: 0,
          yPct: 0,
          widthPct: 0,
          heightPct: 0,
          heightM: 0,
          rotation: 0,
          label: form[key],
        });
    });
    if (form.notes.trim())
      objects.push({
        id: "chamber-notes",
        type: "chamber-notes",
        xPct: 0,
        yPct: 0,
        widthPct: 0,
        heightPct: 0,
        heightM: 0,
        rotation: 0,
        label: form.notes.trim(),
      });
    try {
      await save.mutateAsync({
        protocolId,
        roomLengthM: n("length"),
        roomWidthM: n("width"),
        roomHeightM: n("height"),
        floorPlanObjects: objects,
      });
      setConfig(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["plan", "1 · План"],
            ["actual", "2 · Установленные логгеры"],
            ["temperature", "3 · Средние температуры"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            onClick={() => setMode(id)}
            className={`rounded-lg border px-3 py-2 text-sm ${mode === id ? "bg-slate-900 text-white" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        15 внутренних точек и 1 внешний регистратор. Нажмите на точку и
        назначьте логгер. C/W/V обозначают места в рабочем объёме, а линии
        указывают точное положение измерения.
      </p>
      <svg
        viewBox={`0 0 ${CHAMBER_VIEW.width} ${CHAMBER_VIEW.height}`}
        className="w-full rounded-xl border bg-white"
        role="img"
        aria-label="Объёмная схема холодильной камеры"
      >
        {scene.map((p, i) =>
          p.kind === "poly" ? (
            <polygon
              key={i}
              points={p.points.map(p => p.join(",")).join(" ")}
              fill={p.fill}
              stroke={p.stroke ?? "none"}
              opacity={p.opacity ?? 1}
            />
          ) : p.kind === "line" ? (
            <polyline
              key={i}
              points={p.points.map(p => p.join(",")).join(" ")}
              fill="none"
              stroke={p.stroke}
              strokeWidth={p.width ?? 1}
              strokeDasharray={p.dash ? "6 4" : undefined}
            />
          ) : p.kind === "circle" ? (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.fill}
              stroke={p.stroke}
              strokeWidth={p.width ?? 1}
              onClick={() => !readOnly && p.position && setSelected(p.position)}
              className={p.position && !readOnly ? "cursor-pointer" : ""}
            >
              <title>
                {p.position
                  ? CHAMBER_POSITIONS.find(v => v.id === p.position)?.name
                  : "Точка измерения"}
              </title>
            </circle>
          ) : (
            <text
              key={i}
              x={p.x}
              y={p.y}
              dominantBaseline="hanging"
              textAnchor="middle"
              fill={p.color}
              fontSize={p.size}
              fontWeight={p.bold ? 700 : 400}
              style={{ pointerEvents: "none" }}
            >
              {p.text}
            </text>
          )
        )}
      </svg>
      {selected && !readOnly && (
        <label className="block rounded-lg border bg-slate-50 p-3">
          {selected} · {CHAMBER_POSITIONS.find(p => p.id === selected)?.name}
          <select
            className="ml-3 rounded border p-2"
            disabled={update.isPending}
            value={currentLoggers.find(l => l.position === selected)?.id ?? ""}
            onChange={e => assign(e.target.value)}
          >
            <option value="">Не назначен</option>
            {currentLoggers
              .filter(l => l.role === "internal")
              .map(l => (
                <option key={l.id} value={l.id}>
                  {l.label}
                  {l.position && l.position !== "unset"
                    ? ` · ${l.position}`
                    : ""}
                </option>
              ))}
          </select>
        </label>
      )}
      {issues.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {issues.map(issue => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      )}
      {mode === "temperature" && (
        <p className="text-sm text-muted-foreground">
          Цветовая карта — интерполяция средних температур в трёх сечениях
          рабочего объёма. Она не заменяет измерения между точками и оценку
          экстремумов. Внешний датчик в градиент не включён.
        </p>
      )}
      {!readOnly && (
        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend>Размеры, уровни хранения и оценка рисков</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["door", "Дверь"],
              ["cooling", "Испаритель 1"],
              ["cooling2", "Испаритель 2"],
              ["racks", "Стеллажи"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <select
                  className="mt-1 w-full rounded border p-2"
                  value={form[key]}
                  onChange={e => setConfig({ ...form, [key]: e.target.value })}
                >
                  <option value="none">Не указано</option>
                  <option value="left">Слева</option>
                  <option value="right">Справа</option>
                  {key === "racks" ? (
                    <option value="both">С двух сторон</option>
                  ) : (
                    <>
                      <option value="front">Спереди</option>
                      <option value="back">Сзади</option>
                    </>
                  )}
                </select>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              ["length", "Длина камеры, м"],
              ["width", "Ширина камеры, м"],
              ["height", "Высота камеры, м"],
              ["lower", "Нижний уровень, м"],
              ["middle", "Средний уровень, м"],
              ["upper", "Верхний уровень, м"],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  className="mt-1 w-full rounded border p-2"
                  inputMode="decimal"
                  value={form[key]}
                  onChange={e => setConfig({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <label className="block text-sm">
            Планировка, дверь, испарители, стеллажи, штатный датчик, условия
            внешней среды и обоснование периода
            <textarea
              className="mt-1 w-full rounded border p-2"
              rows={4}
              value={form.notes}
              onChange={e => setConfig({ ...form, notes: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="rounded bg-slate-900 px-4 py-2 text-white"
            disabled={save.isPending}
            onClick={saveConfig}
          >
            Сохранить сведения камеры
          </button>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
