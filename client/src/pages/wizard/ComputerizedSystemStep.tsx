import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Download, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getComputerizedSystemReleaseReadiness } from "@shared/computerizedSystem";

type Section = "profile" | "screening" | "requirements" | "supplier" | "testing" | "release";
type Requirement = { id: string; text: string; type: string; criticality: "low" | "medium" | "high"; acceptanceCriteria: string };
type TestCase = { id: string; requirementId: string; steps: string; expected: string; actual: string; result: "none" | "pass" | "fail"; evidence: string; deviation: string };

const DEFAULT_CONFIG = {
  systemName: "", intendedUse: "", processOwner: "", systemOwner: "", supplier: "", version: "",
  hosting: "saas", solutionType: "configured", environment: "Production", interfaces: "", dataTypes: "",
  screening: { productQuality: false, patientSafety: false, gxpRecords: false, releaseDecision: false, calculations: false, electronicSignatures: false, editableRecords: false, integrations: false },
  requirements: [] as Requirement[], supplierAssessment: { sla: false, documentation: false, changeNotification: false, incidentManagement: false, backup: false, security: false, notes: "" },
  tests: [] as TestCase[], deviations: "", releaseDecision: "pending", releaseRestrictions: "", periodicReviewMonths: "12",
  completedSections: [] as string[],
};

export default function ComputerizedSystemStep({ protocolId, section, onNext, onBack }: { protocolId: number; section: Section; onNext?: () => void; onBack?: () => void }) {
  const giQ = trpc.generalInfo.get.useQuery({ protocolId });
  const utils = trpc.useUtils();
  const [config, setConfig] = useState<any>(DEFAULT_CONFIG);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (giQ.isLoading || seeded) return;
    const saved = (giQ.data?.computerizedSystemConfig as any) || {};
    setConfig({ ...DEFAULT_CONFIG, ...saved, screening: { ...DEFAULT_CONFIG.screening, ...(saved.screening || {}) }, supplierAssessment: { ...DEFAULT_CONFIG.supplierAssessment, ...(saved.supplierAssessment || {}) } });
    setSeeded(true);
  }, [giQ.data, giQ.isLoading, seeded]);
  const save = trpc.generalInfo.save.useMutation({ onError: e => toast.error(e.message) });
  const report = trpc.report.generate.useMutation({
    onSuccess: ({ url }) => window.open(new URL(url, window.location.origin).href, "_blank", "noopener,noreferrer"),
    onError: e => toast.error(e.message),
  });
  const s = config.screening || {};
  const readiness = getComputerizedSystemReleaseReadiness(config);
  const { riskLevel, isGxp } = readiness;
  const persist = async (next = false) => {
    if (section === "profile" && (!config.systemName?.trim() || !config.intendedUse?.trim())) {
      toast.error("Заполните наименование системы и предполагаемое использование"); return;
    }
    if (section === "requirements" && isGxp && (!(config.requirements || []).length || config.requirements.some((r: Requirement) => !String(r.text || "").trim() || !String(r.acceptanceCriteria || "").trim()))) {
      toast.error("Для GxP-системы заполните хотя бы одно URS и критерий приёмки"); return;
    }
    if (section === "testing" && (config.tests || []).some((t: TestCase) => t.result === "pass" && (!t.requirementId || !String(t.actual || "").trim() || !String(t.evidence || "").trim()))) {
      toast.error("Для пройденного теста укажите связь с URS, фактический результат и доказательство"); return;
    }
    if (section === "release" && config.releaseDecision === "conditional" && !String(config.releaseRestrictions || "").trim()) {
      toast.error("Для условного допуска укажите ограничения и условия"); return;
    }
    if (section === "release" && ["approved", "conditional"].includes(config.releaseDecision) && !readiness.ready) {
      toast.error("Выпуск заблокирован: закройте обязательные контроли, тесты и прослеживаемость критичных URS"); return;
    }
    const completedSections = Array.from(new Set([...(config.completedSections || []), section]));
    const nextConfig = { ...config, riskLevel, completedSections, lastSavedSection: section };
    setConfig(nextConfig);
    await save.mutateAsync({ protocolId, equipmentType: "computerized-system", manufacturer: config.supplier || null, model: config.systemName || null, serial: config.version || null, location: config.environment || null, purpose: config.intendedUse || null, computerizedSystemConfig: nextConfig });
    await utils.generalInfo.get.invalidate({ protocolId });
    toast.success("Раздел сохранён");
    if (next) onNext?.();
  };
  const addRequirement = () => setConfig({ ...config, requirements: [...config.requirements, { id: `URS-${String(config.requirements.length + 1).padStart(3, "0")}`, text: "", type: "Функциональное", criticality: "medium", acceptanceCriteria: "" }] });
  const addTest = (requirementId = config.requirements[0]?.id || "") => setConfig({ ...config, tests: [...config.tests, { id: `TEST-${String(config.tests.length + 1).padStart(3, "0")}`, requirementId, steps: "", expected: "", actual: "", result: "none", evidence: "", deviation: "" }] });
  const generateTests = () => {
    const linked = new Set((config.tests || []).map((t: TestCase) => t.requirementId));
    const additions = (config.requirements || []).filter((r: Requirement) => !linked.has(r.id)).map((r: Requirement, idx: number) => ({ id: `TEST-${String(config.tests.length + idx + 1).padStart(3, "0")}`, requirementId: r.id, steps: `Проверить выполнение требования ${r.id}`, expected: r.acceptanceCriteria, actual: "", result: "none", evidence: "", deviation: "" }));
    setConfig({ ...config, tests: [...config.tests, ...additions] });
    toast.success(additions.length ? `Создано тестов: ${additions.length}` : "Все URS уже связаны с тестами");
  };
  const updateRow = (key: "requirements" | "tests", i: number, patch: any) => setConfig({ ...config, [key]: config[key].map((x: any, idx: number) => idx === i ? { ...x, ...patch } : x) });
  const removeRow = (key: "requirements" | "tests", i: number) => setConfig({ ...config, [key]: config[key].filter((_: any, idx: number) => idx !== i) });
  if (giQ.isError) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">Не удалось загрузить данные системы: {giQ.error.message}</div>;
  if (giQ.isLoading || !seeded) return <div className="h-72 rounded-xl bg-muted animate-pulse" />;
  return <div className="space-y-6"><Card><CardContent className="p-6 md:p-8 space-y-6">
    {section === "profile" && <><Header title="Паспорт компьютеризированной системы" text="Границы системы и предполагаемое GxP-использование."/><div className="grid md:grid-cols-2 gap-4">
      <Field label="Наименование системы *"><Input value={config.systemName} onChange={e=>setConfig({...config,systemName:e.target.value})}/></Field><Field label="Версия"><Input value={config.version} onChange={e=>setConfig({...config,version:e.target.value})}/></Field>
      <Field label="Владелец процесса"><Input value={config.processOwner} onChange={e=>setConfig({...config,processOwner:e.target.value})}/></Field><Field label="Владелец системы"><Input value={config.systemOwner} onChange={e=>setConfig({...config,systemOwner:e.target.value})}/></Field>
      <Field label="Поставщик"><Input value={config.supplier} onChange={e=>setConfig({...config,supplier:e.target.value})}/></Field><Field label="Размещение"><select className="w-full border rounded-md p-2" value={config.hosting} onChange={e=>setConfig({...config,hosting:e.target.value})}><option value="saas">Облачное (SaaS)</option><option value="local">Локальное</option><option value="hybrid">Гибридное</option></select></Field>
      <Field label="Тип решения"><select className="w-full border rounded-md p-2" value={config.solutionType} onChange={e=>setConfig({...config,solutionType:e.target.value})}><option value="standard">Стандартное без настройки</option><option value="configured">Конфигурируемое</option><option value="custom">Заказная разработка</option></select></Field><Field label="Среда"><Input value={config.environment} onChange={e=>setConfig({...config,environment:e.target.value})} placeholder="Production"/></Field>
      <Field label="Предполагаемое использование *" wide><Textarea value={config.intendedUse} onChange={e=>setConfig({...config,intendedUse:e.target.value})} placeholder="Какой GxP-процесс поддерживает система, кто и для чего её использует"/></Field><Field label="Интерфейсы" wide><Textarea value={config.interfaces} onChange={e=>setConfig({...config,interfaces:e.target.value})} placeholder="Связанные системы, направление и состав передаваемых данных"/></Field><Field label="Категории данных" wide><Textarea value={config.dataTypes} onChange={e=>setConfig({...config,dataTypes:e.target.value})} placeholder="Записи, справочники, аудиторский след, электронные подписи"/></Field>
    </div></>}
    {section === "screening" && <><Header title="GxP-скрининг и уровень риска" text="Отметьте факторы, которые действительно относятся к системе."/><div className="rounded-lg border p-4 font-semibold">Результат: {riskLevel}</div><div className="grid md:grid-cols-2 gap-3">{Object.entries({productQuality:"Влияет на качество продукции",patientSafety:"Влияет на безопасность пациента",gxpRecords:"Создаёт или изменяет GxP-записи",releaseDecision:"Используется при выпуске продукции",calculations:"Выполняет критичные расчёты",electronicSignatures:"Использует электронные подписи",editableRecords:"Позволяет изменять записи",integrations:"Передаёт GxP-данные другим системам"}).map(([k,label])=><label key={k} className="flex gap-3 rounded-lg border p-3"><input type="checkbox" checked={!!config.screening[k]} onChange={e=>setConfig({...config,screening:{...config.screening,[k]:e.target.checked}})}/><span>{label}</span></label>)}</div></>}
    {section === "requirements" && <><Header title="Требования пользователя (URS)" text="Формулируйте проверяемое требование и заранее задавайте однозначный критерий приёмки."/><Button variant="outline" onClick={addRequirement}><Plus className="h-4 w-4"/>Добавить URS</Button>{config.requirements.length===0&&<Hint>Для GxP-системы добавьте требования к функциям, данным, доступу, аудиторскому следу, резервному копированию и восстановлению — только применимые.</Hint>}{config.requirements.map((r:Requirement,i:number)=><div key={r.id} className="rounded-lg border p-4 space-y-3"><div className="grid md:grid-cols-[110px_180px_180px_44px] gap-2"><Input value={r.id} disabled/><select className="border rounded-md px-3" value={r.type} onChange={e=>updateRow("requirements",i,{type:e.target.value})}><option>Функциональное</option><option>Данные и целостность</option><option>Доступ и безопасность</option><option>Аудиторский след</option><option>Резервирование</option><option>Интерфейс</option></select><select className="border rounded-md px-3" value={r.criticality} onChange={e=>updateRow("requirements",i,{criticality:e.target.value})}><option value="low">Низкая критичность</option><option value="medium">Средняя критичность</option><option value="high">Высокая критичность</option></select><Button variant="outline" aria-label={`Удалить ${r.id}`} onClick={()=>removeRow("requirements",i)}><Trash2 className="h-4 w-4"/></Button></div><Textarea value={r.text} onChange={e=>updateRow("requirements",i,{text:e.target.value})} placeholder="Система должна…"/><Textarea value={r.acceptanceCriteria||""} onChange={e=>updateRow("requirements",i,{acceptanceCriteria:e.target.value})} placeholder="Критерий приёмки: наблюдаемый и однозначный результат"/></div>)}</>}
    {section === "supplier" && <><Header title="Поставщик и средства контроля" text="Компактная оценка достаточности поставщика для выбранного риска."/><div className="grid md:grid-cols-2 gap-3">{Object.entries({sla:"Договор / SLA",documentation:"Документация системы",changeNotification:"Уведомление об изменениях",incidentManagement:"Управление инцидентами",backup:"Резервное копирование",security:"Информационная безопасность"}).map(([k,label])=><label key={k} className="flex gap-3 rounded-lg border p-3"><input type="checkbox" checked={!!config.supplierAssessment[k]} onChange={e=>setConfig({...config,supplierAssessment:{...config.supplierAssessment,[k]:e.target.checked}})}/><span>{label}</span></label>)}</div><Field label="Вывод по поставщику"><Textarea value={config.supplierAssessment.notes} onChange={e=>setConfig({...config,supplierAssessment:{...config.supplierAssessment,notes:e.target.value}})}/></Field></>}
    {section === "testing" && <><Header title="Верификация и UAT" text="Свяжите каждую проверку с URS, зафиксируйте доказательство и обработайте отклонения."/><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>addTest()}><Plus className="h-4 w-4"/>Добавить тест</Button><Button variant="outline" onClick={generateTests}><Sparkles className="h-4 w-4"/>Создать из URS</Button></div>{config.tests.length===0&&<Hint>Сначала добавьте URS, затем создайте из них готовые карточки тестов одной кнопкой.</Hint>}{config.tests.map((t:TestCase,i:number)=><div key={t.id} className="rounded-lg border p-4 space-y-3"><div className="grid md:grid-cols-3 gap-2"><Input value={t.id} disabled/><select className="border rounded-md px-3" value={t.requirementId} onChange={e=>updateRow("tests",i,{requirementId:e.target.value})}><option value="">Без связи с URS</option>{config.requirements.map((r:Requirement)=><option key={r.id} value={r.id}>{r.id} — {r.text.slice(0,60)}</option>)}</select><select className="border rounded-md px-3" value={t.result} onChange={e=>updateRow("tests",i,{result:e.target.value})}><option value="none">Не выполнен</option><option value="pass">Пройден</option><option value="fail">Не пройден</option></select></div><Textarea value={t.steps} onChange={e=>updateRow("tests",i,{steps:e.target.value})} placeholder="Действия испытания"/><Textarea value={t.expected} onChange={e=>updateRow("tests",i,{expected:e.target.value})} placeholder="Ожидаемый результат / критерий приёмки"/><Textarea value={t.actual} onChange={e=>updateRow("tests",i,{actual:e.target.value})} placeholder="Фактический результат"/><Input value={t.evidence||""} onChange={e=>updateRow("tests",i,{evidence:e.target.value})} placeholder="Доказательство: скриншот, запись журнала, номер приложения"/><Textarea value={t.deviation||""} onChange={e=>updateRow("tests",i,{deviation:e.target.value})} placeholder="Отклонение и принятое решение (если применимо)"/><Button variant="outline" onClick={()=>removeRow("tests",i)}><Trash2 className="h-4 w-4"/>Удалить</Button></div>)}</>}
    {section === "release" && <><Header title="Выпуск в эксплуатацию" text="Система допускается только после закрытия критичных требований, тестов и обязательных контролей."/><Readiness ready={readiness.ready} blockers={readiness.blockers}/><div className="grid md:grid-cols-2 gap-4"><Field label="Решение"><select className="w-full border rounded-md p-2" value={config.releaseDecision} onChange={e=>setConfig({...config,releaseDecision:e.target.value})}><option value="pending">Не принято</option><option value="approved" disabled={!readiness.ready}>Разрешить эксплуатацию</option><option value="conditional" disabled={!readiness.ready}>Разрешить с ограничениями</option><option value="rejected">Не разрешать</option></select></Field><Field label="Периодический обзор, месяцев"><Input type="number" min="1" value={config.periodicReviewMonths} onChange={e=>setConfig({...config,periodicReviewMonths:e.target.value})}/></Field><Field label="Отклонения" wide><Textarea value={config.deviations} onChange={e=>setConfig({...config,deviations:e.target.value})} placeholder="Номер, описание, влияние и статус каждого отклонения"/></Field><Field label="Ограничения и условия" wide><Textarea value={config.releaseRestrictions} onChange={e=>setConfig({...config,releaseRestrictions:e.target.value})} placeholder="Обязательно для условного допуска"/></Field></div><Button onClick={async()=>{await persist();report.mutate({protocolId});}} disabled={save.isPending||report.isPending}>{report.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}Сформировать GAMP-отчёт</Button></>}
  </CardContent></Card><div className="flex justify-between">{onBack?<Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4"/>Назад</Button>:<span/>}<Button onClick={()=>persist(!!onNext)} disabled={save.isPending}>{save.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:onNext?<ArrowRight className="h-4 w-4"/>:<Save className="h-4 w-4"/>}{onNext?"Сохранить и продолжить":"Сохранить"}</Button></div></div>;
}
function Header({title,text}:{title:string;text:string}){return <div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-muted-foreground mt-1">{text}</p></div>}
function Field({label,children,wide}:{label:string;children:React.ReactNode;wide?:boolean}){return <div className={`space-y-1.5 ${wide?"md:col-span-2":""}`}><Label>{label}</Label>{children}</div>}
function Hint({children}:{children:React.ReactNode}){return <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{children}</div>}
function Readiness({ready,blockers}:{ready:boolean;blockers:string[]}){return <div className={`rounded-lg border p-4 ${ready?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><div className="flex gap-2 font-semibold">{ready?<CheckCircle2 className="h-5 w-5 text-emerald-600"/>:<AlertCircle className="h-5 w-5 text-amber-600"/>}{ready?"Готово к решению о выпуске":"До выпуска нужно закрыть"}</div>{!ready&&<ul className="mt-2 list-disc space-y-1 pl-6 text-sm">{blockers.map(item=><li key={item}>{item}</li>)}</ul>}</div>}
