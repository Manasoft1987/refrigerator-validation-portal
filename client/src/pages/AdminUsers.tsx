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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: {
    label: "Ожидает",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  approved: {
    label: "Активен",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: { label: "Отклонён", cls: "bg-red-50 text-red-700 border-red-200" },
};

type AdminMemberRow = {
  id: number;
  companyName?: string | null;
  status: string;
  invitedAt: string;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export default function AdminUsers() {
  const [removeId, setRemoveId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const membersQ = trpc.companies.allMembers.useQuery();
  const members = (membersQ.data || []) as AdminMemberRow[];

  const removeMutation = trpc.companies.removeMember.useMutation({
    onSuccess: () => {
      utils.companies.allMembers.invalidate();
      toast.success("Доступ пользователя удалён");
      setRemoveId(null);
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Все пользователи
        </h1>
        <p className="text-muted-foreground mt-1">
          Пользователи, которым открыт доступ к компаниям портала. Новый доступ
          создаётся на странице конкретной компании.
        </p>
      </div>

      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Пользователи ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {membersQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Пользователей пока нет.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    ФИО
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Компания
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Статус
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Добавлен
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => (
                  <tr
                    key={member.id}
                    className={index % 2 === 0 ? "" : "bg-muted/20"}
                  >
                    <td className="px-4 py-3 font-medium">
                      {member.user?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.user?.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.companyName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={STATUS_LABEL[member.status]?.cls || ""}
                      >
                        {STATUS_LABEL[member.status]?.label || member.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(member.invitedAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveId(member.id)}
                        aria-label="Удалить доступ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={removeId !== null}
        onOpenChange={open => !open && setRemoveId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить доступ пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Пользователь больше не сможет работать с этой компанией. История
              протоколов и записей сохранится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                removeId !== null &&
                removeMutation.mutate({ memberId: removeId })
              }
            >
              Удалить доступ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
