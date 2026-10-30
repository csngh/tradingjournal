"use client";

import { useRef, useState } from "react";
import { ClipboardPlus, Check, CalendarPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form";
import {
  createBacktestTrade,
  updateBacktestTrade,
  deleteBacktestTrade,
  type BacktestTradeInput,
} from "@/app/actions";
import { defaultFees, strategyRules } from "@/lib/backtest";
import { formatCurrency } from "@/lib/metrics";
import { wallClockToUtcIso, zonedWallClock, zonedDayKey } from "@/lib/timezone";
import type { BacktestTrade, Strategy } from "@/db/schema";

type ExitReason = BacktestTradeInput["exitReason"];

/** Adds one calendar day to a "YYYY-MM-DD" string, via UTC noon so DST never shifts the date. */
function addOneDay(dateStr: string): string {
  if (!dateStr) return dateStr;
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function BacktestTradeForm({
  open,
  onClose,
  strategy,
  trade,
  timeZone,
  lastEntryTime,
  dayCounts,
}: {
  open: boolean;
  onClose: () => void;
  strategy: Strategy;
  trade?: BacktestTrade | null;
  timeZone: string;
  lastEntryTime?: string | null;
  /** How many trades are already logged on each calendar day (app timezone). */
  dayCounts: Record<string, number>;
}) {
  const rules = strategyRules(strategy);
  // A risk:reward strategy still offers Win / Loss even before any point sizes are known.
  const hasTp = rules.tp != null || rules.mode === "rr";
  const hasSl = rules.sl != null || rules.mode === "rr";
  const fmt = (n: number) => String(Math.round(n * 100) / 100);

  const [side, setSide] = useState<BacktestTradeInput["side"]>(trade?.side ?? "LONG");
  const initialWall = zonedWallClock(trade?.entryTime ?? lastEntryTime ?? new Date().toISOString(), timeZone);
  const [date, setDate] = useState(initialWall.slice(0, 10));
  const [withTime, setWithTime] = useState(trade?.hasEntryTime ?? false);
  const [time, setTime] = useState(trade?.hasEntryTime ? initialWall.slice(11, 16) : "09:30");
  const [contracts, setContracts] = useState(String(trade?.contracts ?? strategy.contracts));
  const [exitReason, setExitReason] = useState<ExitReason>(trade?.exitReason ?? (hasTp ? "TP" : "MANUAL"));
  // For TP / SL this is the size only (the sign follows the result). For custom points it is signed.
  // Left empty on a new trade, so the strategy's own sizes apply. Editing shows what was really saved.
  const [pointsInput, setPointsInput] = useState(
    !trade || trade.exitReason === "BE"
      ? ""
      : trade.exitReason === "MANUAL"
        ? String(trade.points)
        : String(Math.abs(trade.points))
  );
  const [fees, setFees] = useState(String(trade?.fees ?? defaultFees(strategy, strategy.contracts)));
  const [feesTouched, setFeesTouched] = useState(!!trade);
  const [beOutcome, setBeOutcome] = useState<"" | "WIN" | "LOSS">(trade?.beOutcome ?? "");
  const [atr, setAtr] = useState(trade?.atr != null ? String(trade.atr) : "");
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedCount, setLoggedCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const typed = pointsInput.trim() === "" ? null : Number(pointsInput);
  const points =
    exitReason === "TP"
      ? typed != null && Number.isFinite(typed)
        ? Math.abs(typed)
        : rules.tp ?? 0
      : exitReason === "SL"
        ? -(typed != null && Number.isFinite(typed) ? Math.abs(typed) : rules.sl ?? 0)
        : exitReason === "BE"
          ? 0
          : typed != null && Number.isFinite(typed)
            ? typed
            : 0;
  const defaultSize = exitReason === "TP" ? rules.tp : exitReason === "SL" ? rules.sl : null;

  function chooseResult(next: ExitReason) {
    setExitReason(next);
    setPointsInput("");
    if (next !== "BE") setBeOutcome("");
  }

  const size = Math.max(1, Number(contracts) || 1);
  const gross = points * strategy.pointValue * size;
  const net = gross - (Number(fees) || 0);

  function handleContractsChange(value: string) {
    setContracts(value);
    if (!feesTouched) setFees(String(defaultFees(strategy, Math.max(1, Number(value) || 1))));
  }

  const entryWall = date ? `${date}T${withTime && time ? time : "12:00"}` : "";
  const dayKey = entryWall ? zonedDayKey(wallClockToUtcIso(entryWall, timeZone), timeZone) : "";
  const alreadyOnDay =
    (dayCounts[dayKey] ?? 0) -
    (trade && zonedDayKey(trade.entryTime, timeZone) === dayKey ? 1 : 0);
  const overCap = strategy.maxTradesPerDay != null && alreadyOnDay >= strategy.maxTradesPerDay;

  function buildInput(): BacktestTradeInput {
    return {
      strategyId: strategy.id,
      side,
      entryTime: wallClockToUtcIso(entryWall, timeZone),
      hasEntryTime: withTime && !!time,
      contracts: size,
      points,
      fees: Number(fees) || 0,
      exitReason,
      beOutcome: exitReason === "BE" && beOutcome ? beOutcome : null,
      atr: atr.trim() === "" ? null : Number(atr),
      notes: notes || null,
    };
  }

  async function save(addAnother: boolean) {
    if ((exitReason === "TP" || exitReason === "SL") && typed != null && typed === 0) {
      setError("Enter a size greater than zero, or choose Breakeven.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (trade) {
        await updateBacktestTrade(trade.id, buildInput());
        onClose();
      } else {
        await createBacktestTrade(buildInput());
        if (addAnother) {
          setLoggedCount((n) => n + 1);
          setNotes("");
          setPointsInput("");
          setBeOutcome("");
          setExitReason(hasTp ? "TP" : "MANUAL");
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this trade.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void save(false);
  }

  async function handleDelete() {
    if (!trade) return;
    setSubmitting(true);
    try {
      await deleteBacktestTrade(trade.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const segment = (active: boolean, tone: "profit" | "loss" | "gold" | "neutral") =>
    `flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? tone === "profit"
          ? "text-[var(--profit)] [background-image:var(--gradient-profit-soft)]"
          : tone === "loss"
            ? "text-[var(--loss)] [background-image:var(--gradient-loss-soft)]"
            : tone === "gold"
              ? "text-[var(--accent)] [background-image:var(--gradient-accent-soft)]"
              : "bg-[var(--surface)] text-[var(--text)] shadow-sm"
        : "text-[var(--text-muted)] hover:text-[var(--text)]"
    }`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={trade ? "Edit backtest trade" : `Log trade · ${strategy.name}`}
      icon={ClipboardPlus}
      width="max-w-lg"
    >
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Side</label>
            <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
              <button type="button" className={segment(side === "LONG", "profit")} onClick={() => setSide("LONG")}>
                Long
              </button>
              <button type="button" className={segment(side === "SHORT", "loss")} onClick={() => setSide("SHORT")}>
                Short
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Contracts</label>
            <input
              required
              type="number"
              min="1"
              step="1"
              className={inputClass}
              value={contracts}
              onChange={(e) => handleContractsChange(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date</label>
              <div className="flex gap-1.5">
                <input
                  required
                  type="date"
                  className={`${inputClass} cursor-pointer`}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
                <button
                  type="button"
                  title="Add one day"
                  disabled={!date}
                  onClick={() => setDate((d) => addOneDay(d))}
                  className={`${secondaryButtonClass} shrink-0 px-2.5 disabled:opacity-50`}
                >
                  <CalendarPlus size={15} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Entry time</label>
              <input
                required={withTime}
                type="time"
                className={`${inputClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-40`}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!withTime}
              />
            </div>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              checked={withTime}
              onChange={(e) => setWithTime(e.target.checked)}
            />
            Record the entry time (optional, used for the by-hour analysis) · {timeZone}
          </label>
          {overCap && (
            <p className="mt-1 text-[11px] text-[var(--warning)]">
              This day already has {alreadyOnDay} trade{alreadyOnDay === 1 ? "" : "s"}, at or over the
              strategy limit of {strategy.maxTradesPerDay}. It will be flagged in the analysis.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Result</label>
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
            {hasTp && (
              <button type="button" className={segment(exitReason === "TP", "profit")} onClick={() => chooseResult("TP")}>
                {rules.tp != null
                  ? `TP hit +${fmt(rules.tp)}${rules.mode === "rr" ? ` · ${fmt(rules.rr ?? 0)}R` : ""}`
                  : `Win +${fmt(rules.rr ?? 0)}R`}
              </button>
            )}
            {hasSl && (
              <button type="button" className={segment(exitReason === "SL", "loss")} onClick={() => chooseResult("SL")}>
                {rules.sl != null ? `SL hit -${fmt(rules.sl)}${rules.mode === "rr" ? " · 1R" : ""}` : "Loss -1R"}
              </button>
            )}
            <button type="button" className={segment(exitReason === "BE", "gold")} onClick={() => chooseResult("BE")}>
              Breakeven
            </button>
            <button
              type="button"
              className={segment(exitReason === "MANUAL", "neutral")}
              onClick={() => chooseResult("MANUAL")}
            >
              Custom points
            </button>
          </div>
          {exitReason === "BE" && (
            <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <label className={labelClass}>Ultimately a win or loss? (optional)</label>
              <select
                className={inputClass}
                value={beOutcome}
                onChange={(e) => setBeOutcome(e.target.value as "" | "WIN" | "LOSS")}
              >
                <option value="">Not decided yet</option>
                <option value="WIN">Ultimately a win</option>
                <option value="LOSS">Ultimately a loss</option>
              </select>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Doesn&apos;t change the trade&apos;s P&amp;L or any metric. Just tagged for your own analytics.
              </p>
            </div>
          )}
          {exitReason !== "BE" && (
            <div className="mt-2">
              <label className={labelClass}>
                {exitReason === "TP"
                  ? "Points gained"
                  : exitReason === "SL"
                    ? "Points lost"
                    : "Points per contract"}
                {exitReason !== "MANUAL" && defaultSize != null ? " (optional)" : ""}
              </label>
              <input
                required={exitReason === "MANUAL" || defaultSize == null}
                autoFocus={exitReason === "MANUAL"}
                type="number"
                step="any"
                min={exitReason === "MANUAL" ? undefined : "0"}
                className={inputClass}
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                placeholder={
                  exitReason === "MANUAL"
                    ? "Signed, e.g. 12.5 or -6"
                    : defaultSize != null
                      ? `Leave empty for ${fmt(defaultSize)}`
                      : "Enter the size, e.g. 18"
                }
              />
              {exitReason !== "MANUAL" && (
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  {defaultSize != null
                    ? "Fill in only when the actual result differed from the plan. Enter the size; the sign follows the result."
                    : "This strategy has no fixed size, so enter the points. Enter the size; the sign follows the result."}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Fees ($)</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputClass}
              value={fees}
              onChange={(e) => {
                setFees(e.target.value);
                setFeesTouched(true);
              }}
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {exitReason === "BE"
                ? "Breakeven trades still pay fees, so the net is the fees as a loss."
                : strategy.feePerContract > 0
                  ? `Auto: ${formatCurrency(strategy.feePerContract)}/contract`
                  : "Set a fee per contract on the strategy to auto-fill."}
            </p>
          </div>
          <div>
            <label className={labelClass}>Net P&amp;L</label>
            <div
              className={`flex h-9 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold tabular ${
                points === 0
                  ? "text-[var(--text-muted)]"
                  : net >= 0
                    ? "text-[var(--profit)]"
                    : "text-[var(--loss)]"
              }`}
            >
              {net >= 0 ? "+" : ""}
              {formatCurrency(net)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>ATR (optional)</label>
            <input
              type="number"
              min="0"
              step="any"
              className={inputClass}
              value={atr}
              onChange={(e) => setAtr(e.target.value)}
              placeholder="e.g. 42.5"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            className={inputClass}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Setup quality, market context, mistakes"
          />
        </div>

        {error && <p className="text-sm text-[var(--loss)]">{error}</p>}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          {trade ? (
            <button type="button" onClick={handleDelete} disabled={submitting} className={dangerButtonClass}>
              Delete trade
            </button>
          ) : loggedCount > 0 ? (
            <span className="flex items-center gap-1 text-xs text-[var(--profit)]">
              <Check size={14} />
              {loggedCount} logged this session
            </span>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              {loggedCount > 0 ? "Done" : "Cancel"}
            </button>
            {!trade && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (formRef.current?.reportValidity()) void save(true);
                }}
                className={secondaryButtonClass}
              >
                Save &amp; add another
              </button>
            )}
            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving…" : trade ? "Save changes" : "Log trade"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
