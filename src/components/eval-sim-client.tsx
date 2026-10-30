"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Award, FlaskConical, Gauge, Target, TrendingDown, TrendingUp } from "lucide-react";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/form";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { EvalRulesForm, DEFAULT_EVAL_RULES_INPUT, type EvalRulesInput } from "@/components/eval-rules-form";
import { EvalCycleChart, EvalResultsPanel } from "@/components/eval-results-panel";
import { runEvalSimulation, type EvalRules, type EvalSimResult, type SizeDownRule } from "@/lib/eval-sim";
import { findFuturesSymbol } from "@/lib/futures-symbols";
import { filterTradesByDateRange } from "@/lib/backtest";
import { zonedDayKey } from "@/lib/timezone";
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

function toRules(input: EvalRulesInput): EvalRules | null {
  const accountSize = Number(input.accountSize) || 0;
  const profitTarget = Number(input.profitTarget) || 0;
  const maxDrawdown = Number(input.maxDrawdown) || 0;
  if (accountSize <= 0 || profitTarget <= 0 || maxDrawdown <= 0) return null;
  return {
    accountSize,
    profitTarget,
    maxDrawdown,
    drawdownMode: input.drawdownMode,
    lockEnabled: input.drawdownMode === "trailing" && input.lockEnabled,
    lockAt: input.lockAt.trim() !== "" ? Number(input.lockAt) : null,
    sizeDown: toSizeDown(input),
  };
}

function toSizeDown(input: EvalRulesInput): SizeDownRule | null {
  if (!input.sizeDownEnabled) return null;
  const symbol = findFuturesSymbol(input.sizeDownSymbol);
  const cushionBelow = Number(input.sizeDownBelow) || 0;
  const contracts = Math.floor(Number(input.sizeDownContracts) || 0);
  if (!symbol || cushionBelow <= 0 || contracts <= 0) return null;
  return {
    cushionBelow,
    symbol: symbol.symbol,
    pointValue: symbol.pointValue,
    contracts,
    feePerContract: Math.max(0, Number(input.sizeDownFee) || 0),
  };
}

function StrategySelect({
  label,
  strategies,
  value,
  onChange,
}: {
  label: string;
  strategies: Strategy[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
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

type StatRow = { name: string; value: string; sub?: string; raw: number | null };

function CompareStatCard({
  label,
  icon,
  a,
  b,
  higherIsBetter,
}: {
  label: string;
  icon: ReactNode;
  a: StatRow;
  b: StatRow;
  higherIsBetter: boolean | null;
}) {
  const winnerClass = (mine: number | null, theirs: number | null) => {
    if (higherIsBetter == null || mine == null || theirs == null || mine === theirs) return "text-[var(--text)]";
    const iWin = higherIsBetter ? mine > theirs : mine < theirs;
    return iWin ? "text-[var(--profit)]" : "text-[var(--text-muted)]";
  };

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-muted)]">{label}</span>
        <span className="text-[var(--text-faint)]">{icon}</span>
      </div>
      <div className="mt-3 flex flex-col">
        {[a, b].map((row, i) => (
          <div
            key={row.name}
            className={`flex items-baseline justify-between gap-2 ${i === 0 ? "pb-2.5" : "border-t border-[var(--border)] pt-2.5"}`}
          >
            <span className="truncate text-xs font-medium text-[var(--text-muted)]">{row.name}</span>
            <span className="text-right">
              <span className={`block text-lg font-semibold tabular tracking-tight ${winnerClass(row.raw, i === 0 ? b.raw : a.raw)}`}>
                {row.value}
              </span>
              {row.sub && <span className="block text-[10px] text-[var(--text-faint)]">{row.sub}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareStatGrid({ nameA, nameB, a, b }: { nameA: string; nameB: string; a: EvalSimResult; b: EvalSimResult }) {
  const fmtPct = (n: number | null) => (n == null ? "n/a" : `${n.toFixed(1)}%`);
  const fmtNum = (n: number | null) => (n == null ? "n/a" : n.toFixed(1));
  const fmtDays = (n: number | null) => (n != null ? `~${n.toFixed(0)}d` : undefined);
  const tradesSub = (r: EvalSimResult) =>
    r.rules.sizeDown ? `${r.tradesUsed} trades · ${r.sizedDownTrades} on ${r.rules.sizeDown.symbol}` : `${r.tradesUsed} trades`;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <CompareStatCard
        label="Cycles run"
        icon={<Gauge size={16} />}
        higherIsBetter={null}
        a={{ name: nameA, value: String(a.totalCycles), sub: tradesSub(a), raw: null }}
        b={{ name: nameB, value: String(b.totalCycles), sub: tradesSub(b), raw: null }}
      />
      <CompareStatCard
        label="Pass rate"
        icon={<Target size={16} />}
        higherIsBetter={true}
        a={{ name: nameA, value: fmtPct(a.passRate), sub: `${a.passes}W-${a.fails}L`, raw: a.passRate }}
        b={{ name: nameB, value: fmtPct(b.passRate), sub: `${b.passes}W-${b.fails}L`, raw: b.passRate }}
      />
      <CompareStatCard
        label="Avg trades to pass"
        icon={<TrendingUp size={16} />}
        higherIsBetter={false}
        a={{ name: nameA, value: fmtNum(a.avgTradesToPass), sub: fmtDays(a.avgDaysToPass), raw: a.avgTradesToPass }}
        b={{ name: nameB, value: fmtNum(b.avgTradesToPass), sub: fmtDays(b.avgDaysToPass), raw: b.avgTradesToPass }}
      />
      <CompareStatCard
        label="Avg trades to fail"
        icon={<TrendingDown size={16} />}
        higherIsBetter={true}
        a={{ name: nameA, value: fmtNum(a.avgTradesToFail), sub: fmtDays(a.avgDaysToFail), raw: a.avgTradesToFail }}
        b={{ name: nameB, value: fmtNum(b.avgTradesToFail), sub: fmtDays(b.avgDaysToFail), raw: b.avgTradesToFail }}
      />
      <CompareStatCard
        label="Fastest pass"
        icon={<Award size={16} />}
        higherIsBetter={false}
        a={{ name: nameA, value: a.fastestPass ? `${a.fastestPass.trades} trades` : "n/a", raw: a.fastestPass?.trades ?? null }}
        b={{ name: nameB, value: b.fastestPass ? `${b.fastestPass.trades} trades` : "n/a", raw: b.fastestPass?.trades ?? null }}
      />
    </div>
  );
}

function CompareView({
  strategyA,
  tradesA,
  strategyB,
  tradesB,
  rules,
  timeZone,
}: {
  strategyA: Strategy;
  tradesA: BacktestTrade[];
  strategyB: Strategy;
  tradesB: BacktestTrade[];
  rules: EvalRules;
  timeZone: string;
}) {
  const resultA = useMemo(() => runEvalSimulation(tradesA, strategyA, rules, timeZone), [tradesA, strategyA, rules, timeZone]);
  const resultB = useMemo(() => runEvalSimulation(tradesB, strategyB, rules, timeZone), [tradesB, strategyB, rules, timeZone]);

  if (resultA.totalCycles === 0 || resultB.totalCycles === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
        {resultA.totalCycles === 0 ? strategyA.name : strategyB.name} has no trades to simulate against.
      </p>
    );
  }

  return (
    <>
      <CompareStatGrid nameA={strategyA.name} nameB={strategyB.name} a={resultA} b={resultB} />
      <div className="flex flex-col gap-5">
        <EvalCycleChart label={strategyA.name} result={resultA} rules={rules} timeZone={timeZone} />
        <EvalCycleChart label={strategyB.name} result={resultB} rules={rules} timeZone={timeZone} />
      </div>
    </>
  );
}

export function EvalSimClient({
  strategies,
  tradesByStrategy,
  timeZone,
}: {
  strategies: Strategy[];
  tradesByStrategy: Record<string, BacktestTrade[]>;
  timeZone: string;
}) {
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [strategyAId, setStrategyAId] = useState(strategies[0]?.id ?? "");
  const [strategyBId, setStrategyBId] = useState(strategies[1]?.id ?? strategies[0]?.id ?? "");
  const [rulesInput, setRulesInput] = useState<EvalRulesInput>(DEFAULT_EVAL_RULES_INPUT);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const rules = toRules(rulesInput);
  const strategyA = strategies.find((s) => s.id === strategyAId) ?? null;
  const strategyB = strategies.find((s) => s.id === strategyBId) ?? null;

  const allTradesA = tradesByStrategy[strategyAId] ?? [];
  const allTradesB = tradesByStrategy[strategyBId] ?? [];
  const relevantTrades = mode === "compare" ? [...allTradesA, ...allTradesB] : allTradesA;
  const { from: availableFrom, to: availableTo } = dateRangeOf(relevantTrades, timeZone);
  const tradesA = filterTradesByDateRange(allTradesA, timeZone, startDate || null, endDate || null);
  const tradesB = filterTradesByDateRange(allTradesB, timeZone, startDate || null, endDate || null);

  const segment = (active: boolean) =>
    `flex-1 cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition ${active ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  if (strategies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center">
        <Target size={28} className="text-[var(--text-faint)]" />
        <h2 className="mt-3 text-lg font-semibold text-[var(--text)]">No strategies yet</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
          Eval Sim runs funded-account simulations against trades you&apos;ve logged in Backtest. Create a strategy and log
          some trades first.
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
          <Target size={20} className="text-[var(--accent)]" />
          Eval Sim
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
          Simulate repeated funded-account evaluations against your backtested strategies: set an account size, profit
          target, and max drawdown, and watch how often each strategy would pass, fail, or still be running.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
        <button className={segment(mode === "single")} onClick={() => setMode("single")}>
          One Strategy
        </button>
        <button className={segment(mode === "compare")} onClick={() => setMode("compare")}>
          Compare Two
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className={`grid grid-cols-1 gap-3 ${mode === "compare" ? "sm:grid-cols-2" : "sm:max-w-xs"}`}>
          {mode === "single" ? (
            <StrategySelect label="Strategy" strategies={strategies} value={strategyAId} onChange={setStrategyAId} />
          ) : (
            <>
              <StrategySelect label="Strategy A" strategies={strategies} value={strategyAId} onChange={setStrategyAId} />
              <StrategySelect label="Strategy B" strategies={strategies} value={strategyBId} onChange={setStrategyBId} />
            </>
          )}
        </div>

        <div className="mt-4">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            availableFrom={availableFrom}
            availableTo={availableTo}
            matchedCount={mode === "compare" ? tradesA.length + tradesB.length : tradesA.length}
            totalCount={relevantTrades.length}
          />
        </div>
      </section>

      <EvalRulesForm value={rulesInput} onChange={setRulesInput} />

      {!rules ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
          Enter an account size, profit target, and max drawdown above to run the simulation.
        </p>
      ) : mode === "single" ? (
        strategyA && <EvalResultsPanel strategy={strategyA} trades={tradesA} rules={rules} timeZone={timeZone} />
      ) : (
        strategyA &&
        strategyB && (
          <CompareView
            strategyA={strategyA}
            tradesA={tradesA}
            strategyB={strategyB}
            tradesB={tradesB}
            rules={rules}
            timeZone={timeZone}
          />
        )
      )}
    </div>
  );
}
