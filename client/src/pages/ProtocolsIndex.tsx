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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ClipboardList,
  Copy,
  Download,
  FilePlus2,
  Loader2,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-slate-100 text-slate-700" },
  general_info_done: { label: "Общие сведения", cls: "bg-sky-50 text-sky-700" },
  iq_done: { label: "IQ пройден", cls: "bg-indigo-50 text-indigo-700" },
  oq_done: { label: "OQ пройден", cls: "bg-violet-50 text-violet-700" },
  pv_done: { label: "PV выполнен", cls: "bg-amber-50 text-amber-700" },
  completed: { label: "Завершён", cls: "bg-emerald-50 text-emerald-700" },
};

export default function ProtocolsIndex() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>("all");
  const [orgF, setOrgF] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createEquipmentType, setCreateEquipmentType] = useState<"refrigerator" | "auto-refrigerator" | "warehouse" | "other" | null>(null);
  const [createCustomName, setCreateCustomName] = useState("");
  const [createOrg, setCreateOrg] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [cloneOpen, setCloneOpen] = useState<number | null>(null);
  const [cloneOrg, setCloneOrg] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const orgsQ = trpc.organizations.list.useQuery();
  const allQ = trpc.protocols.listAll.useQuery();

  const protocols = allQ.data || [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return protocols.filter(p => {
      if (statusF !== "all" && p.status !== statusF) return false;
      if (orgF !== "all" && String(p.organizationId) !== orgF) return false;
      if (!needle) return true;
      return (
        p.number.toLowerCase().includes(needle) ||
        (p.organizationName || "").toLowerCase().includes(needle) ||
        (p.equipmentModel || "").toLowerCase().includes(needle) ||
        (p.serialNumber || "").toLowerCase().includes(needle)
      );
    });
  }, [protocols, q, statusF, orgF]);

  const create = trpc.protocols.create.useMutation({
    onSuccess: row => {
      utils.protocols.listAll.invalidate();
      utils.protocols.listForOrg.invalidate();
      toast.success(`Создан протокол ${row.number}`);
      setCreateOpen(false);
      setLocation(`/protocols/${row.id}`);
    },
    onError: e => toast.error(e.message),
  });
  const handleCreateProtocol = () => {
    if (!createOrg || !createEquipmentType) return;
    create.mutate({
      organizationId: createOrg,
      equipmentType: createEquipmentType,
      customEquipmentName: createEquipmentType === "other" ? createCustomName : undefined,
    });
  };
  const handleOpenCreate = () => {
    setCreateStep(1);
    setCreateEquipmentType(null);
    setCreateCustomName("");
    setCreateOrg(null);
    setCreateOpen(true);
  };
  const del = trpc.protocols.delete.useMutation({
    onSuccess: () => {
      utils.protocols.listAll.invalidate();
      utils.protocols.listForOrg.invalidate();
      toast.success("Протокол удалён");
    },
    onError: e => toast.error(e.message),
  });
  const clone = trpc.protocols.clone.useMutation({
    onSuccess: row => {
      utils.protocols.listAll.invalidate();
      utils.protocols.listForOrg.invalidate();
      toast.success(`Протокол клонирован: ${row.number}`);
      setCloneOpen(null);
      setCloneOrg(null);
      setLocation(`/protocols/${row.id}`);
    },
    onError: e => toast.error(e.message),
  });
  const genReport = trpc.report.generate.useMutation();

  const handleDownload = async (id: number) => {
    setDownloadingId(id);
    try {
      const res = await genReport.mutateAsync({ protocolId: id });
      window.open(new URL(res.url, window.location.origin).href, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message || "Не удалось сформировать PDF");
    } finally {
      setDownloadingId(null);
    }
  };
  const handleClone = (sourceId: number) => {
    const sourceProto = protocols.find(p => p.id === sourceId);
    if (sourceProto) {
      setCloneOpen(sourceId);
      setCloneOrg(sourceProto.organizationId);
    }
  };
  const handleConfirmClone = () => {
    if (!cloneOpen || !cloneOrg) return;
    clone.mutate({ sourceProtocolId: cloneOpen, organizationId: cloneOrg });
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Протоколы</h1>
          <p className="text-muted-foreground mt-1">
            Все протоколы квалификации и валидации по всем организациям.
          </p>
        </div>
        <Button onClick={() => handleOpenCreate()}>
          <FilePlus2 className="h-4 w-4" /> Новый протокол
        </Button>
      </div>

      <Card className="border">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Поиск по номеру, модели, серийному номеру"
              className="pl-9"
            />
          </div>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(STATUS_META).map(([v, m]) => (
                <SelectItem key={v} value={v}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orgF} onValueChange={setOrgF}>
            <SelectTrigger className="w-[240px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все организации</SelectItem>
              {(orgsQ.data || []).map(o => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {allQ.isLoading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="p-16 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Протоколов не найдено</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {protocols.length === 0
                ? "Создайте первый протокол — для этого понадобится хотя бы одна организация."
                : "Попробуйте изменить фильтры или поисковый запрос."}
            </p>
            {protocols.length === 0 && (
              <Button onClick={() => handleOpenCreate()} className="mt-2">
                <FilePlus2 className="h-4 w-4" /> Новый протокол
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-6 py-3 font-medium">Номер</th>
                  <th className="text-left px-4 py-3 font-medium">Организация</th>
                  <th className="text-left px-4 py-3 font-medium">Оборудование</th>
                  <th className="text-left px-4 py-3 font-medium">Статус</th>
                  <th className="text-left px-4 py-3 font-medium">Создан</th>
                  <th className="text-right px-6 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(p => {
                  const meta = STATUS_META[p.status] || STATUS_META.draft;
                  return (
                    <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-6 py-3 num font-medium tracking-tight">{p.number}</td>
                      <td className="px-4 py-3 truncate max-w-[220px]">
                        {p.organizationName || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[220px]">
                        {p.equipmentModel || "—"}
                        {p.serialNumber ? (
                          <span className="num"> · {p.serialNumber}</span>
                        ) : null}
                      </td>
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
                            onClick={() => handleClone(p.id)}
                            disabled={clone.isPending}
                          >
                            <Copy className="h-3.5 w-3.5" /> Клонировать
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
                            )}{" "}
                            PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-background text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(p.id)}
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
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый протокол</DialogTitle>
            <DialogDescription>
              {createStep === 1
                ? "Шаг 1 из 2 — Выберите объект валидации"
                : "Шаг 2 из 2 — Выберите организацию"}
            </DialogDescription>
          </DialogHeader>

          {createStep === 1 && (
            <div className="py-2 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {([
                  { id: "refrigerator", label: "Холодильник", icon: "🧊", desc: "Фармацевтический холодильник / камера хранения" },
                  { id: "auto-refrigerator", label: "Авторефрижератор", icon: "🚛", desc: "Транспортный рефрижератор / термоконтейнер" },
                  { id: "warehouse", label: "Помещение / зона хранения", icon: "🏢", desc: "Склад, холодильная камера, зона приёмки/экспедиции (ЕАЭК №8)" },
                  { id: "other", label: "Другое", icon: "📦", desc: "Иное оборудование" },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCreateEquipmentType(opt.id)}
                    className={`flex items-center gap-4 rounded-lg border-2 p-4 text-left transition-all ${
                      createEquipmentType === opt.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-3xl">{opt.icon}</span>
                    <div>
                      <div className="font-semibold">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {createEquipmentType === "other" && (
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Название объекта
                  </Label>
                  <Input
                    placeholder="Например: Морозильная камера"
                    value={createCustomName}
                    onChange={e => setCreateCustomName(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {createStep === 2 && (
            <div className="py-2 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Организация
              </Label>
              <Select
                value={createOrg ? String(createOrg) : undefined}
                onValueChange={v => setCreateOrg(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите организацию" />
                </SelectTrigger>
                <SelectContent>
                  {(orgsQ.data || []).map(o => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(orgsQ.data || []).length === 0 && (
                <p className="text-xs text-destructive">
                  Сначала создайте хотя бы одну организацию.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              if (createStep === 2) setCreateStep(1);
              else setCreateOpen(false);
            }}>
              {createStep === 2 ? "Назад" : "Отмена"}
            </Button>
            {createStep === 1 ? (
              <Button
                disabled={!createEquipmentType || (createEquipmentType === "other" && !createCustomName.trim())}
                onClick={() => setCreateStep(2)}
              >
                Далее
              </Button>
            ) : (
              <Button
                disabled={!createOrg || create.isPending}
                onClick={handleCreateProtocol}
              >
                Создать
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={o => !o && setConfirmDelete(null)}
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
                if (confirmDelete != null) del.mutate({ id: confirmDelete });
                setConfirmDelete(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={cloneOpen !== null}
        onOpenChange={o => !o && (setCloneOpen(null), setCloneOrg(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Клонирование протокола</DialogTitle>
            <DialogDescription>
              Новый протокол будет содержать те же данные об оборудовании и организации, но без результатов тестов и датчиков.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Организация</Label>
              <Select value={String(cloneOrg || "")} onValueChange={v => setCloneOrg(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orgsQ.data?.map(org => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => (setCloneOpen(null), setCloneOrg(null))}>
              Отмена
            </Button>
            <Button onClick={handleConfirmClone} disabled={clone.isPending || !cloneOrg}>
              {clone.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Клонирование...
                </>
              ) : (
                "Клонировать"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
