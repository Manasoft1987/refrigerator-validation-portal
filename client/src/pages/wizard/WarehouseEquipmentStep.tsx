import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Edit2, Plus, Trash2, Thermometer, Info, Wind, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type EquipmentKind =
  | "conditioner"
  | "ventilation"
  | "heat_curtain"
  | "chiller"
  | "fan_coil"
  | "other";

const KIND_OPTIONS: { value: EquipmentKind; label: string; description: string }[] = [
  { value: "conditioner",  label: "Кондиционер",                   description: "Сплит-система, мультисплит, прецизионный кондиционер" },
  { value: "ventilation",  label: "Приточно-вытяжная вентиляция",  description: "ПВУ, вентиляционная установка, воздухообменник" },
  { value: "heat_curtain", label: "Тепловая завеса",               description: "Воздушная завеса над воротами или дверями" },
  { value: "chiller",      label: "Чиллер",                        description: "Холодильная машина с жидкостным охлаждением" },
  { value: "fan_coil",     label: "Фанкойл",                       description: "Доводчик воздуха, подключённый к чиллеру" },
  { value: "other",        label: "Другое оборудование",           description: "Иное оборудование, влияющее на температурный режим" },
];

const KIND_BADGE_COLORS: Record<EquipmentKind, string> = {
  conditioner:  "bg-blue-50 text-blue-700 border-blue-200",
  ventilation:  "bg-teal-50 text-teal-700 border-teal-200",
  heat_curtain: "bg-orange-50 text-orange-700 border-orange-200",
  chiller:      "bg-cyan-50 text-cyan-700 border-cyan-200",
  fan_coil:     "bg-purple-50 text-purple-700 border-purple-200",
  other:        "bg-muted text-muted-foreground border-border",
};

type EquipmentRow = {
  id?: number;
  kind: EquipmentKind;
  name: string;
  manufacturer: string;
  model: string;
  serial: string;
  purpose: string;
  ord: number;
};

const EMPTY_ROW: Omit<EquipmentRow, "ord"> = {
  kind: "conditioner",
  name: "",
  manufacturer: "",
  model: "",
  serial: "",
  purpose: "",
};

export default function WarehouseEquipmentStep({
  protocolId,
  onDone,
}: {
  protocolId: number;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: equipment = [], isLoading } = trpc.warehouseEquipment.list.useQuery({ protocolId });

  const createMut = trpc.warehouseEquipment.create.useMutation({
    onSuccess: () => {
      utils.warehouseEquipment.list.invalidate({ protocolId });
      toast.success("Оборудование добавлено");
    },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.warehouseEquipment.update.useMutation({
    onSuccess: () => {
      utils.warehouseEquipment.list.invalidate({ protocolId });
      toast.success("Оборудование обновлено");
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.warehouseEquipment.delete.useMutation({
    onSuccess: () => {
      utils.warehouseEquipment.list.invalidate({ protocolId });
      toast.success("Оборудование удалено");
    },
    onError: e => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<EquipmentRow | null>(null);
  const [form, setForm] = useState<Omit<EquipmentRow, "ord">>(EMPTY_ROW);

  const openAdd = () => {
    setEditRow(null);
    setForm(EMPTY_ROW);
    setDialogOpen(true);
  };

  const openEdit = (eq: EquipmentRow) => {
    setEditRow(eq);
    setForm({ ...eq });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Укажите наименование оборудования");
      return;
    }
    if (editRow?.id) {
      await updateMut.mutateAsync({ id: editRow.id, ...form });
    } else {
      await createMut.mutateAsync({ protocolId, ...form, ord: equipment.length });
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить это оборудование?")) return;
    await deleteMut.mutateAsync({ id });
  };

  const kindLabel = (k: string) =>
    KIND_OPTIONS.find(o => o.value === k)?.label ?? k;

  // Unique kinds in the current list (for IQ/OQ preview)
  const uniqueKinds = Array.from(new Set(equipment.map(e => (e as any).kind ?? "other")));

  return (
    <Card className="border">
      <CardContent className="p-6 md:p-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Оборудование в объекте квалификации
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Добавьте всё оборудование, установленное в данном помещении (кондиционеры, вентиляция, тепловые завесы и т.д.).
            Для каждого типа оборудования вопросы IQ и OQ формируются автоматически.
          </p>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Как формируются вопросы IQ/OQ:</p>
            <ul className="space-y-1 list-disc list-inside text-blue-700">
              <li>Единый <strong>IQ</strong> и единый <strong>OQ</strong> на весь объект</li>
              <li>Вопросы автоматически подбираются по <strong>типу оборудования</strong> — кондиционер, вентиляция, тепловая завеса и т.д.</li>
              <li>Раздел <strong>PQ/PV</strong> один на весь объект — оценивает совместную работу всего оборудования</li>
            </ul>
          </div>
        </div>

        {/* Equipment list */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Загрузка…</div>
        ) : equipment.length === 0 ? (
          <div className="rounded-xl border border-dashed border-muted-foreground/30 p-10 text-center space-y-3">
            <Thermometer className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Оборудование не добавлено.</p>
            <p className="text-xs text-muted-foreground">
              Нажмите «Добавить оборудование» для внесения первой записи.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {equipment.map((eq, i) => {
              const kind = ((eq as any).kind ?? "other") as EquipmentKind;
              const badgeCls = KIND_BADGE_COLORS[kind] ?? KIND_BADGE_COLORS.other;
              return (
                <div
                  key={eq.id}
                  className="flex items-start gap-4 rounded-xl border bg-card p-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{eq.name}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeCls}`}>
                        {kindLabel(kind)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {eq.manufacturer && (
                        <span className="bg-muted rounded px-1.5 py-0.5">
                          Производитель: {eq.manufacturer}
                        </span>
                      )}
                      {eq.model && (
                        <span className="bg-muted rounded px-1.5 py-0.5">
                          Модель: {eq.model}
                        </span>
                      )}
                      {eq.serial && (
                        <span className="bg-muted rounded px-1.5 py-0.5">
                          Серийный №: {eq.serial}
                        </span>
                      )}
                    </div>
                    {eq.purpose && (
                      <p className="text-xs text-muted-foreground">{eq.purpose}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(eq as EquipmentRow)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(eq.id!)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* IQ/OQ preview chips */}
        {uniqueKinds.length > 0 && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Вопросы IQ/OQ будут сформированы для:
            </p>
            <div className="flex flex-wrap gap-2">
              {uniqueKinds.map(k => {
                const kind = k as EquipmentKind;
                const badgeCls = KIND_BADGE_COLORS[kind] ?? KIND_BADGE_COLORS.other;
                return (
                  <span
                    key={kind}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${badgeCls}`}
                  >
                    <Wind className="h-3 w-3" />
                    {kindLabel(kind)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Add button */}
        <Button variant="outline" className="bg-background w-full" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить оборудование
        </Button>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {equipment.length === 0
              ? "Можно продолжить без оборудования — вопросы IQ/OQ будут общими."
              : `Добавлено: ${equipment.length} ед. (${uniqueKinds.length} тип${uniqueKinds.length > 1 ? "а" : ""}) → 1 IQ + 1 OQ + 1 PQ/PV`}
          </p>
          <Button onClick={onDone}>
            К IQ
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editRow ? "Редактировать оборудование" : "Добавить оборудование"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Kind selector */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Тип оборудования *
              </Label>
              <Select
                value={form.kind}
                onValueChange={v => setForm({ ...form, kind: v as EquipmentKind })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип…" />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Тип определяет набор вопросов IQ/OQ для этого оборудования
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Наименование *
              </Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={
                  form.kind === "conditioner" ? "напр. Кондиционер 1 (основной)" :
                  form.kind === "ventilation" ? "напр. ПВУ-1 (приточная)" :
                  form.kind === "heat_curtain" ? "напр. Тепловая завеса (ворота №1)" :
                  form.kind === "chiller" ? "напр. Чиллер (основной)" :
                  form.kind === "fan_coil" ? "напр. Фанкойл №1" :
                  "напр. Оборудование 1"
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Производитель
                </Label>
                <Input
                  value={form.manufacturer}
                  onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                  placeholder="напр. Daikin, Carrier"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Модель
                </Label>
                <Input
                  value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                  placeholder="напр. RXS25K"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Серийный номер
                </Label>
                <Input
                  value={form.serial}
                  onChange={e => setForm({ ...form, serial: e.target.value })}
                  placeholder="напр. SN-2024-001"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Назначение / описание
              </Label>
              <Textarea
                rows={2}
                value={form.purpose}
                onChange={e => setForm({ ...form, purpose: e.target.value })}
                placeholder="Поддержание температуры в зоне хранения ЛС при +2…+8 °C"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-background" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editRow ? "Сохранить изменения" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
