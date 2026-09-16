"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/metrics";

export type ChartPoint = { index: number; date: string; balance: number };

export function EquityChart({
  data,
  drawdownThreshold,
  height = 260,
}: {
  data: ChartPoint[];
  drawdownThreshold?: number | null;
  height?: number;
}) {
  const values = data.map((d) => d.balance);
  const min = Math.min(...values, drawdownThreshold ?? Infinity);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 10);
  const positive = data.length > 0 && data[data.length - 1].balance >= data[0].balance;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor={positive ? "var(--profit)" : "var(--loss)"}
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor={positive ? "var(--profit)" : "var(--loss)"}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <XAxis dataKey="index" hide />
        <YAxis
          domain={[min - padding, max + padding]}
          hide
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelFormatter={() => ""}
          formatter={(value) => [formatCurrency(Number(value)), "Balance"]}
        />
        {drawdownThreshold != null && drawdownThreshold > 0 && (
          <ReferenceLine
            y={drawdownThreshold}
            stroke="var(--loss)"
            strokeDasharray="4 4"
            label={{
              value: `Stop-out ${formatCompactCurrency(drawdownThreshold)}`,
              position: "insideBottomLeft",
              fill: "var(--loss)",
              fontSize: 11,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="balance"
          stroke={positive ? "var(--profit)" : "var(--loss)"}
          strokeWidth={2}
          fill="url(#equityFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
