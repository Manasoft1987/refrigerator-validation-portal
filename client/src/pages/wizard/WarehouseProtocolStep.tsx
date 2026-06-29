/**
 * WarehouseProtocolStep — Шаг визарда для помещений хранения.
 * Содержит редактируемые разделы 1–7 по ЕАЭК Рек. №8.
 * Разделы заполняются дефолтными текстами при первом открытии,
 * пользователь может редактировать или оставить как есть.
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WAREHOUSE_MAPPING_METHOD_NOTE } from "@shared/validation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Plus, ChevronRight, ChevronLeft, Save, Pencil, ClipboardCopy, Info } from "lucide-react";
import { toast } from "sonner";

/* ─── Default section texts ─────────────────────────────────────────────── */
const DEFAULT_SECTIONS: Record<string, string> = {
  "1.1": `ЕАЭС — Евразийский экономический союз
ЕЭК — Евразийская экономическая комиссия
ЛС — лекарственные средства
МИ - медицинские изделия
GDP (Good Distribution Practice) — Правила надлежащей дистрибьюторской практики
GPP (Good Pharmacy Practice) — Правила надлежащей аптечной практики
GMP (Good Manufacturing Practice) — Правила надлежащей производственной практики
СОП — стандартная операционная процедура
IQ (Installation Qualification) — квалификация монтажа
OQ (Operational Qualification) — квалификация функционирования
PV / PQ (Process Validation / Performance Qualification) — валидация процесса хранения / эксплуатационная квалификация
CAPA (Corrective and Preventive Actions) — корректирующие и предупреждающие действия
MKT (Mean Kinetic Temperature) — средняя кинетическая температура
SD (Standard Deviation) — стандартное отклонение
ISPE (International Society for Pharmaceutical Engineering) — Международное общество фармацевтического инжиниринга
ИБП — источник бесперебойного питания
ID — идентификационный номер регистратора данных`,
  "1.2": `Температурное картирование — документально оформленное изучение распределения температуры в зонах хранения лекарственных средств, включая определение точек с минимальными и максимальными значениями (холодная и горячая точки) и точек с наиболее значительными колебаниями температуры (критические точки).
Квалификация – документально оформленные действия, подтверждающие, что оборудование или вспомогательные системы смонтированы должным образом, правильно функционируют и действительно приводят к ожидаемым результатам.
Зона – помещение или часть помещений, а также холодильные (морозильные) камеры, предназначенные для приемки, отгрузки, карантина и хранения лекарственных средств.
Электронный регистратор данных температуры – средство измерения, обеспечивающее регистрацию данных температуры на протяжении заданного периода времени, хранение полученных данных и сохранение их целостности, а также имеющее возможность передачи полученных показаний в электронном виде на другой носитель (например, на компьютер).
Критерии приемлемости — заранее установленные пределы, в рамках которых результаты измерений считаются соответствующими требованиям.
Горячая точка — максимальные значения температуры, зафиксированные в ходе картирования, но находящиеся в пределах допустимого температурного диапазона.
Холодная точка — минимальные значения температуры, зафиксированные в ходе картирования, но находящиеся в пределах допустимого температурного диапазона.
MKT (средняя кинетическая температура) — расчётная единая температура, при которой суммарное химическое воздействие на продукт эквивалентно воздействию при реально измеренных колебаниях температуры.
Картирование проводится с использованием калиброванных регистраторов данных, размещаемых в соответствии с рекомендациями ЕАЭК (Рек. №8 ЕЭК) и принципами ISPE.`,
  "2.1": `Настоящий протокол описывает порядок проведения температурного картирования помещения/зоны хранения лекарственных средств. Объект исследования — помещение (зона) хранения, в котором поддерживается контролируемый температурный режим в соответствии с требованиями GMP/GDP/GPP.`,
  "2.2.1": `Настоящий протокол разработан в соответствии со следующими нормативными документами:
— Решение Совета ЕЭС от 03.11.2016 г. № 80 «Об утверждении Правил надлежащей дистрибьюторской практики в рамках Евразийского экономического союза»;
— Рекомендация Коллегии ЕЭК от 20.04.2026 г. № 8 «О Руководстве по проведению температурного картирования зон хранения лекарственных средств»;
— Решение Совета ЕЭК от 03.11.2016 г. №77 «Об утверждении Правил надлежащей производственной практики ЕАЭС»;
— Приказ и.о. МЗ РК от 04.02.2021 г. № ҚР ДСМ-15 «Об утверждении надлежащих фармацевтических практик»;
— Приказ МЗ РК от 16.02.2021 г. № ҚР ДСМ-19 «Об утверждении правил хранения и транспортировки лекарственных средств и медицинских изделий»;
— ISPE Good Practice Guide: Cold Chain Management (2014);
— Национальные стандарты и требования страны-участницы ЕАЭС.`,
  "2.2.2": `Проведение настоящего исследования обусловлено следующими факторами:
— необходимость подтверждения стабильности температурного режима в течение полного рабочего цикла хранения лекарственных средств с учётом эксплуатационных факторов: рутинные открывания дверей, движения персонала, изменения внешних условий окружающей среды (день, ночь), изменения рабочей среды (будни, выходные);
— необходимость определения критически холодной и горячей точки для установки средств измерения.`,
  "3": `Настоящий протокол распространяется на помещение (зону) хранения лекарственных средств, расположенное по адресу, указанному в разделе «Общие сведения». Протокол применяется для документального подтверждения соответствия условий хранения требованиям GMP/GDP/GPP и нормативным документам ЕАЭС.
Результаты картирования используются для:
— подтверждения квалификации помещения хранения;
— определения мест размещения средств измерения или датчиков системы мониторинга;
— выявления зон с неприемлемыми условиями хранения;
— разработки рекомендаций по организации хранения лекарственных средств.`,
  "4": `Целями настоящего температурного картирования являются:
а) выявление колебаний температуры и отклонений температуры в пределах выбранных зон хранения;
б) измерение и регистрация температуры на каждом участке зоны хранения в разные дни недели и разное время суток;
в) описание процедуры документальной фиксации зарегистрированных колебаний температуры и отклонений температуры в помещениях с контролируемой средой;
г) составление рекомендаций по организации безопасного хранения лекарственных средств в конкретной зоне хранения и определению мест, в которых нельзя размещать такие лекарственные средства. В рекомендациях следует учитывать все зафиксированные колебания температуры и отклонения температуры, выявленные в ходе исследования, а также допустимый для хранения лекарственных средств диапазон температур;
д) определение (уточнение) мест размещения датчиков мониторинга температуры. Если система мониторинга установлена, в ходе температурного картирования могут определяться точки для перемещения датчиков (при необходимости).`,
  "6.1": `Для проведения температурного картирования применяются электронные регистраторы данных со следующими характеристиками:
— наименование датчиков: SSN-13;
— диапазон измерений: не менее −35 °C ... +85 °C;
— погрешность измерения: ±0,2 °C;
— интервал регистрации: 1–15 минут (настраивается в зависимости от продолжительности исследования);
— объем памяти: 64 Кбайт;
— степень защиты: IP67;
— наличие действующего свидетельства о поверке / калибровке.
Датчики зарегистрированы в Государственном реестре средств измерений Республики Казахстан.`,
  "6.2": `Ответственные за проведение температурного картирования:
— Директор: [ФИО, организация]
— Менеджер по валидации: [ФИО, организация]`,
  "6.3": `Объект исследования — помещение (зона) хранения лекарственных средств и медицинских изделий, характеристики которой приведены в разделе «Общие сведения». Помещение хранения оснащено системой кондиционирования / отопления / вентиляции, обеспечивающей поддержание заданного температурного режима. Описание планировки, расположения стеллажей, дверей и кондиционеров приведено в соответствующей схеме отчета квалификации.`,
  "6.4": `Критерии приемлемости для данного исследования установлены в соответствии с требованиями к условиям хранения лекарственных средств:
— Температурный режим хранения: в соответствии с разделом «Общие сведения»;
— Допустимый диапазон температур: указан в разделе PV;
— Критерий по MKT: не должен превышать верхнюю границу допустимого диапазона;
— Допустимое количество кратковременных отклонений: 0 (нулевая толерантность к выходу за пределы диапазона в течение всего периода исследования).
Все внутренние регистраторы должны показывать температуру в пределах установленного диапазона на протяжении всего периода исследования.`,
  "6.5": `Количество и расположение точек размещения регистраторов данных определены в соответствии с рекомендациями ЕАЭК (Рек. №8, п. 16д) исходя из объёма и геометрии зоны хранения. Расчёт минимального количества регистраторов приведён в разделе «Общие сведения». 
Регистраторы данных располагаются в форме сетки и таким образом, чтобы они покрывали зону хранения по всей ее длине и ширине. Регистраторы данных размещаются по возможности с равными интервалами. Рекомендуемый шаг сетки размещения регистраторов данных по горизонтали:
— длина или ширина зоны хранения до 10 метров – не менее 2 регистраторов данных;
— длина или ширина зоны хранения от 10 до 40 метров – не менее 3 регистраторов данных;
— длина или ширина зоны хранения от 40 до 60 метров – не менее 4 регистраторов данных;
— длина или ширина зоны хранения 60 метров и более – не менее 5 регистраторов данных.
В каждой точке сетки размещения регистраторов данных следует дополнительно организовать размещение регистраторов данных по вертикали (послойно) с учетом следующих требований:
— регистраторы данных размещаются друг над другом на разной высоте в зависимости от высоты зоны хранения (не высоты потолка);
— нижняя точка размещения регистраторов данных определяется высотой нижнего уровня хранения лекарственных средств (палеты или нижнего яруса стеллажа), верхняя точка – высотой верхнего уровня хранения лекарственных средств (верхнего яруса стеллажа).
— Рекомендуемый шаг сетки размещения регистраторов данных по вертикали:
— высота до 1,5 метра от пола – не менее 1 регистратора данных;
— высота от 1,5 метра до 5 метров – не менее 2 регистраторов данных;
— высота 5 метров и более – не менее 3 регистраторов данных.`,
  "6.6": `Расположение каждого регистратора данных фиксируется на схеме с указанием:
— идентификационного номера (ID) регистратора;
— высоты размещения над уровнем пола;
— визуальной демонстрации точки размещения (рядом со стеллажом, напротив кондиционера, свободное пространство, вблизи двери и т.д.).
Схема размещения регистраторов прилагается к отчету квалификации.`,
  "6.7": `До начала исследования каждый регистратор данных:
— маркируется уникальным идентификационным номером (ID);
— программируется на заданный интервал регистрации (1–15 минут);
— проверяется на работоспособность (при программировании компьютером);
— проверяется наличие действующего свидетельства о поверке / калибровке.
Данные о регистраторах (ID, серийный номер, дата поверки) вносятся в таблицу (смотрите QR код в конце отчета).`,
  "6.8": `Регистраторы данных размещаются в зоне хранения в соответствии со схемой размещения до начала периода исследования. Размещение осуществляется ответственным исполнителем в присутствии руководителя исследования. Устройства устанавливаются и закрепляются таким образом, чтобы исключить их повреждение или смещение при выполнении рутинных операций в зоне хранения, а также чтобы при размещении исключить непосредственный контакт датчиков с металлическими, бетонными и подобными по теплоотдаче поверхностями.`,
  "6.9": `В течение всего периода исследования:
— регистраторы данных не перемещаются и не извлекаются из зоны хранения;
— условия эксплуатации зоны хранения поддерживаются в штатном режиме (обычная загрузка, стандартный режим работы);
— фиксируются все нештатные ситуации (отключение электроэнергии, открытие дверей на длительное время, ремонтные работы и т.д.) с указанием даты, времени и продолжительности.
По завершении периода исследования данные регистраторов извлекаются.`,
  "6.10": `После извлечения регистраторов данных:
— данные считываются с каждого регистратора с использованием специализированного программного обеспечения;
— данные экспортируются в формат CSV / XLSX для последующей обработки;
— проверяется полнота данных (отсутствие пропусков, соответствие периоду исследования);
— данные объединяются в единую таблицу для анализа;
— исходные файлы данных сохраняются в архиве в соответствии с требованиями к документообороту GxP.
Обработка и анализ данных проводятся в соответствии с разделом PV настоящего протокола.`,
};

/* ─── Section structure definition ─────────────────────────────────────── */
type SectionDef = {
  key: string;
  title: string;
  description?: string;
  children?: SectionDef[];
};

const SECTION_STRUCTURE: SectionDef[] = [
  {
    key: "1",
    title: "1. Сокращения и определения",
    children: [
      { key: "1.1", title: "1.1. Сокращения" },
      { key: "1.2", title: "1.2. Определения" },
    ],
  },
  {
    key: "2",
    title: "2. Описание и обоснование",
    children: [
      { key: "2.1", title: "2.1. Описание объекта картирования" },
      {
        key: "2.2",
        title: "2.2. Обоснование проведения температурного картирования",
        children: [
          { key: "2.2.1", title: "2.2.1. Нормативные основания" },
          { key: "2.2.2", title: "2.2.2. Конкретные основания для проведения исследования" },
        ],
      },
    ],
  },
  { key: "3", title: "3. Область применения" },
  { key: "4", title: "4. Цели и задачи температурного картирования" },
  { key: "5", title: "5. Общие сведения об оборудовании", isEquipment: true } as any,
  {
    key: "6",
    title: "6. Методология проведения температурного картирования",
    children: [
      { key: "6.1", title: "6.1. Сведения о выборе типа регистратора данных" },
      { key: "6.2", title: "6.2. ФИО исполнителей, ответственных за проведение картирования" },
      { key: "6.3", title: "6.3. Сведения об объекте исследования" },
      { key: "6.4", title: "6.4. Сведения о выборе и установлении пределов критериев приемлемости" },
      { key: "6.5", title: "6.5. Сведения об определении точек размещения регистраторов данных" },
      { key: "6.6", title: "6.6. Сведения о регистрации точек размещения регистраторов данных" },
      { key: "6.7", title: "6.7. Сведения о маркировке и программировании регистраторов данных" },
      { key: "6.8", title: "6.8. Сведения о размещении регистраторов данных" },
      { key: "6.9", title: "6.9. Сведения об извлечении регистраторов данных" },
      { key: "6.10", title: "6.10. Сведения о загрузке и объединении данных" },
      { key: "6.11", title: "6.11. План IQ — Квалификация монтажа", isIQ: true } as any,
      { key: "6.12", title: "6.12. План OQ — Квалификация функционирования", isOQ: true } as any,
      { key: "6.13", title: "6.13. План PQ — Эксплуатационная квалификация", isPQ: true } as any,
    ],
  },
  { key: "7", title: "7. Подписи к Протоколу", isSignatures: true } as any,
];

/* ─── Equipment dialog ──────────────────────────────────────────────────── */
type EquipmentRow = {
  id?: number;
  name: string;
  manufacturer: string;
  model: string;
  serial: string;
  purpose: string;
};

function EquipmentDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial?: EquipmentRow | null;
  onSave: (row: EquipmentRow) => void;
  onClose: () => void;
}) {
  const [row, setRow] = useState<EquipmentRow>(
    initial ?? { name: "", manufacturer: "", model: "", serial: "", purpose: "" },
  );
  useEffect(() => {
    setRow(initial ?? { name: "", manufacturer: "", model: "", serial: "", purpose: "" });
  }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Редактировать оборудование" : "Добавить оборудование"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {(
            [
              ["name", "Наименование *"],
              ["manufacturer", "Производитель"],
              ["model", "Модель"],
              ["serial", "Серийный номер"],
            ] as [keyof EquipmentRow, string][]
          ).map(([field, label]) => (
            <div key={field} className="grid grid-cols-3 items-center gap-2">
              <Label className="text-right text-sm">{label}</Label>
              <Input
                className="col-span-2"
                value={(row[field] as string) ?? ""}
                onChange={e => setRow(r => ({ ...r, [field]: e.target.value }))}
              />
            </div>
          ))}
          <div className="grid grid-cols-3 items-start gap-2">
            <Label className="text-right text-sm pt-2">Назначение</Label>
            <Textarea
              className="col-span-2 h-20"
              value={row.purpose ?? ""}
              onChange={e => setRow(r => ({ ...r, purpose: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => { if (row.name.trim()) onSave(row); }} disabled={!row.name.trim()}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Equipment section ─────────────────────────────────────────────────── */
function EquipmentSection({ protocolId }: { protocolId: number }) {
  const utils = trpc.useUtils();
  const { data: equipment = [] } = trpc.warehouseEquipment.list.useQuery({ protocolId });
  const createMut = trpc.warehouseEquipment.create.useMutation({
    onSuccess: () => utils.warehouseEquipment.list.invalidate({ protocolId }),
  });
  const updateMut = trpc.warehouseEquipment.update.useMutation({
    onSuccess: () => utils.warehouseEquipment.list.invalidate({ protocolId }),
  });
  const deleteMut = trpc.warehouseEquipment.delete.useMutation({
    onSuccess: () => utils.warehouseEquipment.list.invalidate({ protocolId }),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentRow | null>(null);

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(eq: any) {
    setEditing({ id: eq.id, name: eq.name ?? "", manufacturer: eq.manufacturer ?? "", model: eq.model ?? "", serial: eq.serial ?? "", purpose: eq.purpose ?? "" });
    setDialogOpen(true);
  }

  async function handleSave(row: EquipmentRow) {
    if (row.id) {
      await updateMut.mutateAsync({ id: row.id, ...row });
      toast.success("Оборудование обновлено");
    } else {
      await createMut.mutateAsync({ protocolId, ...row, ord: equipment.length });
      toast.success("Оборудование добавлено");
    }
    setDialogOpen(false);
  }

  async function handleDelete(id: number) {
    await deleteMut.mutateAsync({ id });
    toast.success("Оборудование удалено");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Перечислите все регистраторы данных и вспомогательное оборудование, используемое в исследовании.
        </p>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Добавить
        </Button>
      </div>
      {equipment.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Оборудование не добавлено. Нажмите «Добавить» для внесения первой записи.
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Наименование</TableHead>
                <TableHead>Производитель / Модель</TableHead>
                <TableHead>Серийный №</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipment.map((eq, i) => (
                <TableRow key={eq.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{eq.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[eq.manufacturer, eq.model].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{eq.serial || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(eq)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(eq.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <EquipmentDialog
        open={dialogOpen}
        initial={editing}
        onSave={handleSave}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
type Props = {
  protocolId: number;
  onDone: () => void;
  onBack: () => void;
};

/** Build section 6.2 text from commission members */
function buildSection62(members: { name: string; role: string; company?: string | null }[]): string {
  const lines = members
    .filter(m => m.name?.trim() || m.role?.trim())
    .map(m => {
      const name = m.name?.trim() || "—";
      const role = m.role?.trim() || "—";
      const company = m.company?.trim();
      return company ? `— ${role}: ${name} (${company})` : `— ${role}: ${name}`;
    });
  if (lines.length === 0) return DEFAULT_SECTIONS["6.2"];
  return `Ответственные за проведение температурного картирования:\n${lines.join("\n")}`;
}

export default function WarehouseProtocolStep({ protocolId, onDone, onBack }: Props) {
  const utils = trpc.useUtils();
  const { data: savedSections, isLoading } = trpc.warehouseSections.get.useQuery({ protocolId });
  const { data: giData } = trpc.generalInfo.get.useQuery({ protocolId });
  const saveMut = trpc.warehouseSections.save.useMutation({
    onSuccess: () => utils.warehouseSections.get.invalidate({ protocolId }),
  });

  // Local editable state — initialised from DB or defaults
  const [sections, setSections] = useState<Record<string, string>>(DEFAULT_SECTIONS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!savedSections) return;
    const commission: { name: string; role: string; company?: string | null }[] =
      Array.isArray((giData as any)?.commissionMembers) ? (giData as any).commissionMembers : [];
    // Merge: DB values override defaults; missing keys keep default
    const merged: Record<string, string> = { ...DEFAULT_SECTIONS };
    for (const [k, v] of Object.entries(savedSections)) {
      if (v !== undefined && v !== null) merged[k] = v as string;
    }
    // Auto-fill 6.2 from commission if it still has the default placeholder text
    const isDefault62 =
      !merged["6.2"] ||
      merged["6.2"] === DEFAULT_SECTIONS["6.2"] ||
      merged["6.2"].includes("[ФИО, должность]");
    if (isDefault62 && commission.length > 0) {
      merged["6.2"] = buildSection62(commission);
    }
    setSections(merged);
    setDirty(false);
  }, [savedSections, giData]);

  const handleChange = useCallback((key: string, value: string) => {
    setSections(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  async function handleSave() {
    await saveMut.mutateAsync({ protocolId, sections });
    setDirty(false);
    toast.success("Разделы протокола сохранены");
  }

  async function handleSaveAndContinue() {
    await saveMut.mutateAsync({ protocolId, sections });
    setDirty(false);
    onDone();
  }

  // Collect all leaf section keys that have text editors
  const editableKeys = Object.keys(DEFAULT_SECTIONS);

  function renderSection(def: SectionDef & { isEquipment?: boolean; isIQ?: boolean; isOQ?: boolean; isPQ?: boolean; isSignatures?: boolean }, depth = 0): React.ReactNode {
    const isLeaf = !def.children || def.children.length === 0;
    const isSpecial = def.isEquipment || def.isIQ || def.isOQ || def.isPQ || def.isSignatures;

    if (isSpecial) {
      if (def.isEquipment) {
        return (
          <AccordionItem key={def.key} value={def.key} className="border rounded-lg mb-2">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                {def.title}
                <Badge variant="secondary" className="text-xs font-normal">Таблица оборудования</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <EquipmentSection protocolId={protocolId} />
            </AccordionContent>
          </AccordionItem>
        );
      }
      if (def.isIQ || def.isOQ || def.isPQ || def.isSignatures) {
        return (
          <AccordionItem key={def.key} value={def.key} className="border rounded-lg mb-2">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2">
                {def.title}
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  Заполняется на следующих шагах
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <p className="text-sm text-muted-foreground italic">
                Этот раздел формируется автоматически на основании данных, введённых на шагах IQ, OQ и PV визарда.
              </p>
            </AccordionContent>
          </AccordionItem>
        );
      }
    }

    if (isLeaf && editableKeys.includes(def.key)) {
      const is62 = def.key === "6.2";
      const commission: { name: string; role: string; company?: string | null }[] =
        Array.isArray((giData as any)?.commissionMembers) ? (giData as any).commissionMembers : [];
      return (
        <AccordionItem key={def.key} value={def.key} className={`border rounded-lg mb-2 ${depth > 0 ? "ml-4" : ""}`}>
          <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              {def.title}
              {is62 && commission.length > 0 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {commission.length} чел. из комиссии
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-2">
            {is62 && commission.length > 0 && (
              <div className="flex items-center justify-between rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                <p className="text-xs text-blue-800">
                  Раздел автозаполняется из состава комиссии. Если состав изменился — нажмите «Обновить».
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-background ml-3 shrink-0 text-xs"
                  onClick={() => {
                    handleChange("6.2", buildSection62(commission));
                    toast.success("Раздел 6.2 обновлён из состава комиссии");
                  }}
                >
                  <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
                  Обновить
                </Button>
              </div>
            )}
            <Textarea
              className="min-h-[160px] font-mono text-sm leading-relaxed resize-y"
              value={sections[def.key] ?? ""}
              onChange={e => handleChange(def.key, e.target.value)}
              placeholder={`Введите содержание раздела ${def.key}…`}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Текст по умолчанию заполнен согласно ЕАЭК Рек. №8. Вы можете отредактировать его под конкретный объект.
            </p>
          </AccordionContent>
        </AccordionItem>
      );
    }

    // Group with children
    return (
      <div key={def.key} className={depth > 0 ? "ml-4" : ""}>
        <div className="px-1 py-2 text-sm font-semibold text-foreground/70 uppercase tracking-wide">
          {def.title}
        </div>
        {def.children?.map(child => renderSection(child as any, depth + 1))}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Загрузка разделов протокола…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Разделы протокола картирования</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Разделы 1–7 по ЕАЭК Рек. №8. Тексты заполнены по умолчанию — отредактируйте под конкретный объект или оставьте как есть.
          </p>
        </div>
        {dirty && (
          <Badge variant="secondary" className="shrink-0 mt-1">Есть несохранённые изменения</Badge>
        )}
      </div>

      <Alert className="border-sky-200 bg-sky-50/60 text-sky-950">
        <Info />
        <AlertTitle>Методологическое основание</AlertTitle>
        <AlertDescription className="text-sky-900/80">
          <p>{WAREHOUSE_MAPPING_METHOD_NOTE}</p>
        </AlertDescription>
      </Alert>

      {/* Sections accordion */}
      <Accordion type="multiple" className="space-y-1">
        {SECTION_STRUCTURE.map(s => renderSection(s as any))}
      </Accordion>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Назад
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saveMut.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {saveMut.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
          <Button onClick={handleSaveAndContinue} disabled={saveMut.isPending}>
            Далее <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
