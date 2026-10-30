"use client";

import { useState } from "react";
import Link from "next/link";
import { FlaskConical, PlusCircle, ChevronRight } from "lucide-react";
import { StrategyForm } from "@/components/strategy-form";
import { BacktestDataManager } from "@/components/backtest-data-manager";
import { ImportStrategyButton } from "@/components/import-strategy-button";
import { primaryButtonClass } from "@/components/ui/form";
import { formatCurrency } from "@/lib/metrics";
import type { Strategy } from "@/db/schema";

export type StrategySummary = {
  strategy: Strategy;
  trades: number;
  winRate: number;
  netPnl: number;
  profitFactor: number | null;
  maxDrawdown: number;
};

function Metric({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-[var(--text-muted)]">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular ${
          tone === "profit" ? "text-[var(--profit)]" : tone === "loss" ? "text-[var(--loss)]" : "text-[var(--text)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function BacktestClient({ items }: { items: StrategySummary[] }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function openNew() {
    setFormKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--text)]">
            <FlaskConical size={20} className="text-[var(--accent)]" />
            Backtest
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Define a strategy, log its backtested trades, and get a full analysis.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          <BacktestDataManager strategyCount={items.length} />
          <ImportStrategyButton />
          <button onClick={openNew} className={primaryButtonClass}>
            <PlusCircle size={16} />
            New strategy
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-20 text-center">
          <h2 className="text-lg font-semibold text-[var(--text)]">No strategies yet</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
            Create a strategy with its symbol, timeframe, trade size, take profit, stop loss and daily trade limit.
            Then log the trades your backtest produced and see win rate, expectancy, drawdown and more.
          </p>
          <button onClick={openNew} className={`${primaryButtonClass} mt-5`}>
            <PlusCircle size={16} />
            Create your first strategy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map(({ strategy: s, trades, winRate, netPnl, profitFactor, maxDrawdown }) => (
            <Link
              key={s.id}
              href={`/backtest/${s.id}`}
              className="group min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-[var(--text)]">{s.name}</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {s.symbol} · {s.timeframe} · {s.contracts} contract{s.contracts === 1 ? "" : "s"}
                      {s.rr != null
                        ? ` · 1:${Math.round(s.rr * 100) / 100} RR${s.slPoints != null ? ` · risk ${s.slPoints}` : ""}`
                        : `${s.tpPoints != null ? ` · TP ${s.tpPoints}` : ""}${s.slPoints != null ? ` · SL ${s.slPoints}` : ""}`}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-[var(--text-faint)] transition group-hover:text-[var(--accent)]" />
              </div>

              {s.description && (
                <p className="mt-3 line-clamp-2 text-xs text-[var(--text-muted)]">{s.description}</p>
              )}

              {trades === 0 ? (
                <p className="mt-4 text-xs text-[var(--text-muted)]">No trades logged yet.</p>
              ) : (
                <>
                  <div className="mt-4 text-2xl font-semibold tabular">
                    <span className={netPnl >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"}>
                      {netPnl >= 0 ? "+" : ""}
                      {formatCurrency(netPnl)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Metric label="Trades" value={String(trades)} />
                    <Metric label="Win rate" value={`${winRate.toFixed(1)}%`} />
                    <Metric
                      label="Profit factor"
                      value={profitFactor == null ? "n/a" : profitFactor.toFixed(2)}
                      tone={profitFactor != null ? (profitFactor >= 1 ? "profit" : "loss") : undefined}
                    />
                    <Metric label="Max DD" value={formatCurrency(-maxDrawdown)} tone={maxDrawdown > 0 ? "loss" : undefined} />
                  </div>
                </>
              )}
            </Link>
          ))}
        </div>
      )}

      <StrategyForm key={formKey} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
