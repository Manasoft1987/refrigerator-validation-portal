import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  ClipboardCopy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Signatory = { name: string; role: string; company?: string | null };
type CM = { name: string; role: string; company?: string | null };

const DEFAULT_PART1: Signatory[] = [
  { role: "Составил", name: "" },
  { role: "Проверил", name: "" },
  { role: "Утвердил", name: "" },
];
const DEFAULT_PART2: Signatory[] = [
  { role: "Составитель отчёта", name: "" },
  { role: "Проверяющий", name: "" },
  { role: "Утверждающий", name: "" },
];

/** Convert commission members to signatories */
function commissionToSignatories(members: CM[]): Signatory[] {
  return members
    .filter(m => m.name?.trim() || m.role?.trim())
    .map(m => ({ role: m.role || "", name: m.name || "", company: m.company || null }));
}

export default function FinalReportStep({
  protocolId,
  onBack,
}: {
  protocolId: number;
  onBack: () => void;
}) {
  const protoQ = trpc.protocols.get.useQuery({ id: protocolId });
  const giQ = trpc.generalInfo.get.useQuery({ protocolId });
  const pvQ = trpc.pv.get.useQuery({ protocolId });
  const [lastReportUrl, setLastReportUrl] = useState<string | null>(null);

  const [sig1, setSig1] = useState<Signatory[]>(DEFAULT_PART1);
  const [sig2, setSig2] = useState<Signatory[]>(DEFAULT_PART2);
  const [planDeviations, setPlanDeviations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [documentValidityPeriod, setDocumentValidityPeriod] = useState("1 год");

  // Initialize once when GI loads
  useEffect(() => {
    if (!giQ.data) return;
    const gi = giQ.data as any;
    const commission: CM[] = Array.isArray(gi.commissionMembers) ? gi.commissionMembers : [];

    // Part I: use saved signatories if present, otherwise auto-fill from commission
    if (Array.isArray(gi.signatoriesPart1) && gi.signatoriesPart1.length > 0) {
      setSig1(gi.signatoriesPart1);
    } else if (commission.length > 0) {
      setSig1(commissionToSignatories(commission));
    }

    // Part II: use saved signatories if present, otherwise auto-fill from commission
    if (Array.isArray(gi.signatoriesPart2) && gi.signatoriesPart2.length > 0) {
      setSig2(gi.signatoriesPart2);
    } else if (commission.length > 0) {
      setSig2(commissionToSignatories(commission));
    }

    if (typeof gi.planDeviations === "string") setPlanDeviations(gi.planDeviations);
    if (typeof gi.recommendations === "string") setRecommendations(gi.recommendations);
    if (typeof gi.reportDate === "string" && gi.reportDate) setReportDate(gi.reportDate);
    if (typeof gi.documentValidityPeriod === "string" && gi.documentValidityPeriod) setDocumentValidityPeriod(gi.documentValidityPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giQ.data?.id]);

  const utils = trpc.useUtils();
  const saveGI = trpc.generalInfo.save.useMutation({
    onSuccess: () => {
      utils.generalInfo.get.invalidate({ protocolId });
      toast.success("Сохранено");
    },
    onError: (e) => toast.error(e.message),
  });

  const gen = trpc.report.generate.useMutation({
    onSuccess: ({ url, size }) => {
      setLastReportUrl(url);
      toast.success(`PDF сформирован (${(size / 1024).toFixed(0)} КБ)`);
    },
    onError: (e) => toast.error(e.message),
  });

  const p = protoQ.data;
  const gi = giQ.data;
  const session = pvQ.data?.session;
  const loggers = pvQ.data?.loggers || [];
  const commission: CM[] = Array.isArray((gi as any)?.commissionMembers) ? (gi as any).commissionMembers : [];

  const iqPass = p?.iqVerdict === "pass";
  const oqPass = p?.oqVerdict === "pass";
  const pvPass = p?.pvVerdict === "pass";
  const pvFail = p?.pvVerdict === "fail";
  const overall = iqPass && oqPass && pvPass;
  const hasFailures = p?.iqVerdict === "fail" || p?.oqVerdict === "fail" || pvFail;

  function handleSaveAndGenerate() {
    saveGI.mutate(
      {
        protocolId,
        signatoriesPart1: sig1.filter((s) => s.role.trim() || s.name.trim()),
        signatoriesPart2: sig2.filter((s) => s.role.trim() || s.name.trim()),
        planDeviations: planDeviations.trim() || null,
        recommendations: recommendations.trim() || null,
        reportDate: reportDate.trim() || null,
        documentValidityPeriod: documentValidityPeriod.trim() || "1 год",
      },
      {
        onSuccess: () => gen.mutate({ protocolId }),
      },
    );
  }

  function handleSaveOnly() {
    saveGI.mutate({
      protocolId,
      signatoriesPart1: sig1.filter((s) => s.role.trim() || s.name.trim()),
      signatoriesPart2: sig2.filter((s) => s.role.trim() || s.name.trim()),
      planDeviations: planDeviations.trim() || null,
      recommendations: recommendations.trim() || null,
      reportDate: reportDate.trim() || null,
      documentValidityPeriod: documentValidityPeriod.trim() || "1 год",
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Итоговый отчёт валидации</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Документ формируется в соответствии с требованиями GMP и состоит из двух частей в одном
              PDF: <b>Часть I — Протокол квалификации (план)</b> и{" "}
              <b>Часть II — Отчёт о квалификации (результаты)</b>.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <SummaryStage title="IQ · Монтаж" state={p?.iqVerdict} />
            <SummaryStage title="OQ · Функционирование" state={p?.oqVerdict} />
            <SummaryStage title="PV · Эксплуатация" state={p?.pvVerdict} />
          </div>

          <div
            className={`rounded-xl border p-5 ${
              overall
                ? "bg-emerald-50/60 border-emerald-200"
                : pvFail
                  ? "bg-rose-50/60 border-rose-200"
                  : "bg-amber-50/60 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold tracking-tight mb-2">
              {overall ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Заключение: оборудование
                  признано прошедшим валидацию
                </>
              ) : pvFail ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-rose-600" /> Заключение: выявлены
                  несоответствия — валидация не пройдена
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" /> Заключение не готово —
                  завершите все этапы
                </>
              )}
            </div>
            <dl className="grid md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
              <Row label="Модель" value={gi?.model || "—"} />
              <Row label="Серийный №" value={gi?.serial || "—"} />
              <Row
                label="Температурный режим"
                value={session?.tempMode ? `${session.tempMode} °C` : gi?.tempMode || "—"}
              />
              <Row label="Датчиков (всего)" value={String(loggers.length)} />
              <Row
                label="Внутренних"
                value={String(loggers.filter((l) => l.role === "internal").length)}
              />
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Commission summary banner */}
      {commission.length > 0 && (
        <Card className="border border-blue-200 bg-blue-50/40">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Валидационная комиссия ({commission.length} чел.) — данные для подписей
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {commission.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-white border border-blue-200 rounded-md px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-foreground">{m.name || "—"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-blue-700">{m.role || "—"}</span>
                  {m.company && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{m.company}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-700 mt-2">
              Эти данные автоматически подставляются в разделы подписей ниже. Вы можете изменить их вручную.
            </p>
          </CardContent>
        </Card>
      )}

      {/* GMP — signatories Part I */}
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">
                Подписи · Часть I (Протокол квалификации)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Лица, утверждающие план испытаний (до начала работ).
              </p>
            </div>
            {commission.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="bg-background shrink-0 text-xs"
                onClick={() => {
                  setSig1(commissionToSignatories(commission));
                  toast.success("Подписанты Части I заполнены из комиссии");
                }}
              >
                <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
                Заполнить из комиссии
              </Button>
            )}
          </div>
          <SignatoryEditor value={sig1} onChange={setSig1} commission={commission} />
        </CardContent>
      </Card>

      {/* GMP — signatories Part II */}
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">
                Подписи · Часть II (Отчёт о квалификации)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Лица, утверждающие отчёт по результатам испытаний.
              </p>
            </div>
            {commission.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="bg-background shrink-0 text-xs"
                onClick={() => {
                  setSig2(commissionToSignatories(commission));
                  toast.success("Подписанты Части II заполнены из комиссии");
                }}
              >
                <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
                Заполнить из комиссии
              </Button>
            )}
          </div>
          <SignatoryEditor value={sig2} onChange={setSig2} commission={commission} />
        </CardContent>
      </Card>

      {/* Report date */}
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div>
            <h3 className="font-semibold tracking-tight">Дата составления отчёта</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Укажите дату, которая будет напечатана на обложке Части II (Отчёт о квалификации).
              Если поле оставить пустым, будет использована дата проведения валидации.
            </p>
          </div>
          <div className="max-w-xs">
            <Label className="text-xs text-muted-foreground mb-1 block">Дата (дд.мм.гггг)</Label>
            <Input
              type="text"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              placeholder="например, 23.04.2026"
            />
          </div>
        </CardContent>
      </Card>

      {/* Document validity period */}
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div>
            <h3 className="font-semibold tracking-tight">Срок действия документа</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Укажите срок действия протокола (например: «1 года», «2 года», «3 года»).
              Будет отображено в разделе 14 Отчёта (Часть II).
            </p>
          </div>
          <div className="max-w-xs">
            <Label className="text-xs text-muted-foreground mb-1 block">Срок действия</Label>
            <Input
              type="text"
              value={documentValidityPeriod}
              onChange={(e) => setDocumentValidityPeriod(e.target.value)}
              placeholder="например, 1 года"
            />
          </div>
        </CardContent>
      </Card>

      {/* GMP — deviations from plan */}
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div>
            <h3 className="font-semibold tracking-tight">Отклонения от плана протокола</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Если в ходе работ план был изменён — опишите изменения и обоснование. Если изменений не
              было — оставьте поле пустым (в PDF будет указано «Отклонений от плана не зафиксировано»).
            </p>
          </div>
          <Textarea
            value={planDeviations}
            onChange={(e) => setPlanDeviations(e.target.value)}
            rows={4}
            placeholder="Например: точка измерения №3 перенесена с верхней полки на среднюю по причине занятости полки термоконтейнером. Изменение согласовано инженером по валидации 17.04.2026."
          />
        </CardContent>
      </Card>

      {/* GMP — recommendations */}
      <Card className="border">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div>
            <h3 className="font-semibold tracking-tight">Рекомендации</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFailures
                ? "Описание корректирующих действий, необходимых для устранения выявленных отклонений."
                : "Опционально — рекомендации по дальнейшей эксплуатации, мониторингу, периодичности повторной квалификации."}
            </p>
          </div>
          <Textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            rows={4}
            placeholder={
              hasFailures
                ? "Например: устранить негерметичность уплотнителя двери, провести повторную PV в полном объёме."
                : "Например: проводить мониторинг температуры в режиме реального времени; повторная квалификация — через 12 месяцев."
            }
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="outline" className="bg-background" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Назад
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="bg-background"
            onClick={handleSaveOnly}
            disabled={saveGI.isPending}
          >
            {saveGI.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Сохранить
          </Button>
          <Button onClick={handleSaveAndGenerate} disabled={gen.isPending || saveGI.isPending}>
            {gen.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : lastReportUrl ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            {lastReportUrl ? "Перегенерировать PDF" : "Сформировать PDF"}
          </Button>
          {lastReportUrl && (
            <a href={lastReportUrl} target="_blank" rel="noopener noreferrer" download>
              <Button variant="outline" className="bg-background">
                <Download className="h-4 w-4" /> Скачать
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SignatoryEditor ──────────────────────────────────────────────────────────

function SignatoryEditor({
  value,
  onChange,
  commission,
}: {
  value: Signatory[];
  onChange: (v: Signatory[]) => void;
  commission?: CM[];
}) {
  // Add a single commission member as a new signatory row
  const addFromMember = (m: CM) => {
    const already = value.some(s => s.name === m.name && s.role === m.role);
    if (already) {
      toast.info(`${m.name} уже есть в списке подписантов`);
      return;
    }
    onChange([...value, { role: m.role || "", name: m.name || "", company: m.company || null }]);
  };

  return (
    <div className="space-y-3">
      {/* Quick-add chips from commission */}
      {commission && commission.filter(m => m.name?.trim() || m.role?.trim()).length > 0 && (
        <div className="rounded-md bg-muted/40 border p-2.5 space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-medium">Быстрое добавление из комиссии:</p>
          <div className="flex flex-wrap gap-1.5">
            {commission.filter(m => m.name?.trim() || m.role?.trim()).map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => addFromMember(m)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-background text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <Plus className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{m.name || "—"}</span>
                {m.role && <span className="text-muted-foreground">· {m.role}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Signatory rows */}
      {value.map((s, i) => (
        <div key={i} className="space-y-2 p-3 border rounded bg-muted/30">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              {i === 0 && <Label className="text-xs text-muted-foreground">Роль / должность</Label>}
              <Input
                value={s.role}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = { ...next[i], role: e.target.value };
                  onChange(next);
                }}
                placeholder="Утвердил"
              />
            </div>
            <div className="col-span-5">
              {i === 0 && <Label className="text-xs text-muted-foreground">ФИО</Label>}
              <Input
                value={s.name}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = { ...next[i], name: e.target.value };
                  onChange(next);
                }}
                placeholder="Иванов И.И."
              />
            </div>
            <div className="col-span-2 flex items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-background"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label="Удалить"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Компания</Label>
            <Input
              value={s.company || ""}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...next[i], company: e.target.value || null };
                onChange(next);
              }}
              placeholder="ООО Компания"
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="bg-background"
        size="sm"
        onClick={() => onChange([...value, { role: "", name: "", company: null }])}
      >
        <Plus className="h-4 w-4" /> Добавить подписанта
      </Button>
    </div>
  );
}

// ─── SummaryStage ─────────────────────────────────────────────────────────────

function SummaryStage({
  title,
  state,
}: {
  title: string;
  state: "pass" | "fail" | "none" | null | undefined;
}) {
  const tone =
    state === "pass"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : state === "fail"
        ? "bg-rose-50 border-rose-200 text-rose-800"
        : "bg-muted/40 border-border text-muted-foreground";
  const label =
    state === "pass" ? "Пройден" : state === "fail" ? "Не пройден" : "Не завершён";
  return (
    <div className={`rounded-lg border p-3 text-center text-sm font-medium ${tone}`}>
      <div className="text-xs mb-1 opacity-70">{title}</div>
      {label}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground shrink-0">{label}:</dt>
      <dd className="font-medium truncate">{value}</dd>
    </div>
  );
}
