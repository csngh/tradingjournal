import type { Account, Tag, Trade } from "@/db/schema";
import { netPnl } from "@/lib/metrics";
import { formatZonedDate, formatZonedTime } from "@/lib/timezone";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Plain 2-decimal numeric string (not currency-formatted) so Excel reads it as a number. */
function money(value: number): string {
  return value.toFixed(2);
}

const HEADERS = [
  "Account",
  "Symbol",
  "Side",
  "Timeframe",
  "Contracts",
  "Entry Date",
  "Entry Time",
  "Points",
  "Point Value",
  "Fees",
  "Gross P&L",
  "Net P&L",
  "Breakeven",
  "BE Outcome",
  "Tag",
  "Notes",
];

export function tradesToCsv(trades: Trade[], accounts: Account[], tags: Tag[], timeZone: string): string {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const rows = trades.map((t) => {
    const account = accountById.get(t.accountId);
    const tag = t.tagId ? tagById.get(t.tagId) : undefined;
    return [
      account?.name ?? "",
      t.symbol,
      t.side,
      t.timeframe,
      t.contracts,
      formatZonedDate(t.entryTime, timeZone),
      formatZonedTime(t.entryTime, timeZone),
      t.points,
      t.pointValue,
      money(t.fees),
      money(t.pnl),
      money(netPnl(t)),
      t.isBreakeven ? "Yes" : "No",
      t.beOutcome ?? "",
      tag?.name ?? "",
      t.notes ?? "",
    ];
  });

  return [HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, csv: string) {
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}

export function downloadJson(filename: string, data: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}
