"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, Gauge, Target, TrendingDown, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/metrics";
import { formatZonedDate } from "@/lib/timezone";
import { runEvalSimulation, type EvalCycle, type EvalRules, type EvalSimResult, type SizeDownRule } from "@/lib/eval-sim";
import type { BacktestTrade, Strategy } from "@/db/schema";

export const AXIS = { fill: "var(--text-muted)", fontSize: 11 };
export const TOOLTIP_STYLE = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 10px",
};

export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function signedMoney(n: number): string {
  return `${n > 0 ? "+" : ""}${formatCurrency(n)}`;
}

export const OUTCOME_COLOR: Record<EvalCycle["outcome"], string> = {
  PASS: "var(--profit)",
  FAIL: "var(--loss)",
  IN_PROGRESS: "var(--text-faint)",
};

export const OUTCOME_BADGE_TONE: Record<EvalCycle["outcome"], "profit" | "loss" | "neutral"> = {
  PASS: "profit",
  FAIL: "loss",
  IN_PROGRESS: "neutral",
};

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

type ChartPoint = {
  globalIndex: number;
  date: string;
  balance: number;
  cycleNumber: number;
  outcome: EvalCycle["outcome"];
  sizedDown: boolean;
};

function cycleToChartSeries(c: EvalCycle, accountSize: number): ChartPoint[] {
  const start: ChartPoint = {
    globalIndex: c.startIndex - 0.5,
    date: c.startDate,
    balance: accountSize,
    cycleNumber: c.cycleNumber,
    outcome: c.outcome,
    sizedDown: false,
  };
  const rest: ChartPoint[] = c.steps.map((s) => ({
    globalIndex: s.globalIndex,
    date: s.date,
    balance: s.balance,
    cycleNumber: c.cycleNumber,
    outcome: c.outcome,
    sizedDown: s.sizedDown,
  }));
  return [start, ...rest];
}

type TipPayload = { payload?: ChartPoint; value?: number }[];
type LineLabelProps = { x?: string | number; y?: string | number; index?: number };
type LineDotProps = { cx?: number; cy?: number; index?: number; payload?: ChartPoint };

function EvalTip({
  active,
  payload,
  timeZone,
  sizeDown,
}: {
  active?: boolean;
  payload?: TipPayload;
  timeZone: string;
  sizeDown: SizeDownRule | null;
}) {
  const point = active ? payload?.find((p) => p.payload)?.payload : undefined;
  if (!point) return null;
  return (
    <div style={TOOLTIP_STYLE} className="text-[var(--text)]">
      <div className="font-semibold">
        Cycle {point.cycleNumber} · {formatZonedDate(point.date, timeZone)}
      </div>
      <div className="mt-1 text-[var(--text-muted)]">
        Balance <b className="text-[var(--text)]">{formatCurrency(point.balance)}</b>
      </div>
      {point.sizedDown && sizeDown && (
        <div className="mt-1 text-[var(--accent)]">
          Sized down: {sizeDown.contracts} {sizeDown.symbol}
        </div>
      )}
    </div>
  );
}

export function EvalKpiRow({ result }: { result: EvalSimResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        label="Cycles run"
        value={String(result.totalCycles)}
        icon={<Gauge size={16} />}
        sub={
          result.rules.sizeDown
            ? `${result.tradesUsed} trades · ${result.sizedDownTrades} on ${result.rules.sizeDown.symbol}`
            : `${result.tradesUsed} trades simulated`
        }
      />
      <KpiCard
        label="Pass rate"
        value={result.passRate == null ? "n/a" : `${result.passRate.toFixed(1)}%`}
        tone={result.passRate == null ? "neutral" : result.passRate >= 50 ? "profit" : "loss"}
        icon={<Target size={16} />}
        sub={`${result.passes} passed · ${result.fails} failed${result.inProgress ? ` · ${result.inProgress} in progress` : ""}`}
      />
      <KpiCard
        label="Avg trades to pass"
        value={result.avgTradesToPass == null ? "n/a" : result.avgTradesToPass.toFixed(1)}
        tone="profit"
        icon={<TrendingUp size={16} />}
        sub={result.avgDaysToPass != null ? `~${result.avgDaysToPass.toFixed(0)} days` : undefined}
      />
      <KpiCard
        label="Avg trades to fail"
        value={result.avgTradesToFail == null ? "n/a" : result.avgTradesToFail.toFixed(1)}
        tone="loss"
        icon={<TrendingDown size={16} />}
        sub={result.avgDaysToFail != null ? `~${result.avgDaysToFail.toFixed(0)} days` : undefined}
      />
      <KpiCard
        label="Fastest pass"
        value={result.fastestPass ? `${result.fastestPass.trades} trades` : "n/a"}
        icon={<Award size={16} />}
        sub={result.fastestPass ? `Cycle ${result.fastestPass.cycleNumber}` : undefined}
      />
    </div>
  );
}

export function EvalCycleChart({
  label,
  result,
  rules,
  timeZone,
}: {
  label?: string;
  result: EvalSimResult;
  rules: EvalRules;
  timeZone: string;
}) {
  const chartSeries = useMemo(
    () => result.cycles.map((c) => cycleToChartSeries(c, rules.accountSize)),
    [result, rules.accountSize]
  );

  return (
    <Panel
      title={label ? `${label}: Cycle equity` : "Cycle equity"}
      subtitle={`Each cycle resets to ${formatCurrency(rules.accountSize)}. Green = passed, red = failed, gray = still in progress at the end of your logged trades. Labels show calendar days taken, including off days.${
        rules.sizeDown ? ` Gold dots mark trades taken as ${rules.sizeDown.contracts} ${rules.sizeDown.symbol} while the cushion was under ${formatCurrency(rules.sizeDown.cushionBelow)}.` : ""
      }`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="globalIndex"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => String(Math.round(Number(v)))}
            minTickGap={32}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={compactMoney} domain={["auto", "auto"]} />
          <ReferenceLine y={rules.accountSize} stroke="var(--border)" strokeDasharray="4 4" />
          <ReferenceLine
            y={rules.accountSize + rules.profitTarget}
            stroke="var(--profit)"
            strokeDasharray="4 4"
            label={{ value: "Target", position: "insideTopLeft", fill: "var(--profit)", fontSize: 11 }}
          />
          {rules.drawdownMode === "static" && (
            <ReferenceLine
              y={rules.accountSize - rules.maxDrawdown}
              stroke="var(--loss)"
              strokeDasharray="4 4"
              label={{ value: "Max DD floor", position: "insideBottomLeft", fill: "var(--loss)", fontSize: 11 }}
            />
          )}
          <Tooltip content={<EvalTip timeZone={timeZone} sizeDown={rules.sizeDown} />} />
          {result.cycles.map((c, idx) => (
            <Line
              key={c.cycleNumber}
              data={chartSeries[idx]}
              dataKey="balance"
              stroke={OUTCOME_COLOR[c.outcome]}
              strokeWidth={2}
              dot={(props: LineDotProps) =>
                props.payload?.sizedDown ? (
                  <circle
                    key={`sd-${c.cycleNumber}-${props.index}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={2.5}
                    fill="var(--accent)"
                    stroke="none"
                  />
                ) : (
                  <g key={`sd-${c.cycleNumber}-${props.index}`} />
                )
              }
              isAnimationActive={false}
              connectNulls={false}
              label={(props: LineLabelProps) => {
                if (props.index !== chartSeries[idx].length - 1) return <g key={`cl-${c.cycleNumber}`} />;
                const dy = c.outcome === "FAIL" ? 15 : -9;
                return (
                  <text
                    key={`cl-${c.cycleNumber}`}
                    x={props.x}
                    y={Number(props.y ?? 0) + dy}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fill={OUTCOME_COLOR[c.outcome]}
                  >
                    {c.daysToEnd}d
                  </text>
                );
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function EvalCyclesTable({ result, timeZone }: { result: EvalSimResult; timeZone: string }) {
  const sizeDown = result.rules.sizeDown;
  return (
    <Panel title="Cycles" subtitle={`${result.totalCycles} attempt${result.totalCycles === 1 ? "" : "s"}, oldest first`}>
      <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--text-muted)]">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Outcome</th>
              <th className="py-2 pr-3">Start</th>
              <th className="py-2 pr-3">End</th>
              <th className="py-2 pr-3 text-right">Trades</th>
              <th className="py-2 pr-3 text-right">Days</th>
              {sizeDown && <th className="py-2 pr-3 text-right">On {sizeDown.symbol}</th>}
              <th className="py-2 pr-3 text-right">Net P&amp;L</th>
              <th className="py-2 text-right">Peak</th>
            </tr>
          </thead>
          <tbody>
            {result.cycles.map((c) => (
              <tr key={c.cycleNumber} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-3 tabular text-[var(--text-faint)]">{c.cycleNumber}</td>
                <td className="py-2 pr-3">
                  <Badge tone={OUTCOME_BADGE_TONE[c.outcome]}>{c.outcome.replace("_", " ")}</Badge>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-[var(--text-muted)]">{formatZonedDate(c.startDate, timeZone)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-[var(--text-muted)]">{formatZonedDate(c.endDate, timeZone)}</td>
                <td className="py-2 pr-3 text-right tabular">{c.trades}</td>
                <td className="py-2 pr-3 text-right tabular text-[var(--text-muted)]">{c.daysToEnd}</td>
                {sizeDown && (
                  <td className="py-2 pr-3 text-right tabular text-[var(--text-muted)]">{c.sizedDownTrades}</td>
                )}
                <td
                  className={`py-2 pr-3 text-right tabular font-semibold ${
                    c.netPnl > 0 ? "text-[var(--profit)]" : c.netPnl < 0 ? "text-[var(--loss)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {signedMoney(c.netPnl)}
                </td>
                <td className="py-2 text-right tabular text-[var(--text-muted)]">{formatCurrency(c.peakBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Runs the simulation for one strategy and renders its KPI row, cycle-equity chart, and cycles table. */
export function EvalResultsPanel({
  label,
  strategy,
  trades,
  rules,
  timeZone,
}: {
  label?: string;
  strategy: Strategy;
  trades: BacktestTrade[];
  rules: EvalRules;
  timeZone: string;
}) {
  const result: EvalSimResult = useMemo(
    () => runEvalSimulation(trades, strategy, rules, timeZone),
    [trades, strategy, rules, timeZone]
  );

  if (result.totalCycles === 0) {
    return (
      <div className="flex flex-col gap-3">
        {label && <h2 className="text-lg font-semibold text-[var(--text)]">{label}</h2>}
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
          No trades to simulate against.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {label && <h2 className="text-lg font-semibold text-[var(--text)]">{label}</h2>}
      <EvalKpiRow result={result} />
      <EvalCycleChart result={result} rules={rules} timeZone={timeZone} />
      <EvalCyclesTable result={result} timeZone={timeZone} />
    </div>
  );
}
