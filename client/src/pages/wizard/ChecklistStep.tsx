import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Answer = "yes" | "no" | "na" | "unset";
type Item = { questionIndex: number; questionText: string; answer: Answer; comment: string | null };

type EquipmentItem = { id: number; name: string; manufacturer?: string | null; model?: string | null; serial?: string | null };

export default function ChecklistStep({
  protocolId,
  stage,
  onPass,
  onBack,
  equipmentType,
  warehouseEquipmentId,
  equipmentLabel,
  warehouseEquipmentList,
}: {
  protocolId: number;
  stage: "iq" | "oq";
  onPass: () => void;
  onBack: () => void;
  equipmentType?: string;
  /** Legacy: per-equipment checklist (not used for unified warehouse flow) */
  warehouseEquipmentId?: number | null;
  /** Legacy: display label for the equipment */
  equipmentLabel?: string;
  /** Unified warehouse flow: list of all equipment in the object */
  warehouseEquipmentList?: EquipmentItem[];
}) {
  const utils = trpc.useUtils();
  // For unified warehouse flow, warehouseEquipmentId is null (single answer set per object)
  const isWarehouseUnified = warehouseEquipmentList !== undefined;
  const effectiveEquipmentId = isWarehouseUnified ? null : warehouseEquipmentId;

  // For warehouse: use auto-generated questions based on equipment kinds
  const autoQuestionsQ = trpc.warehouseEquipment.autoQuestions.useQuery(
    { protocolId, stage },
    { enabled: isWarehouseUnified },
  );
  // For standard protocols: use template questions
  const defaultsQ = trpc.templates.questions.useQuery(
    { stage, equipmentType },
    { enabled: !isWarehouseUnified },
  );

  const existingQ = trpc.checklist.get.useQuery({ protocolId, stage, warehouseEquipmentId: effectiveEquipmentId });
  const blocksQ = trpc.templates.stageBlocks.useQuery({ stage, equipmentType });

  const [items, setItems] = useState<Item[]>([]);

  // Determine which question source to use
  const questionSource = isWarehouseUnified ? autoQuestionsQ.data : defaultsQ.data;

  useEffect(() => {
    if (!existingQ.data || !questionSource) return;
    if (existingQ.data.length > 0) {
      setItems(
        existingQ.data
          .slice()
          .sort((a: any, b: any) => a.questionIndex - b.questionIndex)
          .map((i: any) => ({
            questionIndex: i.questionIndex,
            questionText: i.questionText,
            answer: (i.answer as Answer) || "unset",
            comment: i.comment,
          })),
      );
    } else {
      setItems(
        questionSource.map((q: string, idx: number) => ({
          questionIndex: idx,
          questionText: q,
          answer: "unset",
          comment: null,
        })),
      );
    }
  }, [existingQ.data, questionSource]);

  const save = trpc.checklist.save.useMutation({
    onSuccess: ({ verdict }) => {
      utils.checklist.get.invalidate({ protocolId, stage, warehouseEquipmentId: effectiveEquipmentId });
      utils.protocols.get.invalidate({ id: protocolId });
      if (verdict === "pass") {
        toast.success(
          stage === "iq"
            ? "IQ пройден — переходим к OQ"
            : "OQ пройден — переходим к PV",
        );
        onPass();
      } else if (verdict === "fail") {
        toast.warning("Этап не пройден — есть замечания. Устраните «Нет» перед переходом далее.");
      } else {
        toast.info("Прогресс сохранён. Ответьте на все вопросы для завершения этапа.");
      }
    },
    onError: e => toast.error(e.message),
  });

  const progress = useMemo(() => {
    const answered = items.filter(i => i.answer !== "unset").length;
    return { answered, total: items.length };
  }, [items]);

  const verdictPreview = useMemo(() => {
    if (items.length === 0) return "none";
    if (items.some(i => i.answer === "unset")) return "pending";
    if (items.some(i => i.answer === "no")) return "fail";
    return "pass";
  }, [items]);

  const updItem = (i: number, patch: Partial<Item>) =>
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () =>
    setItems(prev => [
      ...prev,
      { questionIndex: prev.length, questionText: "", answer: "unset", comment: null },
    ]);
  const delItem = (i: number) =>
    setItems(prev => prev.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, questionIndex: idx })));
  const markAllYes = () =>
    setItems(prev => prev.map(it => ({ ...it, answer: "yes" })));

  const stageLabel = stage === "iq" ? "Квалификация монтажа (IQ)" : "Квалификация функционирования (OQ)";
  const title = equipmentLabel ? `${stageLabel} — ${equipmentLabel}` : stageLabel;

  return (
    <div className="space-y-6">
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              {equipmentLabel && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Оборудование: <span className="font-medium text-foreground">{equipmentLabel}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                {blocksQ.data?.purpose}
              </p>
            </div>
            <VerdictBadge state={verdictPreview} />
          </div>
          <div className="rounded-lg bg-accent/40 px-4 py-3 text-sm leading-relaxed text-accent-foreground">
            <div className="font-medium mb-0.5 text-foreground">Критерии приёмки</div>
            {blocksQ.data?.criteria}
          </div>
          {/* Equipment list banner for unified warehouse IQ/OQ */}
          {warehouseEquipmentList && warehouseEquipmentList.length > 0 && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                Оборудование в объекте ({warehouseEquipmentList.length} ед.)
              </div>
              <div className="flex flex-wrap gap-2">
                {warehouseEquipmentList.map((eq) => (
                  <div key={eq.id} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm">
                    <span className="font-medium">{eq.name}</span>
                    {(eq.manufacturer || eq.model) && (
                      <span className="text-muted-foreground">
                        {[eq.manufacturer, eq.model].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    {eq.serial && (
                      <span className="text-xs text-muted-foreground font-mono">№ {eq.serial}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {warehouseEquipmentList && warehouseEquipmentList.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              В объекте ещё не добавлено оборудование. Вернитесь на шаг «Оборудование в объекте» и добавьте хотя бы одну единицу.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold tracking-tight">Опросник</div>
                <div className="text-xs text-muted-foreground">
                  Отвечено {progress.answered} из {progress.total}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-background" onClick={markAllYes}>
                <CheckCircle2 className="h-4 w-4" /> Отметить всё
              </Button>
              <Button variant="outline" className="bg-background" onClick={addItem}>
                <Plus className="h-4 w-4" /> Добавить вопрос
              </Button>
            </div>
          </div>

          <ul className="divide-y">
            {items.map((it, i) => (
              <li key={i} className="px-6 py-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="text-xs font-semibold text-muted-foreground pt-2.5 w-6 num">
                    {i + 1}.
                  </div>
                  <div className="flex-1 space-y-3">
                    <Input
                      value={it.questionText}
                      onChange={e => updItem(i, { questionText: e.target.value })}
                      className="border-0 shadow-none px-0 focus-visible:ring-0 text-[15px] font-medium"
                      placeholder="Текст вопроса"
                    />
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <RadioGroup
                        value={it.answer}
                        onValueChange={(v: string) => updItem(i, { answer: v as Answer })}
                        className="flex items-center gap-4"
                      >
                        <AnswerOpt value="yes" label="Да" tone="emerald" currentId={it.answer} />
                        <AnswerOpt value="no" label="Нет" tone="rose" currentId={it.answer} />
                        <AnswerOpt value="na" label="Н/П" tone="slate" currentId={it.answer} />
                      </RadioGroup>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-background text-destructive hover:text-destructive"
                        onClick={() => delItem(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Комментарий / несоответствие
                      </Label>
                      <Input
                        value={it.comment || ""}
                        onChange={e => updItem(i, { comment: e.target.value })}
                        placeholder={
                          it.answer === "no"
                            ? "Опишите выявленное несоответствие"
                            : "Необязательное примечание"
                        }
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" className="bg-background" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Назад
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="bg-background"
            disabled={save.isPending}
            onClick={() => save.mutate({ protocolId, stage, warehouseEquipmentId: effectiveEquipmentId, items })}
          >
            <Save className="h-4 w-4" /> Сохранить
          </Button>
          <Button
            disabled={save.isPending || verdictPreview === "pending" || items.length === 0}
            onClick={() => save.mutate({ protocolId, stage, warehouseEquipmentId: effectiveEquipmentId, items })}
          >
            {stage === "iq" ? "Далее к OQ" : "Далее к PV"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnswerOpt({
  value,
  label,
  tone,
  currentId,
}: {
  value: string;
  label: string;
  tone: "emerald" | "rose" | "slate";
  currentId: string;
}) {
  const active = currentId === value;
  const toneCls = active
    ? tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "rose"
        ? "bg-rose-50 border-rose-200 text-rose-800"
        : "bg-slate-50 border-slate-200 text-slate-800"
    : "bg-background border-border text-muted-foreground hover:text-foreground";
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${toneCls}`}
    >
      <RadioGroupItem value={value} className="h-3.5 w-3.5" />
      {label}
    </label>
  );
}

function VerdictBadge({ state }: { state: "pass" | "fail" | "pending" | "none" | string }) {
  if (state === "pass")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" /> Этап готов к закрытию
      </span>
    );
  if (state === "fail")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 px-3 py-1 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5" /> Есть несоответствия
      </span>
    );
  if (state === "pending")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-medium">
        Ожидает ответов
      </span>
    );
  return null;
}
