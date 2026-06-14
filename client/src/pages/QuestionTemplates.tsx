import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { GripVertical, Pencil, Trash2, Plus, Check, X, Thermometer, Info } from "lucide-react";

type Stage = "iq" | "oq";
type EquipmentType = "refrigerator" | "auto-refrigerator" | "warehouse" | "other";
type EquipmentKind = "conditioner" | "ventilation" | "heat_curtain" | "chiller" | "fan_coil" | "other" | null;

const EQUIPMENT_OPTIONS: { value: EquipmentType; label: string }[] = [
  { value: "refrigerator", label: "Холодильник" },
  { value: "auto-refrigerator", label: "Авторефрижератор" },
  { value: "warehouse", label: "Помещение / зона хранения" },
  { value: "other", label: "Другое оборудование" },
];

// Equipment kind tabs for warehouse type
// null = general warehouse questions (not kind-specific)
const WAREHOUSE_KIND_TABS: { value: EquipmentKind; label: string; description: string; color: string }[] = [
  { value: null, label: "Общие", description: "Вопросы для любого объекта хранения (не зависят от типа оборудования)", color: "bg-slate-100 text-slate-700" },
  { value: "conditioner", label: "Кондиционер", description: "Вопросы IQ/OQ для кондиционеров сплит-систем и прецизионных кондиционеров", color: "bg-blue-100 text-blue-700" },
  { value: "ventilation", label: "ПВВ", description: "Вопросы IQ/OQ для приточно-вытяжной вентиляции", color: "bg-green-100 text-green-700" },
  { value: "heat_curtain", label: "Тепловая завеса", description: "Вопросы IQ/OQ для тепловых завес", color: "bg-orange-100 text-orange-700" },
  { value: "chiller", label: "Чиллер", description: "Вопросы IQ/OQ для чиллеров и холодильных машин", color: "bg-cyan-100 text-cyan-700" },
  { value: "fan_coil", label: "Фанкойл", description: "Вопросы IQ/OQ для фанкойлов", color: "bg-purple-100 text-purple-700" },
  { value: "other", label: "Другое", description: "Вопросы IQ/OQ для прочего оборудования", color: "bg-gray-100 text-gray-700" },
];

type Question = {
  id: number;
  stage: Stage;
  equipmentType: string;
  equipmentKind: string | null;
  ord: number;
  text: string;
  isDefault: number;
};

function QuestionList({
  stage,
  equipmentType,
  equipmentKind,
}: {
  stage: Stage;
  equipmentType: EquipmentType;
  equipmentKind: EquipmentKind;
}) {
  const utils = trpc.useUtils();
  const { data: allTemplates = [], isLoading } = trpc.questionTemplates.list.useQuery(
    { equipmentType, equipmentKind },
  );
  const questions = (allTemplates as Question[])
    .filter(q => q.stage === stage)
    .sort((a, b) => a.ord - b.ord);

  const seedMutation = trpc.questionTemplates.seedDefaults.useMutation({
    onSuccess: (data) => {
      utils.questionTemplates.list.invalidate();
      if (data.inserted > 0) {
        toast.success(`Загружено ${data.inserted} стандартных вопросов`);
      } else {
        toast.info("Стандартные вопросы уже загружены");
      }
    },
    onError: () => toast.error("Не удалось загрузить стандартные вопросы"),
  });

  const createMutation = trpc.questionTemplates.create.useMutation({
    onSuccess: () => {
      utils.questionTemplates.list.invalidate();
      setNewText("");
      setAdding(false);
    },
    onError: () => toast.error("Не удалось добавить вопрос"),
  });
  const updateMutation = trpc.questionTemplates.update.useMutation({
    onSuccess: () => {
      utils.questionTemplates.list.invalidate();
      setEditingId(null);
    },
    onError: () => toast.error("Не удалось сохранить вопрос"),
  });
  const deleteMutation = trpc.questionTemplates.delete.useMutation({
    onSuccess: () => utils.questionTemplates.list.invalidate(),
    onError: () => toast.error("Не удалось удалить вопрос"),
  });
  const reorderMutation = trpc.questionTemplates.reorder.useMutation({
    onSuccess: () => utils.questionTemplates.list.invalidate(),
  });

  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  function startEdit(q: Question) {
    setEditingId(q.id);
    setEditText(q.text);
  }

  function saveEdit(id: number) {
    if (!editText.trim()) return;
    updateMutation.mutate({ id, text: editText.trim() });
  }

  function handleDragStart(id: number) {
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    setDragOverId(id);
  }

  function handleDrop(targetId: number) {
    if (draggingId === null || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const sorted = [...questions];
    const fromIdx = sorted.findIndex(q => q.id === draggingId);
    const toIdx = sorted.findIndex(q => q.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const items = sorted.map((q, i) => ({ id: q.id, ord: (i + 1) * 10 }));
    reorderMutation.mutate({ items });
    setDraggingId(null);
    setDragOverId(null);
  }

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>;
  }

  // For warehouse kind-specific tabs: show info about static defaults when no custom templates
  const isWarehouseKind = equipmentType === "warehouse" && equipmentKind !== null;
  const showStaticDefaultsInfo = isWarehouseKind && questions.length === 0 && !adding;

  return (
    <div className="space-y-2">
      {/* Standard equipment: show seed button when empty */}
      {!isWarehouseKind && questions.length === 0 && !adding && (
        <div className="py-8 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            Нет вопросов для этого типа оборудования.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate({ equipmentType })}
          >
            {seedMutation.isPending ? "Загрузка..." : "Загрузить стандартные вопросы"}
          </Button>
        </div>
      )}

      {/* Warehouse kind: show info about static defaults */}
      {showStaticDefaultsInfo && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3 mb-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-0.5">Используются встроенные вопросы</p>
            <p className="text-blue-700">
              Вопросы для этого типа оборудования берутся из встроенных шаблонов.
              Добавьте свои вопросы ниже, чтобы заменить их на пользовательские.
            </p>
          </div>
        </div>
      )}

      {/* General warehouse: show seed button when empty */}
      {equipmentType === "warehouse" && equipmentKind === null && questions.length === 0 && !adding && (
        <div className="py-8 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            Нет общих вопросов для помещений хранения.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate({ equipmentType })}
          >
            {seedMutation.isPending ? "Загрузка..." : "Загрузить стандартные вопросы"}
          </Button>
        </div>
      )}

      {questions.map((q, idx) => (
        <div
          key={q.id}
          draggable
          onDragStart={() => handleDragStart(q.id)}
          onDragOver={e => handleDragOver(e, q.id)}
          onDrop={() => handleDrop(q.id)}
          onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
          className={`flex items-start gap-2 rounded-lg border bg-card p-3 transition-all
            ${draggingId === q.id ? "opacity-40" : ""}
            ${dragOverId === q.id && draggingId !== q.id ? "border-primary ring-1 ring-primary" : "border-border"}
          `}
        >
          {/* Drag handle */}
          <div className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Number */}
          <span className="mt-1 min-w-[1.5rem] text-sm font-medium text-muted-foreground">
            {idx + 1}.
          </span>

          {/* Text or edit field */}
          <div className="flex-1">
            {editingId === q.id ? (
              <Textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="min-h-[72px] text-sm"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit(q.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <p className="text-sm leading-relaxed">{q.text}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-1">
            {editingId === q.id ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-green-600 hover:text-green-700"
                  onClick={() => saveEdit(q.id)}
                  disabled={updateMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => startEdit(q)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить вопрос?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Вопрос будет удалён из шаблона. Уже созданные протоколы не изменятся.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => deleteMutation.mutate({ id: q.id })}
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Add new question */}
      {adding ? (
        <div className="rounded-lg border border-primary/40 bg-card p-3 space-y-2">
          <Textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Введите текст нового вопроса..."
            className="min-h-[72px] text-sm"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                if (newText.trim()) createMutation.mutate({ stage, text: newText.trim(), equipmentType, equipmentKind });
              }
              if (e.key === "Escape") { setAdding(false); setNewText(""); }
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setNewText(""); }}>
              Отмена
            </Button>
            <Button
              size="sm"
              disabled={!newText.trim() || createMutation.isPending}
              onClick={() => {
                if (newText.trim()) createMutation.mutate({ stage, text: newText.trim(), equipmentType, equipmentKind });
              }}
            >
              Добавить
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed gap-2"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" />
          Добавить вопрос
        </Button>
      )}
    </div>
  );
}

function WarehouseKindPanel({ kind }: { kind: EquipmentKind }) {
  const kindInfo = WAREHOUSE_KIND_TABS.find(k => k.value === kind)!;

  return (
    <div className="space-y-4">
      {/* Kind description */}
      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm text-muted-foreground">
        {kindInfo.description}
      </div>

      <Tabs defaultValue="iq">
        <TabsList className="mb-4">
          <TabsTrigger value="iq">IQ — Квалификация монтажа</TabsTrigger>
          <TabsTrigger value="oq">OQ — Квалификация функционирования</TabsTrigger>
        </TabsList>

        <TabsContent value="iq">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Вопросы IQ</CardTitle>
              <CardDescription>
                {kind === null
                  ? "Общие вопросы монтажа для любого объекта хранения."
                  : `Вопросы монтажа для: ${kindInfo.label}. Добавляются к общим вопросам при наличии данного типа оборудования.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionList stage="iq" equipmentType="warehouse" equipmentKind={kind} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oq">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Вопросы OQ</CardTitle>
              <CardDescription>
                {kind === null
                  ? "Общие вопросы функционирования для любого объекта хранения."
                  : `Вопросы функционирования для: ${kindInfo.label}. Добавляются к общим вопросам при наличии данного типа оборудования.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuestionList stage="oq" equipmentType="warehouse" equipmentKind={kind} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function QuestionTemplates() {
  const [equipmentType, setEquipmentType] = useState<EquipmentType>("refrigerator");
  const [warehouseKind, setWarehouseKind] = useState<EquipmentKind>(null);

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Шаблоны вопросов</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Управляйте вопросами чек-листов IQ и OQ по каждому типу оборудования. Изменения применяются к новым протоколам.
          Перетащите вопрос за иконку <GripVertical className="inline h-3.5 w-3.5" /> чтобы изменить порядок.
        </p>
      </div>

      {/* Equipment type selector */}
      <div className="mb-6 flex items-center gap-3">
        <Thermometer className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Тип оборудования:</span>
        <Select value={equipmentType} onValueChange={v => { setEquipmentType(v as EquipmentType); setWarehouseKind(null); }}>
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EQUIPMENT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Warehouse: show equipment kind tabs */}
      {equipmentType === "warehouse" ? (
        <div className="space-y-4">
          {/* Kind tabs */}
          <div className="flex flex-wrap gap-2">
            {WAREHOUSE_KIND_TABS.map(tab => (
              <button
                key={String(tab.value)}
                onClick={() => setWarehouseKind(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  warehouseKind === tab.value
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
              >
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${tab.color}`}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Active kind panel */}
          <WarehouseKindPanel kind={warehouseKind} />
        </div>
      ) : (
        /* Standard equipment: IQ/OQ tabs */
        <Tabs defaultValue="iq">
          <TabsList className="mb-4">
            <TabsTrigger value="iq">IQ — Квалификация монтажа</TabsTrigger>
            <TabsTrigger value="oq">OQ — Квалификация функционирования</TabsTrigger>
          </TabsList>

          <TabsContent value="iq">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Вопросы IQ</CardTitle>
                <CardDescription>
                  Используются при создании нового протокола на шаге «IQ» для выбранного типа оборудования.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuestionList stage="iq" equipmentType={equipmentType} equipmentKind={null} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="oq">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Вопросы OQ</CardTitle>
                <CardDescription>
                  Используются при создании нового протокола на шаге «OQ» для выбранного типа оборудования.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuestionList stage="oq" equipmentType={equipmentType} equipmentKind={null} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
