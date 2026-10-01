"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, ChevronDown, ChevronRight, ClipboardPlus, Download, ListOrdered, Pencil, Upload, Trash2 } from "lucide-react";
import { BacktestAnalysisView } from "@/components/backtest-analysis";
import { BacktestTradeForm } from "@/components/backtest-trade-form";
import { BacktestImport } from "@/components/backtest-import";
import { BacktestScenarioBar } from "@/components/backtest-scenario";
import { StrategyForm } from "@/components/strategy-form";
import { Badge } from "@/components/ui/badge";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { clearBacktestTrades } from "@/app/actions";
import {
  analyzeBacktest,
  applyScenario,
  backtestNet,
  groupTradesByMonthWeek,
  isScenarioActive,
  NO_SCENARIO,
  strategyRules,
  type BacktestAnalysis,
  type Scenario,
  type TradeGroupStats,
} from "@/lib/backtest";
import { backtestTradesToCsv } from "@/lib/backtest-csv";
import { downloadCsv } from "@/lib/csv";
import { formatCurrency } from "@/lib/metrics";
import { formatZonedDate, formatZonedTime, zonedDayKey } from "@/lib/timezone";
import type { BacktestTrade, Strategy } from "@/db/schema";

const round2 = (n: number) => Math.round(n * 100) / 100;

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </span>
  );
}

function GroupHeader({
  open,
  label,
  stats,
  strong = false,
}: {
  open: boolean;
  label: string;
  stats: TradeGroupStats;
  strong?: boolean;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-1.5">
        <Chevron size={15} className="shrink-0 text-[var(--text-muted)]" />
        <span className={strong ? "text-sm font-semibold text-[var(--text)]" : "text-[13px] font-medium text-[var(--text)]"}>
          {label}
        </span>
      </span>
      <span className="text-xs text-[var(--text-muted)]">
        {stats.count} trade{stats.count === 1 ? "" : "s"} · {stats.wins}W {stats.losses}L
        {stats.scratches > 0 ? ` ${stats.scratches}BE` : ""} · {stats.winRate.toFixed(0)}% win
      </span>
      <span
        className={`text-xs font-semibold tabular ${
          stats.net > 0 ? "text-[var(--profit)]" : stats.net < 0 ? "text-[var(--loss)]" : "text-[var(--text-muted)]"
        }`}
      >
        {stats.net > 0 ? "+" : ""}
        {formatCurrency(stats.net)}
      </span>
    </div>
  );
}

export function BacktestDetailClient({
  strategy,
  trades,
  analysis,
  timeZone,
  countBreakeven,
}: {
  strategy: Strategy;
  trades: BacktestTrade[];
  analysis: BacktestAnalysis;
  timeZone: string;
  countBreakeven: boolean;
}) {
  const router = useRouter();
  const rules = strategyRules(strategy);
  const [tab, setTab] = useState<"analysis" | "trades">("trades");
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [strategyKey, setStrategyKey] = useState(0);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeKey, setTradeKey] = useState(0);
  const [editing, setEditing] = useState<BacktestTrade | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Explicit open/closed choices only; anything not listed uses the default (newest month open, all weeks open).
  const [monthOpen, setMonthOpen] = useState<Record<string, boolean>>({});
  const [weekOpen, setWeekOpen] = useState<Record<string, boolean>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [scenario, setScenario] = useState<Scenario>(NO_SCENARIO);

  // Everything shown (rows, month/week totals, analysis) reads from this view. With no what-if it is
  // exactly the saved data; with one, the same points are re-priced for another symbol and/or size.
  const scenarioOn = isScenarioActive(scenario);
  const view = useMemo(() => applyScenario(strategy, trades, scenario), [strategy, trades, scenario]);
  const viewAnalysis = useMemo(
    () => (scenarioOn ? analyzeBacktest(view.strategy, view.trades, timeZone, countBreakeven) : analysis),
    [scenarioOn, view, timeZone, countBreakeven, analysis]
  );

  const newestFirst = useMemo(() => [...view.trades].reverse(), [view.trades]);
  const groups = useMemo(
    () => groupTradesByMonthWeek(newestFirst, view.strategy, timeZone, countBreakeven),
    [newestFirst, view.strategy, timeZone, countBreakeven]
  );
  const seqById = useMemo(() => new Map(trades.map((t, i) => [t.id, i + 1])), [trades]);
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of trades) {
      const k = zonedDayKey(t.entryTime, timeZone);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [trades, timeZone]);

  const lastEntry = trades.length ? trades[trades.length - 1].entryTime : null;

  function openLog() {
    setEditing(null);
    setTradeKey((k) => k + 1);
    setTradeOpen(true);
  }

  function openEdit(t: BacktestTrade) {
    // Rows may be re-priced by the what-if view; editing always works on what was actually saved.
    setEditing(trades.find((x) => x.id === t.id) ?? t);
    setTradeKey((k) => k + 1);
    setTradeOpen(true);
  }

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = strategy.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "strategy";
    const suffix = scenarioOn ? "-whatif" : "";
    const csv = backtestTradesToCsv(trades, strategy, timeZone, scenarioOn ? view : undefined);
    downloadCsv(`backtest-${safe}${suffix}-${stamp}.csv`, csv);
  }

  function expandAll() {
    setMonthOpen(Object.fromEntries(groups.map((m) => [m.key, true])));
    setWeekOpen(Object.fromEntries(groups.flatMap((m) => m.weeks.map((w) => [`${m.key}|${w.key}`, true]))));
  }

  function collapseAll() {
    setMonthOpen(Object.fromEntries(groups.map((m) => [m.key, false])));
  }

  async function handleClear() {
    await clearBacktestTrades(strategy.id);
    setConfirmClear(false);
    router.refresh();
  }

  const tabClass = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
      active ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/backtest"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={13} />
          All strategies
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-[var(--text)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: strategy.color }} />
              <span className="min-w-0 break-words">{strategy.name}</span>
            </h1>
            {strategy.description && (
              <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{strategy.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setStrategyKey((k) => k + 1);
                setStrategyOpen(true);
              }}
              className={secondaryButtonClass}
            >
              <Pencil size={15} />
              Edit
            </button>
            <button onClick={() => setImportOpen(true)} className={secondaryButtonClass}>
              <Upload size={15} />
              Import CSV
            </button>
            <button
              onClick={handleExport}
              disabled={trades.length === 0}
              title={scenarioOn ? "Contracts, fees, gross and net P&L use the what-if numbers, replacing the numbers as logged" : undefined}
              className={`${secondaryButtonClass} disabled:opacity-50`}
            >
              <Download size={15} />
              Export CSV{scenarioOn ? " (+ what-if)" : ""}
            </button>
            <button onClick={openLog} className={primaryButtonClass}>
              <ClipboardPlus size={16} />
              Log trade
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Symbol" value={strategy.symbol} />
          <Chip label="Timeframe" value={strategy.timeframe} />
          <Chip label="Size" value={`${strategy.contracts} contract${strategy.contracts === 1 ? "" : "s"}`} />
          <Chip label="Point value" value={formatCurrency(strategy.pointValue)} />
          {rules.mode === "rr" ? (
            <>
              <Chip label="R:R" value={`1 : ${round2(rules.rr ?? 0)}`} />
              {rules.sl != null && <Chip label="Risk" value={`${rules.sl} pts`} />}
              {rules.tp != null && <Chip label="TP" value={`${round2(rules.tp)} pts`} />}
            </>
          ) : (
            <>
              {rules.tp != null && <Chip label="TP" value={`${rules.tp} pts`} />}
              {rules.sl != null && <Chip label="SL" value={`${rules.sl} pts`} />}
              {rules.rr != null && <Chip label="R:R" value={`1 : ${round2(rules.rr)}`} />}
            </>
          )}
          {strategy.maxTradesPerDay != null && <Chip label="Max / day" value={String(strategy.maxTradesPerDay)} />}
          {strategy.feePerContract > 0 && <Chip label="Fee" value={`${formatCurrency(strategy.feePerContract)} / contract`} />}
          {strategy.startingCapital > 0 && <Chip label="Capital" value={formatCurrency(strategy.startingCapital)} />}
        </div>
        {strategy.notes && (
          <p className="mt-3 whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--text-muted)]">
            {strategy.notes}
          </p>
        )}
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
        <button className={tabClass(tab === "trades")} onClick={() => setTab("trades")}>
          <ListOrdered size={15} />
          Trades
          <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] tabular text-[var(--text-muted)]">
            {trades.length}
          </span>
        </button>
        <button className={tabClass(tab === "analysis")} onClick={() => setTab("analysis")}>
          <BarChart3 size={15} />
          Analysis
        </button>
      </div>

      {trades.length > 0 && (
        <BacktestScenarioBar
          strategy={strategy}
          trades={trades}
          timeZone={timeZone}
          countBreakeven={countBreakeven}
          scenario={scenario}
          onChange={setScenario}
        />
      )}

      {trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-[var(--text)]">No backtest trades yet</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
            Log trades one by one as you scroll through the chart, or import a CSV of results. The full analysis
            appears as soon as there is a trade to analyze.
          </p>
          <div className="mt-5 flex gap-2">
            <button onClick={openLog} className={primaryButtonClass}>
              <ClipboardPlus size={16} />
              Log first trade
            </button>
            <button onClick={() => setImportOpen(true)} className={secondaryButtonClass}>
              <Upload size={15} />
              Import CSV
            </button>
          </div>
        </div>
      ) : tab === "analysis" ? (
        <BacktestAnalysisView strategy={view.strategy} analysis={viewAnalysis} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--text-muted)]">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3">Exit</th>
                    <th className="px-4 py-3 text-right">Fees</th>
                    <th className="px-4 py-3 text-right">Net P&amp;L</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((m, mi) => {
                    const mOpen = monthOpen[m.key] ?? mi === 0;
                    return (
                      <Fragment key={m.key}>
                        <tr
                          onClick={() => setMonthOpen((o) => ({ ...o, [m.key]: !mOpen }))}
                          className="cursor-pointer border-b border-[var(--border)] bg-[var(--surface-2)] hover:brightness-110"
                        >
                          <td colSpan={11} className="px-4 py-3">
                            <GroupHeader open={mOpen} label={m.label} stats={m} strong />
                          </td>
                        </tr>
                        {mOpen &&
                          m.weeks.map((w) => {
                            const wKey = `${m.key}|${w.key}`;
                            const wOpen = weekOpen[wKey] ?? true;
                            return (
                              <Fragment key={wKey}>
                                <tr
                                  onClick={() => setWeekOpen((o) => ({ ...o, [wKey]: !wOpen }))}
                                  className="cursor-pointer border-b border-[var(--border)] hover:bg-[var(--surface-2)]"
                                >
                                  <td colSpan={11} className="py-2 pl-8 pr-4">
                                    <GroupHeader open={wOpen} label={`Week of ${w.label}`} stats={w} />
                                  </td>
                                </tr>
                                {wOpen &&
                                  w.trades.map((t) => {
                                    const net = backtestNet(t, view.strategy);
                                    return (
                                      <tr
                                        key={t.id}
                                        onClick={() => openEdit(t)}
                                        className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                                      >
                                        <td className="px-4 py-3 tabular text-[var(--text-faint)]">{seqById.get(t.id)}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">
                                          {formatZonedDate(t.entryTime, timeZone)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">
                                          {t.hasEntryTime ? (
                                            formatZonedTime(t.entryTime, timeZone)
                                          ) : (
                                            <span className="text-[var(--text-faint)]">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          <Badge tone={t.side === "LONG" ? "profit" : "loss"}>{t.side}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular">{t.contracts}</td>
                                        <td className="px-4 py-3 text-right tabular text-[var(--text-muted)]">
                                          {t.points > 0 ? "+" : ""}
                                          {t.points.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                          <Badge
                                            tone={
                                              t.exitReason === "TP"
                                                ? "profit"
                                                : t.exitReason === "SL"
                                                  ? "loss"
                                                  : t.exitReason === "BE"
                                                    ? "accent"
                                                    : "neutral"
                                            }
                                          >
                                            {t.exitReason === "MANUAL"
                                              ? "CUSTOM"
                                              : t.exitReason === "BE" && t.beOutcome
                                                ? `BE · ${t.beOutcome}`
                                                : t.exitReason}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right tabular text-[var(--text-muted)]">
                                          {formatCurrency(t.fees)}
                                        </td>
                                        <td
                                          className={`px-4 py-3 text-right tabular font-semibold ${
                                            net > 0
                                              ? "text-[var(--profit)]"
                                              : net < 0
                                                ? "text-[var(--loss)]"
                                                : "text-[var(--text-muted)]"
                                          }`}
                                        >
                                          {formatCurrency(net)}
                                        </td>
                                        <td className="max-w-[220px] truncate px-4 py-3 text-[var(--text-muted)]">
                                          {t.notes ?? ""}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <Pencil size={14} className="inline text-[var(--text-faint)]" />
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex gap-2">
              <button onClick={expandAll} className={secondaryButtonClass}>
                Expand all
              </button>
              <button onClick={collapseAll} className={secondaryButtonClass}>
                Collapse all
              </button>
            </span>
            {confirmClear ? (
              <span className="flex items-center gap-2 text-xs text-[var(--loss)]">
                Delete all {trades.length} trades in this strategy?
                <button onClick={handleClear} className={dangerButtonClass}>
                  Yes, delete all
                </button>
                <button onClick={() => setConfirmClear(false)} className={secondaryButtonClass}>
                  Keep
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmClear(true)} className={dangerButtonClass}>
                <Trash2 size={14} />
                Delete all trades
              </button>
            )}
          </div>
        </div>
      )}

      <StrategyForm
        key={`s-${strategyKey}`}
        open={strategyOpen}
        onClose={() => setStrategyOpen(false)}
        strategy={strategy}
        tradeCount={trades.length}
      />
      <BacktestTradeForm
        key={`t-${tradeKey}`}
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        strategy={strategy}
        trade={editing}
        timeZone={timeZone}
        lastEntryTime={lastEntry}
        dayCounts={dayCounts}
      />
      <BacktestImport
        key={`i-${importOpen}`}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        strategy={strategy}
        timeZone={timeZone}
      />
    </div>
  );
}
