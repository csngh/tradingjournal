"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form";
import { bulkResizeBacktestTrades, createStrategy, updateStrategy, deleteStrategy, type StrategyInput } from "@/app/actions";
import { FUTURES_SYMBOLS, findFuturesSymbol } from "@/lib/futures-symbols";
import { TIMEFRAMES } from "@/lib/timeframes";
import { formatCurrency } from "@/lib/metrics";
import type { Strategy } from "@/db/schema";

const COLORS = ["#d4af37", "#22c55e", "#06b6d4", "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#ef4444"];

export function StrategyForm({
  open,
  onClose,
  strategy,
  tradeCount = 0,
}: {
  open: boolean;
  onClose: () => void;
  strategy?: Strategy | null;
  tradeCount?: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(strategy?.name ?? "");
  const [description, setDescription] = useState(strategy?.description ?? "");
  const [color, setColor] = useState(strategy?.color ?? COLORS[0]);
  const [symbol, setSymbol] = useState(strategy?.symbol ?? "");
  const [pointValue, setPointValue] = useState(String(strategy?.pointValue ?? ""));
  const [timeframe, setTimeframe] = useState(strategy?.timeframe ?? "3m");
  const [contracts, setContracts] = useState(String(strategy?.contracts ?? 1));
  const [exitMode, setExitMode] = useState<"points" | "rr">(strategy?.rr != null ? "rr" : "points");
  const [rrInput, setRrInput] = useState(strategy?.rr != null ? String(strategy.rr) : "");
  const [tpPoints, setTpPoints] = useState(strategy?.tpPoints != null ? String(strategy.tpPoints) : "");
  const [slPoints, setSlPoints] = useState(strategy?.slPoints != null ? String(strategy.slPoints) : "");
  const [maxTrades, setMaxTrades] = useState(
    strategy?.maxTradesPerDay != null ? String(strategy.maxTradesPerDay) : ""
  );
  const [feePerContract, setFeePerContract] = useState(String(strategy?.feePerContract ?? 0));
  const [startingCapital, setStartingCapital] = useState(String(strategy?.startingCapital ?? 0));
  const [notes, setNotes] = useState(strategy?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set after an edit changes size or fee per contract while trades already exist, to offer an
  // explicit repricing of everything already logged. Replaces the form with a yes/no prompt.
  const [pendingResize, setPendingResize] = useState<{
    contractsFrom: number;
    contractsTo: number;
    feeFrom: number;
    feeTo: number;
  } | null>(null);
  const [resizing, setResizing] = useState(false);

  const knownSymbol = findFuturesSymbol(symbol);

  function handleSymbolChange(value: string) {
    const upper = value.toUpperCase();
    setSymbol(upper);
    const known = findFuturesSymbol(upper);
    if (known) setPointValue(String(known.pointValue));
  }

  const pv = Number(pointValue) || 0;
  const size = Math.max(1, Number(contracts) || 1);
  const rrValue = exitMode === "rr" ? Number(rrInput) || 0 : 0;
  const sl = Number(slPoints) || 0;
  const tp = exitMode === "rr" ? (rrValue > 0 && sl > 0 ? rrValue * sl : 0) : Number(tpPoints) || 0;
  const effectiveRr = exitMode === "rr" ? rrValue : tp > 0 && sl > 0 ? tp / sl : 0;
  const fees = (Number(feePerContract) || 0) * size;
  const reward = tp * pv * size;
  const risk = sl * pv * size;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const input: StrategyInput = {
      name,
      description: description || null,
      color,
      symbol,
      timeframe,
      pointValue: pv,
      contracts: size,
      rr: exitMode === "rr" && rrValue > 0 ? rrValue : null,
      tpPoints: exitMode === "points" && tp > 0 ? tp : null,
      slPoints: sl > 0 ? sl : null,
      maxTradesPerDay: Number(maxTrades) > 0 ? Number(maxTrades) : null,
      feePerContract: Number(feePerContract) || 0,
      startingCapital: Number(startingCapital) || 0,
      notes: notes || null,
    };
    try {
      if (strategy) {
        await updateStrategy(strategy.id, input);
        const sizeChanged = input.contracts !== strategy.contracts;
        const feeChanged = input.feePerContract !== strategy.feePerContract;
        if ((sizeChanged || feeChanged) && tradeCount > 0) {
          setPendingResize({
            contractsFrom: strategy.contracts,
            contractsTo: input.contracts,
            feeFrom: strategy.feePerContract,
            feeTo: input.feePerContract,
          });
        } else {
          onClose();
        }
      } else {
        const id = await createStrategy(input);
        onClose();
        router.push(`/backtest/${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this strategy.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResizeDecision(apply: boolean) {
    if (!strategy || !pendingResize) return;
    if (!apply) {
      onClose();
      return;
    }
    setResizing(true);
    try {
      await bulkResizeBacktestTrades(strategy.id, pendingResize.contractsTo, pendingResize.feeTo);
      router.refresh();
      onClose();
    } finally {
      setResizing(false);
    }
  }

  async function handleDelete() {
    if (!strategy) return;
    setSubmitting(true);
    try {
      await deleteStrategy(strategy.id);
      onClose();
      router.push("/backtest");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pendingResize ? "Update logged trades?" : strategy ? "Edit strategy" : "New strategy"}
      icon={FlaskConical}
      width="max-w-xl"
    >
      {pendingResize ? (
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-[var(--text-muted)]">
            {pendingResize.contractsFrom !== pendingResize.contractsTo && (
              <>
                Trade size changed from <b className="text-[var(--text)]">{pendingResize.contractsFrom}</b> to{" "}
                <b className="text-[var(--text)]">{pendingResize.contractsTo}</b> contract
                {pendingResize.contractsTo === 1 ? "" : "s"}.{" "}
              </>
            )}
            {pendingResize.feeFrom !== pendingResize.feeTo && (
              <>
                Fee per contract changed from <b className="text-[var(--text)]">{formatCurrency(pendingResize.feeFrom)}</b>{" "}
                to <b className="text-[var(--text)]">{formatCurrency(pendingResize.feeTo)}</b>.{" "}
              </>
            )}
            The strategy is already saved. This only decides what happens to the{" "}
            <b className="text-[var(--text)]">{tradeCount}</b> trade{tradeCount === 1 ? "" : "s"} already logged.
          </p>
          <p className="text-[var(--text-muted)]">
            Updating recalculates their net P&amp;L at the new size: points stay exactly as logged, and every trade&apos;s
            fee is repriced at the strategy&apos;s current fee per contract ({formatCurrency(pendingResize.feeTo)}).
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => handleResizeDecision(false)}
              disabled={resizing}
              className={secondaryButtonClass}
            >
              No, keep as logged
            </button>
            <button
              type="button"
              onClick={() => handleResizeDecision(true)}
              disabled={resizing}
              className={primaryButtonClass}
            >
              {resizing ? "Updating…" : `Yes, update all ${tradeCount} trades`}
            </button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Strategy name</label>
          <input
            required
            autoFocus
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Opening range breakout"
          />
        </div>

        <div>
          <label className={labelClass}>Description (optional)</label>
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One line on the setup and the rules"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Symbol</label>
            <input
              required
              list="strategy-symbols"
              className={inputClass}
              value={symbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              placeholder="NQ"
            />
            <datalist id="strategy-symbols">
              {FUTURES_SYMBOLS.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Timeframe</label>
            <select className={inputClass} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
              {TIMEFRAMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Point value ($/pt)</label>
            <input
              required
              type="number"
              step="any"
              min="0"
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              value={pointValue}
              onChange={(e) => setPointValue(e.target.value)}
              disabled={!!knownSymbol}
              placeholder="Custom symbol"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Trade size</label>
            <input
              required
              type="number"
              min="1"
              step="1"
              className={inputClass}
              value={contracts}
              onChange={(e) => setContracts(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Max trades / day</label>
            <input
              type="number"
              min="1"
              step="1"
              className={inputClass}
              value={maxTrades}
              onChange={(e) => setMaxTrades(e.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Exit rules</label>
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
            {(
              [
                ["points", "Fixed points (TP / SL)"],
                ["rr", "Risk : reward"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setExitMode(mode)}
                className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition ${
                  exitMode === mode
                    ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {exitMode === "points" ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>TP (points)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  value={tpPoints}
                  onChange={(e) => setTpPoints(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={labelClass}>SL (points)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  value={slPoints}
                  onChange={(e) => setSlPoints(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Reward for every 1 of risk</label>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 whitespace-nowrap text-sm font-medium text-[var(--text-muted)]">1 :</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    className={inputClass}
                    value={rrInput}
                    onChange={(e) => setRrInput(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Typical risk (points)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  value={slPoints}
                  onChange={(e) => setSlPoints(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <p className="col-span-2 -mt-1 text-[11px] text-[var(--text-muted)]">
                A win pays the risk times this ratio and a loss costs 1 R. With a typical risk set, wins and losses
                fill in their points automatically. Without it, you enter the points on each trade. You can always
                override the points per trade.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Fee per contract ($, round turn)</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputClass}
              value={feePerContract}
              onChange={(e) => setFeePerContract(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Starting capital ($, optional)</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputClass}
              value={startingCapital}
              onChange={(e) => setStartingCapital(e.target.value)}
            />
          </div>
        </div>

        {pv > 0 && (tp > 0 || sl > 0) && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-xs text-[var(--text-muted)]">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {tp > 0 && (
                <span>
                  Reward <b className="tabular text-[var(--profit)]">{formatCurrency(reward)}</b>
                </span>
              )}
              {sl > 0 && (
                <span>
                  Risk <b className="tabular text-[var(--loss)]">{formatCurrency(risk)}</b>
                </span>
              )}
              {effectiveRr > 0 && (
                <>
                  <span>
                    R:R <b className="tabular text-[var(--text)]">1 : {effectiveRr.toFixed(2)}</b>
                  </span>
                  <span>
                    Break-even win rate{" "}
                    <b className="tabular text-[var(--text)]">
                      {((1 / (1 + effectiveRr)) * 100).toFixed(1)}%
                    </b>
                  </span>
                </>
              )}
              {fees > 0 && (
                <span>
                  Fees per trade <b className="tabular text-[var(--text)]">{formatCurrency(fees)}</b>
                </span>
              )}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className="h-7 w-7 cursor-pointer rounded-full"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${c}` : "none",
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            className={inputClass}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Entry rules, filters, sessions traded, data source"
          />
        </div>

        {error && <p className="text-sm text-[var(--loss)]">{error}</p>}

        <div className="mt-2 flex items-center justify-between gap-2">
          {strategy ? (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-xs text-[var(--loss)]">
                Delete this strategy and its {tradeCount} trade{tradeCount === 1 ? "" : "s"}?
                <button type="button" onClick={handleDelete} disabled={submitting} className={dangerButtonClass}>
                  Yes, delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className={secondaryButtonClass}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className={dangerButtonClass}>
                Delete strategy
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving…" : strategy ? "Save changes" : "Create strategy"}
            </button>
          </div>
        </div>
      </form>
      )}
    </Modal>
  );
}
