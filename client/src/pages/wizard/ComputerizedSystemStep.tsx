import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Download, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Section = "profile" | "screening" | "requirements" | "supplier" | "testing" | "release";
type Requirement = { id: string; text: string; type: string; criticality: "low" | "medium" | "high" };
type TestCase = { id: string; requirementId: string; steps: string; expected: string; actual: string; result: "none" | "pass" | "fail" };

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
    if (!giQ.data || seeded) return;
    const saved = (giQ.data.computerizedSystemConfig as any) || {};
    setConfig({ ...DEFAULT_CONFIG, ...saved, screening: { ...DEFAULT_CONFIG.screening, ...(saved.screening || {}) }, supplierAssessment: { ...DEFAULT_CONFIG.supplierAssessment, ...(saved.supplierAssessment || {}) } });
    setSeeded(true);
  }, [giQ.data, seeded]);
  const save = trpc.generalInfo.save.useMutation({ onError: e => toast.error(e.message) });
  const report = trpc.report.generate.useMutation({
    onSuccess: ({ url }) => window.open(new URL(url, window.location.origin).href, "_blank", "noopener,noreferrer"),
    onError: e => toast.error(e.message),
  });
  const riskCount = Object.values(config.screening || {}).filter(Boolean).length;
  const riskLevel = riskCount >= 5 ? "Высокий" : riskCount >= 2 ? "Средний" : riskCount === 1 ? "Низкий" : "Не GxP";
  const persist = async (next = false) => {
    const completedSections = Array.from(new Set([...(config.completedSections || []), section]));
    const nextConfig = { ...config, riskLevel, completedSections };
    setConfig(nextConfig);
    await save.mutateAsync({ protocolId, equipmentType: "computerized-system", manufacturer: config.supplier || null, model: config.systemName || null, serial: config.version || null, location: config.environment || null, purpose: config.intendedUse || null, computerizedSystemConfig: nextConfig });
    await utils.generalInfo.get.invalidate({ protocolId });
    toast.success("Раздел сохранён");
    if (next) onNext?.();
  };
  const addRequirement = () => setConfig({ ...config, requirements: [...config.requirements, { id: `URS-${String(config.requirements.length + 1).padStart(3, "0")}`, text: "", type: "Функциональное", criticality: "medium" }] });
  const addTest = () => setConfig({ ...config, tests: [...config.tests, { id: `TEST-${String(config.tests.length + 1).padStart(3, "0")}`, requirementId: config.requirements[0]?.id || "", steps: "", expected: "", actual: "", result: "none" }] });
  const updateRow = (key: "requirements" | "tests", i: number, patch: any) => setConfig({ ...config, [key]: config[key].map((x: any, idx: number) => idx === i ? { ...x, ...patch } : x) });
  const removeRow = (key: "requirements" | "tests", i: number) => setConfig({ ...config, [key]: config[key].filter((_: any, idx: number) => idx !== i) });
  if (giQ.isLoading || !seeded) return <div className="h-72 rounded-xl bg-muted animate-pulse" />;
  return <div className="space-y-6"><Card><CardContent className="p-6 md:p-8 space-y-6">
    {section === "profile" && <><Header title="Паспорт компьютеризированной системы" text="Границы системы и предполагаемое GxP-использование."/><div className="grid md:grid-cols-2 gap-4">
      <Field label="Наименование системы *"><Input value={config.systemName} onChange={e=>setConfig({...config,systemName:e.target.value})}/></Field><Field label="Версия"><Input value={config.version} onChange={e=>setConfig({...config,version:e.target.value})}/></Field>
      <Field label="Владелец процесса"><Input value={config.processOwner} onChange={e=>setConfig({...config,processOwner:e.target.value})}/></Field><Field label="Владелец системы"><Input value={config.systemOwner} onChange={e=>setConfig({...config,systemOwner:e.target.value})}/></Field>
      <Field label="Поставщик"><Input value={config.supplier} onChange={e=>setConfig({...config,supplier:e.target.value})}/></Field><Field label="Размещение"><Input value={config.hosting} onChange={e=>setConfig({...config,hosting:e.target.value})} placeholder="SaaS / локально / гибрид"/></Field>
      <Field label="Предполагаемое использование *" wide><Textarea value={config.intendedUse} onChange={e=>setConfig({...config,intendedUse:e.target.value})}/></Field><Field label="Интерфейсы" wide><Textarea value={config.interfaces} onChange={e=>setConfig({...config,interfaces:e.target.value})}/></Field>
    </div></>}
    {section === "screening" && <><Header title="GxP-скрининг и уровень риска" text="Отметьте факторы, которые действительно относятся к системе."/><div className="rounded-lg border p-4 font-semibold">Результат: {riskLevel}</div><div className="grid md:grid-cols-2 gap-3">{Object.entries({productQuality:"Влияет на качество продукции",patientSafety:"Влияет на безопасность пациента",gxpRecords:"Создаёт или изменяет GxP-записи",releaseDecision:"Используется при выпуске продукции",calculations:"Выполняет критичные расчёты",electronicSignatures:"Использует электронные подписи",editableRecords:"Позволяет изменять записи",integrations:"Передаёт GxP-данные другим системам"}).map(([k,label])=><label key={k} className="flex gap-3 rounded-lg border p-3"><input type="checkbox" checked={!!config.screening[k]} onChange={e=>setConfig({...config,screening:{...config.screening,[k]:e.target.checked}})}/><span>{label}</span></label>)}</div></>}
    {section === "requirements" && <><Header title="Требования пользователя (URS)" text="Каждое критичное требование должно быть связано с испытанием."/><Button variant="outline" onClick={addRequirement}><Plus className="h-4 w-4"/>Добавить URS</Button>{config.requirements.map((r:Requirement,i:number)=><div key={r.id} className="grid md:grid-cols-[110px_1fr_180px_44px] gap-2"><Input value={r.id} disabled/><Input value={r.text} onChange={e=>updateRow("requirements",i,{text:e.target.value})} placeholder="Требование"/><select className="border rounded-md px-3" value={r.criticality} onChange={e=>updateRow("requirements",i,{criticality:e.target.value})}><option value="low">Низкая</option><option value="medium">Средняя</option><option value="high">Высокая</option></select><Button variant="outline" onClick={()=>removeRow("requirements",i)}><Trash2 className="h-4 w-4"/></Button></div>)}</>}
    {section === "supplier" && <><Header title="Поставщик и средства контроля" text="Компактная оценка достаточности поставщика для выбранного риска."/><div className="grid md:grid-cols-2 gap-3">{Object.entries({sla:"Договор / SLA",documentation:"Документация системы",changeNotification:"Уведомление об изменениях",incidentManagement:"Управление инцидентами",backup:"Резервное копирование",security:"Информационная безопасность"}).map(([k,label])=><label key={k} className="flex gap-3 rounded-lg border p-3"><input type="checkbox" checked={!!config.supplierAssessment[k]} onChange={e=>setConfig({...config,supplierAssessment:{...config.supplierAssessment,[k]:e.target.checked}})}/><span>{label}</span></label>)}</div><Field label="Вывод по поставщику"><Textarea value={config.supplierAssessment.notes} onChange={e=>setConfig({...config,supplierAssessment:{...config.supplierAssessment,notes:e.target.value}})}/></Field></>}
    {section === "testing" && <><Header title="Верификация и UAT" text="Фиксируйте только проверки, необходимые для URS и рисков."/><Button variant="outline" onClick={addTest}><Plus className="h-4 w-4"/>Добавить тест</Button>{config.tests.map((t:TestCase,i:number)=><div key={t.id} className="rounded-lg border p-4 space-y-3"><div className="grid md:grid-cols-3 gap-2"><Input value={t.id} disabled/><Input value={t.requirementId} onChange={e=>updateRow("tests",i,{requirementId:e.target.value})} placeholder="URS-001"/><select className="border rounded-md px-3" value={t.result} onChange={e=>updateRow("tests",i,{result:e.target.value})}><option value="none">Не выполнен</option><option value="pass">Пройден</option><option value="fail">Не пройден</option></select></div><Textarea value={t.steps} onChange={e=>updateRow("tests",i,{steps:e.target.value})} placeholder="Шаги"/><Textarea value={t.expected} onChange={e=>updateRow("tests",i,{expected:e.target.value})} placeholder="Ожидаемый результат"/><Textarea value={t.actual} onChange={e=>updateRow("tests",i,{actual:e.target.value})} placeholder="Фактический результат"/><Button variant="outline" onClick={()=>removeRow("tests",i)}><Trash2 className="h-4 w-4"/>Удалить</Button></div>)}</>}
    {section === "release" && <><Header title="Выпуск в эксплуатацию" text="Итоговое решение, ограничения и периодический обзор."/><div className="grid md:grid-cols-2 gap-4"><Field label="Решение"><select className="w-full border rounded-md p-2" value={config.releaseDecision} onChange={e=>setConfig({...config,releaseDecision:e.target.value})}><option value="pending">Не принято</option><option value="approved">Разрешить эксплуатацию</option><option value="conditional">Разрешить с ограничениями</option><option value="rejected">Не разрешать</option></select></Field><Field label="Периодический обзор, месяцев"><Input type="number" value={config.periodicReviewMonths} onChange={e=>setConfig({...config,periodicReviewMonths:e.target.value})}/></Field><Field label="Отклонения" wide><Textarea value={config.deviations} onChange={e=>setConfig({...config,deviations:e.target.value})}/></Field><Field label="Ограничения и условия" wide><Textarea value={config.releaseRestrictions} onChange={e=>setConfig({...config,releaseRestrictions:e.target.value})}/></Field></div><Button onClick={async()=>{await persist();report.mutate({protocolId});}} disabled={save.isPending||report.isPending}>{report.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}Сформировать GAMP-отчёт</Button></>}
  </CardContent></Card><div className="flex justify-between">{onBack?<Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4"/>Назад</Button>:<span/>}<Button onClick={()=>persist(!!onNext)} disabled={save.isPending}>{save.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:onNext?<ArrowRight className="h-4 w-4"/>:<Save className="h-4 w-4"/>}{onNext?"Сохранить и продолжить":"Сохранить"}</Button></div></div>;
}
function Header({title,text}:{title:string;text:string}){return <div><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm text-muted-foreground mt-1">{text}</p></div>}
function Field({label,children,wide}:{label:string;children:React.ReactNode;wide?:boolean}){return <div className={`space-y-1.5 ${wide?"md:col-span-2":""}`}><Label>{label}</Label>{children}</div>}
