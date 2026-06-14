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
import { Building2, Plus, Users, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AdminCompanies() {
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const utils = trpc.useUtils();

  const companiesQ = trpc.companies.list.useQuery();
  const companies = companiesQ.data || [];

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      utils.companies.list.invalidate();
      toast.success("Компания создана");
      setCreateOpen(false);
      setNewName("");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Компании</h1>
          <p className="text-muted-foreground mt-1">
            Управляйте компаниями и их пользователями. Каждая компания — отдельное рабочее пространство.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Новая компания
        </Button>
      </div>

      {companiesQ.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : companies.length === 0 ? (
        <Card className="border">
          <CardContent className="py-20 text-center">
            <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="font-medium">Нет компаний</p>
            <p className="text-sm text-muted-foreground mt-1">
              Создайте первую компанию и пригласите пользователей.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Создать компанию
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map(company => (
            <Card
              key={company.id}
              className="border cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              onClick={() => setLocation(`/admin/companies/${company.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                </div>
                <CardTitle className="text-base mt-3">{company.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Создана {new Date(company.createdAt).toLocaleDateString("ru-RU")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая компания</DialogTitle>
            <DialogDescription>
              Введите название компании. После создания вы сможете пригласить пользователей.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="company-name">Название компании</Label>
            <Input
              id="company-name"
              placeholder="ТОО «Фармацевтика»"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && newName.trim() && createMutation.mutate({ name: newName.trim() })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName.trim() })}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
