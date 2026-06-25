import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  Snowflake,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  general_info_done: "Общие сведения",
  iq_done: "IQ пройден",
  oq_done: "OQ пройден",
  pv_done: "PV пройден",
  completed: "Завершён",
};

type ProtocolRow = {
  id: number;
  number: string;
  status: string;
  organizationName: string | null;
  userName?: string | null;
  userEmail?: string | null;
  createdAt: string | Date;
  iqVerdict: string | null;
  oqVerdict: string | null;
  pvVerdict: string | null;
};

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Single, stable queries — never call hooks inside a loop.
  const orgsQ = trpc.organizations.list.useQuery();
  const protocolsQ = trpc.protocols.listAll.useQuery();

  const orgs = orgsQ.data ?? [];
  const protocols = (protocolsQ.data ?? []) as ProtocolRow[];

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b bg-[radial-gradient(ellipse_at_top_right,_oklch(0.95_0.04_256)_0%,_transparent_60%)]">
        <div className="max-w-7xl mx-auto px-8 py-10">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Snowflake className="h-3 w-3" />
                ColdChain Validation Portal
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Добрый день{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                Формируйте протоколы квалификации и валидации (IQ · OQ · PV) холодильного
                оборудования в соответствии с GDP / GSP — от ввода данных и загрузки показаний
                логгеров до выпуска итогового PDF-протокола.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="bg-background"
                onClick={() => setLocation("/organizations")}
              >
                <Building2 className="h-4 w-4" /> Организации
              </Button>
              <Button onClick={() => setLocation("/protocols?new=1")}>
                <FilePlus2 className="h-4 w-4" /> Создать протокол
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        <StatsRow orgCount={orgs.length} protocols={protocols} />

        {/* Recent protocols per org */}
        <div className="grid lg:grid-cols-2 gap-6">
          <RecentProtocols
            protocols={protocols}
            onOpen={id => setLocation(`/protocols/${id}`)}
          />
          <OrgsMini orgs={orgs} onOpen={id => setLocation(`/organizations/${id}`)} />
        </div>

        <WorkflowGuide />
      </div>
    </div>
  );
}

function StatsRow({
  orgCount,
  protocols,
}: {
  orgCount: number;
  protocols: ProtocolRow[];
}) {
  const { completed, inProgress, issues } = useMemo(() => {
    let c = 0;
    let ip = 0;
    let is = 0;
    for (const p of protocols) {
      if (p.status === "completed") c++;
      else ip++;
      if (p.iqVerdict === "fail" || p.oqVerdict === "fail" || p.pvVerdict === "fail") is++;
    }
    return { completed: c, inProgress: ip, issues: is };
  }, [protocols]);

  const stats = [
    {
      icon: Building2,
      label: "Организаций",
      value: orgCount,
      tone: "text-primary bg-primary/10",
    },
    {
      icon: ClipboardList,
      label: "Всего протоколов",
      value: protocols.length,
      tone: "text-slate-700 bg-slate-100",
    },
    {
      icon: CheckCircle2,
      label: "Завершено",
      value: completed,
      tone: "text-emerald-700 bg-emerald-50",
    },
    {
      icon: Clock,
      label: "В работе",
      value: inProgress,
      tone: "text-amber-700 bg-amber-50",
    },
    {
      icon: AlertTriangle,
      label: "С замечаниями",
      value: issues,
      tone: "text-rose-700 bg-rose-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map(s => (
        <Card key={s.label} className="border shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.tone}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold tracking-tight num">{s.value}</div>
              <div className="text-xs text-muted-foreground truncate">{s.label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentProtocols({
  protocols,
  onOpen,
}: {
  protocols: ProtocolRow[];
  onOpen: (id: number) => void;
}) {
  const rows = useMemo(() => {
    return protocols
      .slice()
      .sort((a, b) => {
        const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt ?? 0);
        const at = a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt ?? 0);
        return bt - at;
      })
      .slice(0, 6);
  }, [protocols]);

  return (
    <Card className="border">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Последние протоколы</h3>
            <p className="text-xs text-muted-foreground">
              Шесть самых свежих работ из всех организаций
            </p>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Пока нет ни одного протокола. Перейдите в раздел «Протоколы», чтобы создать первый.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map(r => (
              <li
                key={r.id}
                onClick={() => onOpen(r.id)}
                className="flex items-center justify-between px-5 py-3 hover:bg-accent/40 cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm num tracking-tight">{r.number}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.organizationName ?? "—"}
                    {r.userName || r.userEmail ? " - " + (r.userName || r.userEmail) : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OrgsMini({
  orgs,
  onOpen,
}: {
  orgs: Array<{ id: number; name: string; bin: string | null }>;
  onOpen: (id: number) => void;
}) {
  return (
    <Card className="border">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Организации</h3>
            <p className="text-xs text-muted-foreground">Мои юридические лица</p>
          </div>
        </div>
        {orgs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Добавьте первую организацию, чтобы начать.
          </div>
        ) : (
          <ul className="divide-y">
            {orgs.slice(0, 6).map(o => (
              <li
                key={o.id}
                onClick={() => onOpen(o.id)}
                className="flex items-center justify-between px-5 py-3 hover:bg-accent/40 cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm tracking-tight truncate">{o.name}</div>
                  <div className="text-xs text-muted-foreground truncate num">
                    БИН/ИНН: {o.bin || "—"}
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function WorkflowGuide() {
  const steps = [
    {
      n: 1,
      title: "Организация",
      body: "Заполните реквизиты, загрузите логотип — они попадут на титул и в подвал PDF.",
    },
    {
      n: 2,
      title: "Общие сведения",
      body: "Данные об оборудовании: модель, серийный номер, режим хранения, место установки.",
    },
    {
      n: 3,
      title: "IQ · OQ",
      body: "Пройдите опросники — несоответствия автоматически попадут в заключение.",
    },
    {
      n: 4,
      title: "PV",
      body: "Загрузите файлы логгеров (CSV/XLSX) — портал рассчитает MKT, отклонения, критические точки.",
    },
    {
      n: 5,
      title: "PDF-протокол",
      body: "Один PDF: титул, IQ, OQ, PV, графики, тепловая карта, заключение, подписи.",
    },
  ];
  return (
    <Card className="border bg-gradient-to-br from-background to-accent/30">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Как устроен процесс</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Пять шагов от ввода данных до выпуска регуляторного PDF-протокола.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-5 gap-4">
          {steps.map(s => (
            <div key={s.n} className="space-y-2">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm num">
                {s.n}
              </div>
              <div className="text-sm font-medium tracking-tight">{s.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
