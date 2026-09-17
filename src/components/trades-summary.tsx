import { formatCurrency } from "@/lib/metrics";
import type { TradeStats } from "@/lib/metrics";

function toneClass(tone: "profit" | "loss" | "neutral" | "text") {
  return {
    profit: "text-[var(--profit)]",
    loss: "text-[var(--loss)]",
    neutral: "text-[var(--text-faint)]",
    text: "text-[var(--text)]",
  }[tone];
}

function Stat({ label, value, tone = "text" }: { label: string; value: string; tone?: "profit" | "loss" | "neutral" | "text" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--text-muted)]">{label}</span>
      <span className={`text-base font-semibold tabular tracking-tight ${toneClass(tone)}`}>{value}</span>
    </div>
  );
}

export function TradesSummary({
  stats,
  netPnl,
  totalTrades,
  scratches,
}: {
  stats: TradeStats;
  /** True net P&L / total trades / breakeven count across every filtered trade, unaffected by the count/exclude-breakeven setting — each defaults to the matching `stats` field if omitted. */
  netPnl?: number;
  totalTrades?: number;
  scratches?: number;
}) {
  const trueTotalTrades = totalTrades ?? stats.totalTrades;
  const trueScratches = scratches ?? stats.scratches;
  const hasTrades = stats.totalTrades > 0;
  const winLossRatio = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : null;
  const trueNetPnl = netPnl ?? stats.netPnl;
  const netSign = trueNetPnl >= 0 ? "+" : "-";

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-4 xl:grid-cols-8">
      <Stat label="Total trades" value={String(trueTotalTrades)} />
      <Stat label="Wins" value={String(stats.wins)} tone="profit" />
      <Stat label="Losses" value={String(stats.losses)} tone="loss" />
      <Stat label="Breakevens" value={String(trueScratches)} tone="neutral" />
      <Stat label="Win rate" value={hasTrades ? `${stats.winRate.toFixed(2)}%` : "—"} />
      <Stat
        label="Net P&L"
        value={`${netSign}${formatCurrency(Math.abs(trueNetPnl))}`}
        tone={trueNetPnl >= 0 ? "profit" : "loss"}
      />
      <Stat label="Profit factor" value={stats.profitFactor == null ? "—" : stats.profitFactor.toFixed(2)} />
      <Stat label="Avg win / loss" value={winLossRatio == null ? "—" : winLossRatio.toFixed(2)} />
    </div>
  );
}
