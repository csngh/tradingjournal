"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FlaskConical, Layers, Users } from "lucide-react";
import { BacktestAnalysisView } from "@/components/backtest-analysis";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/form";
import { KpiCard } from "@/components/ui/kpi-card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { formatCurrency } from "@/lib/metrics";
import { formatZonedDate, zonedDayKey } from "@/lib/timezone";
import { filterTradesByDateRange } from "@/lib/backtest";
import {
  applyPayoutsToAnalysis,
  runMultiAccountSim,
  type AccountGroup,
  type MultiAccountSimResult,
  type PayoutCycle,
  type PayoutInfo,
} from "@/lib/multi-account-sim";
import type { BacktestTrade, Strategy } from "@/db/schema";

/** Earliest/latest trade day across the given trades, in the app timezone; null if there's nothing. */
function dateRangeOf(trades: BacktestTrade[], timeZone: string): { from: string | null; to: string | null } {
  if (trades.length === 0) return { from: null, to: null };
  let from = "";
  let to = "";
  for (const t of trades) {
    const day = zonedDayKey(t.entryTime, timeZone);
    if (!from || day < from) from = day;
    if (!to || day > to) to = day;
  }
  return { from, to };
}

/** Stable empty-array fallback so a missing-trades lookup doesn't create a new reference every render. */
const EMPTY_TRADES: BacktestTrade[] = [];

const GROUP_QUICK = [2, 3, 4, 5, 6];
const ACCOUNTS_QUICK = [1, 2, 3, 5, 10];
const ROTATION_QUICK = [1, 2, 3, 5];

const SETTINGS_STORAGE_KEY = "multi-account-sim-settings";

type PersistedSettings = {
  strategyId?: string;
  enableGrouping?: boolean;
  numGroups?: number;
  accountsPerGroup?: number;
  tradesPerRotation?: number;
  showPayout?: boolean;
  payoutTargetInput?: string;
  payoutBufferInput?: string;
  payoutSplitInput?: string;
};

/** Reads whatever was last saved to this browser; never throws (private browsing, blocked storage). */
function loadPersistedSettings(): PersistedSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSettings) : {};
  } catch {
    return {};
  }
}

function StrategySelect({
  strategies,
  value,
  onChange,
}: {
  strategies: Strategy[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Strategy</label>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {strategies.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function signedMoney(n: number): string {
  return `${n > 0 ? "+" : ""}${formatCurrency(n)}`;
}

/** e.g. 3 groups, rotation 2 -> "AA, BB, CC, AA...". Used in the rotation-pattern explainer text. */
function rotationPreview(result: MultiAccountSimResult): string {
  const letters = result.groups.slice(0, 3).map((g) => (g.label.match(/Group (.)/)?.[1] ?? "?").repeat(result.tradesPerRotation));
  return `${letters.join(", ")}, ${letters[0]}...`;
}

type CompareRow = {
  label: string;
  full: string;
  groups: string[];
  // Raw values for highlighting the best column; null = no winner highlight for this row.
  fullRaw: number | null;
  groupRaw: (number | null)[];
  higherIsBetter: boolean | null;
};

function ComparisonTable({ result }: { result: MultiAccountSimResult }) {
  const f = result.fullAnalysis;
  const gs = result.groups.map((g) => g.analysis);

  const rows: CompareRow[] = [
    {
      label: "Trades",
      full: String(f.totalTrades),
      groups: gs.map((g) => String(g.totalTrades)),
      fullRaw: null,
      groupRaw: gs.map(() => null),
      higherIsBetter: null,
    },
    {
      label: "Net P&L",
      full: signedMoney(f.netPnl),
      groups: gs.map((g) => signedMoney(g.netPnl)),
      // No winner highlight: Full always has ~N× the trades of any one group, so it's not a fair
      // comparison. The risk-adjusted rows below are.
      fullRaw: null,
      groupRaw: gs.map(() => null),
      higherIsBetter: null,
    },
    ...(result.payoutTarget != null
      ? [
          {
            label: "Payout total (per account)",
            full: formatCurrency(result.fullPayout.totalPayout),
            groups: result.groups.map((g) => formatCurrency(g.payout.totalPayout)),
            fullRaw: result.fullPayout.totalPayout,
            groupRaw: result.groups.map((g) => g.payout.totalPayout),
            higherIsBetter: true,
          } satisfies CompareRow,
          {
            label: "Payout cycles",
            full: String(result.fullPayout.cycles),
            groups: result.groups.map((g) => String(g.payout.cycles)),
            fullRaw: null,
            groupRaw: result.groups.map(() => null),
            higherIsBetter: null,
          } satisfies CompareRow,
        ]
      : []),
    {
      label: "Win rate",
      full: `${f.winRate.toFixed(1)}%`,
      groups: gs.map((g) => `${g.winRate.toFixed(1)}%`),
      fullRaw: f.winRate,
      groupRaw: gs.map((g) => g.winRate),
      higherIsBetter: true,
    },
    {
      label: "Profit factor",
      full: f.profitFactor == null ? "n/a" : f.profitFactor.toFixed(2),
      groups: gs.map((g) => (g.profitFactor == null ? "n/a" : g.profitFactor.toFixed(2))),
      fullRaw: f.profitFactor,
      groupRaw: gs.map((g) => g.profitFactor),
      higherIsBetter: true,
    },
    {
      label: "Max drawdown",
      full: formatCurrency(-f.maxDrawdown),
      groups: gs.map((g) => formatCurrency(-g.maxDrawdown)),
      fullRaw: f.maxDrawdown,
      groupRaw: gs.map((g) => g.maxDrawdown),
      higherIsBetter: false,
    },
    {
      label: "Recovery factor",
      full: f.recoveryFactor == null ? "n/a" : f.recoveryFactor.toFixed(2),
      groups: gs.map((g) => (g.recoveryFactor == null ? "n/a" : g.recoveryFactor.toFixed(2))),
      fullRaw: f.recoveryFactor,
      groupRaw: gs.map((g) => g.recoveryFactor),
      higherIsBetter: true,
    },
    {
      label: "Max loss streak",
      full: String(f.maxLossStreak),
      groups: gs.map((g) => String(g.maxLossStreak)),
      fullRaw: f.maxLossStreak,
      groupRaw: gs.map((g) => g.maxLossStreak),
      higherIsBetter: false,
    },
  ];

  const cellClass = (value: number | null, all: (number | null)[], higherIsBetter: boolean | null) => {
    if (higherIsBetter == null || value == null) return "text-[var(--text)]";
    const defined = all.filter((v): v is number => v != null);
    if (!defined.length) return "text-[var(--text)]";
    const best = higherIsBetter ? Math.max(...defined) : Math.min(...defined);
    return value === best ? "text-[var(--profit)] font-semibold" : "text-[var(--text-muted)]";
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-[15px] font-semibold text-[var(--text)]">Full backtest vs. each group</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        &quot;Full&quot; is every trade on one account, undivided.{" "}
        {result.tradesPerRotation === 1
          ? `Each group only sees every ${result.numGroups}${result.numGroups === 2 ? "nd" : result.numGroups === 3 ? "rd" : "th"} trade, round-robin.`
          : `Trades rotate in blocks of ${result.tradesPerRotation} per group (${rotationPreview(result)}), so each group only sees its own blocks.`}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--text-muted)]">
              <th className="py-2 pr-3">Metric</th>
              <th className="py-2 pr-3 text-right">Full</th>
              {result.groups.map((g) => (
                <th key={g.index} className="py-2 pr-3 text-right">
                  {g.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2 pr-3 text-[var(--text-muted)]">{r.label}</td>
                <td className={`py-2 pr-3 text-right tabular ${cellClass(r.fullRaw, [r.fullRaw, ...r.groupRaw], r.higherIsBetter)}`}>
                  {r.full}
                </td>
                {r.groups.map((val, i) => (
                  <td
                    key={i}
                    className={`py-2 pr-3 text-right tabular ${cellClass(r.groupRaw[i], [r.fullRaw, ...r.groupRaw], r.higherIsBetter)}`}
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Average calendar days between one payout and the next, skipping the climb to the first one. */
function avgDaysBetweenPayouts(events: PayoutCycle[]): number | null {
  if (events.length < 2) return null;
  let totalDays = 0;
  for (let i = 1; i < events.length; i++) {
    totalDays += (new Date(events[i].date).getTime() - new Date(events[i - 1].date).getTime()) / 86_400_000;
  }
  return totalDays / (events.length - 1);
}

function AvgPayoutDaysCard({ payout }: { payout: PayoutInfo }) {
  if (payout.events.length === 0) return null;
  const avgDays = avgDaysBetweenPayouts(payout.events);
  return (
    <KpiCard
      label="Days between payouts"
      value={avgDays == null ? "n/a" : `${avgDays.toFixed(1)}d`}
      sub={
        avgDays == null
          ? "Only one payout so far"
          : `avg across ${payout.cycles - 1} gap${payout.cycles - 1 === 1 ? "" : "s"}, after the first buildup`
      }
    />
  );
}

function PayoutCycleTable({
  label,
  payout,
  payoutTarget,
  payoutBuffer,
  payoutSplit,
  timeZone,
}: {
  label: string;
  payout: PayoutInfo;
  payoutTarget: number;
  payoutBuffer: number;
  payoutSplit: number;
  timeZone: string;
}) {
  const hasSplit = payoutSplit < 100;
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-[15px] font-semibold text-[var(--text)]">Buffer build-up &amp; withdrawal cycles: {label}</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        Per account. Each time profit reaches {formatCurrency(payoutTarget)}, {formatCurrency(payoutTarget - payoutBuffer)}{" "}
        is taken out and {formatCurrency(payoutBuffer)} stays banked.{" "}
        {hasSplit
          ? `Of what's taken out, ${payoutSplit}% is actually disbursed.`
          : "All of it is disbursed (100% split)."}
      </p>
      {payout.events.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
          Profit never reached {formatCurrency(payoutTarget)}. No withdrawals yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--text-muted)]">
                <th className="py-2 pr-3">Cycle</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3 text-right">Buffer built to</th>
                <th className="py-2 pr-3 text-right">Withdrawn</th>
                {hasSplit && <th className="py-2 pr-3 text-right">Disbursed ({payoutSplit}%)</th>}
                <th className="py-2 pr-3 text-right">Buffer kept</th>
              </tr>
            </thead>
            <tbody>
              {payout.events.map((e) => (
                <tr key={e.cycle} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-3 text-[var(--text-muted)]">#{e.cycle}</td>
                  <td className="py-2 pr-3 text-[var(--text)]">{formatZonedDate(e.date, timeZone)}</td>
                  <td className="py-2 pr-3 text-right tabular text-[var(--text)]">{formatCurrency(e.profitAtTrigger)}</td>
                  <td
                    className={`py-2 pr-3 text-right tabular ${hasSplit ? "text-[var(--text-muted)]" : "font-medium text-[var(--profit)]"}`}
                  >
                    {formatCurrency(e.withdrawn)}
                  </td>
                  {hasSplit && (
                    <td className="py-2 pr-3 text-right tabular font-medium text-[var(--profit)]">
                      {formatCurrency(e.disbursed)}
                    </td>
                  )}
                  <td className="py-2 pr-3 text-right tabular text-[var(--text-muted)]">{formatCurrency(e.bufferAfter)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 pr-3 text-[var(--text-muted)]">
                  Total disbursed ({payout.cycles} cycle{payout.cycles === 1 ? "" : "s"})
                </td>
                <td
                  colSpan={hasSplit ? 2 : 1}
                  className="pt-3 pr-3 text-right tabular font-semibold text-[var(--profit)]"
                >
                  {formatCurrency(payout.totalPayout)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function OverviewPanel({ result }: { result: MultiAccountSimResult }) {
  const avgGroupDD = result.groups.reduce((s, g) => s + g.analysis.maxDrawdown, 0) / result.groups.length;
  const ddReductionPct = result.fullAnalysis.maxDrawdown > 0 ? (1 - avgGroupDD / result.fullAnalysis.maxDrawdown) * 100 : 0;
  const totalNetAllAccounts = result.groups.reduce((s, g) => s + g.analysis.netPnl * g.accounts, 0);
  const totalPayoutAllAccounts =
    result.payoutTarget != null ? result.groups.reduce((s, g) => s + g.payout.totalPayout * g.accounts, 0) : null;

  return (
    <div className="flex flex-col gap-5">
      <div
        className="rounded-2xl border border-[var(--border)] p-5"
        style={{ background: totalNetAllAccounts >= 0 ? "var(--gradient-profit-soft)" : "var(--gradient-loss-soft)" }}
      >
        <span className="text-[13px] font-medium text-[var(--text-muted)]">
          Total Net P&amp;L: all {result.numGroups} groups, all {result.totalAccounts} accounts combined
        </span>
        <div
          className={`mt-2 text-3xl font-bold tabular tracking-tight ${
            totalNetAllAccounts >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
          }`}
        >
          {signedMoney(totalNetAllAccounts)}
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          Sum of each group&apos;s net P&amp;L × its {result.accountsPerGroup} identical account
          {result.accountsPerGroup === 1 ? "" : "s"}: {result.accountsPerGroup}× the single-account (Full) result of{" "}
          {signedMoney(result.fullAnalysis.netPnl)}.
        </div>
      </div>

      {totalPayoutAllAccounts != null && (
        <div className="rounded-2xl border border-[var(--accent)]/40 p-5 [background-image:var(--gradient-accent-soft)]">
          <span className="text-[13px] font-medium text-[var(--text-muted)]">
            Total Payouts: all {result.totalAccounts} accounts, {formatCurrency(result.payoutTarget!)} target /{" "}
            {formatCurrency(result.payoutBuffer!)} buffer / {result.payoutSplit ?? 100}% split each
          </span>
          <div className="mt-2 text-3xl font-bold tabular tracking-tight text-[var(--accent)]">
            {formatCurrency(totalPayoutAllAccounts)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Per account: no payout until profit first reaches {formatCurrency(result.payoutTarget!)}. After that,
            each time it hits that level again, {formatCurrency(result.payoutTarget! - result.payoutBuffer!)} is
            taken out and {formatCurrency(result.payoutBuffer!)} stays in the account as the buffer. Of what&apos;s
            taken out, {result.payoutSplit ?? 100}% is actually disbursed. Accounts that never reached the target
            contribute $0.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <span className="text-[13px] font-medium text-[var(--text-muted)]">Groups × accounts</span>
          <div className="mt-2 text-2xl font-semibold tabular tracking-tight text-[var(--text)]">
            {result.numGroups} × {result.accountsPerGroup}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">{result.totalAccounts} accounts total</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <span className="text-[13px] font-medium text-[var(--text-muted)]">Trades per group</span>
          <div className="mt-2 text-2xl font-semibold tabular tracking-tight text-[var(--text)]">
            ~{Math.round(result.tradesUsed / result.numGroups)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">of {result.tradesUsed} total, round-robin</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <span className="text-[13px] font-medium text-[var(--text-muted)]">Full max drawdown</span>
          <div className="mt-2 text-2xl font-semibold tabular tracking-tight text-[var(--loss)]">
            {formatCurrency(-result.fullAnalysis.maxDrawdown)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">one account, every trade</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <span className="text-[13px] font-medium text-[var(--text-muted)]">Avg group max drawdown</span>
          <div className={`mt-2 text-2xl font-semibold tabular tracking-tight ${ddReductionPct > 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"}`}>
            {formatCurrency(-avgGroupDD)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            {ddReductionPct > 0 ? `${ddReductionPct.toFixed(0)}% shallower` : `${Math.abs(ddReductionPct).toFixed(0)}% deeper`} than full
          </div>
        </div>
      </div>

      <ComparisonTable result={result} />
    </div>
  );
}

function FullAccountView({
  result,
  strategy,
  timeZone,
}: {
  result: MultiAccountSimResult;
  strategy: Strategy;
  timeZone: string;
}) {
  return (
    <BacktestAnalysisView
      strategy={strategy}
      analysis={applyPayoutsToAnalysis(result.fullAnalysis, result.fullPayout)}
      timeZone={timeZone}
      extraKpiCards={
        result.payoutTarget != null && result.payoutBuffer != null && <AvgPayoutDaysCard payout={result.fullPayout} />
      }
      afterEquity={
        result.payoutTarget != null &&
        result.payoutBuffer != null && (
          <PayoutCycleTable
            label="Full"
            payout={result.fullPayout}
            payoutTarget={result.payoutTarget}
            payoutBuffer={result.payoutBuffer}
            payoutSplit={result.payoutSplit ?? 100}
            timeZone={timeZone}
          />
        )
      }
    />
  );
}

export function MultiAccountSimClient({
  strategies,
  tradesByStrategy,
  timeZone,
  countBreakeven,
  breakevenContinuesStreak,
}: {
  strategies: Strategy[];
  tradesByStrategy: Record<string, BacktestTrade[]>;
  timeZone: string;
  countBreakeven: boolean;
  breakevenContinuesStreak: boolean;
}) {
  const [strategyId, setStrategyId] = useState(strategies[0]?.id ?? "");
  const [enableGrouping, setEnableGrouping] = useState(false);
  const [numGroups, setNumGroups] = useState(3);
  const [accountsPerGroup, setAccountsPerGroup] = useState(5);
  const [tradesPerRotation, setTradesPerRotation] = useState(1);
  const [showPayout, setShowPayout] = useState(true);
  const [payoutTargetInput, setPayoutTargetInput] = useState("5000");
  const [payoutBufferInput, setPayoutBufferInput] = useState("2500");
  const [payoutSplitInput, setPayoutSplitInput] = useState("90");
  const [tab, setTab] = useState<string>("overview");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Deliberately not persisted across visits: a leftover date filter from last time would silently
  // hide data on the next visit, which is worse than just resetting to the full range each time.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Restore whatever was last selected in this browser. Runs after mount (not as a lazy useState
  // initializer) so the server-rendered defaults always match the first client render, then this
  // swaps in the saved values right after, avoiding a hydration mismatch at the cost of one frame.
  useEffect(() => {
    const saved = loadPersistedSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved.strategyId && strategies.some((s) => s.id === saved.strategyId)) setStrategyId(saved.strategyId);
    if (saved.enableGrouping != null) setEnableGrouping(saved.enableGrouping);
    if (saved.numGroups != null) setNumGroups(saved.numGroups);
    if (saved.accountsPerGroup != null) setAccountsPerGroup(saved.accountsPerGroup);
    if (saved.tradesPerRotation != null) setTradesPerRotation(saved.tradesPerRotation);
    if (saved.showPayout != null) setShowPayout(saved.showPayout);
    if (saved.payoutTargetInput != null) setPayoutTargetInput(saved.payoutTargetInput);
    if (saved.payoutBufferInput != null) setPayoutBufferInput(saved.payoutBufferInput);
    if (saved.payoutSplitInput != null) setPayoutSplitInput(saved.payoutSplitInput);
    setSettingsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change, once the initial restore above has finished (otherwise this would
  // immediately overwrite the saved settings with the pre-restore defaults).
  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      const settings: PersistedSettings = {
        strategyId,
        enableGrouping,
        numGroups,
        accountsPerGroup,
        tradesPerRotation,
        showPayout,
        payoutTargetInput,
        payoutBufferInput,
        payoutSplitInput,
      };
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing or blocked storage, nothing more we can do client-side.
    }
  }, [
    settingsLoaded,
    strategyId,
    enableGrouping,
    numGroups,
    accountsPerGroup,
    tradesPerRotation,
    showPayout,
    payoutTargetInput,
    payoutBufferInput,
    payoutSplitInput,
  ]);

  const strategy = strategies.find((s) => s.id === strategyId) ?? null;
  const payoutTargetRaw = Math.max(0, Number(payoutTargetInput) || 0);
  const payoutBufferRaw = Math.max(0, Number(payoutBufferInput) || 0);
  const payoutSplitRaw = Math.max(0, Math.min(100, Number(payoutSplitInput) || 0));
  const payoutValid = payoutBufferRaw < payoutTargetRaw;
  const payoutTarget = showPayout && payoutValid ? payoutTargetRaw : null;
  const payoutBuffer = showPayout && payoutValid ? payoutBufferRaw : null;
  const payoutSplit = showPayout && payoutValid ? payoutSplitRaw : null;

  const allTrades = (strategy && tradesByStrategy[strategy.id]) || EMPTY_TRADES;
  const { from: availableFrom, to: availableTo } = dateRangeOf(allTrades, timeZone);
  const rangedTrades = useMemo(
    () => filterTradesByDateRange(allTrades, timeZone, startDate || null, endDate || null),
    [allTrades, timeZone, startDate, endDate]
  );

  const result = useMemo(() => {
    if (!strategy) return null;
    if (rangedTrades.length === 0 || numGroups < 1 || accountsPerGroup < 1 || tradesPerRotation < 1) return null;
    return runMultiAccountSim(
      rangedTrades,
      strategy,
      timeZone,
      countBreakeven,
      breakevenContinuesStreak,
      numGroups,
      accountsPerGroup,
      tradesPerRotation,
      payoutTarget,
      payoutBuffer,
      payoutSplit
    );
  }, [
    strategy,
    rangedTrades,
    timeZone,
    countBreakeven,
    breakevenContinuesStreak,
    numGroups,
    accountsPerGroup,
    tradesPerRotation,
    payoutTarget,
    payoutBuffer,
    payoutSplit,
  ]);

  const tabClass = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
      active ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  if (strategies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
        <Users size={28} className="text-[var(--text-faint)]" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--text)]">No strategies yet</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
          Multi-Accounts Sim splits a backtested strategy&apos;s trades round-robin across simulated account groups.
          Create a strategy and log some trades first.
        </p>
        <Link href="/backtest" className={`${primaryButtonClass} mt-5`}>
          <FlaskConical size={16} />
          Go to Backtest
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-[var(--text)]">
          <Layers size={20} className="text-[var(--accent)]" />
          Multi-Accounts Sim
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Splits a strategy&apos;s backtested trades round-robin across parent groups, then copies each group&apos;s
          trades onto every account inside it. Each account only lives through a fraction of the full trade
          sequence, which usually means a shallower max drawdown than running everything on one account.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StrategySelect strategies={strategies} value={strategyId} onChange={setStrategyId} />
        </div>

        <div className="mt-4">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            availableFrom={availableFrom}
            availableTo={availableTo}
            matchedCount={rangedTrades.length}
            totalCount={allTrades.length}
          />
        </div>

        <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-3">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              checked={enableGrouping}
              onChange={(e) => setEnableGrouping(e.target.checked)}
            />
            Split into groups
          </label>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            When off, no trades are divided up — only the full, undivided account is shown.
          </p>
        </div>

        <div className={`mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 ${enableGrouping ? "" : "opacity-40"}`}>
          <div>
            <label className={labelClass}>Number of groups</label>
            <input
              type="number"
              min="2"
              max="12"
              step="1"
              className={`${inputClass} disabled:cursor-not-allowed`}
              value={numGroups}
              onChange={(e) => setNumGroups(Math.max(2, Math.min(12, Math.round(Number(e.target.value)) || 2)))}
              disabled={!enableGrouping}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {GROUP_QUICK.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumGroups(n)}
                  disabled={!enableGrouping}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed ${
                    numGroups === n
                      ? "border-[var(--accent)] text-[var(--accent)] [background-image:var(--gradient-accent-soft)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Accounts per group</label>
            <input
              type="number"
              min="1"
              max="50"
              step="1"
              className={`${inputClass} disabled:cursor-not-allowed`}
              value={accountsPerGroup}
              onChange={(e) => setAccountsPerGroup(Math.max(1, Math.min(50, Math.round(Number(e.target.value)) || 1)))}
              disabled={!enableGrouping}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ACCOUNTS_QUICK.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAccountsPerGroup(n)}
                  disabled={!enableGrouping}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed ${
                    accountsPerGroup === n
                      ? "border-[var(--accent)] text-[var(--accent)] [background-image:var(--gradient-accent-soft)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Trades per rotation</label>
            <input
              type="number"
              min="1"
              max="50"
              step="1"
              className={`${inputClass} disabled:cursor-not-allowed`}
              value={tradesPerRotation}
              onChange={(e) => setTradesPerRotation(Math.max(1, Math.min(50, Math.round(Number(e.target.value)) || 1)))}
              disabled={!enableGrouping}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ROTATION_QUICK.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTradesPerRotation(n)}
                  disabled={!enableGrouping}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed ${
                    tradesPerRotation === n
                      ? "border-[var(--accent)] text-[var(--accent)] [background-image:var(--gradient-accent-soft)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
              How many trades in a row go to the same group before rotating: 1 → A, B, C, A... · 2 → AA, BB, CC, AA...
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-3">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              checked={showPayout}
              onChange={(e) => setShowPayout(e.target.checked)}
            />
            Show payouts
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <div>
              <label className={labelClass}>Profit target ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                className={`${inputClass} w-40 disabled:cursor-not-allowed disabled:opacity-50`}
                value={payoutTargetInput}
                onChange={(e) => setPayoutTargetInput(e.target.value)}
                disabled={!showPayout}
              />
            </div>
            <div>
              <label className={labelClass}>Minimum buffer ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                className={`${inputClass} w-40 disabled:cursor-not-allowed disabled:opacity-50`}
                value={payoutBufferInput}
                onChange={(e) => setPayoutBufferInput(e.target.value)}
                disabled={!showPayout}
              />
            </div>
            <div>
              <label className={labelClass}>Profit split (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                className={`${inputClass} w-40 disabled:cursor-not-allowed disabled:opacity-50`}
                value={payoutSplitInput}
                onChange={(e) => setPayoutSplitInput(e.target.value)}
                disabled={!showPayout}
              />
            </div>
          </div>
          {showPayout && !payoutValid ? (
            <p className="mt-2 text-[11px] text-[var(--loss)]">
              Profit target must be more than the buffer. Payouts are off until it is.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              No payout until profit first reaches the target. From then on, every time it hits that level again,{" "}
              {formatCurrency(payoutTargetRaw - payoutBufferRaw)} is eligible, of which{" "}
              {formatCurrency(((payoutTargetRaw - payoutBufferRaw) * payoutSplitRaw) / 100)} ({payoutSplitRaw}%) is
              disbursed, leaving {formatCurrency(payoutBufferRaw)} banked as the buffer.
            </p>
          )}
        </div>
      </section>

      {!result ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
          This strategy has no trades to simulate against.
        </p>
      ) : !enableGrouping ? (
        <FullAccountView result={result} strategy={strategy!} timeZone={timeZone} />
      ) : (
        <>
          <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
            <button className={tabClass(tab === "overview")} onClick={() => setTab("overview")}>
              Overview
            </button>
            <button className={tabClass(tab === "full")} onClick={() => setTab("full")}>
              Full (undivided)
            </button>
            {result.groups.map((g) => (
              <button key={g.index} className={tabClass(tab === String(g.index))} onClick={() => setTab(String(g.index))}>
                {g.label}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <OverviewPanel result={result} />
          ) : tab === "full" ? (
            <FullAccountView result={result} strategy={strategy!} timeZone={timeZone} />
          ) : (
            (() => {
              const g = result.groups[Number(tab)] as AccountGroup | undefined;
              if (!g) return null;
              return (
                <div className="flex flex-col gap-5">
                  <p className="text-xs text-[var(--text-muted)]">
                    {g.label} · {g.accounts} identical account{g.accounts === 1 ? "" : "s"} · {g.trades.length} trades
                  </p>
                  <BacktestAnalysisView
                    strategy={strategy!}
                    analysis={applyPayoutsToAnalysis(g.analysis, g.payout)}
                    timeZone={timeZone}
                    extraKpiCards={
                      result.payoutTarget != null && result.payoutBuffer != null && <AvgPayoutDaysCard payout={g.payout} />
                    }
                    afterEquity={
                      result.payoutTarget != null &&
                      result.payoutBuffer != null && (
                        <PayoutCycleTable
                          label={g.label}
                          payout={g.payout}
                          payoutTarget={result.payoutTarget}
                          payoutBuffer={result.payoutBuffer}
                          payoutSplit={result.payoutSplit ?? 100}
                          timeZone={timeZone}
                        />
                      )
                    }
                  />
                </div>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}
