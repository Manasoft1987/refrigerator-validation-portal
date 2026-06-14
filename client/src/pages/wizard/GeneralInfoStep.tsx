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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  EQUIPMENT_TYPES,
  TEMP_MODES,
  WAREHOUSE_STUDY_TYPES,
  WAREHOUSE_SEASONS,
  computeWarehouseSensorCount,
  getLocationPlaceholder,
  getPurposePlaceholder,
} from "@shared/validation";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type CM = { name: string; role: string; company?: string | null };

export default function GeneralInfoStep({
  protocolId,
  onDone,
  equipmentType: initialEquipmentType,
}: {
  protocolId: number;
  onDone: () => void;
  equipmentType?: string;
}) {
  const utils = trpc.useUtils();
  const giQ = trpc.generalInfo.get.useQuery({ protocolId });
  const pvQ = trpc.pv.get.useQuery({ protocolId });

  const [form, setForm] = useState<any>({
    equipmentType: initialEquipmentType || "refrigerator",
    manufacturer: "",
    model: "",
    serial: "",
    tempMode: "2-8",
    location: "",
    purpose: "",
    validationDate: new Date().toISOString().slice(0, 10),
    basis: "primary",
    season: undefined,
    qualificationType: undefined,
    commissionMembers: [] as CM[],
    // Warehouse / storage zone (EAEU Рек. №8)
    whLengthM: "",
    whWidthM: "",
    whHeightM: "",
    whHumidityControl: 0,
    whHumidityMin: "",
    whHumidityMax: "",
    whSeason: "n_a",
    whStudyType: "warehouse",
    whExternalEnv: 0,
    whLayoutNotes: "",
    fillStatus: undefined, // empty | loaded
    loadPercent: "",
  });

  // Seed the form from server data ONLY ONCE on initial load.
  // Subsequent refetches (e.g. window focus, cache invalidation) must NOT overwrite
  // user-entered values — that was the root cause of the "fields clear themselves after 3-4 seconds" bug.
  const seededRef = useRef(false);
  useEffect(() => {
    if (giQ.data && !seededRef.current) {
      seededRef.current = true;
      setForm((prev: any) => ({
        ...prev,
        ...giQ.data,
        equipmentType: giQ.data?.equipmentType || initialEquipmentType || prev.equipmentType,
        commissionMembers: (giQ.data?.commissionMembers as CM[] | null) || [],
      }));
      // Seed uncontrolled warehouse dim inputs directly from server data.
      const L = (giQ.data as any)?.whLengthM;
      const W = (giQ.data as any)?.whWidthM;
      const H = (giQ.data as any)?.whHeightM;
      if (lengthRef.current) lengthRef.current.value = L != null ? String(L) : "";
      if (widthRef.current) widthRef.current.value = W != null ? String(W) : "";
      if (heightRef.current) heightRef.current.value = H != null ? String(H) : "";
      // Force re-render so sensorCalc panel updates after seeding
      setDimsTick(t => t + 1);
    }
  }, [giQ.data, initialEquipmentType]);

  // Uncontrolled refs for warehouse dimension inputs — immune to React re-renders
  // overwriting them when tRPC refetches data.
  const lengthRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const [, setDimsTick] = useState(0);
  const readDim = (ref: React.RefObject<HTMLInputElement | null>) => {
    const v = ref.current?.value?.trim() ?? "";
    return v === "" ? null : v;
  };

  const save = trpc.generalInfo.save.useMutation({
    onSuccess: () => {
      utils.generalInfo.get.invalidate({ protocolId });
      utils.protocols.get.invalidate({ id: protocolId });
    },
    onError: e => toast.error(e.message),
  });

  const isWarehouse = form.equipmentType === "warehouse";


  const canContinueBase = isWarehouse
    ? !!(form.location && form.tempMode)
    : !!(form.model && form.serial && form.tempMode);

  // Read current dim values from refs (live DOM state) for sensor calc preview.
  const liveL = readDim(lengthRef);
  const liveW = readDim(widthRef);
  const liveH = readDim(heightRef);
  const sensorCalc = computeWarehouseSensorCount({
    lengthM: liveL ? Number(liveL) : null,
    widthM: liveW ? Number(liveW) : null,
    heightM: liveH ? Number(liveH) : null,
    externalEnv: !!form.whExternalEnv,
  });
  const warehouseDimsValidLive = isWarehouse
    ? Number(liveL) > 0 && Number(liveW) > 0 && Number(liveH) > 0
    : true;

  const handleSave = async (goNext: boolean) => {
    // Whitelist only the fields the save mutation accepts — prevents
    // accidentally sending DB metadata (id, createdAt, updatedAt) from giQ.data
    // which can cause silent server-side failures.
    const payload: any = {
      protocolId,
      equipmentType: form.equipmentType ?? null,
      manufacturer: form.manufacturer ?? null,
      model: form.model ?? null,
      serial: form.serial ?? null,
      tempMode: form.tempMode ?? null,
      location: form.location ?? null,
      purpose: form.purpose ?? null,
      validationDate: form.validationDate || null,
      basis: form.basis ?? null,
      qualificationType: form.qualificationType ?? null,
      season: form.season ?? null,
      commissionMembers: (form.commissionMembers || []).filter(
        (m: CM) => m.name?.trim() || m.role?.trim(),
      ),
      signatoriesPart1: form.signatoriesPart1 ?? null,
      signatoriesPart2: form.signatoriesPart2 ?? null,
      planDeviations: form.planDeviations ?? null,
      recommendations: form.recommendations ?? null,
      reportDate: form.reportDate ?? null,
      documentValidityPeriod: form.documentValidityPeriod ?? null,
      whLengthM: readDim(lengthRef),
      whWidthM: readDim(widthRef),
      whHeightM: readDim(heightRef),
      whHumidityControl: form.whHumidityControl ?? 0,
      whHumidityMin: form.whHumidityMin === "" || form.whHumidityMin == null ? null : String(form.whHumidityMin),
      whHumidityMax: form.whHumidityMax === "" || form.whHumidityMax == null ? null : String(form.whHumidityMax),
      whSeason: form.whSeason ?? null,
      whStudyType: form.whStudyType ?? null,
      whExternalEnv: form.whExternalEnv ?? 0,
      whLayoutNotes: form.whLayoutNotes ?? null,
      fillStatus: form.fillStatus ?? null,
      loadPercent: form.loadPercent === "" || form.loadPercent == null ? null : String(form.loadPercent),
    };
    try {
      await save.mutateAsync(payload);
      toast.success("Общие сведения сохранены");
      if (goNext) onDone();
    } catch (err) {
      console.error('[GeneralInfoStep] save error:', err);
    }
  };

  const addMember = () =>
    setForm({
      ...form,
      commissionMembers: [...(form.commissionMembers || []), { name: "", role: "", company: null }],
    });
  const updMember = (i: number, patch: Partial<CM>) => {
    const next = [...(form.commissionMembers || [])];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, commissionMembers: next });
  };
  const delMember = (i: number) => {
    const next = [...(form.commissionMembers || [])];
    next.splice(i, 1);
    setForm({ ...form, commissionMembers: next });
  };

  return (
    <Card className="border">
      <CardContent className="p-6 md:p-8 space-y-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {isWarehouse
              ? "Общие сведения об объекте квалификации"
              : "Общие сведения об оборудовании"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isWarehouse
              ? "Параметры помещения / зоны хранения. Оборудование, установленное в объекте, добавляется на следующем шаге."
              : "Эти данные попадут в шапку протокола и используются во всех стадиях квалификации."}
          </p>
        </div>

        {/* ── WAREHOUSE: object fields only ─────────────────────────── */}
        {isWarehouse ? (
          <div className="space-y-6">
            {/* Row 1: type + temp mode */}
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Тип объекта">
                <Select
                  value={form.equipmentType || undefined}
                  onValueChange={v => setForm({ ...form, equipmentType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Температурный режим *">
                <Select
                  value={form.tempMode || undefined}
                  onValueChange={v => setForm({ ...form, tempMode: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMP_MODES.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Address */}
              <Field label="Адрес объекта *" className="md:col-span-2">
                <Input
                  value={form.location || ""}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Страна, город, улица, дом, корпус, этаж, помещение"
                />
              </Field>

              {/* Season + qualification type */}
              <Field label="Сезон проведения">
                <Select
                  value={form.season || undefined}
                  onValueChange={v => setForm({ ...form, season: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите сезон..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">Теплый период</SelectItem>
                    <SelectItem value="cold">Холодный период</SelectItem>
                    <SelectItem value="interseasonal">Межсезонье</SelectItem>
                    <SelectItem value="none">Не применимо (нет контакта с внешней средой)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Тип квалификации">
                <Select
                  value={form.qualificationType || undefined}
                  onValueChange={v => setForm({ ...form, qualificationType: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите тип..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Первичная</SelectItem>
                    <SelectItem value="periodic">Периодическая</SelectItem>
                    <SelectItem value="repeat">Повторная</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Date */}
              <Field label="Дата валидации">
                <Input
                  type="date"
                  value={form.validationDate || ""}
                  onChange={e => setForm({ ...form, validationDate: e.target.value })}
                />
                {(() => {
                  const earliestTs = pvQ.data?.earliestSensorTs;
                  if (!earliestTs || !form.validationDate) return null;
                  const validationMs = new Date(form.validationDate + "T00:00:00").getTime();
                  if (validationMs > earliestTs) {
                    const earliest = new Date(earliestTs).toLocaleDateString("ru-RU", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                    });
                    return (
                      <p className="text-sm text-destructive mt-1">
                        ⚠ Дата валидации не может быть позже даты начала записи датчиков ({earliest})
                      </p>
                    );
                  }
                  return null;
                })()}
              </Field>

              {/* Purpose */}
              <Field label="Назначение объекта" className="md:col-span-2">
                <Textarea
                  rows={3}
                  value={form.purpose || ""}
                  onChange={e => setForm({ ...form, purpose: e.target.value })}
                  placeholder="Хранение лекарственных средств при температуре +2…+8 °C"
                />
              </Field>
            </div>

            {/* Warehouse geometry & parameters */}
            <div className="rounded-xl border bg-emerald-50/40 p-5 space-y-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-semibold tracking-tight">
                    Параметры зоны хранения (Рек. ЕАЭК №8)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Геометрия используется для расчёта минимального количества регистраторов и построения схемы размещения.
                  </p>
                </div>
                {sensorCalc.total > 0 && (
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">
                      Расчётное кол-во регистраторов
                    </div>
                    <div className="text-2xl font-bold text-emerald-700">{sensorCalc.total}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {sensorCalc.nL}×{sensorCalc.nW}×{sensorCalc.nV} ярусов
                      {sensorCalc.external ? ` + ${sensorCalc.external} внешний` : ""}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-x-6 gap-y-4">
                <Field label="Длина, м *">
                  <Input type="number" step="0.1" min="0" ref={lengthRef} defaultValue=""
                    onChange={() => setDimsTick(t => t + 1)} placeholder="напр. 12.5" />
                </Field>
                <Field label="Ширина, м *">
                  <Input type="number" step="0.1" min="0" ref={widthRef} defaultValue=""
                    onChange={() => setDimsTick(t => t + 1)} placeholder="напр. 8.0" />
                </Field>
                <Field label="Высота, м *">
                  <Input type="number" step="0.1" min="0" ref={heightRef} defaultValue=""
                    onChange={() => setDimsTick(t => t + 1)} placeholder="напр. 3.5" />
                </Field>
                <Field label="Тип исследования">
                  <Select value={form.whStudyType || undefined} onValueChange={v => setForm({ ...form, whStudyType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WAREHOUSE_STUDY_TYPES.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label} — {s.duration}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Контакт с внешней средой">
                  <Select value={String(form.whExternalEnv ?? 0)} onValueChange={v => setForm({ ...form, whExternalEnv: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Нет (полностью в контролируемой среде)</SelectItem>
                      <SelectItem value="1">Да (+1 внешний регистратор)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Контроль влажности">
                  <Select value={String(form.whHumidityControl ?? 0)} onValueChange={v => setForm({ ...form, whHumidityControl: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Не контролируется</SelectItem>
                      <SelectItem value="1">Контролируется</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Заполненность объекта">
                  <Select value={form.fillStatus || undefined} onValueChange={v => setForm({ ...form, fillStatus: v })}>
                    <SelectTrigger><SelectValue placeholder="Выберите..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empty">Пустой</SelectItem>
                      <SelectItem value="loaded">Загруженный</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Процент загруженности объекта">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.loadPercent || ""}
                    onChange={e => setForm({ ...form, loadPercent: e.target.value })}
                    placeholder="75"
                  />
                </Field>
                {form.whHumidityControl ? (
                  <>
                    <Field label="Влажность, %, от">
                      <Input type="number" step="1" min="0" max="100" value={form.whHumidityMin || ""}
                        onChange={e => setForm({ ...form, whHumidityMin: e.target.value })} placeholder="напр. 30" />
                    </Field>
                    <Field label="Влажность, %, до">
                      <Input type="number" step="1" min="0" max="100" value={form.whHumidityMax || ""}
                        onChange={e => setForm({ ...form, whHumidityMax: e.target.value })} placeholder="напр. 65" />
                    </Field>
                  </>
                ) : null}
                <Field label="Описание планировки зоны" className="md:col-span-3">
                  <Textarea rows={3} value={form.whLayoutNotes || ""}
                    onChange={e => setForm({ ...form, whLayoutNotes: e.target.value })}
                    placeholder="Расположение стеллажей, охлаждающих элементов, вентиляции, зон приёмки/экспедиции и т.д." />
                </Field>
              </div>
              {sensorCalc.total > 0 && (
                <div className="rounded-md bg-white border p-3 text-xs text-muted-foreground space-y-1">
                  <div>• Горизонталь: <b>{sensorCalc.nL}×{sensorCalc.nW}</b> — сетка в плане (равномерные интервалы).</div>
                  <div>• Вертикаль: <b>{sensorCalc.nV}</b> ярус(а): нижний уровень хранения, {sensorCalc.nV >= 2 ? "верхний ярус" : "(высота до 1.5 м)"}{sensorCalc.nV >= 3 ? ", и средний ярус (≥ 5 м)" : ""}.</div>
                  <div>• Итог: <b>{sensorCalc.base}</b> внутренних{sensorCalc.external ? <> + <b>{sensorCalc.external}</b> внешний</> : null} = <b>{sensorCalc.total}</b> регистраторов.</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── STANDARD EQUIPMENT: all fields ─────────────────────── */
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Тип оборудования">
              <Select
                value={form.equipmentType || undefined}
                onValueChange={v => setForm({ ...form, equipmentType: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Температурный режим *">
              <Select
                value={form.tempMode || undefined}
                onValueChange={v => setForm({ ...form, tempMode: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMP_MODES.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Производитель">
              <Input
                value={form.manufacturer || ""}
                onChange={e => setForm({ ...form, manufacturer: e.target.value })}
              />
            </Field>
            <Field label="Модель *">
              <Input
                value={form.model || ""}
                onChange={e => setForm({ ...form, model: e.target.value })}
              />
            </Field>
            <Field label="Серийный номер *">
              <Input
                value={form.serial || ""}
                onChange={e => setForm({ ...form, serial: e.target.value })}
              />
            </Field>
            <Field label="Процент загруженности объекта">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.loadPercent || ""}
                onChange={e => setForm({ ...form, loadPercent: e.target.value })}
                placeholder="75"
              />
            </Field>
            <Field label="Дата валидации">
              <Input
                type="date"
                value={form.validationDate || ""}
                onChange={e => setForm({ ...form, validationDate: e.target.value })}
              />
              {(() => {
                const earliestTs = pvQ.data?.earliestSensorTs;
                if (!earliestTs || !form.validationDate) return null;
                const validationMs = new Date(form.validationDate + "T00:00:00").getTime();
                if (validationMs > earliestTs) {
                  const earliest = new Date(earliestTs).toLocaleDateString("ru-RU", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  });
                  return (
                    <p className="text-sm text-destructive mt-1">
                      ⚠ Дата валидации не может быть позже даты начала записи датчиков ({earliest})
                    </p>
                  );
                }
                return null;
              })()}
            </Field>
            <Field label="Место установки / эксплуатации" className="md:col-span-2">
              <Input
                value={form.location || ""}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder={getLocationPlaceholder(form.equipmentType)}
              />
            </Field>
            <Field label="Сезон">
              <Select
                value={form.season || undefined}
                onValueChange={v => setForm({ ...form, season: v })}
              >
                <SelectTrigger><SelectValue placeholder="Выберите сезон..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm">Теплый период</SelectItem>
                  <SelectItem value="cold">Холодный период</SelectItem>
                  <SelectItem value="interseasonal">Межсезонье</SelectItem>
                  <SelectItem value="none">Не применимо (нет контакта с внешней средой)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Тип квалификации">
              <Select
                value={form.qualificationType || undefined}
                onValueChange={v => setForm({ ...form, qualificationType: v })}
              >
                <SelectTrigger><SelectValue placeholder="Выберите тип..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Первичная</SelectItem>
                  <SelectItem value="periodic">Периодическая</SelectItem>
                  <SelectItem value="repeat">Повторная</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Назначение" className="md:col-span-2">
              <Textarea
                rows={3}
                value={form.purpose || ""}
                onChange={e => setForm({ ...form, purpose: e.target.value })}
                placeholder={getPurposePlaceholder(form.equipmentType)}
              />
            </Field>
          </div>
        )}

        {/* Commission — same for all types */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold tracking-tight">Валидационная комиссия</h3>
              <p className="text-xs text-muted-foreground">Кто подписывает итоговый протокол.</p>
            </div>
            <Button variant="outline" className="bg-background" onClick={addMember}>
              <Plus className="h-4 w-4" /> Добавить участника
            </Button>
          </div>
          {(form.commissionMembers || []).length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-5 text-center">
              Комиссия не задана — на странице подписей будут пустые строки.
            </div>
          ) : (
            <div className="space-y-2">
              {(form.commissionMembers as CM[]).map((m, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      value={m.role}
                      onChange={e => updMember(i, { role: e.target.value })}
                      placeholder="Должность / роль в комиссии"
                    />
                    <Input
                      value={m.name}
                      onChange={e => updMember(i, { name: e.target.value })}
                      placeholder="Ф.И.О."
                    />
                    <Button
                      variant="outline"
                      className="bg-background text-destructive hover:text-destructive"
                      onClick={() => delMember(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={m.company || ""}
                    onChange={e => updMember(i, { company: e.target.value || null })}
                    placeholder="Организация (необязательно)"
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            * обязательные поля
            {isWarehouse
              ? " — адрес, температурный режим и размеры зоны обязательны."
              : " — без них нельзя перейти к IQ."}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="bg-background"
              disabled={save.isPending}
              onClick={() => handleSave(false)}
            >
              <Save className="h-4 w-4" /> Сохранить
            </Button>
            <Button
              disabled={!(canContinueBase && warehouseDimsValidLive) || save.isPending}
              onClick={() => handleSave(true)}
            >
              {isWarehouse ? "К разделам протокола" : "К этапу IQ"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}
