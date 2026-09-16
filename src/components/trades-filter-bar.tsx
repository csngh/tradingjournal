"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { inputClass, labelClass, secondaryButtonClass } from "@/components/ui/form";
import type { Account } from "@/db/schema";

export type TradeFilters = {
  dateFrom: string;
  dateTo: string;
  accountId: string;
  symbol: string;
  side: string;
  timeframe: string;
  result: string;
};

export const EMPTY_FILTERS: TradeFilters = {
  dateFrom: "",
  dateTo: "",
  accountId: "all",
  symbol: "all",
  side: "all",
  timeframe: "all",
  result: "all",
};

export function isFiltersEmpty(f: TradeFilters): boolean {
  return (
    !f.dateFrom &&
    !f.dateTo &&
    f.accountId === "all" &&
    f.symbol === "all" &&
    f.side === "all" &&
    f.timeframe === "all" &&
    f.result === "all"
  );
}

export function TradesFilterBar({
  filters,
  onChange,
  accounts,
  symbols,
  timeframes,
}: {
  filters: TradeFilters;
  onChange: (next: TradeFilters) => void;
  accounts: Account[];
  symbols: string[];
  timeframes: string[];
}) {
  function set<K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
        <SlidersHorizontal size={13} />
        Filters
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div>
          <label className={labelClass}>From</label>
          <input
            type="date"
            className={inputClass}
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <input
            type="date"
            className={inputClass}
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Account</label>
          <select
            className={inputClass}
            value={filters.accountId}
            onChange={(e) => set("accountId", e.target.value)}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Symbol</label>
          <select
            className={inputClass}
            value={filters.symbol}
            onChange={(e) => set("symbol", e.target.value)}
          >
            <option value="all">All symbols</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Side</label>
          <select
            className={inputClass}
            value={filters.side}
            onChange={(e) => set("side", e.target.value)}
          >
            <option value="all">All sides</option>
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Timeframe</label>
          <select
            className={inputClass}
            value={filters.timeframe}
            onChange={(e) => set("timeframe", e.target.value)}
          >
            <option value="all">All timeframes</option>
            {timeframes.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Result</label>
          <select
            className={inputClass}
            value={filters.result}
            onChange={(e) => set("result", e.target.value)}
          >
            <option value="all">Win &amp; loss</option>
            <option value="win">Wins only</option>
            <option value="loss">Losses only</option>
          </select>
        </div>
      </div>

      {!isFiltersEmpty(filters) && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className={`${secondaryButtonClass} mt-3`}
        >
          <RotateCcw size={14} />
          Reset filters
        </button>
      )}
    </div>
  );
}
