import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Check,
  ClipboardList,
  Copy,
  Loader2,
  MailPlus,
  Trash2,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Ожидает", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Одобрен", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Отклонён", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function AdminCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const companyId = Number(id);
  const [, setLocation] = useLocation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; name: string | null; password: string } | null>(null);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const companyQ = trpc.companies.get.useQuery({ id: companyId });
  const membersQ = trpc.companies.listMembers.useQuery({ companyId });
  const protocolsQ = trpc.companies.protocolsByCompany.useQuery({ companyId });

  const company = companyQ.data;
  const members = membersQ.data || [];
  const protocols = protocolsQ.data || [];

  const inviteMutation = trpc.companies.inviteByEmail.useMutation({
    onSuccess: data => {
      utils.companies.listMembers.invalidate({ companyId });
      utils.companies.allMembers.invalidate();
      toast.success('Пользователь добавлен');
      setCreatedCredentials({ email: data.email, name: data.name ?? null, password: data.password });
      setEmail('');
      setName('');
      setPassword('');
    },
    onError: e => toast.error(e.message),
  });

  const approveMutation = trpc.companies.approveMember.useMutation({
    onSuccess: () => {
      utils.companies.listMembers.invalidate({ companyId });
      toast.success("Пользователь одобрен");
    },
    onError: e => toast.error(e.message),
  });

  const rejectMutation = trpc.companies.rejectMember.useMutation({
    onSuccess: () => {
      utils.companies.listMembers.invalidate({ companyId });
      toast.success("Пользователь отклонён");
    },
    onError: e => toast.error(e.message),
  });

  const removeMutation = trpc.companies.removeMember.useMutation({
    onSuccess: () => {
      utils.companies.listMembers.invalidate({ companyId });
      toast.success("Пользователь удалён из компании");
      setRemoveId(null);
    },
    onError: e => toast.error(e.message),
  });

  if (companyQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-10">
        <p className="text-muted-foreground">Компания не найдена.</p>
      </div>
    );
  }

  const pending = members.filter(m => m.status === "pending");
  const approved = members.filter(m => m.status === "approved");
  const rejected = members.filter(m => m.status === "rejected");

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/companies")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
              <p className="text-sm text-muted-foreground">
                Создана {new Date(company.createdAt).toLocaleDateString("ru-RU")}
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <MailPlus className="h-4 w-4" /> Пригласить пользователя
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{approved.length}</p>
              <p className="text-xs text-muted-foreground">Активных</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{pending.length}</p>
              <p className="text-xs text-muted-foreground">Ожидают одобрения</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{protocols.length}</p>
              <p className="text-xs text-muted-foreground">Протоколов</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-amber-800">
              Ожидают одобрения ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-amber-100">
                <div>
                  <p className="font-medium text-sm">{m.user?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{m.user?.email || "—"}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => approveMutation.mutate({ memberId: m.id })}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="h-3.5 w-3.5" /> Одобрить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => rejectMutation.mutate({ memberId: m.id })}
                    disabled={rejectMutation.isPending}
                  >
                    <UserX className="h-3.5 w-3.5" /> Отклонить
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Members table */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Пользователи компании</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Нет пользователей. Пригласите первого.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Пользователь</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Приглашён</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-3 font-medium">{m.user?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.user?.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_LABEL[m.status]?.cls || ""}`}>
                        {STATUS_LABEL[m.status]?.label || m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(m.invitedAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {m.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600"
                              onClick={() => approveMutation.mutate({ memberId: m.id })}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500"
                              onClick={() => rejectMutation.mutate({ memberId: m.id })}>
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setRemoveId(m.id)}>
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Protocols */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Протоколы компании ({protocols.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {protocols.length === 0 ? (
            <div className="py-10 text-center">
              <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Протоколов пока нет.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Номер</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Создан</th>
                </tr>
              </thead>
              <tbody>
                {protocols.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-3 font-medium">{p.number}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.status}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={open => {
          setInviteOpen(open);
          if (!open) {
            setCreatedCredentials(null);
            setEmail('');
            setName('');
            setPassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить пользователя</DialogTitle>
            <DialogDescription>
              Укажите ФИО и email. Пароль можно оставить пустым: портал создаст временный пароль и сразу добавит доступ к компании.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <Label htmlFor='invite-name'>ФИО</Label>
              <Input
                id='invite-name'
                placeholder='Сафиуллин А.В.'
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='invite-email'>Email пользователя</Label>
              <Input
                id='invite-email'
                type='email'
                placeholder='user@gxp.kz'
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && email.trim()) {
                    inviteMutation.mutate({
                      companyId,
                      email: email.trim(),
                      name: name.trim() || undefined,
                      password: password.trim() || undefined,
                    });
                  }
                }}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='invite-password'>Пароль</Label>
              <Input
                id='invite-password'
                type='text'
                placeholder='Оставьте пустым для временного пароля'
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <p className='text-xs text-muted-foreground'>Минимум 8 символов, если задаёте вручную.</p>
            </div>
            {createdCredentials && (
              <div className='rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm'>
                <p className='font-medium text-emerald-900'>Доступ создан</p>
                <div className='mt-3 space-y-1 text-emerald-950'>
                  <p>Email: <span className='font-mono'>{createdCredentials.email}</span></p>
                  <p>Пароль: <span className='font-mono font-semibold'>{createdCredentials.password}</span></p>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='mt-3 bg-white'
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdCredentials.email + ' / ' + createdCredentials.password);
                    toast.success('Логин и пароль скопированы');
                  }}
                >
                  <Copy className='h-3.5 w-3.5' /> Скопировать
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setInviteOpen(false)}>Закрыть</Button>
            <Button
              disabled={!email.trim() || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate({
                companyId,
                email: email.trim(),
                name: name.trim() || undefined,
                password: password.trim() || undefined,
              })}
            >
              {inviteMutation.isPending && <Loader2 className='h-4 w-4 animate-spin' />}
              Создать доступ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={removeId !== null} onOpenChange={o => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Пользователь потеряет доступ к компании. Его данные останутся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeId !== null && removeMutation.mutate({ memberId: removeId })}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
