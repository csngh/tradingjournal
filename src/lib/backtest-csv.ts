import type { BacktestTrade, Strategy } from "@/db/schema";
import type { BacktestTradeInput } from "@/app/actions";
import { backtestGross, backtestNet, strategyRules } from "@/lib/backtest";
import { wallClockToUtcIso, zonedWallClock } from "@/lib/timezone";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EXPORT_HEADERS = ["Date", "Time", "Side", "Contracts", "Points", "Exit", "BE Outcome", "Fees", "Gross P&L", "Net P&L", "Notes"];

export const BACKTEST_CSV_TEMPLATE =
  "Date,Time,Side,Contracts,Points,Exit,Fees,Notes\n2026-01-05,09:35,LONG,1,20,TP,4.50,Opening range break\n2026-01-05,10:10,SHORT,1,-10,SL,4.50,";

/**
 * When `whatIf` is given, every trade is exported entirely as it's re-priced under that view
 * (another symbol and/or contract size — see `applyScenario`): Contracts, Fees, Gross P&L and Net
 * P&L all use the what-if numbers, not the numbers as actually logged. The file otherwise looks
 * exactly like a normal export — same columns, no extra "what-if" columns — so it can be reimported
 * like any other CSV. Points stay as logged either way; only the dollar value per point and the size
 * change. Rows are matched by trade id so the export stays aligned even if either array's order differs.
 */
export function backtestTradesToCsv(
  trades: BacktestTrade[],
  strategy: Strategy,
  timeZone: string,
  whatIf?: { strategy: Strategy; trades: BacktestTrade[] }
): string {
  const whatIfById = whatIf ? new Map(whatIf.trades.map((t) => [t.id, t])) : null;
  const priceStrategy = whatIf?.strategy ?? strategy;
  const rows = [...trades]
    .sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime())
    .map((t) => {
      const priced = whatIfById?.get(t.id) ?? t;
      const wall = zonedWallClock(t.entryTime, timeZone);
      return [
        wall.slice(0, 10),
        t.hasEntryTime ? wall.slice(11, 16) : "",
        t.side,
        priced.contracts,
        t.points,
        t.exitReason,
        t.exitReason === "BE" ? (t.beOutcome ?? "") : "",
        priced.fees.toFixed(2),
        backtestGross(priced, priceStrategy).toFixed(2),
        backtestNet(priced, priceStrategy).toFixed(2),
        t.notes ?? "",
      ];
    });
  return [EXPORT_HEADERS, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF, and a leading BOM. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES = {
  datetime: ["datetime", "timestamp"],
  date: ["date", "entrydate", "day"],
  time: ["time", "entrytime"],
  side: ["side", "direction", "type"],
  points: ["points", "pts", "pnlpoints"],
  result: ["exit", "exitreason", "result", "outcome"],
  beOutcome: ["beoutcome", "beresult", "beultimately", "ultimateoutcome"],
  contracts: ["contracts", "qty", "size", "quantity"],
  fees: ["fees", "fee", "commission", "commissions"],
  notes: ["notes", "note", "comment", "comments"],
} as const;

const pad = (n: number | string) => String(n).padStart(2, "0");

function parseDatePart(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${pad(m[1])}-${pad(m[2])}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return null;
}

function parseTimePart(raw: string): string | null {
  const m = raw.trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) {
    const pm = m[3].toLowerCase() === "pm";
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

function parseSide(raw: string): "LONG" | "SHORT" | null {
  const s = raw.trim().toLowerCase();
  if (["long", "buy", "l", "b"].includes(s)) return "LONG";
  if (["short", "sell", "s"].includes(s)) return "SHORT";
  return null;
}

function parseBeOutcome(raw: string): "WIN" | "LOSS" | null {
  const s = raw.trim().toLowerCase();
  if (["win", "w", "won", "ultimately a win"].includes(s)) return "WIN";
  if (["loss", "l", "lost", "ultimately a loss"].includes(s)) return "LOSS";
  return null;
}

export type ParsedBacktestRow = Omit<BacktestTradeInput, "strategyId">;

export function parseBacktestCsv(
  text: string,
  strategy: Strategy,
  timeZone: string
): { rows: ParsedBacktestRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ["The file needs a header row and at least one trade."] };

  const rules = strategyRules(strategy);
  const header = table[0].map(norm);
  const find = (names: readonly string[]) => header.findIndex((h) => names.includes(h));
  const col = {
    datetime: find(ALIASES.datetime),
    date: find(ALIASES.date),
    time: find(ALIASES.time),
    side: find(ALIASES.side),
    points: find(ALIASES.points),
    result: find(ALIASES.result),
    beOutcome: find(ALIASES.beOutcome),
    contracts: find(ALIASES.contracts),
    fees: find(ALIASES.fees),
    notes: find(ALIASES.notes),
  };

  const headerErrors: string[] = [];
  if (col.datetime < 0 && col.date < 0) headerErrors.push('Missing a "Date" column.');
  if (col.side < 0) headerErrors.push('Missing a "Side" column (LONG or SHORT).');
  if (col.points < 0 && col.result < 0) headerErrors.push('Missing a "Points" column (or an "Exit" column with TP / SL).');
  if (headerErrors.length) return { rows: [], errors: headerErrors };

  const rows: ParsedBacktestRow[] = [];
  const errors: string[] = [];
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  table.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const problems: string[] = [];

    let datePart: string | null = null;
    let timePart: string | null = null;
    if (col.datetime >= 0 && cell(r, col.datetime)) {
      const raw = cell(r, col.datetime);
      datePart = parseDatePart(raw);
      timePart = parseTimePart(raw);
    }
    if (!datePart && col.date >= 0) datePart = parseDatePart(cell(r, col.date));
    if (!timePart && col.time >= 0 && cell(r, col.time)) timePart = parseTimePart(cell(r, col.time));
    if (!datePart) problems.push("invalid date");
    const hasEntryTime = timePart != null;
    if (!timePart) timePart = "12:00";

    const side = parseSide(cell(r, col.side));
    if (!side) problems.push(`invalid side "${cell(r, col.side)}"`);

    const resultRaw = cell(r, col.result).toLowerCase();
    let exitReason: ParsedBacktestRow["exitReason"] | null = null;
    if (["tp", "take profit", "takeprofit", "win", "target"].includes(resultRaw)) exitReason = "TP";
    else if (["sl", "stop", "stop loss", "stoploss", "loss"].includes(resultRaw)) exitReason = "SL";
    else if (["be", "breakeven", "break even", "scratch"].includes(resultRaw)) exitReason = "BE";
    else if (["manual", "custom"].includes(resultRaw)) exitReason = "MANUAL";

    let points: number | null = null;
    if (exitReason === "BE") {
      points = 0;
    } else if (col.points >= 0 && cell(r, col.points) !== "") {
      const n = Number(cell(r, col.points).replace(/,/g, ""));
      if (Number.isFinite(n)) points = n;
      else problems.push(`invalid points "${cell(r, col.points)}"`);
    } else if (exitReason === "TP" && rules.tp != null) {
      points = rules.tp;
    } else if (exitReason === "SL" && rules.sl != null) {
      points = -rules.sl;
    } else {
      problems.push("no points, and no TP/SL result the strategy can convert to points");
    }

    if (exitReason == null && points != null) {
      if (rules.tp != null && points === rules.tp) exitReason = "TP";
      else if (rules.sl != null && points === -rules.sl) exitReason = "SL";
      else if (points === 0) exitReason = "BE";
      else exitReason = "MANUAL";
    }

    let contracts = strategy.contracts;
    if (col.contracts >= 0 && cell(r, col.contracts) !== "") {
      const n = Number(cell(r, col.contracts));
      if (Number.isFinite(n) && n >= 1) contracts = Math.round(n);
      else problems.push(`invalid contracts "${cell(r, col.contracts)}"`);
    }

    let fees = Math.round(strategy.feePerContract * contracts * 100) / 100;
    if (col.fees >= 0 && cell(r, col.fees) !== "") {
      const n = Number(cell(r, col.fees).replace(/[$,]/g, ""));
      if (Number.isFinite(n) && n >= 0) fees = n;
      else problems.push(`invalid fees "${cell(r, col.fees)}"`);
    }

    if (problems.length) {
      errors.push(`Row ${line}: ${problems.join(", ")}.`);
      return;
    }

    rows.push({
      side: side!,
      entryTime: wallClockToUtcIso(`${datePart}T${timePart}`, timeZone),
      hasEntryTime,
      contracts,
      points: points!,
      fees,
      exitReason: exitReason!,
      beOutcome: exitReason === "BE" ? parseBeOutcome(cell(r, col.beOutcome)) : null,
      notes: cell(r, col.notes) || null,
    });
  });

  return { rows, errors };
}
