/**
 * WarehouseProtocolStep — Шаг визарда для помещений хранения.
 * Содержит редактируемые разделы 1–7 по Рекомендации ЕЭК №8.
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
import {
  PHARMACY_STORAGE_MAPPING_METHOD_NOTE,
  WAREHOUSE_EXPERT_EQUIPMENT_TYPE,
  WAREHOUSE_MAPPING_METHOD_NOTE,
} from "@shared/validation";
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
СОП — стандартная операционная процедура
IQ (Installation Qualification) — квалификация монтажа
OQ (Operational Qualification) — квалификация функционирования
PQ/PV (Performance Qualification / Process Validation) — эксплуатационная квалификация / валидация процесса хранения
CAPA (Corrective and Preventive Actions) — корректирующие и предупреждающие действия
MKT (Mean Kinetic Temperature) — средняя кинетическая температура
SD (Standard Deviation) — стандартное отклонение
ИБП — источник бесперебойного питания
ID — идентификационный номер регистратора данных`,
  "1.2": `Температурное картирование — документально оформленное изучение распределения температуры в помещении (зоне) хранения аптеки, включая определение точек с минимальными и максимальными значениями (холодная и горячая точки) и точек с наиболее значительными колебаниями температуры (критические точки).
Квалификация – документально оформленные действия, подтверждающие, что оборудование или вспомогательные системы смонтированы должным образом, правильно функционируют и действительно приводят к ожидаемым результатам.
Помещение (зона) хранения аптеки — помещение или выделенная часть помещения аптеки, предназначенная для хранения лекарственных средств в заданных температурных условиях.
Электронный регистратор данных температуры – средство измерения, обеспечивающее регистрацию данных температуры на протяжении заданного периода времени, хранение полученных данных и сохранение их целостности, а также имеющее возможность передачи полученных показаний в электронном виде на другой носитель (например, на компьютер).
Критерии приемлемости — заранее установленные пределы, в рамках которых результаты измерений считаются соответствующими требованиям.
Горячая точка — максимальные значения температуры, зафиксированные в ходе картирования, но находящиеся в пределах допустимого температурного диапазона.
Холодная точка — минимальные значения температуры, зафиксированные в ходе картирования, но находящиеся в пределах допустимого температурного диапазона.
MKT (средняя кинетическая температура) — расчётная единая температура, при которой суммарное химическое воздействие на продукт эквивалентно воздействию при реально измеренных колебаниях температуры.
Картирование проводится с использованием поверенных регистраторов данных, размещаемых в соответствии с Рекомендацией Коллегии ЕЭК №8.`,
  "2.1": `Настоящий протокол описывает порядок проведения температурного картирования помещения (зоны) хранения аптеки. Объект исследования — помещение (зона) хранения аптеки, в котором поддерживается установленный температурный режим.`,
  "2.2.1": `Настоящий протокол разработан в соответствии со следующими нормативными документами:
— Рекомендация Коллегии ЕЭК от 20.04.2026 г. № 8 «О Руководстве по проведению температурного картирования зон хранения лекарственных средств»;
— Приказ и.о. МЗ РК от 04.02.2021 г. № ҚР ДСМ-15 «Об утверждении надлежащих фармацевтических практик»;
— Приказ МЗ РК от 16.02.2021 г. № ҚР ДСМ-19 «Об утверждении правил хранения и транспортировки лекарственных средств и медицинских изделий»;
— внутренние стандартные операционные процедуры аптеки.`,
  "2.2.2": `Проведение настоящего исследования обусловлено следующими факторами:
— необходимость подтверждения стабильности температурного режима в течение полного рабочего цикла хранения лекарственных средств с учётом эксплуатационных факторов: рутинные открывания дверей, движения персонала, изменения внешних условий окружающей среды (день, ночь), изменения рабочей среды (будни, выходные);
— необходимость определения критически холодной и горячей точки для установки средств измерения.`,
  "3": `Настоящий протокол распространяется на помещение (зону) хранения аптеки, расположенное по адресу, указанному в разделе «Общие сведения». Протокол применяется для документального подтверждения стабильности условий хранения лекарственных средств и пригодности помещения для эксплуатации.
Результаты картирования используются для:
— подтверждения готовности помещения (зоны) хранения аптеки;
— определения мест размещения средств измерения для мониторинга условий хранения лекарственных средств;
— выявления зон с неприемлемыми условиями хранения;
— разработки рекомендаций по организации хранения лекарственных средств.`,
  "4": `Целями настоящего температурного картирования являются:
а) выявление колебаний температуры и отклонений температуры в помещении (зоне) хранения аптеки;
б) измерение и регистрация температуры на каждом участке помещения (зоны) хранения аптеки в разные дни недели и разное время суток;
в) описание процедуры документальной фиксации зарегистрированных колебаний температуры и отклонений температуры в помещениях с контролируемой средой;
г) составление рекомендаций по безопасному размещению лекарственных средств в помещении (зоне) хранения аптеки и определению мест, в которых не следует размещать такие лекарственные средства. В рекомендациях следует учитывать все зафиксированные колебания температуры и отклонения температуры, выявленные в ходе исследования, а также допустимый диапазон температур;
д) определение (выявление) мест размещения приборов мониторинга температуры. Если система мониторинга установлена, в ходе температурного картирования могут определяться точки для перемещения приборов (при необходимости).`,
  "6.1": `Для проведения температурного картирования применяются электронные регистраторы данных со следующими характеристиками:
— наименование, марка/модель и серийные номера: согласно реестру регистраторов данных и разделу отчёта;
— диапазон измерений: соответствует установленному температурному режиму помещения (зоны) хранения аптеки;
— абсолютная погрешность измерения: не более ±0,5 °C; фактическая погрешность каждого регистратора указывается в реестре и отчёте;
— интервал регистрации: 1–15 минут (настраивается в зависимости от продолжительности исследования);
— объём памяти: достаточен для регистрации данных в течение всего периода исследования;
— наличие действующего свидетельства о поверке.
Регистраторы данных применяются в соответствии с их эксплуатационной документацией и требованиями метрологического обеспечения, применимыми в стране проведения работ.`,
  "6.2": `Ответственные за проведение температурного картирования:
— Директор: [ФИО, организация]
— Менеджер по валидации: [ФИО, организация]

Ответственные лица обладают необходимой подготовкой для выполнения работ по температурному картированию, программированию регистраторов данных, считыванию и анализу данных.`,
  "6.3": `Объект исследования — помещение (зона) хранения аптеки для лекарственных средств, характеристики которого приведены в разделе «Общие сведения». Помещение оснащено системой кондиционирования / отопления / вентиляции, обеспечивающей поддержание заданного температурного режима. Описание планировки, расположения стеллажей, дверей и оборудования приведено в соответствующей схеме отчёта температурного картирования.`,
  "6.4": `Критерии приемлемости для данного исследования установлены в соответствии с требованиями к условиям хранения лекарственных средств:
— Температурный режим хранения: в соответствии с разделом «Общие сведения»;
— Допустимый диапазон температур: указан в разделе PQ/PV;
— Критерий по MKT: не должен превышать верхнюю границу допустимого диапазона;
— Допустимое количество кратковременных отклонений: 0 (нулевая толерантность к выходу за пределы диапазона в течение всего периода исследования).
Все внутренние регистраторы должны показывать температуру в пределах установленного диапазона на протяжении всего периода исследования.`,
  "6.5": `Количество и расположение точек размещения регистраторов данных определены в соответствии с Рекомендацией Коллегии ЕЭК №8 (п. 16д) исходя из объёма и геометрии помещения (зоны) хранения аптеки. Расчёт минимального количества регистраторов приведён в разделе «Общие сведения».
Регистраторы данных располагаются в форме сетки и таким образом, чтобы они покрывали помещение по всей его длине и ширине. Регистраторы данных размещаются по возможности с равными интервалами. Рекомендуемый шаг сетки размещения регистраторов данных по горизонтали:
— длина или ширина помещения до 10 метров – не менее 2 регистраторов данных;
— длина или ширина помещения от 10 до 40 метров – не менее 3 регистраторов данных;
— длина или ширина помещения от 40 до 60 метров – не менее 4 регистраторов данных;
— длина или ширина помещения 60 метров и более – не менее 5 регистраторов данных.
В каждой точке сетки размещения регистраторов данных следует дополнительно организовать размещение регистраторов данных по вертикали (послойно) с учетом следующих требований:
— регистраторы данных размещаются друг над другом на разной высоте в зависимости от высоты помещения (не высоты потолка);
— нижняя точка размещения регистраторов данных определяется высотой нижнего уровня размещения лекарственных средств, верхняя точка – высотой верхнего уровня размещения лекарственных средств.
— Рекомендуемый шаг сетки размещения регистраторов данных по вертикали:
— высота помещения до 1,5 метра от пола – не менее 1 регистратора данных;
— высота от 1,5 метра до 5 метров – не менее 2 регистраторов данных;
— высота 5 метров и более – не менее 3 регистраторов данных.`,
  "6.6": `Расположение каждого регистратора данных фиксируется на схеме с указанием:
— идентификационного номера (ID) регистратора;
— высоты размещения над уровнем пола;
— визуальной демонстрации точки размещения (рядом со стеллажом, напротив кондиционера, свободное пространство, вблизи двери и т.д.).
Схема размещения регистраторов прилагается к отчёту температурного картирования.`,
  "6.7": `До начала исследования каждый регистратор данных:
— маркируется уникальным идентификационным номером (ID);
— программируется на заданный интервал регистрации (1–15 минут);
— проверяется на работоспособность (при программировании компьютером);
— проверяется наличие действующего свидетельства о поверке.
Данные о регистраторах (ID, серийный номер, дата поверки) вносятся в таблицу (смотрите QR код в конце отчета).`,
  "6.8": `Регистраторы данных размещаются в помещении (зоне) хранения аптеки в соответствии со схемой размещения до начала периода исследования. Размещение осуществляется ответственным исполнителем в присутствии руководителя исследования. Устройства устанавливаются и закрепляются таким образом, чтобы исключить их повреждение или смещение при выполнении обычных операций, а также непосредственный контакт датчиков с металлическими, бетонными и подобными по теплоотдаче поверхностями. Персонал, работающий в помещении, информируется о проведении температурного картирования во избежание случайного нарушения работы, отключения или утраты регистраторов и данных.`,
  "6.9": `Температурное картирование проводится в условиях штатной эксплуатации помещения (зоны) хранения аптеки. В период исследования двери открываются в обычном рабочем режиме, связанном с движением персонала и выполнением повседневных операций аптеки. Специальное испытание с регламентированным открыванием дверей не проводится, если иное не указано в протоколе.

В течение всего периода исследования:
— регистраторы данных не перемещаются и не извлекаются из помещения;
— условия эксплуатации помещения поддерживаются в штатном режиме;
— длительные или нештатные открытия дверей, отключение электропитания, ремонтные работы и иные события, способные повлиять на температурный режим, фиксируются с указанием даты, времени, продолжительности и причины.

По завершении периода исследования данные регистраторов извлекаются. Выполняется повторная сверка серийных номеров регистраторов данных и мест их размещения с утверждённой схемой и таблицей размещения.`,
  "6.10": `После извлечения регистраторов данных:
— данные считываются с каждого регистратора с использованием специализированного программного обеспечения;
— данные экспортируются в формат CSV / XLSX для последующей обработки;
— проверяется полнота данных (отсутствие пропусков, соответствие периоду исследования);
— данные объединяются в единую таблицу для анализа;
— исходные файлы данных сохраняются в архиве в соответствии с утверждённым порядком документооборота.
Обработка и анализ данных проводятся в соответствии с разделом PQ/PV настоящего протокола.`,
};

// Legacy storage variants keep their broader wording until their dedicated
// templates are revised. The selected `warehouse` type uses DEFAULT_SECTIONS.
const GENERIC_DEFAULT_SECTIONS: Record<string, string> = {
  ...DEFAULT_SECTIONS,
  "1.1": `ЕАЭС — Евразийский экономический союз
ЕЭК — Евразийская экономическая комиссия
ЛС — лекарственные средства
GDP (Good Distribution Practice) — Правила надлежащей дистрибьюторской практики
GPP (Good Pharmacy Practice) — Правила надлежащей аптечной практики
GMP (Good Manufacturing Practice) — Правила надлежащей производственной практики
СОП — стандартная операционная процедура
IQ (Installation Qualification) — квалификация монтажа
OQ (Operational Qualification) — квалификация функционирования
PQ/PV (Performance Qualification / Process Validation) — эксплуатационная квалификация / валидация
Т — температура
MKT (Mean Kinetic Temperature) — среднекинетическая температура`,
  "1.2": `Температурное картирование — систематическое измерение и документирование температурного распределения внутри помещения или зоны хранения с целью выявления «горячих» и «холодных» точек, оценки однородности температурного поля и определения оптимальных мест размещения датчиков системы мониторинга.

Регистратор данных (логгер) — автономное устройство, непрерывно фиксирующее значения температуры (и, при необходимости, относительной влажности) с заданным интервалом и сохраняющее результаты во внутренней памяти.

Критерий приемлемости — заранее установленный предел, с которым сравниваются результаты измерений для принятия решения о соответствии / несоответствии.

Зона хранения — выделенная часть склада или помещения, предназначенная для хранения лекарственных средств в определённых температурных условиях.`,
  "2.1": `Объект картирования: помещение (зона) хранения лекарственных средств.
Адрес: [указать адрес объекта]
Назначение: хранение лекарственных средств в условиях контролируемой температурной среды.`,
  "2.2.1": `Настоящее температурное картирование проводится в соответствии с:
• Рекомендацией Коллегии ЕЭК от 20.04.2026 № 8 «О Руководстве по проведению температурного картирования зон хранения лекарственных средств»;
• Требованиями GDP/GPP/GMP в части обеспечения условий хранения лекарственных средств;
• Внутренними стандартными операционными процедурами организации.`,
  "3": `Настоящий протокол распространяется на помещение (зону) хранения лекарственных средств, указанное в разделе 2.1. Результаты картирования применяются для:
• подтверждения соответствия температурных условий установленным требованиям;
• определения мест размещения датчиков системы мониторинга;
• разработки рекомендаций по безопасному хранению лекарственных средств.`,
  "4": `Цели температурного картирования:
а) подтверждение того, что температурные условия в помещении хранения соответствуют установленным требованиям на протяжении всего периода исследования;
б) выявление «горячих» и «холодных» точек, а также зон с нестабильным температурным режимом;
в) документальная фиксация зарегистрированных колебаний температуры;
г) составление рекомендаций по организации безопасного хранения лекарственных средств;
д) определение (уточнение) мест размещения датчиков мониторинга температуры.`,
  "6.5": `Количество и расположение точек размещения регистраторов определено в соответствии с п. 16д Рекомендации ЕЭК № 8 с учётом объёма помещения. Расчёт приведён в разделе «Общие сведения».`,
  "6.8": `Регистраторы размещены в соответствии со схемой (Приложение № 1). Размещение выполнено до начала периода регистрации. Персонал, работающий в зоне хранения, информируется о проведении температурного картирования во избежание случайного нарушения работы, отключения, утраты регистраторов данных или собранных данных.`,
  "6.9": `Температурное картирование проводится в условиях штатной эксплуатации помещения хранения. В период исследования двери/ворота открываются в обычном рабочем режиме, связанном с движением персонала, приемкой, размещением, комплектованием и отпуском продукции. Специальное испытание с регламентированным открыванием дверей/ворот не проводится, если иное не указано в протоколе.

В течение всего периода исследования:
— регистраторы данных не перемещаются и не извлекаются из зоны хранения;
— условия эксплуатации зоны хранения поддерживаются в штатном режиме;
— длительные или нештатные открытия дверей/ворот, отключение электропитания, ремонтные работы и иные события, способные повлиять на температурный режим, фиксируются с указанием даты, времени, продолжительности и причины.

По завершении периода исследования данные регистраторов извлекаются. Выполняется повторная сверка серийных номеров регистраторов данных и мест их размещения с утверждённой схемой и таблицей размещения.`,
  "6.10": `После извлечения регистраторов данных:
— данные считываются с каждого регистратора с использованием специализированного программного обеспечения;
— данные экспортируются в формат CSV / XLSX для последующей обработки;
— проверяется полнота данных (отсутствие пропусков, соответствие периоду исследования);
— данные объединяются в единую таблицу для анализа;
— исходные файлы данных сохраняются в архиве в соответствии с требованиями к документообороту GxP.
Обработка и анализ данных проводятся в соответствии с разделом PQ/PV настоящего протокола.`,
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
      { key: "6.13", title: "6.13. План PQ/PV — Эксплуатационная квалификация / валидация", isPQ: true } as any,
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
  return `Ответственные за проведение температурного картирования:\n${lines.join("\n")}\n\nОтветственные лица обладают необходимой подготовкой для выполнения работ по температурному картированию, программированию регистраторов данных, считыванию и анализу данных.`;
}

function normalizePharmacySectionText(text: string): string {
  return text
    .split("\n")
    .filter(line => !/\bGDP\b|\bGPP\b|\bGMP\b|склад|дистрибьютор|производственн/i.test(line))
    .join("\n")
    .replace(/помещение\/зона хранения/gi, "помещение (зона) хранения аптеки")
    .replace(/(?<!\()зоны хранения/gi, "помещения (зоны) хранения аптеки")
    .replace(/(?<!\()зона хранения/gi, "помещение (зона) хранения аптеки")
    .replace(/приемкой, размещением, комплектованием и отпуском продукции/gi, "движением персонала и выполнением повседневных операций аптеки")
    .replace(/GxP/gi, "утверждённым порядком документооборота");
}

function pharmacyAutoSectionText(key: string, generalInfo: any): string | null {
  const value = (input: unknown, fallback = "—") => {
    const text = String(input ?? "").trim();
    return text || fallback;
  };
  if (key === "2.1") {
    const location = value(generalInfo?.location);
    const purpose = value(generalInfo?.purpose, "Хранение лекарственных средств");
    const tempMode = value(generalInfo?.tempMode);
    return `Объект картирования: помещение (зона) хранения аптеки.
Адрес: ${location}
Назначение: ${purpose}${tempMode !== "—" ? `
Температурный режим: ${tempMode}.` : "."}`;
  }
  if (key === "2.2.2") {
    const type = generalInfo?.qualificationType || generalInfo?.basis;
    const label = type === "primary" ? "Первичное" : "Повторное";
    return `Конкретные основания для проведения данного исследования:
• ${label} картирование.`;
  }
  return null;
}

function isPharmacyStorageType(type: string | null | undefined): boolean {
  return type === "warehouse" || type === WAREHOUSE_EXPERT_EQUIPMENT_TYPE;
}

function isDefaultPharmacySection(key: string, value: string): boolean {
  const text = value.trim();
  if (key === "2.1") return !text || text.startsWith("Настоящий протокол описывает") || text.startsWith("Объект картирования:") || text.includes("[указать адрес");
  if (key === "2.2.1") return !text || text.startsWith("Настоящее температурное картирование проводится") || /\bGDP\b|\bGPP\b|\bGMP\b|склад/i.test(text);
  if (key === "2.2.2") return !text || text.startsWith("Проведение настоящего исследования обусловлено") || text.startsWith("Конкретные основания для проведения данного исследования:");
  if (key === "3") return !text || text.startsWith("Настоящий протокол распространяется");
  if (key === "4") return !text || text.startsWith("Цели температурного картирования");
  return false;
}

export default function WarehouseProtocolStep({ protocolId, onDone, onBack }: Props) {
  const utils = trpc.useUtils();
  const { data: savedSections, isLoading } = trpc.warehouseSections.get.useQuery({ protocolId });
  const { data: giData } = trpc.generalInfo.get.useQuery({ protocolId });
  const saveMut = trpc.warehouseSections.save.useMutation({
    onSuccess: () => utils.warehouseSections.get.invalidate({ protocolId }),
  });

  const isPharmacyStorage = isPharmacyStorageType(giData?.equipmentType);
  const defaultSections = isPharmacyStorage ? DEFAULT_SECTIONS : GENERIC_DEFAULT_SECTIONS;
  // Local editable state — initialised from DB or defaults
  const [sections, setSections] = useState<Record<string, string>>(DEFAULT_SECTIONS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!savedSections && !giData) return;
    const commission: { name: string; role: string; company?: string | null }[] =
      Array.isArray((giData as any)?.commissionMembers) ? (giData as any).commissionMembers : [];
    // Merge: DB values override defaults; missing keys keep default
    const merged: Record<string, string> = { ...defaultSections };
    for (const [k, v] of Object.entries(savedSections ?? {})) {
      if (v !== undefined && v !== null) {
        merged[k] = isPharmacyStorage
          ? normalizePharmacySectionText(v as string)
          : v as string;
      }
    }
    if (isPharmacyStorage) {
      for (const key of ["2.1", "2.2.2"]) {
        const autoText = pharmacyAutoSectionText(key, giData);
        if (autoText) merged[key] = autoText;
      }
      for (const key of ["2.2.1", "3", "4"]) {
        merged[key] = defaultSections[key] ?? merged[key];
      }
    }
    // Auto-fill 6.2 from commission if it still has the default placeholder text
    const isDefault62 =
      !merged["6.2"] ||
      merged["6.2"] === defaultSections["6.2"] ||
      merged["6.2"].includes("[ФИО, должность]");
    if (isDefault62 && commission.length > 0) {
      merged["6.2"] = buildSection62(commission);
    }
    setSections(merged);
    setDirty(false);
  }, [savedSections, giData, defaultSections]);

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
                Этот раздел формируется автоматически на основании данных, введённых на шагах IQ, OQ и PQ/PV визарда.
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
              Текст по умолчанию заполнен согласно Рекомендации ЕЭК №8. Вы можете отредактировать его под конкретный объект.
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
            Разделы 1–7 по Рекомендации ЕЭК №8. Тексты заполнены по умолчанию — отредактируйте под конкретный объект или оставьте как есть.
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
          <p>{isPharmacyStorage ? PHARMACY_STORAGE_MAPPING_METHOD_NOTE : WAREHOUSE_MAPPING_METHOD_NOTE}</p>
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
