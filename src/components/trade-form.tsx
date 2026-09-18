"use client";

import { useState } from "react";
import { ListOrdered } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form";
import { createTrade, updateTrade, deleteTrade, type TradeInput } from "@/app/actions";
import { FUTURES_SYMBOLS, findFuturesSymbol } from "@/lib/futures-symbols";
import { TIMEFRAMES, minutesForTimeframe, bucketToCandleClose } from "@/lib/timeframes";
import { formatCurrency } from "@/lib/metrics";
import { wallClockToUtcIso, zonedWallClock } from "@/lib/timezone";
import type { Account, Tag, Trade } from "@/db/schema";

export function TradeForm({
  open,
  onClose,
  accounts,
  tags,
  trade,
  timeZone,
  defaultAccountId,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  tags: Tag[];
  trade?: Trade | null;
  timeZone: string;
  defaultAccountId?: string;
  defaultDate?: string;
}) {
  const defaultTime = defaultDate
    ? `${defaultDate}T09:30`
    : zonedWallClock(new Date().toISOString(), timeZone);

  const [accountId, setAccountId] = useState(trade?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "");
  const [symbol, setSymbol] = useState(trade?.symbol ?? "");
  const [side, setSide] = useState<TradeInput["side"]>(trade?.side ?? "LONG");
  const [timeframe, setTimeframe] = useState(trade?.timeframe ?? "3m");
  const [contracts, setContracts] = useState(String(trade?.contracts ?? 1));
  const [entryTime, setEntryTime] = useState(
    trade
      ? zonedWallClock(trade.entryTime, timeZone)
      : bucketToCandleClose(defaultTime, minutesForTimeframe("3m"))
  );
  const [points, setPoints] = useState(String(trade?.points ?? ""));
  const [pointValue, setPointValue] = useState(
    String(trade?.pointValue ?? findFuturesSymbol(trade?.symbol ?? "")?.pointValue ?? "")
  );
  const [fees, setFees] = useState(String(trade?.fees ?? 0));
  const [isBreakeven, setIsBreakeven] = useState(trade?.isBreakeven ?? false);
  const [beOutcome, setBeOutcome] = useState<"" | "WIN" | "LOSS">(trade?.beOutcome ?? "");
  const [tagId, setTagId] = useState(trade?.tagId ?? "");
  const [notes, setNotes] = useState(trade?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  function recalcFees(nextContracts: string, nextAccountId: string) {
    const account = accounts.find((a) => a.id === nextAccountId);
    if (account?.feePerContract == null) return;
    const c = Number(nextContracts) || 0;
    setFees((account.feePerContract * c).toFixed(2));
  }

  function handleAccountChange(value: string) {
    setAccountId(value);
    recalcFees(contracts, value);
  }

  function handleContractsChange(value: string) {
    setContracts(value);
    recalcFees(value, accountId);
  }

  function handleSymbolChange(value: string) {
    const upper = value.toUpperCase();
    setSymbol(upper);
    const known = findFuturesSymbol(upper);
    if (known) setPointValue(String(known.pointValue));
  }

  function handleTimeframeChange(value: string) {
    setTimeframe(value);
    setEntryTime((prev) => bucketToCandleClose(prev, minutesForTimeframe(value)));
  }

  function handleEntryTimeChange(value: string) {
    setEntryTime(bucketToCandleClose(value, minutesForTimeframe(timeframe)));
  }

  const grossPnl = (Number(points) || 0) * (Number(pointValue) || 0) * (Number(contracts) || 0);
  const netPnl = grossPnl - (Number(fees) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const input: TradeInput = {
      accountId,
      symbol,
      side,
      timeframe,
      contracts: Number(contracts) || 1,
      points: Number(points) || 0,
      pointValue: Number(pointValue) || 0,
      entryTime: wallClockToUtcIso(entryTime, timeZone),
      fees: Number(fees) || 0,
      pnl: grossPnl,
      isBreakeven,
      beOutcome: isBreakeven && beOutcome ? beOutcome : null,
      tagId: tagId || null,
      notes: notes || null,
    };
    try {
      if (trade) {
        await updateTrade(trade.id, input);
      } else {
        await createTrade(input);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!trade) return;
    setSubmitting(true);
    try {
      await deleteTrade(trade.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={trade ? "Edit trade" : "Log a trade"} icon={ListOrdered} width="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>Account</label>
          <select
            className={inputClass}
            value={accountId}
            onChange={(e) => handleAccountChange(e.target.value)}
            required
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.role === "MASTER" ? " (master, copies to followers)" : ""}
              </option>
            ))}
          </select>
          {selectedAccount?.role === "MASTER" && (
            <p className="mt-1 text-xs text-[var(--accent)]">
              This trade will auto-copy to this account&apos;s followers.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Symbol</label>
            <input
              required
              list="futures-symbols"
              className={inputClass}
              value={symbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              placeholder="ES"
            />
            <datalist id="futures-symbols">
              {FUTURES_SYMBOLS.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.name}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Side</label>
            <select className={inputClass} value={side} onChange={(e) => setSide(e.target.value as TradeInput["side"])}>
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Contracts</label>
            <input
              required
              type="number"
              min="1"
              className={inputClass}
              value={contracts}
              onChange={(e) => handleContractsChange(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Timeframe</label>
            <select className={inputClass} value={timeframe} onChange={(e) => handleTimeframeChange(e.target.value)}>
              {TIMEFRAMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Entry time</label>
            <input
              required
              type="datetime-local"
              className={`${inputClass} cursor-pointer`}
              value={entryTime}
              onChange={(e) => handleEntryTimeChange(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Snapped to this timeframe&apos;s candle close · {timeZone}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Points +/-</label>
            <input
              required
              type="number"
              step="0.01"
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="e.g. 12.5 or -6"
              disabled={isBreakeven}
            />
            {isBreakeven && (
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Locked to 0 because breakeven trades don&apos;t move points.
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Point value ($/pt)</label>
            <input
              required
              type="number"
              step="0.01"
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              value={pointValue}
              disabled
              readOnly
              placeholder="Auto-fills from symbol"
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Set automatically from the symbol above.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Fees / commissions ($)</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {selectedAccount?.feePerContract != null
                ? `Auto: ${formatCurrency(selectedAccount.feePerContract)}/contract`
                : "Set a fee per contract on the account to auto-fill this."}
            </p>
          </div>
          <div>
            <label className={labelClass}>Net P&amp;L</label>
            <div
              className={`flex h-9 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-semibold tabular ${
                isBreakeven ? "text-[var(--text-muted)]" : netPnl >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
              }`}
            >
              {netPnl >= 0 ? "+" : ""}
              {formatCurrency(netPnl)}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--text)]">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              checked={isBreakeven}
              onChange={(e) => {
                setIsBreakeven(e.target.checked);
                if (e.target.checked) {
                  setPoints("0");
                } else {
                  setBeOutcome("");
                }
              }}
            />
            Mark as breakeven (BE)
          </label>
          <p className="mt-1 pl-6 text-[11px] text-[var(--text-muted)]">
            Counts as a scratch, not a win or loss, even if fees push the net P&amp;L slightly
            off zero.
          </p>

          {isBreakeven && (
            <div className="mt-3 pl-6">
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
                Doesn&apos;t affect dashboard metrics. Just tagged for your own analytics later.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>Tag</label>
          <select
            className={inputClass}
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
          >
            <option value="">No tag</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id} style={{ color: t.color }}>
                {t.name}
              </option>
            ))}
          </select>
          {tags.length === 0 && (
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              No tags yet. Add some in Settings.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            className={inputClass}
            rows={3}
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was the setup? How did you feel executing it?"
          />
        </div>

        <div className="mt-2 flex items-center justify-between">
          {trade ? (
            <button type="button" onClick={handleDelete} disabled={submitting} className={dangerButtonClass}>
              Delete trade
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? "Saving…" : trade ? "Save changes" : "Log trade"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
