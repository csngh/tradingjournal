import type { Account, Trade } from "@/db/schema";
import { netPnl } from "@/lib/metrics";
import { zonedDayKey } from "@/lib/timezone";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "Date",
  "Account",
  "Symbol",
  "Side",
  "Timeframe",
  "Contracts",
  "Points",
  "Point Value",
  "Fees",
  "Gross P&L",
  "Net P&L",
  "Breakeven",
  "BE Outcome",
  "Tags",
  "Notes",
];

export function tradesToCsv(trades: Trade[], accounts: Account[], timeZone: string): string {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const rows = trades.map((t) => {
    const account = accountById.get(t.accountId);
    return [
      zonedDayKey(t.exitTime, timeZone),
      account?.name ?? "",
      t.symbol,
      t.side,
      t.timeframe,
      t.contracts,
      t.points,
      t.pointValue,
      t.fees,
      t.pnl,
      netPnl(t),
      t.isBreakeven ? "Yes" : "No",
      t.beOutcome ?? "",
      t.tags ?? "",
      t.notes ?? "",
    ];
  });

  return [HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
