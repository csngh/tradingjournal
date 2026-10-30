"use client";

import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/metrics";
import { formatZonedDate } from "@/lib/timezone";
import { buildInsights, formatStreakDate, strategyRules, type BacktestAnalysis, type Bucket, type Insight } from "@/lib/backtest";
import type { Strategy } from "@/db/schema";

const AXIS = { fill: "var(--text-muted)", fontSize: 11 };
const TOOLTIP_STYLE = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 10px",
};

function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function signedMoney(n: number): string {
  return `${n > 0 ? "+" : ""}${formatCurrency(n)}`;
}

function toneOf(n: number): "profit" | "loss" | "neutral" {
  return n > 0 ? "profit" : n < 0 ? "loss" : "neutral";
}

function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const insightIcon = {
  good: <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--profit)]" />,
  bad: <XCircle size={16} className="mt-0.5 shrink-0 text-[var(--loss)]" />,
  warn: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" />,
  info: <Info size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />,
} satisfies Record<Insight["tone"], ReactNode>;

type TipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> };

function BucketTip({ active, payload }: TipProps) {
  const b = active ? (payload?.[0]?.payload as Bucket | undefined) : undefined;
  if (!b) return null;
  return (
    <div style={TOOLTIP_STYLE} className="text-[var(--text)]">
      <div className="font-semibold">{b.label}</div>
      <div className="mt-1 flex flex-col gap-0.5 text-[var(--text-muted)]">
        <span>
          Net <b className={b.net >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"}>{signedMoney(b.net)}</b>
        </span>
        <span>
          {b.trades} trade{b.trades === 1 ? "" : "s"} · {b.winRate.toFixed(0)}% win
        </span>
        <span>Avg {signedMoney(b.avg)} / trade</span>
      </div>
    </div>
  );
}

function BucketChart({ data, height = 220 }: { data: Bucket[]; height?: number }) {
  if (data.length === 0) return <p className="text-sm text-[var(--text-muted)]">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={compactMoney} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<BucketTip />} />
        <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((b) => (
            <Cell key={b.key} fill={b.net >= 0 ? "var(--profit)" : "var(--loss)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function BucketTable({ data }: { data: Bucket[] }) {
  if (data.length === 0) return <p className="text-sm text-[var(--text-muted)]">No data yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-medium text-[var(--text-muted)]">
          <th className="pb-2 font-medium"></th>
          <th className="pb-2 text-right font-medium">Trades</th>
          <th className="pb-2 text-right font-medium">Win rate</th>
          <th className="pb-2 text-right font-medium">Avg / trade</th>
          <th className="pb-2 text-right font-medium">Net P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {data.map((b) => (
          <tr key={b.key} className="border-t border-[var(--border)]">
            <td className="py-2 font-medium text-[var(--text)]">{b.label}</td>
            <td className="py-2 text-right tabular text-[var(--text-muted)]">{b.trades}</td>
            <td className="py-2 text-right tabular text-[var(--text-muted)]">{b.winRate.toFixed(1)}%</td>
            <td className="py-2 text-right tabular text-[var(--text-muted)]">{signedMoney(b.avg)}</td>
            <td
              className={`py-2 text-right tabular font-semibold ${
                b.net >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
              }`}
            >
              {signedMoney(b.net)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CheckRow({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "profit" | "loss" | "neutral";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="text-sm text-[var(--text)]">{label}</div>
        {hint && <div className="text-[11px] text-[var(--text-muted)]">{hint}</div>}
      </div>
      <div
        className={`shrink-0 text-sm font-semibold tabular ${
          tone === "profit"
            ? "text-[var(--profit)]"
            : tone === "loss"
              ? "text-[var(--loss)]"
              : "text-[var(--text)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function BacktestAnalysisView({
  strategy,
  analysis: a,
  timeZone,
  afterEquity,
  extraKpiCards,
}: {
  strategy: Strategy;
  analysis: BacktestAnalysis;
  timeZone: string;
  /** Extra panels (e.g. Multi-Account Sim's payout cycle breakdown) slotted in right after the
   * equity/drawdown charts and before Losing streaks, keeping a consistent reading order instead
   * of the caller bolting them on before or after this whole view. */
  afterEquity?: ReactNode;
  /** Extra KpiCard tiles (e.g. Multi-Account Sim's avg payout days) dropped into the same top
   * stat grid as Net P&L, Win rate, etc., so they sit among same-sized cards instead of alone. */
  extraKpiCards?: ReactNode;
}) {
  const insights = buildInsights(a, strategy);
  const rules = strategyRules(strategy);
  const [minStreak, setMinStreak] = useState(2);
  const shownStreaks = a.lossStreaks.filter((s) => s.length >= minStreak);
  const r2 = (n: number) => String(Math.round(n * 100) / 100);
  const realizedRr = a.avgLossPoints > 0 && a.avgWinPoints > 0 ? a.avgWinPoints / a.avgLossPoints : null;
  const equityUp = a.equity.length > 0 && a.equity[a.equity.length - 1].equity >= a.equity[0].equity;
  const eqColor = equityUp ? "var(--profit)" : "var(--loss)";

  const tpShare = a.byExit.find((b) => b.key === "TP");
  const slShare = a.byExit.find((b) => b.key === "SL");
  const pct = (n: number) => (a.totalTrades ? `${((n / a.totalTrades) * 100).toFixed(1)}%` : "0%");

  const capExcess = a.days.filter((d) => d.overCap);

  // Only set when this analysis came through Multi-Account Sim's payout rule; a plain backtest
  // never has this field, so none of this applies there.
  const payoutPoints = a.equity.filter((pt) => pt.payout != null && pt.payout > 0);
  // Calendar days from the previous payout (or the first trade, for the very first one) up to each
  // payout, i.e. how long the account took to rebuild its peak and trigger again.
  const payoutGapDays = payoutPoints.map((pt, i) => {
    const prevDate = i === 0 ? a.firstTrade : payoutPoints[i - 1].date;
    if (!prevDate) return null;
    return Math.round((new Date(pt.date).getTime() - new Date(prevDate).getTime()) / 86_400_000);
  });
  // The gold marker itself sits one trade later, at the actual post-withdrawal dip, while the "Xd"
  // label stays anchored to the peak trade that triggered it (falls back to the peak's own point
  // when the payout happened on the very last trade, so there's no "next" point to show a dip at).
  const payoutDipPoints = payoutPoints.map((pt) => a.equity[pt.index + 1] ?? pt);

  // Shared by the equity-curve and drawdown tooltips: both plot `a.equity`, keyed by trade index,
  // so the hovered point's real calendar date comes from the matching payload entry, not the axis label.
  const equityLabel = (l: ReactNode, payload?: readonly { payload?: { date?: string; payout?: number } }[]) => {
    if (Number(l) === 0) return "Start";
    const point = payload?.[0]?.payload;
    const dateStr = point?.date && point.date !== "start" ? formatZonedDate(point.date, timeZone) : null;
    const payoutStr = point?.payout ? ` · Payout ${formatCurrency(point.payout)}` : "";
    return `After trade ${l}${dateStr ? ` · ${dateStr}` : ""}${payoutStr}`;
  };

  return (
    <div className="flex flex-col gap-5">
      {a.excludedScratches > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-muted)]">
          <Info size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <span>
            Breakeven trades are excluded in Settings, so {a.excludedScratches} of them are left out of total trades,
            win rate, profit factor, expectancy, streaks and the breakdowns. Net P&amp;L, fees, the equity curve,
            drawdown, daily results and the daily trade limit still include every trade.
          </span>
        </p>
      )}
      {insights.length > 0 && (
        <Panel title="Key findings" subtitle="Generated from the trades you logged">
          <ul className="flex flex-col gap-2.5">
            {insights.map((i, idx) => (
              <li key={idx} className="flex gap-2.5 text-sm text-[var(--text)]">
                {insightIcon[i.tone]}
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Net P&L" value={signedMoney(a.netPnl)} tone={toneOf(a.netPnl)} sub={`After ${formatCurrency(a.totalFees)} fees`} />
        <KpiCard
          label="Win rate"
          value={`${a.winRate.toFixed(1)}%`}
          sub={`${a.wins}W · ${a.losses}L${a.scratches ? ` · ${a.scratches} BE` : ""}`}
          tone={a.breakevenWinRate != null ? (a.winRate >= a.breakevenWinRate ? "profit" : "loss") : "neutral"}
        />
        <KpiCard
          label="Profit factor"
          value={a.profitFactor == null ? (a.grossProfit > 0 ? "∞" : "0.00") : a.profitFactor.toFixed(2)}
          sub={`${formatCurrency(a.grossProfit)} won / ${formatCurrency(a.grossLoss)} lost`}
          tone={a.profitFactor == null ? (a.grossProfit > 0 ? "profit" : "neutral") : a.profitFactor >= 1 ? "profit" : "loss"}
        />
        <KpiCard
          label="Expectancy"
          value={signedMoney(a.expectancy)}
          tone={toneOf(a.expectancy)}
          sub={`per trade${a.expectancyR != null ? ` · ${a.expectancyR.toFixed(2)}R` : ""} · ${a.expectancyPoints.toFixed(2)} pts`}
        />
        <KpiCard
          label="Avg win / avg loss"
          value={a.payoffRatio == null ? "n/a" : a.payoffRatio.toFixed(2)}
          sub={`${formatCurrency(a.avgWin)} / ${formatCurrency(a.avgLoss)}`}
        />
        <KpiCard
          label="Max drawdown"
          value={formatCurrency(-a.maxDrawdown)}
          tone={a.maxDrawdown > 0 ? "loss" : "neutral"}
          sub={
            a.maxDrawdownPct != null
              ? `${a.maxDrawdownPct.toFixed(1)}% of peak · ${a.maxDrawdownTrades} trades deep`
              : `${a.maxDrawdownTrades} trades deep`
          }
        />
        <KpiCard
          label="Recovery factor"
          value={a.recoveryFactor == null ? "n/a" : a.recoveryFactor.toFixed(2)}
          sub="Net profit / max drawdown"
        />
        <KpiCard
          label="Total trades"
          value={String(a.totalTrades)}
          sub={`${a.tradingDays} day${a.tradingDays === 1 ? "" : "s"} · ${a.avgTradesPerDay.toFixed(1)} per day${
            a.excludedScratches > 0 ? ` · ${a.excludedScratches} BE not counted` : ""
          }`}
        />
        <KpiCard label="Best trade" value={signedMoney(a.largestWin)} tone="profit" sub={`Max win streak ${a.maxWinStreak}`} />
        <KpiCard label="Worst trade" value={signedMoney(a.largestLoss)} tone="loss" sub={`Max loss streak ${a.maxLossStreak}`} />
        <KpiCard
          label="Best day"
          value={a.bestDay ? signedMoney(a.bestDay.net) : "n/a"}
          tone={a.bestDay ? toneOf(a.bestDay.net) : "neutral"}
          sub={a.bestDay ? `${a.bestDay.date} · ${a.bestDay.trades} trades` : undefined}
        />
        <KpiCard
          label="Worst day"
          value={a.worstDay ? signedMoney(a.worstDay.net) : "n/a"}
          tone={a.worstDay ? toneOf(a.worstDay.net) : "neutral"}
          sub={a.worstDay ? `${a.worstDay.date} · ${a.worstDay.trades} trades` : undefined}
        />
        {extraKpiCards}
      </div>

      <Panel
        title="Equity curve"
        subtitle={
          payoutPoints.length > 0
            ? `Account balance after fees and payouts. Gold dots mark each of the ${payoutPoints.length} withdrawal${payoutPoints.length === 1 ? "" : "s"}, labeled above the peak that triggered it with calendar days since the previous one.`
            : `Cumulative net P&L after fees${strategy.startingCapital > 0 ? `, starting from ${formatCurrency(strategy.startingCapital)}` : ""}`
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={a.equity} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="btEquityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={eqColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={eqColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="index" tick={AXIS} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={compactMoney} domain={["auto", "auto"]} />
            <ReferenceLine y={strategy.startingCapital} stroke="var(--border)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={equityLabel}
              formatter={(v) => [formatCurrency(Number(v)), "Equity"]}
            />
            <Area type="monotone" dataKey="equity" stroke={eqColor} strokeWidth={2} fill="url(#btEquityFill)" />
            {payoutPoints.map((pt, i) => (
              // Invisible anchor at the peak: carries only the "Xd" label, no visible marker of its own.
              <ReferenceDot
                key={`label-${pt.index}`}
                x={pt.index}
                y={pt.equity}
                r={0}
                fill="transparent"
                stroke="none"
                ifOverflow="extendDomain"
                label={
                  payoutGapDays[i] != null
                    ? { value: `${payoutGapDays[i]}d`, position: "top", fill: "var(--accent)", fontSize: 10, fontWeight: 600 }
                    : undefined
                }
              />
            ))}
            {payoutDipPoints.map((pt) => (
              <ReferenceDot
                key={`dot-${pt.index}`}
                x={pt.index}
                y={pt.equity}
                r={5}
                fill="var(--accent)"
                stroke="var(--bg)"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Drawdown" subtitle="Distance below the running equity peak after each trade">
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={a.equity} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="btDdFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--loss)" stopOpacity={0} />
                <stop offset="95%" stopColor="var(--loss)" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="index" tick={AXIS} tickLine={false} axisLine={false} minTickGap={32} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={compactMoney} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={equityLabel}
              formatter={(v) => [formatCurrency(Number(v)), "Drawdown"]}
            />
            <Area type="monotone" dataKey="drawdown" stroke="var(--loss)" strokeWidth={1.5} fill="url(#btDdFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {afterEquity}

      {a.lossStreaks.length > 0 && (
        <Panel
          title="Losing streaks"
          subtitle={`Longest first · longest overall: ${a.maxLossStreak} trades`}
          actions={
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              At least
              <input
                type="number"
                min={2}
                step={1}
                value={minStreak}
                onChange={(e) => setMinStreak(Math.max(2, Math.round(Number(e.target.value)) || 2))}
                className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-center text-sm font-medium text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              losses in a row
            </label>
          }
        >
          {shownStreaks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No streak of {minStreak} or more losses in a row.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--surface)]">
                  <tr className="text-left text-xs font-medium text-[var(--text-muted)]">
                    <th className="pb-2 font-medium">Losses in a row</th>
                    <th className="pb-2 font-medium">Date range</th>
                    <th className="pb-2 text-right font-medium">Days spanned</th>
                    <th className="pb-2 text-right font-medium">Net P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {shownStreaks.map((s, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="py-2 font-semibold text-[var(--loss)]">{s.length}</td>
                      <td className="py-2 text-[var(--text)]">
                        {s.startDate === s.endDate
                          ? formatStreakDate(s.startDate)
                          : `${formatStreakDate(s.startDate)} to ${formatStreakDate(s.endDate)}`}
                      </td>
                      <td className="py-2 text-right tabular text-[var(--text-muted)]">
                        {s.days}
                        {s.days > 1 && (
                          <span className="ml-1.5">
                            <Badge tone="warning">spans days</Badge>
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular font-semibold text-[var(--loss)]">{signedMoney(s.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {a.sameDayLossStreaks.length > 0 && (
        <Panel
          title="Days with back-to-back losses"
          subtitle="Longest first · a run only counts within a single day, never across days"
        >
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="text-left text-xs font-medium text-[var(--text-muted)]">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Losses that day</th>
                  <th className="pb-2 text-right font-medium">Net P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {a.sameDayLossStreaks.map((d) => (
                  <tr key={d.day} className="border-t border-[var(--border)]">
                    <td className="py-2 text-[var(--text)]">{formatStreakDate(d.day)}</td>
                    <td className="py-2 font-semibold text-[var(--loss)]">{d.count}</td>
                    <td className="py-2 text-right tabular font-semibold text-[var(--loss)]">{signedMoney(d.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Strategy check" subtitle="What the strategy is set up to do versus what happened">
          <CheckRow
            label="Take profit hit rate"
            value={tpShare ? pct(tpShare.trades) : "0%"}
            hint={
              rules.tp != null
                ? `Target is ${r2(rules.tp)} points${rules.mode === "rr" ? ` (${r2(rules.rr ?? 0)}R)` : ""}`
                : rules.mode === "rr"
                  ? `Wins target ${r2(rules.rr ?? 0)}R`
                  : "No take profit set on this strategy"
            }
          />
          <CheckRow
            label="Stop loss hit rate"
            value={slShare ? pct(slShare.trades) : "0%"}
            hint={
              rules.sl != null
                ? `${rules.mode === "rr" ? "Risk" : "Stop"} is ${r2(rules.sl)} points`
                : rules.mode === "rr"
                  ? "Losses cost 1R"
                  : "No stop loss set on this strategy"
            }
          />
          {a.breakevenWinRate != null && (
            <CheckRow
              label="Win rate vs break-even line"
              value={`${a.winRate.toFixed(1)}% vs ${a.breakevenWinRate.toFixed(1)}%`}
              hint="Break-even win rate = SL / (TP + SL), before fees"
              tone={a.winRate >= a.breakevenWinRate ? "profit" : "loss"}
            />
          )}
          {rules.rr != null && (
            <CheckRow
              label="Realized reward : risk"
              value={realizedRr != null ? `1 : ${r2(realizedRr)}` : "n/a"}
              hint={`Planned 1 : ${r2(rules.rr)}. Average winner divided by average loser, in points.`}
              tone={realizedRr != null ? (realizedRr >= rules.rr * 0.95 ? "profit" : "loss") : undefined}
            />
          )}
          <CheckRow
            label="Average winner"
            value={`${a.avgWinPoints.toFixed(2)} pts`}
            hint={rules.tp != null ? `vs ${r2(rules.tp)} pt target` : undefined}
          />
          <CheckRow
            label="Average loser"
            value={`${a.avgLossPoints.toFixed(2)} pts`}
            hint={rules.sl != null ? `vs ${r2(rules.sl)} pt ${rules.mode === "rr" ? "risk" : "stop"}` : undefined}
          />
          <CheckRow label="Winning days" value={`${a.winningDays} of ${a.tradingDays}`} hint={`${a.losingDays} losing`} />
          {a.beOutcomes.total > 0 && (
            <>
              <CheckRow
                label="Breakeven outcomes"
                value={`${a.beOutcomes.total} breakeven${a.beOutcomes.total === 1 ? "" : "s"}`}
                hint={`${a.beOutcomes.win} ultimately a win · ${a.beOutcomes.loss} ultimately a loss · ${a.beOutcomes.undecided} not decided`}
              />
              {a.beOutcomes.resolvedWinRate != null && a.beOutcomes.decidedWinRate != null && (
                <CheckRow
                  label="Win rate counting tagged breakevens"
                  value={`${a.beOutcomes.resolvedWinRate.toFixed(1)}%`}
                  hint={`vs ${a.beOutcomes.decidedWinRate.toFixed(1)}% without them. Undecided breakevens stay out.`}
                />
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Daily trade limit"
          subtitle={
            a.cap ? `Rule: at most ${a.cap.max} trade${a.cap.max === 1 ? "" : "s"} per day` : "No daily limit set on this strategy"
          }
        >
          {a.cap ? (
            <>
              <CheckRow
                label="Days over the limit"
                value={`${a.cap.daysOver} of ${a.tradingDays}`}
                tone={a.cap.daysOver > 0 ? "loss" : "profit"}
              />
              <CheckRow label="Extra trades taken" value={String(a.cap.tradesOver)} />
              <CheckRow label="Most trades in one day" value={String(a.maxTradesInADay)} />
              <CheckRow
                label="Net P&L if the limit were enforced"
                value={signedMoney(a.cap.netWithCap)}
                hint={`Keeps only the first ${a.cap.max} trade${a.cap.max === 1 ? "" : "s"} each day`}
                tone={toneOf(a.cap.netWithCap)}
              />
              <CheckRow
                label="Difference vs actual"
                value={signedMoney(a.cap.netDelta)}
                tone={toneOf(a.cap.netDelta)}
              />
              {capExcess.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {capExcess.slice(0, 12).map((d) => (
                    <Badge key={d.date} tone="warning">
                      {d.date} · {d.trades}
                    </Badge>
                  ))}
                  {capExcess.length > 12 && <Badge>+{capExcess.length - 12} more</Badge>}
                </div>
              )}
            </>
          ) : (
            <>
              <CheckRow label="Average trades per day" value={a.avgTradesPerDay.toFixed(1)} />
              <CheckRow label="Most trades in one day" value={String(a.maxTradesInADay)} />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Edit the strategy and set a max trades per day to see how often the rule was broken and what
                enforcing it would have changed.
              </p>
            </>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="By weekday" subtitle="Net P&L by entry day, in your app timezone">
          <BucketChart data={a.byWeekday} />
        </Panel>
        <Panel
          title="By hour"
          subtitle={`Net P&L by entry hour, in your app timezone${
            a.tradesWithoutTime > 0 ? ` · ${a.tradesWithoutTime} trade${a.tradesWithoutTime === 1 ? "" : "s"} without a time left out` : ""
          }`}
        >
          {a.byHour.length > 0 ? (
            <BucketChart data={a.byHour} />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              None of these trades have an entry time. Tick &quot;Record the entry time&quot; when logging to see this.
            </p>
          )}
        </Panel>
        {a.byMonth.length > 1 && (
          <Panel title="By month" subtitle="Net P&L per calendar month">
            <BucketChart data={a.byMonth} />
          </Panel>
        )}
        <Panel title="Trade outcome distribution" subtitle="How many trades landed at each net P&L">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={a.distribution} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(l) => `Around ${l}`}
                formatter={(v) => [String(v), "Trades"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {a.distribution.map((b, i) => (
                  <Cell key={i} fill={(b.from + b.to) / 2 >= 0 ? "var(--profit)" : "var(--loss)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Long vs short">
          <BucketTable data={a.bySide} />
        </Panel>
        <Panel title="By exit type">
          <BucketTable data={a.byExit} />
        </Panel>
      </div>

    </div>
  );
}
