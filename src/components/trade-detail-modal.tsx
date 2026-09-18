"use client";

import { Pencil, TrendingUp, TrendingDown } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { TagPill } from "@/components/ui/tag-pill";
import { primaryButtonClass } from "@/components/ui/form";
import { formatCurrency } from "@/lib/metrics";
import { formatZonedDateTime } from "@/lib/timezone";
import type { Account, Tag, Trade } from "@/db/schema";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text)]">{value}</span>
    </div>
  );
}

export function TradeDetailModal({
  open,
  onClose,
  onEdit,
  trade,
  account,
  tag,
  timeZone,
}: {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  trade: Trade | null;
  account?: Account;
  tag?: Tag;
  timeZone: string;
}) {
  if (!trade) return null;

  const net = trade.pnl - trade.fees;
  const isProfit = net >= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${trade.symbol} trade`}
      icon={isProfit ? TrendingUp : TrendingDown}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-4 py-3.5">
          <span className="flex items-center gap-1.5">
            <Badge tone={trade.side === "LONG" ? "profit" : "loss"}>{trade.side}</Badge>
            {trade.isBreakeven && (
              <Badge tone="neutral">
                BE{trade.beOutcome ? ` · ${trade.beOutcome}` : ""}
              </Badge>
            )}
            {tag && <TagPill tag={tag} />}
          </span>
          <span
            className={`flex items-center gap-1 text-lg font-semibold tabular ${
              isProfit ? "text-[var(--profit)]" : "text-[var(--loss)]"
            }`}
          >
            {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {formatCurrency(net)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
          <Field
            label="Account"
            value={
              account ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: account.color }} />
                  {account.name}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Field label="Timeframe" value={trade.timeframe} />
          <Field label="Contracts" value={trade.contracts} />
          <Field label="Entry Time" value={formatZonedDateTime(trade.entryTime, timeZone)} />
          <Field
            label="Points"
            value={`${trade.points >= 0 ? "+" : ""}${trade.points.toLocaleString()}`}
          />
          <Field label="Point value" value={formatCurrency(trade.pointValue)} />
          <Field label="Fees" value={formatCurrency(trade.fees)} />
          <Field label="Gross P&L" value={formatCurrency(trade.pnl)} />
        </div>

        {trade.notes && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">Notes</span>
            <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{trade.notes}</p>
          </div>
        )}

        <div className="flex justify-end border-t border-[var(--border)] pt-4">
          <button onClick={onEdit} className={primaryButtonClass}>
            <Pencil size={15} />
            Edit trade
          </button>
        </div>
      </div>
    </Modal>
  );
}
