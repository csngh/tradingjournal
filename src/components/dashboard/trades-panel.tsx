"use client";

import { useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/metrics";
import { zonedDayKey } from "@/lib/timezone";
import { Tooltip } from "@/components/ui/tooltip";
import type { Trade } from "@/db/schema";

type Tab = "recent" | "biggest";

export function TradesPanel({ trades, timeZone }: { trades: Trade[]; timeZone: string }) {
  const [tab, setTab] = useState<Tab>("recent");

  const rows =
    tab === "recent"
      ? [...trades].sort(
          (a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
        )
      : [...trades].sort(
          (a, b) => Math.abs(b.pnl - b.fees) - Math.abs(a.pnl - a.fees)
        );

  return (
    <div className="flex h-full max-h-[560px] min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[17px] font-semibold text-[var(--text)]">
          Trades
          <Tooltip content="Your closed trades for the selected accounts.">
            <span className="flex cursor-help items-center text-[var(--text-faint)]">
              <Info size={14} />
            </span>
          </Tooltip>
        </span>
        <Link href="/trades" className="text-xs font-medium text-[var(--accent)]">
          View all
        </Link>
      </div>

      <div className="mt-3 flex gap-1 rounded-xl bg-[var(--surface-2)] p-1">
        <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
          Recent
        </TabButton>
        <TabButton active={tab === "biggest"} onClick={() => setTab("biggest")}>
          Biggest
        </TabButton>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">
          No trades logged yet.
        </p>
      ) : (
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--surface)]">
              <tr className="text-left text-xs font-medium text-[var(--text-muted)]">
                <th className="py-2 pr-2 font-medium">Symbol</th>
                <th className="py-2 pr-2 font-medium">Close date</th>
                <th className="py-2 text-right font-medium">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const net = t.pnl - t.fees;
                return (
                  <tr key={t.id} className="border-t border-[var(--border)]">
                    <td className="py-2.5 pr-2 font-medium text-[var(--text)]">{t.symbol}</td>
                    <td className="py-2.5 pr-2 text-[var(--text-muted)] tabular">
                      {zonedDayKey(t.exitTime, timeZone)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-semibold tabular ${
                        net >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
                      }`}
                    >
                      {net >= 0 ? "+" : "-"}
                      {formatCurrency(Math.abs(net))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
        active
          ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
          : "text-[var(--text-muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}
