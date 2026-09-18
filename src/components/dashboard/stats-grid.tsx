import { Flame, Percent, Scale, Calculator, ArrowLeftRight, DollarSign, CalendarDays, Repeat } from "lucide-react";
import { StatCard, StreakBadges } from "@/components/dashboard/stat-card";
import { WinRateGauge } from "@/components/dashboard/win-rate-gauge";
import { RatioRing } from "@/components/dashboard/ratio-ring";
import { SplitBar } from "@/components/dashboard/split-bar";
import { Sparkline } from "@/components/dashboard/sparkline";
import { formatCurrency } from "@/lib/metrics";
import type { StreakInfo, TradeStats } from "@/lib/metrics";

const valueClass = "text-[22px] font-semibold leading-none tracking-tight";
const subClass = "mt-1.5 text-xs text-[var(--text-muted)]";

function signedCurrency(value: number) {
  return `${value < 0 ? "-" : "+"}${formatCurrency(Math.abs(value))}`;
}

function toneClass(value: number) {
  return value >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]";
}

export function StatsGrid({
  stats,
  dayStreaks,
  equityValues,
  netPnl,
  totalFees,
  scratches,
}: {
  stats: TradeStats;
  dayStreaks: StreakInfo;
  equityValues: number[];
  /** True net P&L / fees / breakeven count across every trade, unaffected by the count/exclude-breakeven setting. Defaults to `stats` if omitted. */
  netPnl?: number;
  totalFees?: number;
  scratches?: number;
}) {
  const hasTrades = stats.totalTrades > 0;
  const winLossRatio = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : null;
  const trueNetPnl = netPnl ?? stats.netPnl;
  const trueTotalFees = totalFees ?? stats.totalFees;
  const trueScratches = scratches ?? stats.scratches;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
      <StatCard
        label="Trade win"
        icon={Percent}
        hint="Share of closed trades that finished profitable, with the win / breakeven / loss counts."
        className="lg:row-span-2"
      >
        <WinRateGauge
          wins={stats.wins}
          scratches={trueScratches}
          losses={stats.losses}
          winRate={stats.winRate}
        />
      </StatCard>

      <StatCard
        label="Profit factor"
        icon={Scale}
        hint="Gross profit divided by gross loss. Above 1.00 means you earn more than you give back. The ring's halfway mark is that breakeven point."
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div
              className={`${valueClass} ${
                stats.profitFactor == null
                  ? "text-[var(--text)]"
                  : toneClass(stats.profitFactor - 1)
              }`}
            >
              {stats.profitFactor == null ? "—" : stats.profitFactor.toFixed(2)}
            </div>
            <div className={subClass}>
              {formatCurrency(stats.grossWinAmount)} won /{" "}
              {formatCurrency(stats.grossLossAmount)} lost
            </div>
          </div>
          <RatioRing won={stats.grossWinAmount} lost={stats.grossLossAmount} />
        </div>
      </StatCard>

      <StatCard
        label="Trade expectancy"
        icon={Calculator}
        hint="Average net profit or loss you can expect from each trade you take."
      >
        <div className={`${valueClass} ${toneClass(stats.expectancy)}`}>
          {hasTrades ? signedCurrency(stats.expectancy) : "—"}
        </div>
        <div className={subClass}>
          per trade across {stats.totalTrades} trade{stats.totalTrades === 1 ? "" : "s"}
        </div>
      </StatCard>

      <StatCard
        label="Avg win / loss trade"
        icon={ArrowLeftRight}
        hint="How many dollars the average winner makes for every dollar the average loser gives back."
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={`${valueClass} text-[var(--text)]`}>
            {winLossRatio == null ? "—" : winLossRatio.toFixed(2)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">ratio</span>
        </div>
        <div className="mt-3">
          <SplitBar left={stats.avgWin} right={stats.avgLoss} />
          <div className="mt-1.5 flex items-center justify-between text-xs font-medium">
            <span className="text-[var(--profit)]">
              {stats.avgWin > 0 ? "+" : ""}
              {formatCurrency(stats.avgWin)}
            </span>
            <span className="text-[var(--loss)]">
              {stats.avgLoss > 0 ? "-" : ""}
              {formatCurrency(stats.avgLoss)}
            </span>
          </div>
        </div>
      </StatCard>

      <StatCard
        label="Net P&L"
        icon={DollarSign}
        hint="All-time profit after fees and commissions for the selected accounts."
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`${valueClass} ${toneClass(trueNetPnl)}`}>
              {equityValues.length > 1 ? signedCurrency(trueNetPnl) : "—"}
            </div>
            <div className={subClass}>{formatCurrency(trueTotalFees)} in fees</div>
          </div>
          <Sparkline values={equityValues} tone={trueNetPnl >= 0 ? "profit" : "loss"} />
        </div>
      </StatCard>

      <StatCard
        label="Day streak"
        icon={CalendarDays}
        hint="Consecutive trading days currently green or red. Badges show your best and worst day runs."
        badges={<StreakBadges wins={dayStreaks.maxWin} losses={dayStreaks.maxLoss} />}
      >
        <StreakValue
          count={Math.abs(dayStreaks.current)}
          unit={Math.abs(dayStreaks.current) === 1 ? "day" : "days"}
          direction={dayStreaks.current}
        />
      </StatCard>

      <StatCard
        label="Trade streak"
        icon={Repeat}
        hint="Consecutive trades currently won or lost. Badges show your best and worst trade runs."
        badges={<StreakBadges wins={stats.maxWinStreak} losses={stats.maxLossStreak} />}
      >
        <StreakValue
          count={Math.abs(stats.currentStreak)}
          unit={Math.abs(stats.currentStreak) === 1 ? "trade" : "trades"}
          direction={stats.currentStreak}
        />
      </StatCard>
    </div>
  );
}

function StreakValue({
  count,
  unit,
  direction,
}: {
  count: number;
  unit: string;
  direction: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`${valueClass} ${
          direction === 0 ? "text-[var(--text)]" : toneClass(direction)
        }`}
      >
        {count} <span className="text-base font-medium text-[var(--text-muted)]">{unit}</span>
      </span>
      {count >= 2 && <Flame size={18} className="text-[var(--warning)]" />}
    </div>
  );
}
