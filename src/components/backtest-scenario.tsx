"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers, RotateCcw } from "lucide-react";
import { inputClass, labelClass, secondaryButtonClass } from "@/components/ui/form";
import { FUTURES_SYMBOLS, findFuturesSymbol } from "@/lib/futures-symbols";
import { compareSizes, isScenarioActive, NO_SCENARIO, type Scenario } from "@/lib/backtest";
import { formatCurrency } from "@/lib/metrics";
import type { BacktestTrade, Strategy } from "@/db/schema";

const QUICK_SIZES = [1, 2, 3, 5, 10];

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${formatCurrency(n)}`;
}

export function BacktestScenarioBar({
  strategy,
  trades,
  timeZone,
  countBreakeven,
  scenario,
  onChange,
}: {
  strategy: Strategy;
  trades: BacktestTrade[];
  timeZone: string;
  countBreakeven: boolean;
  scenario: Scenario;
  onChange: (next: Scenario) => void;
}) {
  const [showCompare, setShowCompare] = useState(false);
  const active = isScenarioActive(scenario);

  const symbol = scenario.symbol ?? strategy.symbol;
  const known = findFuturesSymbol(symbol);
  const pointValue = scenario.pointValue ?? strategy.pointValue;
  const viewStrategy = useMemo(
    () => ({ ...strategy, symbol, pointValue }),
    [strategy, symbol, pointValue]
  );

  function handleSymbol(raw: string) {
    const upper = raw.toUpperCase().trim();
    if (upper === "" || upper === strategy.symbol) {
      onChange({ ...scenario, symbol: null, pointValue: null });
      return;
    }
    const match = findFuturesSymbol(upper);
    // A known symbol brings its own point value; an unknown one keeps the last value until edited.
    onChange({ ...scenario, symbol: upper, pointValue: match ? match.pointValue : pointValue });
  }

  function handlePointValue(raw: string) {
    const n = Number(raw);
    onChange({ ...scenario, pointValue: Number.isFinite(n) && n > 0 ? n : null });
  }

  function setContracts(n: number | null) {
    onChange({ ...scenario, contracts: n });
  }

  const sizes = useMemo(() => {
    const set = new Set(QUICK_SIZES);
    if (scenario.contracts != null) set.add(scenario.contracts);
    return [...set].sort((a, b) => a - b);
  }, [scenario.contracts]);

  const rows = useMemo(
    () => (showCompare ? compareSizes(viewStrategy, trades, sizes, timeZone, countBreakeven) : []),
    [showCompare, viewStrategy, trades, sizes, timeZone, countBreakeven]
  );

  const chip = (selected: boolean) =>
    `cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
      selected
        ? "border-[var(--accent)] text-[var(--accent)] [background-image:var(--gradient-accent-soft)]"
        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text)]">
            <Layers size={16} className="text-[var(--accent)]" />
            What-if view
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            See the same backtest with another symbol or size. Points stay as logged; only the dollar figures change.
            Nothing is saved.
          </p>
        </div>
        {active && (
          <button type="button" onClick={() => onChange(NO_SCENARIO)} className={secondaryButtonClass}>
            <RotateCcw size={14} />
            Back to as logged
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className={labelClass}>Symbol</label>
          <input
            list="scenario-symbols"
            className={inputClass}
            value={symbol}
            onChange={(e) => handleSymbol(e.target.value)}
            placeholder={strategy.symbol}
          />
          <datalist id="scenario-symbols">
            {FUTURES_SYMBOLS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.name}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelClass}>Point value ($/pt)</label>
          <input
            type="number"
            step="any"
            min="0"
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
            value={pointValue}
            disabled={!!known}
            onChange={(e) => handlePointValue(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Contracts</label>
          <input
            type="number"
            min="1"
            step="1"
            className={inputClass}
            value={scenario.contracts ?? ""}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              setContracts(e.target.value !== "" && n >= 1 ? n : null);
            }}
            placeholder="As logged"
          />
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className={labelClass}>Quick size</label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(scenario.contracts == null)} onClick={() => setContracts(null)}>
              As logged
            </button>
            {QUICK_SIZES.map((n) => (
              <button key={n} type="button" className={chip(scenario.contracts === n)} onClick={() => setContracts(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {active && (
        <p className="mt-3 rounded-xl border border-[var(--accent)]/40 px-3.5 py-2.5 text-xs text-[var(--text)] [background-image:var(--gradient-accent-soft)]">
          Showing <b>{symbol}</b> ({formatCurrency(pointValue)} per point) at{" "}
          <b>{scenario.contracts != null ? `${scenario.contracts} contract${scenario.contracts === 1 ? "" : "s"}` : "the sizes you logged"}</b>
          . Every dollar figure on this page, in Trades and Analysis, uses this view. Editing a trade still opens what
          you actually saved.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowCompare((v) => !v)}
        className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {showCompare ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Compare sizes side by side
      </button>

      {showCompare && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-[var(--text-muted)]">
                <th className="pb-2 pr-3 font-medium">Contracts</th>
                <th className="pb-2 pr-3 text-right font-medium">Net P&amp;L</th>
                <th className="pb-2 pr-3 text-right font-medium">Max drawdown</th>
                <th className="pb-2 pr-3 text-right font-medium">Worst day</th>
                <th className="pb-2 pr-3 text-right font-medium">Risk / trade</th>
                <th className="pb-2 text-right font-medium">Fees</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.contracts}
                  onClick={() => setContracts(r.contracts)}
                  className={`cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2)] ${
                    scenario.contracts === r.contracts ? "[background-image:var(--gradient-accent-soft)]" : ""
                  }`}
                >
                  <td className="whitespace-nowrap py-2 pr-3 font-medium text-[var(--text)]">
                    {r.contracts} × {symbol}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular font-semibold ${
                      r.net >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
                    }`}
                  >
                    {signed(r.net)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular text-[var(--loss)]">{formatCurrency(-r.maxDrawdown)}</td>
                  <td
                    className={`py-2 pr-3 text-right tabular ${
                      r.worstDay < 0 ? "text-[var(--loss)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {signed(r.worstDay)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular text-[var(--text-muted)]">
                    {r.riskPerTrade != null ? formatCurrency(r.riskPerTrade) : "n/a"}
                  </td>
                  <td className="py-2 text-right tabular text-[var(--text-muted)]">{formatCurrency(r.fees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Click a row to apply that size. Fees scale with size using each trade&apos;s own per-contract fee, and
            breakeven trades keep paying theirs.
          </p>
        </div>
      )}
    </section>
  );
}
