import Link from "next/link";
import { Scale, ShieldAlert, Target, LayoutDashboard, LineChart, Crown, Link2 } from "lucide-react";
import { getAllAccounts, getAppSettings, getTradesForAccounts } from "@/lib/data";
import { resolveSelectedAccountIds } from "@/lib/filter";
import {
  computeBalance,
  computeCombinedEquitySeries,
  computeDayStreaks,
  computeTargetProgress,
  computeTradeStats,
  computeTrailingDrawdown,
  formatCurrency,
} from "@/lib/metrics";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EquityChart } from "@/components/equity-chart";
import { EmptyState } from "@/components/empty-state";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { TradesPanel } from "@/components/dashboard/trades-panel";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const accountsParam = typeof params.accounts === "string" ? params.accounts : undefined;

  const [allAccounts, settings] = await Promise.all([getAllAccounts(), getAppSettings()]);
  const timeZone = settings.timezone;

  if (allAccounts.length === 0) {
    return (
      <EmptyState
        title="Set up your first account"
        description="Add a prop firm or broker account to start tracking balance, trailing drawdown, and targets."
        actionHref="/accounts"
        actionLabel="Add an account"
      />
    );
  }

  const selectedIds = resolveSelectedAccountIds(accountsParam, allAccounts);
  const selectedAccounts = allAccounts.filter((a) => selectedIds.includes(a.id));
  const trades = await getTradesForAccounts(selectedIds);

  const tradesByAccount = new Map<string, typeof trades>();
  for (const t of trades) {
    const arr = tradesByAccount.get(t.accountId) ?? [];
    arr.push(t);
    tradesByAccount.set(t.accountId, arr);
  }

  const metricsTrades = settings.countBreakeven ? trades : trades.filter((t) => !t.isBreakeven);
  const stats = computeTradeStats(metricsTrades, timeZone);
  const trueStats = computeTradeStats(trades, timeZone);
  const dayStreaks = computeDayStreaks(metricsTrades, timeZone);
  const equitySeries = computeCombinedEquitySeries(selectedAccounts, trades);
  const equityValues = equitySeries.map((p) => p.balance);
  const combinedBalance = equityValues[equityValues.length - 1];

  const singleAccount = selectedAccounts.length === 1 ? selectedAccounts[0] : null;
  const singleTrades = singleAccount ? tradesByAccount.get(singleAccount.id) ?? [] : [];
  const drawdown = singleAccount ? computeTrailingDrawdown(singleAccount, singleTrades) : null;
  const target = singleAccount ? computeTargetProgress(singleAccount, singleTrades) : null;

  return (
    <div className="flex flex-col gap-3 md:h-full md:min-h-0">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--text)]">
            <LayoutDashboard size={20} className="text-[var(--accent)]" />
            {singleAccount ? singleAccount.name : "Overview"}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            {singleAccount
              ? `${singleAccount.broker ?? "Account"} · started ${formatCurrency(singleAccount.startingBalance)}`
              : `Combined view across ${selectedAccounts.length} account${selectedAccounts.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {/* Account standing: balance, drawdown room, target progress */}
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium text-[var(--text-muted)]">
              {singleAccount ? "Account balance" : "Combined balance"}
            </span>
            <Scale size={15} className="text-[var(--text-faint)]" />
          </div>
          <div className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight text-[var(--text)]">
            {formatCurrency(combinedBalance)}
          </div>
          <div
            className={`mt-1.5 text-xs font-medium ${
              trueStats.netPnl >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
            }`}
          >
            {trueStats.netPnl >= 0 ? "+" : "-"}
            {formatCurrency(Math.abs(trueStats.netPnl))} logged here
          </div>
        </div>

        {singleAccount && drawdown?.enabled ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-medium text-[var(--text-muted)]">
                Trailing drawdown
              </span>
              <ShieldAlert size={15} className="text-[var(--text-faint)]" />
            </div>
            <div
              className={`mt-1.5 text-[22px] font-semibold leading-none tracking-tight ${
                drawdown.breached ? "text-[var(--loss)]" : "text-[var(--text)]"
              }`}
            >
              {formatCurrency(Math.max(0, drawdown.distanceToBreach))}
            </div>
            <div className="mt-2">
              <Progress
                pct={
                  singleAccount.trailingDrawdown
                    ? (drawdown.distanceToBreach / singleAccount.trailingDrawdown) * 100
                    : 100
                }
                tone={drawdown.breached ? "loss" : "profit"}
              />
            </div>
            <div className="mt-1.5 text-xs text-[var(--text-muted)]">
              cushion · stop-out {formatCurrency(drawdown.threshold)}
              {drawdown.isLocked && " · locked"}
            </div>
          </div>
        ) : null}

        {singleAccount && target?.enabled ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-medium text-[var(--text-muted)]">
                Target progress
              </span>
              <Target size={15} className="text-[var(--text-faint)]" />
            </div>
            <div
              className={`mt-1.5 text-[22px] font-semibold leading-none tracking-tight ${
                target.reached ? "text-[var(--profit)]" : "text-[var(--text)]"
              }`}
            >
              {target.progressPct.toFixed(2)}%
            </div>
            <div className="mt-2">
              <Progress pct={target.progressPct} tone={target.reached ? "profit" : "accent"} />
            </div>
            <div className="mt-1.5 text-xs text-[var(--text-muted)]">
              {target.reached
                ? `target of ${formatCurrency(target.target)} reached`
                : `${formatCurrency(target.remaining)} to go of ${formatCurrency(target.target)}`}
            </div>
          </div>
        ) : null}

        {!singleAccount &&
          selectedAccounts.map((a) => {
            const at = tradesByAccount.get(a.id) ?? [];
            const balance = computeBalance(a, at);
            const dd = computeTrailingDrawdown(a, at);
            const tg = computeTargetProgress(a, at);
            return (
              <Link
                key={a.id}
                href={`/?accounts=${a.id}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  <span className="truncate text-[15px] font-medium text-[var(--text)]">{a.name}</span>
                  {a.role === "MASTER" && (
                    <Badge tone="accent">
                      <Crown size={10} className="mr-0.5" />
                      MASTER
                    </Badge>
                  )}
                  {a.role === "FOLLOWER" && (
                    <Badge>
                      <Link2 size={10} className="mr-0.5" />
                      COPY
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 text-[20px] font-semibold leading-none tracking-tight text-[var(--text)]">
                  {formatCurrency(balance)}
                </div>
                {dd.enabled && (
                  <div className="mt-2">
                    <Progress
                      pct={a.trailingDrawdown ? (dd.distanceToBreach / a.trailingDrawdown) * 100 : 100}
                      tone={dd.breached ? "loss" : "profit"}
                    />
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {formatCurrency(Math.max(0, dd.distanceToBreach))} cushion
                    </p>
                  </div>
                )}
                {tg.enabled && (
                  <div className="mt-2">
                    <Progress pct={tg.progressPct} tone={tg.reached ? "profit" : "accent"} />
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {tg.progressPct.toFixed(2)}% to target
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
      </div>

      <div className="shrink-0">
        <StatsGrid
          stats={stats}
          dayStreaks={dayStreaks}
          equityValues={equityValues}
          netPnl={trueStats.netPnl}
          totalFees={trueStats.totalFees}
        />
      </div>

      <div className="flex flex-col gap-3 md:min-h-0 md:flex-1 xl:flex-row">
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:min-h-0 md:flex-1 xl:basis-2/3">
          <div className="mb-1 flex shrink-0 items-center justify-between">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--text)]">
              <LineChart size={17} className="text-[var(--accent)]" />
              Equity curve
            </h2>
            <Badge tone={trueStats.netPnl >= 0 ? "profit" : "loss"}>
              {trueStats.netPnl >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(trueStats.netPnl))}
            </Badge>
          </div>
          {equityValues.length > 1 ? (
            <div className="h-[280px] md:h-auto md:min-h-0 md:flex-1">
              <EquityChart
                data={equitySeries.map((p, i) => ({ index: i, date: p.date, balance: p.balance }))}
                drawdownThreshold={singleAccount && drawdown?.enabled ? drawdown.threshold : null}
                height="100%"
              />
            </div>
          ) : (
            <p className="flex h-[280px] items-center justify-center text-center text-sm text-[var(--text-muted)] md:h-auto md:flex-1">
              No trades yet — log a trade to see your equity curve.
            </p>
          )}
        </div>
        <div className="h-[420px] md:h-auto md:min-h-0 md:flex-1 xl:basis-1/3">
          <TradesPanel trades={trades} timeZone={timeZone} />
        </div>
      </div>
    </div>
  );
}
