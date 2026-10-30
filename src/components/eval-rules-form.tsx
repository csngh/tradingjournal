"use client";

import { inputClass, labelClass } from "@/components/ui/form";
import { formatCurrency } from "@/lib/metrics";
import { FUTURES_SYMBOLS, findFuturesSymbol } from "@/lib/futures-symbols";
import type { DrawdownMode } from "@/lib/eval-sim";

export type EvalRulesInput = {
  accountSize: string;
  profitTarget: string;
  maxDrawdown: string;
  drawdownMode: DrawdownMode;
  lockEnabled: boolean;
  lockAt: string;
  sizeDownEnabled: boolean;
  sizeDownBelow: string;
  sizeDownSymbol: string;
  sizeDownContracts: string;
  sizeDownFee: string;
};

export const DEFAULT_EVAL_RULES_INPUT: EvalRulesInput = {
  accountSize: "50000",
  profitTarget: "3000",
  maxDrawdown: "2000",
  drawdownMode: "trailing",
  lockEnabled: false,
  lockAt: "",
  sizeDownEnabled: false,
  sizeDownBelow: "1000",
  sizeDownSymbol: "MNQ",
  sizeDownContracts: "1",
  sizeDownFee: "",
};

export function EvalRulesForm({
  value,
  onChange,
}: {
  value: EvalRulesInput;
  onChange: (next: EvalRulesInput) => void;
}) {
  const accountSizeNum = Number(value.accountSize) || 0;
  const set = (patch: Partial<EvalRulesInput>) => onChange({ ...value, ...patch });

  const segment = (active: boolean) =>
    `flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
        : "text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-[15px] font-semibold text-[var(--text)]">Evaluation rules</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        Simulates repeated funded-account attempts, in order: each cycle starts fresh at the account size and ends on
        a pass (target hit) or a fail (drawdown breached), then the next cycle begins on the very next trade.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className={labelClass}>Account size ($)</label>
          <input
            type="number"
            min="1"
            step="any"
            className={inputClass}
            value={value.accountSize}
            onChange={(e) => set({ accountSize: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Profit target ($)</label>
          <input
            type="number"
            min="1"
            step="any"
            className={inputClass}
            value={value.profitTarget}
            onChange={(e) => set({ profitTarget: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Max drawdown ($)</label>
          <input
            type="number"
            min="1"
            step="any"
            className={inputClass}
            value={value.maxDrawdown}
            onChange={(e) => set({ maxDrawdown: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Drawdown type</label>
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
            <button
              type="button"
              className={segment(value.drawdownMode === "trailing")}
              onClick={() => set({ drawdownMode: "trailing" })}
            >
              Trailing
            </button>
            <button
              type="button"
              className={segment(value.drawdownMode === "static")}
              onClick={() => set({ drawdownMode: "static" })}
            >
              Static
            </button>
          </div>
        </div>
      </div>

      {value.drawdownMode === "trailing" && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-[var(--surface-2)] p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              checked={value.lockEnabled}
              onChange={(e) => set({ lockEnabled: e.target.checked })}
            />
            Lock the floor once it reaches
          </label>
          <input
            type="number"
            step="any"
            className={`${inputClass} w-36 disabled:cursor-not-allowed disabled:opacity-50`}
            placeholder={formatCurrency(accountSizeNum)}
            value={value.lockAt}
            onChange={(e) => set({ lockAt: e.target.value })}
            disabled={!value.lockEnabled}
          />
          <p className="text-[11px] text-[var(--text-muted)]">
            Defaults to the account size (breakeven) if left blank. Once balance pushes the floor past this level, it
            stops trailing higher.
          </p>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-[var(--surface-2)] p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
            checked={value.sizeDownEnabled}
            onChange={(e) => set({ sizeDownEnabled: e.target.checked })}
          />
          Size down when the drawdown cushion gets low
        </label>
        {value.sizeDownEnabled && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label className={labelClass}>Switch below ($ left)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  value={value.sizeDownBelow}
                  onChange={(e) => set({ sizeDownBelow: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Instrument</label>
                <select
                  className={inputClass}
                  value={value.sizeDownSymbol}
                  onChange={(e) => set({ sizeDownSymbol: e.target.value })}
                >
                  {FUTURES_SYMBOLS.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} · ${s.pointValue}/pt
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Contracts</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                  value={value.sizeDownContracts}
                  onChange={(e) => set({ sizeDownContracts: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Fee per contract ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  placeholder="0"
                  value={value.sizeDownFee}
                  onChange={(e) => set({ sizeDownFee: e.target.value })}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Before each trade: if balance is less than {formatCurrency(Number(value.sizeDownBelow) || 0)} above the
              drawdown floor, the trade runs as {value.sizeDownContracts || "0"}{" "}
              {findFuturesSymbol(value.sizeDownSymbol)?.name ?? value.sizeDownSymbol} instead, using the same logged
              points. Once the cushion is back to that level or more, it returns to the strategy&apos;s own size. Pick an
              instrument on the same underlying (e.g. NQ → MNQ).
            </p>
          </>
        )}
      </div>
    </section>
  );
}
