import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Users } from "lucide-react";

export default function AdminUsers() {
  const allProtocolsQ = trpc.companies.allProtocols.useQuery();
  const protocols = allProtocolsQ.data || [];

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Все протоколы</h1>
        <p className="text-muted-foreground mt-1">
          Сводная таблица всех протоколов по всем компаниям и пользователям.
        </p>
      </div>

      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Протоколы ({protocols.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allProtocolsQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : protocols.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Протоколов пока нет.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Номер</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Компания</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Пользователь</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Статус</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Создан</th>
                </tr>
              </thead>
              <tbody>
                {protocols.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-3 font-medium">{p.number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.companyName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.userName || "—"}</td>
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
    </div>
  );
}
