"use client";

import { useMemo, useState } from "react";
import { PlusCircle, TrendingUp, TrendingDown, ListOrdered, Download, Pencil } from "lucide-react";
import { TradeForm } from "@/components/trade-form";
import { TradeDetailModal } from "@/components/trade-detail-modal";
import { TradesFilterBar, EMPTY_FILTERS, isFiltersEmpty, type TradeFilters } from "@/components/trades-filter-bar";
import { TradesSummary } from "@/components/trades-summary";
import { Badge } from "@/components/ui/badge";
import { TagPill } from "@/components/ui/tag-pill";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { formatCurrency, isScratchTrade, computeTradeStats } from "@/lib/metrics";
import { formatZonedDate, formatZonedTime, zonedDayKey } from "@/lib/timezone";
import { tradesToCsv, downloadCsv } from "@/lib/csv";
import type { Account, Tag, Trade } from "@/db/schema";

export function TradesClient({
  accounts,
  tags,
  trades,
  timeZone,
  countBreakeven,
}: {
  accounts: Account[];
  tags: Tag[];
  trades: Trade[];
  timeZone: string;
  countBreakeven: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [filters, setFilters] = useState<TradeFilters>(EMPTY_FILTERS);
  const [viewing, setViewing] = useState<Trade | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

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

  function openView(trade: Trade) {
    setViewing(trade);
    setViewOpen(true);
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const tagById = new Map(tags.map((t) => [t.id, t]));

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
      if (filters.tagId === "none" && t.tagId) return false;
      if (filters.tagId !== "all" && filters.tagId !== "none" && t.tagId !== filters.tagId) return false;

      const net = t.pnl - t.fees;
      const scratch = isScratchTrade(t);
      if (filters.result === "win" && (scratch || net <= 0)) return false;
      if (filters.result === "loss" && (scratch || net >= 0)) return false;
      if (filters.result === "be" && !scratch) return false;
      if (filters.result === "be-win" && !(scratch && t.beOutcome === "WIN")) return false;
      if (filters.result === "be-loss" && !(scratch && t.beOutcome === "LOSS")) return false;

      if (filters.dateFrom || filters.dateTo) {
        const day = zonedDayKey(t.exitTime, timeZone);
        if (filters.dateFrom && day < filters.dateFrom) return false;
        if (filters.dateTo && day > filters.dateTo) return false;
      }

      return true;
    });
  }, [trades, filters, timeZone]);

  const metricsTrades = useMemo(
    () => (countBreakeven ? filteredTrades : filteredTrades.filter((t) => !t.isBreakeven)),
    [filteredTrades, countBreakeven]
  );
  const filteredStats = useMemo(
    () => computeTradeStats(metricsTrades, timeZone),
    [metricsTrades, timeZone]
  );
  const trueFilteredStats = useMemo(
    () => computeTradeStats(filteredTrades, timeZone),
    [filteredTrades, timeZone]
  );

  function handleExport() {
    const csv = tradesToCsv(filteredTrades, accounts, tags, timeZone);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`trades-${stamp}.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--text)]">
          <ListOrdered size={20} className="text-[var(--accent)]" />
          Trades
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className={secondaryButtonClass}
            disabled={filteredTrades.length === 0}
          >
            <Download size={16} />
            Export CSV
          </button>
          <button onClick={openAdd} className={primaryButtonClass} disabled={accounts.length === 0}>
            <PlusCircle size={16} />
            Log trade
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
          Add an account first, then start logging trades.
        </div>
      ) : trades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
          No trades yet for this filter. Log your first trade.
        </div>
      ) : (
        <>
          <TradesFilterBar
            filters={filters}
            onChange={setFilters}
            accounts={accounts}
            symbols={symbols}
            timeframes={timeframes}
            tags={tags}
          />

          {!isFiltersEmpty(filters) && (
            <p className="-mb-1 text-xs text-[var(--text-muted)]">
              Showing {filteredTrades.length} of {trades.length} trades
            </p>
          )}

          {filteredTrades.length > 0 && (
            <TradesSummary
              stats={filteredStats}
              netPnl={trueFilteredStats.netPnl}
              totalTrades={trueFilteredStats.totalTrades}
              scratches={trueFilteredStats.scratches}
            />
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
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Entry Time</th>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">TF</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-right">Fees</th>
                  <th className="px-4 py-3 text-right">Net P&amp;L</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((t) => {
                  const net = t.pnl - t.fees;
                  const account = accountById.get(t.accountId);
                  const tag = t.tagId ? tagById.get(t.tagId) : undefined;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openView(t)}
                      className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: account?.color }} />
                          {account?.name ?? "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">
                        {formatZonedDate(t.exitTime, timeZone)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">
                        {formatZonedTime(t.entryTime, timeZone)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--text)]">{t.symbol}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <Badge tone={t.side === "LONG" ? "profit" : "loss"}>{t.side}</Badge>
                          {t.isBreakeven && <Badge tone="neutral">BE</Badge>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {tag ? <TagPill tag={tag} /> : <span className="text-[var(--text-faint)]">—</span>}
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
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(t);
                          }}
                          title="Edit trade"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
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
        tags={tags}
        trade={editing}
        timeZone={timeZone}
      />

      <TradeDetailModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        onEdit={() => {
          setViewOpen(false);
          if (viewing) openEdit(viewing);
        }}
        trade={viewing}
        account={viewing ? accountById.get(viewing.accountId) : undefined}
        tag={viewing?.tagId ? tagById.get(viewing.tagId) : undefined}
        timeZone={timeZone}
      />
    </div>
  );
}
