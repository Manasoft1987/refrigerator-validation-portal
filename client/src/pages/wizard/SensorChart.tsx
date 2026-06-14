import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function SensorChart({
  protocolId,
  loggerId,
  rangeMin,
  rangeMax,
}: {
  protocolId: number;
  loggerId: number;
  rangeMin: number;
  rangeMax: number;
}) {
  const q = trpc.pv.getLoggerSeries.useQuery({ protocolId, loggerId });

  const data = useMemo(() => {
    if (!q.data) return [];
    const { ts, temp } = q.data;
    // Downsample for performance — cap at 2000 points for chart.
    const n = ts.length;
    if (n === 0) return [];
    const step = Math.max(1, Math.ceil(n / 2000));
    const rows: { ts: number; temp: number }[] = [];
    for (let i = 0; i < n; i += step) {
      rows.push({ ts: ts[i], temp: temp[i] });
    }
    return rows;
  }, [q.data]);

  const yDomain = useMemo(() => {
    if (!data.length) return [rangeMin - 2, rangeMax + 2];
    let min = Infinity;
    let max = -Infinity;
    for (const r of data) {
      if (r.temp < min) min = r.temp;
      if (r.temp > max) max = r.temp;
    }
    return [Math.min(min - 1, rangeMin - 1), Math.max(max + 1, rangeMax + 1)];
  }, [data, rangeMin, rangeMax]);

  if (q.isLoading) {
    return (
      <div className="h-72 rounded-xl bg-muted/30 border flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Загрузка ряда…
      </div>
    );
  }
  if (!data.length) return null;

  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
                tickFormatter={v =>
                  new Date(v).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })
                }
                minTickGap={60}
                fontSize={11}
              />
              <YAxis
                domain={yDomain}
                fontSize={11}
                tickFormatter={v => `${v.toFixed(1)}°`}
              />
              <Tooltip
                labelFormatter={v => new Date(v as number).toLocaleString("ru-RU", { timeZone: "UTC" })}
                formatter={(v: any) => [`${Number(v).toFixed(2)} °C`, "Температура"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <ReferenceArea
                y1={yDomain[0]}
                y2={rangeMin}
                fill="#f43f5e"
                fillOpacity={0.06}
              />
              <ReferenceArea
                y1={rangeMax}
                y2={yDomain[1]}
                fill="#f43f5e"
                fillOpacity={0.06}
              />
              <ReferenceLine y={rangeMin} stroke="#f43f5e" strokeDasharray="4 4" />
              <ReferenceLine y={rangeMax} stroke="#f43f5e" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="temp"
                stroke="#4f46e5"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
