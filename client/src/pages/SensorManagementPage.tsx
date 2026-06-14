import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Edit2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export function SensorManagementPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    number: "",
    calibrationDate: "",
    nextCalibrationDate: "",
  });

  const { data: sensors, isLoading, refetch } = trpc.sensors.list.useQuery();
  const { data: expiringIn30Days } = trpc.sensors.expiringIn30Days.useQuery();

  const createMutation = trpc.sensors.create.useMutation({
    onSuccess: () => {
      toast.success("Датчик добавлен");
      refetch();
      setIsOpen(false);
      setFormData({ number: "", calibrationDate: "", nextCalibrationDate: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.sensors.update.useMutation({
    onSuccess: () => {
      toast.success("Датчик обновлён");
      refetch();
      setIsOpen(false);
      setEditingId(null);
      setFormData({ number: "", calibrationDate: "", nextCalibrationDate: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.sensors.delete.useMutation({
    onSuccess: () => {
      toast.success("Датчик удалён");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.number || !formData.calibrationDate || !formData.nextCalibrationDate) {
      toast.error("Заполните все поля");
      return;
    }

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        number: formData.number,
        calibrationDate: formData.calibrationDate,
        nextCalibrationDate: formData.nextCalibrationDate,
      });
    } else {
      await createMutation.mutateAsync({
        number: formData.number,
        calibrationDate: formData.calibrationDate,
        nextCalibrationDate: formData.nextCalibrationDate,
      });
    }
  };

  const handleEdit = (sensor: any) => {
    setEditingId(sensor.id);
    setFormData({
      number: sensor.number,
      calibrationDate: sensor.calibrationDate.split("T")[0],
      nextCalibrationDate: sensor.nextCalibrationDate.split("T")[0],
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот датчик?")) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const getStatusBadge = (sensor: any) => {
    const now = new Date();
    const nextCal = new Date(sensor.nextCalibrationDate);
    const daysUntilExpiry = Math.floor((nextCal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Просрочен</Badge>;
    } else if (daysUntilExpiry <= 30) {
      return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Истекает через {daysUntilExpiry} дн.</Badge>;
    } else {
      return <Badge variant="outline" className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Активен</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Управление датчиками</h1>
          <p className="text-gray-600 mt-1">Отслеживание сроков поверки датчиков</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingId(null); setFormData({ number: "", calibrationDate: "", nextCalibrationDate: "" }); }} className="gap-2">
              <Plus className="w-4 h-4" /> Добавить датчик
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Редактировать датчик" : "Добавить новый датчик"}</DialogTitle>
              <DialogDescription>
                Заполните информацию о датчике и сроках поверки
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="number">Номер датчика</Label>
                <Input
                  id="number"
                  placeholder="Например: SN-12345"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="calibrationDate">Дата последней поверки</Label>
                <Input
                  id="calibrationDate"
                  type="date"
                  value={formData.calibrationDate}
                  onChange={(e) => setFormData({ ...formData, calibrationDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="nextCalibrationDate">Дата следующей поверки</Label>
                <Input
                  id="nextCalibrationDate"
                  type="date"
                  value={formData.nextCalibrationDate}
                  onChange={(e) => setFormData({ ...formData, nextCalibrationDate: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Сохранить изменения" : "Добавить датчик"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expiring Soon Alert */}
      {expiringIn30Days && expiringIn30Days.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-900">
              <Clock className="w-5 h-5" />
              Датчики требуют поверки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-800">
              {expiringIn30Days.length} датчик(ов) требуют поверки в течение следующих 30 дней
            </p>
            <ul className="mt-2 space-y-1">
              {expiringIn30Days.map((sensor) => (
                <li key={sensor.id} className="text-sm text-yellow-700">
                  • {sensor.number} — поверка {new Date(sensor.nextCalibrationDate).toLocaleDateString("ru-RU")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Sensors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Список датчиков</CardTitle>
          <CardDescription>
            Всего датчиков: {sensors?.length || 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Загрузка...</div>
          ) : sensors && sensors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер датчика</TableHead>
                  <TableHead>Дата поверки</TableHead>
                  <TableHead>Следующая поверка</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sensors
                  .sort((a, b) => new Date(a.nextCalibrationDate).getTime() - new Date(b.nextCalibrationDate).getTime())
                  .map((sensor) => (
                  <TableRow key={sensor.id}>
                    <TableCell className="font-medium">{sensor.number}</TableCell>
                    <TableCell>{new Date(sensor.calibrationDate).toLocaleDateString("ru-RU")}</TableCell>
                    <TableCell>{new Date(sensor.nextCalibrationDate).toLocaleDateString("ru-RU")}</TableCell>
                    <TableCell>{getStatusBadge(sensor)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(sensor)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sensor.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Датчики не добавлены</p>
              <p className="text-sm">Нажмите кнопку "Добавить датчик" для создания первого датчика</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
