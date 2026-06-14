import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Search, Phone, ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Organizations() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(blankForm());
  const utils = trpc.useUtils();

  const { data = [], isLoading } = trpc.organizations.list.useQuery();
  const create = trpc.organizations.create.useMutation({
    onSuccess: (row) => {
      utils.organizations.list.invalidate();
      toast.success(`Организация «${row.name}» создана`);
      setCreateOpen(false);
      setForm(blankForm());
      setLocation(`/organizations/${row.id}`);
    },
    onError: e => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter(
      o =>
        o.name.toLowerCase().includes(needle) ||
        (o.bin || "").toLowerCase().includes(needle) ||
        (o.phone || "").toLowerCase().includes(needle),
    );
  }, [q, data]);

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Организации</h1>
          <p className="text-muted-foreground mt-1">
            Юридические лица, от имени которых выпускаются протоколы.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Поиск по названию или БИН"
              className="pl-9 w-72"
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Новая организация
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-xl border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="p-16 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Пока нет организаций</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Добавьте первую организацию — её реквизиты и логотип будут использоваться в
              протоколах валидации.
            </p>
            <Button className="mt-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Создать первую организацию
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(o => (
            <Card
              key={o.id}
              onClick={() => setLocation(`/organizations/${o.id}`)}
              className="border hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all group"
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
                      {o.logoUrl ? (
                        <img src={o.logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold tracking-tight truncate">{o.name}</div>
                      <div className="text-xs text-muted-foreground num truncate">
                        БИН/ИНН: {o.bin || "—"}
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {o.phone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3 w-3 shrink-0" /> {o.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новая организация</DialogTitle>
            <DialogDescription>
              Заполните реквизиты — их можно будет уточнить позже.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Field label="Название *">
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="ТОО «Фарма-Центр»"
              />
            </Field>
            <Field label="БИН / ИНН">
              <Input
                value={form.bin}
                onChange={e => setForm({ ...form, bin: e.target.value })}
                placeholder="000000000000"
              />
            </Field>
            <Field label="Адрес">
              <Input
                value={form.addressFact}
                onChange={e => setForm({ ...form, addressFact: e.target.value })}
              />
            </Field>
            <Field label="Ответственное лицо">
              <Input
                value={form.responsible}
                onChange={e => setForm({ ...form, responsible: e.target.value })}
              />
            </Field>
            <Field label="Телефон">
              <Input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={!form.name.trim() || create.isPending}
              onClick={() => create.mutate({ ...form })}
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

function blankForm() {
  return {
    name: "",
    bin: "",
    addressFact: "",
    responsible: "",
    phone: "",
  };
}
