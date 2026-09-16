"use client";

import { useMemo, useState } from "react";
import { PlusCircle, TrendingUp, TrendingDown, ListOrdered } from "lucide-react";
import { TradeForm } from "@/components/trade-form";
import { TradesFilterBar, EMPTY_FILTERS, isFiltersEmpty, type TradeFilters } from "@/components/trades-filter-bar";
import { Badge } from "@/components/ui/badge";
import { primaryButtonClass } from "@/components/ui/form";
import { formatCurrency } from "@/lib/metrics";
import { formatZonedDate, zonedDayKey } from "@/lib/timezone";
import type { Account, Trade } from "@/db/schema";

export function TradesClient({
  accounts,
  trades,
  timeZone,
}: {
  accounts: Account[];
  trades: Trade[];
  timeZone: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [filters, setFilters] = useState<TradeFilters>(EMPTY_FILTERS);

  function openAdd() {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(trade: Trade) {
    setEditing(trade);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const symbols = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol))).sort(),
    [trades]
  );
  const timeframes = useMemo(
    () => Array.from(new Set(trades.map((t) => t.timeframe))).sort(),
    [trades]
  );

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filters.accountId !== "all" && t.accountId !== filters.accountId) return false;
      if (filters.symbol !== "all" && t.symbol !== filters.symbol) return false;
      if (filters.side !== "all" && t.side !== filters.side) return false;
      if (filters.timeframe !== "all" && t.timeframe !== filters.timeframe) return false;

      const net = t.pnl - t.fees;
      if (filters.result === "win" && net <= 0) return false;
      if (filters.result === "loss" && net >= 0) return false;

      if (filters.dateFrom || filters.dateTo) {
        const day = zonedDayKey(t.exitTime, timeZone);
        if (filters.dateFrom && day < filters.dateFrom) return false;
        if (filters.dateTo && day > filters.dateTo) return false;
      }

      return true;
    });
  }, [trades, filters, timeZone]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--text)]">
          <ListOrdered size={20} className="text-[var(--accent)]" />
          Trades
        </h1>
        <button onClick={openAdd} className={primaryButtonClass} disabled={accounts.length === 0}>
          <PlusCircle size={16} />
          Log trade
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
          Add an account first, then start logging trades.
        </div>
      ) : trades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
          No trades yet for this filter — log your first trade.
        </div>
      ) : (
        <>
          <TradesFilterBar
            filters={filters}
            onChange={setFilters}
            accounts={accounts}
            symbols={symbols}
            timeframes={timeframes}
          />

          {!isFiltersEmpty(filters) && (
            <p className="-mb-1 text-xs text-[var(--text-muted)]">
              Showing {filteredTrades.length} of {trades.length} trades
            </p>
          )}

          {filteredTrades.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
              No trades match these filters.
            </div>
          ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--text-muted)]">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">TF</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-right">Fees</th>
                  <th className="px-4 py-3 text-right">Net P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t) => {
                  const net = t.pnl - t.fees;
                  const account = accountById.get(t.accountId);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openEdit(t)}
                      className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">
                        {formatZonedDate(t.exitTime, timeZone)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: account?.color }} />
                          {account?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{t.symbol}</td>
                      <td className="px-4 py-3">
                        <Badge tone={t.side === "LONG" ? "profit" : "loss"}>{t.side}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">{t.timeframe}</td>
                      <td className="px-4 py-3 text-right tabular">{t.contracts}</td>
                      <td className="px-4 py-3 text-right tabular text-[var(--text-muted)]">
                        {t.points >= 0 ? "+" : ""}
                        {t.points.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular text-[var(--text-muted)]">
                        {formatCurrency(t.fees)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular font-semibold ${
                          net >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
                        }`}
                      >
                        <span className="flex items-center justify-end gap-1">
                          {net >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {formatCurrency(net)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}

      <TradeForm
        key={formKey}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        accounts={accounts}
        trade={editing}
        timeZone={timeZone}
      />
    </div>
  );
}
