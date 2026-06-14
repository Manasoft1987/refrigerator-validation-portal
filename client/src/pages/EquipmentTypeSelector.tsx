import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Snowflake, Truck, Package, Warehouse } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

type EquipmentType = "refrigerator" | "auto-refrigerator" | "warehouse" | "other";

export default function EquipmentTypeSelector() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<EquipmentType | null>(null);
  const [customName, setCustomName] = useState("");

  const handleSelectEquipment = (type: EquipmentType) => {
    setSelectedType(type);
    if (type !== "other") {
      sessionStorage.setItem("selectedEquipmentType", type);
      sessionStorage.removeItem("customEquipmentName");
      setLocation("/protocols/create");
    }
  };

  const handleConfirmOther = () => {
    const name = customName.trim();
    if (!name) return;
    sessionStorage.setItem("selectedEquipmentType", "other");
    sessionStorage.setItem("customEquipmentName", name);
    setLocation("/protocols/create");
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Snowflake className="h-3 w-3" />
            Выбор объекта валидации
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Выберите тип оборудования
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Выберите тип оборудования, для которого вы хотите создать протокол квалификации и валидации
          </p>
        </div>

        {/* Equipment Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Refrigerator Card */}
          <Card
            className={`relative overflow-hidden hover:shadow-lg transition-all cursor-pointer border-2 ${
              selectedType === "refrigerator" ? "border-primary shadow-md" : "hover:border-primary/50"
            }`}
            onClick={() => handleSelectEquipment("refrigerator")}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-100 to-transparent opacity-50 rounded-full -mr-12 -mt-12" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Snowflake className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Холодильник</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Стационарное холодильное оборудование для хранения лекарственных препаратов
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Холодильные шкафы и витрины</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Морозильные камеры</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Стационарные холодильные установки</span>
                </li>
              </ul>
              <Button
                className="w-full mt-6"
                size="lg"
              >
                Выбрать холодильник
              </Button>
            </CardContent>
          </Card>

          {/* Auto-Refrigerator Card */}
          <Card
            className={`relative overflow-hidden hover:shadow-lg transition-all cursor-pointer border-2 ${
              selectedType === "auto-refrigerator" ? "border-primary shadow-md" : "hover:border-primary/50"
            }`}
            onClick={() => handleSelectEquipment("auto-refrigerator")}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-100 to-transparent opacity-50 rounded-full -mr-12 -mt-12" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Truck className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="text-xl">Авторефрижератор</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Мобильное холодильное оборудование для транспортировки лекарственных препаратов
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Автомобильные холодильники</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Изотермические контейнеры</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Мобильные холодильные установки</span>
                </li>
              </ul>
              <Button
                className="w-full mt-6"
                size="lg"
                variant="outline"
              >
                Выбрать авторефрижератор
              </Button>
            </CardContent>
          </Card>

          {/* Warehouse / Storage Zone Card */}
          <Card
            className={`relative overflow-hidden hover:shadow-lg transition-all cursor-pointer border-2 ${
              selectedType === "warehouse" ? "border-primary shadow-md" : "hover:border-primary/50"
            }`}
            onClick={() => handleSelectEquipment("warehouse")}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-transparent opacity-50 rounded-full -mr-12 -mt-12" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <Warehouse className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl">Помещение / зона</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Склад, холодильная камера или зона хранения по Рек. ЕАЭК №8
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Склады и зоны приёмки/экспедиции</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Холодильные/морозильные камеры</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Картирование с сеткой регистраторов</span>
                </li>
              </ul>
              <Button
                className="w-full mt-6"
                size="lg"
                variant="outline"
              >
                Выбрать помещение
              </Button>
            </CardContent>
          </Card>

          {/* Other Equipment Card */}
          <Card
            className={`relative overflow-hidden hover:shadow-lg transition-all cursor-pointer border-2 ${
              selectedType === "other" ? "border-primary shadow-md" : "hover:border-primary/50"
            }`}
            onClick={() => handleSelectEquipment("other")}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100 to-transparent opacity-50 rounded-full -mr-12 -mt-12" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Другое</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Другой тип холодильного или температурно-контролируемого оборудования
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Термостаты и инкубаторы</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Климатические камеры</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Специализированное оборудование</span>
                </li>
              </ul>
              <Button
                className="w-full mt-6"
                size="lg"
                variant="outline"
              >
                Выбрать другое
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Custom name input for "other" type */}
        {selectedType === "other" && (
          <div className="mt-8 max-w-md mx-auto bg-white border rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Укажите название оборудования</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Введите точное наименование оборудования, которое будет использоваться в протоколе и отчёте.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="customEquipmentName">Наименование оборудования</Label>
                <Input
                  id="customEquipmentName"
                  placeholder="Например: Термостат ТС-1/80 СПУ"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirmOther()}
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedType(null)}
                  className="flex-1"
                >
                  Назад
                </Button>
                <Button
                  onClick={handleConfirmOther}
                  disabled={!customName.trim()}
                  className="flex-1"
                >
                  Продолжить
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        {selectedType !== "other" && (
          <div className="mt-8 text-center">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
            >
              ← Вернуться на главную
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
