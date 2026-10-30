"use client";

import { CalendarRange, X } from "lucide-react";
import { inputClass, labelClass } from "@/components/ui/form";
import { formatStreakDate } from "@/lib/backtest";

/** Date-range filter for Sim pages: narrows which of a strategy's trades the simulation runs against. */
export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  availableFrom,
  availableTo,
  matchedCount,
  totalCount,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  availableFrom: string | null;
  availableTo: string | null;
  matchedCount: number;
  totalCount: number;
}) {
  const active = startDate !== "" || endDate !== "";

  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 pb-2 text-sm font-medium text-[var(--text)]">
          <CalendarRange size={15} className="text-[var(--text-muted)]" />
          Date range
        </div>
        <div>
          <label className={labelClass}>Start date</label>
          <input
            type="date"
            className={`${inputClass} w-[150px]`}
            value={startDate}
            min={availableFrom ?? undefined}
            max={endDate || availableTo || undefined}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>End date</label>
          <input
            type="date"
            className={`${inputClass} w-[150px]`}
            value={endDate}
            min={startDate || availableFrom || undefined}
            max={availableTo ?? undefined}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
        {active && (
          <button
            type="button"
            onClick={() => {
              onStartDateChange("");
              onEndDateChange("");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] cursor-pointer"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        {active
          ? `${matchedCount} of ${totalCount} trades fall in this range.`
          : availableFrom && availableTo
            ? `Data available from ${formatStreakDate(availableFrom)} to ${formatStreakDate(availableTo)}. Leave blank to use everything.`
            : "Leave blank to use every trade."}
      </p>
    </div>
  );
}
