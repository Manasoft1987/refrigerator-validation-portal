import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Download,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Play,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-slate-100 text-slate-700" },
  general_info_done: { label: "Общие сведения", cls: "bg-sky-50 text-sky-700" },
  iq_done: { label: "IQ пройден", cls: "bg-indigo-50 text-indigo-700" },
  oq_done: { label: "OQ пройден", cls: "bg-violet-50 text-violet-700" },
  pv_done: { label: "PV выполнен", cls: "bg-amber-50 text-amber-700" },
  completed: { label: "Завершён", cls: "bg-emerald-50 text-emerald-700" },
};

export default function OrganizationDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const orgQ = trpc.organizations.get.useQuery({ id }, { enabled: !isNaN(id) });
  const protoQ = trpc.protocols.listForOrg.useQuery(
    { organizationId: id },
    { enabled: !isNaN(id) },
  );

  const [form, setForm] = useState<any | null>(null);
  useEffect(() => {
    if (orgQ.data) setForm(orgQ.data);
  }, [orgQ.data]);

  const update = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.get.invalidate({ id });
      utils.organizations.list.invalidate();
      toast.success("Изменения сохранены");
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      toast.success("Организация удалена");
      setLocation("/organizations");
    },
    onError: e => toast.error(e.message),
  });
  const createProtocol = trpc.protocols.create.useMutation({
    onSuccess: row => {
      utils.protocols.listForOrg.invalidate({ organizationId: id });
      toast.success(`Создан протокол ${row.number}`);
      setLocation(`/protocols/${row.id}`);
    },
    onError: e => toast.error(e.message),
  });
  const delProtocol = trpc.protocols.delete.useMutation({
    onSuccess: () => {
      utils.protocols.listForOrg.invalidate({ organizationId: id });
      toast.success("Протокол удалён");
    },
    onError: e => toast.error(e.message),
  });
  const generateReport = trpc.report.generate.useMutation();

  const [confirmOrgDelete, setConfirmOrgDelete] = useState(false);
  const [pendingDeleteProtocol, setPendingDeleteProtocol] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadLogo = trpc.organizations.uploadLogo.useMutation({
    onSuccess: () => {
      utils.organizations.get.invalidate({ id });
      toast.success("Логотип обновлён");
    },
    onError: e => toast.error(e.message),
  });

  const handleLogo = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Логотип не должен превышать 3 МБ");
      return;
    }
    const b64 = await fileToBase64(file);
    uploadLogo.mutate({
      id,
      fileName: file.name,
      contentType: file.type || "image/png",
      base64: b64,
    });
  };

  const handleDownload = async (protocolId: number) => {
    setDownloadingId(protocolId);
    try {
      const res = await generateReport.mutateAsync({ protocolId });
      window.open(res.url, "_blank");
      toast.success("PDF-протокол сформирован");
    } catch (e: any) {
      toast.error(e.message || "Не удалось сформировать PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  if (orgQ.isLoading || !form) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="h-8 w-40 rounded bg-muted animate-pulse mb-4" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }
  if (!orgQ.data) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-10">
        <p className="text-muted-foreground">Организация не найдена.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/organizations")}>
          <ArrowLeft className="h-4 w-4" /> К списку
        </Button>
      </div>
    );
  }

  const protocols = protoQ.data || [];

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-8">
      <button
        onClick={() => setLocation("/organizations")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> К списку организаций
      </button>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Form */}
        <Card className="border">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Реквизиты организации</h2>
                <p className="text-sm text-muted-foreground">
                  Эти данные попадают на титул и в подвал PDF-протокола.
                </p>
              </div>
              <Button
                variant="outline"
                className="bg-background text-destructive hover:text-destructive"
                onClick={() => setConfirmOrgDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Удалить
              </Button>
            </div>

            <div className="grid gap-4">
              <Field label="Название">
                <Input
                  value={form.name || ""}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="БИН / ИНН">
                  <Input
                    value={form.bin || ""}
                    onChange={e => setForm({ ...form, bin: e.target.value })}
                  />
                </Field>
                <Field label="Ответственное лицо">
                  <Input
                    value={form.responsible || ""}
                    onChange={e => setForm({ ...form, responsible: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Адрес">
                <Input
                  value={form.addressFact || ""}
                  onChange={e => setForm({ ...form, addressFact: e.target.value })}
                />
              </Field>
              <Field label="Телефон">
                <Input
                  value={form.phone || ""}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                disabled={update.isPending || !form.name?.trim()}
                onClick={() =>
                  update.mutate({
                    id,
                    name: form.name,
                    bin: form.bin,
                    addressFact: form.addressFact,
                    responsible: form.responsible,
                    phone: form.phone,
                  })
                }
              >
                <Save className="h-4 w-4" /> Сохранить
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logo & actions */}
        <div className="space-y-4">
          <Card className="border">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold tracking-tight">Логотип</h3>
                <p className="text-xs text-muted-foreground">
                  PNG / JPG. Попадает на обложку PDF.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl border flex items-center justify-center bg-accent/30 overflow-hidden shrink-0">
                  {orgQ.data.logoUrl ? (
                    <img
                      src={orgQ.data.logoUrl}
                      alt="logo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <input
                    type="file"
                    ref={fileRef}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleLogo(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    className="bg-background"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadLogo.isPending}
                  >
                    {uploadLogo.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    Загрузить логотип
                  </Button>
                  <p className="text-[11px] text-muted-foreground">Не более 3 МБ</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold tracking-tight">Быстрое действие</h3>
              <p className="text-sm text-muted-foreground">
                Создать новый протокол валидации для этой организации.
              </p>
              <Button
                className="w-full"
                onClick={() => createProtocol.mutate({ organizationId: id })}
                disabled={createProtocol.isPending}
              >
                <FilePlus2 className="h-4 w-4" /> Новый протокол
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Protocol list */}
      <Card className="border">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h3 className="font-semibold tracking-tight">Протоколы</h3>
              <p className="text-xs text-muted-foreground">
                Все протоколы валидации для этой организации
              </p>
            </div>
            <Button onClick={() => createProtocol.mutate({ organizationId: id })}>
              <FilePlus2 className="h-4 w-4" /> Создать
            </Button>
          </div>
          {protocols.length === 0 ? (
            <div className="p-12 text-center">
              <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h3 className="mt-3 font-semibold tracking-tight">Пока нет протоколов</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Создайте первый протокол — он пройдёт 5 шагов: общие сведения, IQ, OQ, PV и
                финальный отчёт.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-6 py-3 font-medium">№ протокола</th>
                    <th className="text-left px-4 py-3 font-medium">Статус</th>
                    <th className="text-left px-4 py-3 font-medium">Создан</th>
                    <th className="text-right px-6 py-3 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {protocols.map(p => {
                    const meta = STATUS_META[p.status] || STATUS_META.draft;
                    return (
                      <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-6 py-3 num font-medium tracking-tight">{p.number}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-background"
                              onClick={() => setLocation(`/protocols/${p.id}`)}
                            >
                              <Play className="h-3.5 w-3.5" /> Продолжить
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-background"
                              disabled={downloadingId === p.id}
                              onClick={() => handleDownload(p.id)}
                            >
                              {downloadingId === p.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-background text-destructive hover:text-destructive"
                              onClick={() => setPendingDeleteProtocol(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOrgDelete} onOpenChange={setConfirmOrgDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить организацию?</AlertDialogTitle>
            <AlertDialogDescription>
              Все связанные протоколы, результаты IQ/OQ и загруженные данные логгеров будут
              удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate({ id })}
              className="bg-destructive hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteProtocol !== null}
        onOpenChange={o => !o && setPendingDeleteProtocol(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить протокол?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Все данные IQ / OQ / PV будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteProtocol != null) delProtocol.mutate({ id: pendingDeleteProtocol });
                setPendingDeleteProtocol(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
