import type { BacktestTrade, Strategy } from "@/db/schema";
import { zonedDayKey } from "@/lib/timezone";

export type StrategyRules = {
  mode: "points" | "rr";
  /** Take-profit size in points; derived from risk x RR when the strategy is RR based. */
  tp: number | null;
  /** Stop (risk) size in points. */
  sl: number | null;
  /** Reward-to-risk multiple, given directly or worked out from TP / SL. */
  rr: number | null;
};

/** One place that answers "what are this strategy's exit rules", for either way of defining them. */
export function strategyRules(s: Pick<Strategy, "tpPoints" | "slPoints" | "rr">): StrategyRules {
  const sl = s.slPoints ?? null;
  if (s.rr != null) {
    return { mode: "rr", tp: sl != null ? s.rr * sl : null, sl, rr: s.rr };
  }
  const tp = s.tpPoints ?? null;
  return { mode: "points", tp, sl, rr: tp != null && sl != null && sl > 0 ? tp / sl : null };
}

export function backtestGross(t: BacktestTrade, s: Strategy): number {
  return t.points * s.pointValue * t.contracts;
}

export function backtestNet(t: BacktestTrade, s: Strategy): number {
  return backtestGross(t, s) - t.fees;
}

/** Default round-trip fees for a trade of this size under the strategy's fee setting. */
export function defaultFees(s: Pick<Strategy, "feePerContract">, contracts: number): number {
  return Math.round(s.feePerContract * contracts * 100) / 100;
}

export type Outcome = "WIN" | "LOSS" | "SCRATCH";

export function outcomeOf(t: BacktestTrade, s: Strategy): Outcome {
  if (t.points === 0) return "SCRATCH";
  const net = backtestNet(t, s);
  if (net > 0) return "WIN";
  if (net < 0) return "LOSS";
  return "SCRATCH";
}

export type Bucket = {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  net: number;
  avg: number;
};

export type DayRow = { date: string; trades: number; net: number; overCap: boolean };

export type BacktestAnalysis = {
  totalTrades: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  totalFees: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  /** Fees paid on breakeven trades. */
  scratchFees: number;
  /** The global "count breakeven trades" setting this analysis was computed with. */
  countBreakeven: boolean;
  /** Breakeven trades left out of trade-quality stats (0 when breakevens are counted). */
  excludedScratches: number;
  /**
   * How the breakeven-exit trades were tagged ("ultimately a win or loss"). Analytics only: it never
   * changes P&L or any other metric. The two win rates are null until at least one is tagged.
   */
  beOutcomes: {
    total: number;
    win: number;
    loss: number;
    undecided: number;
    /** Wins / (wins + losses), ignoring breakevens. */
    decidedWinRate: number | null;
    /** Same, but tagged breakevens count as the win or loss they ended up as. Undecided ones stay out. */
    resolvedWinRate: number | null;
  };
  payoffRatio: number | null;
  expectancy: number;
  expectancyPoints: number;
  expectancyR: number | null;
  avgWinPoints: number;
  avgLossPoints: number;
  largestWin: number;
  largestLoss: number;
  maxWinStreak: number;
  maxLossStreak: number;
  maxDrawdown: number;
  maxDrawdownPct: number | null;
  maxDrawdownTrades: number;
  recoveryFactor: number | null;
  tradingDays: number;
  avgTradesPerDay: number;
  maxTradesInADay: number;
  winningDays: number;
  losingDays: number;
  bestDay: DayRow | null;
  worstDay: DayRow | null;
  /** Every run of 2 or more losses in a row (a win or breakeven ends the run), longest first. */
  lossStreaks: StreakRun[];
  breakevenWinRate: number | null;
  firstTrade: string | null;
  lastTrade: string | null;
  equity: { index: number; date: string; equity: number; drawdown: number }[];
  days: DayRow[];
  bySide: Bucket[];
  byExit: Bucket[];
  byWeekday: Bucket[];
  byHour: Bucket[];
  byMonth: Bucket[];
  distribution: { label: string; from: number; to: number; count: number }[];
  /** Trades logged without a time of day; they are left out of the by-hour breakdown. */
  tradesWithoutTime: number;
  cap: {
    max: number;
    daysOver: number;
    tradesOver: number;
    netWithCap: number;
    netDelta: number;
  } | null;
};

/** "YYYY-MM-DD" -> "05-Jun-2026", used everywhere a streak's date range is shown. */
export function formatStreakDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day}-${month}-${d.getUTCFullYear()}`;
}

export type StreakRun = {
  length: number;
  /** First trading day of the run, "YYYY-MM-DD" in the app timezone. */
  startDate: string;
  /** Last trading day of the run. */
  endDate: string;
  /** How many distinct calendar days the run touched (2+ means it crossed at least one day boundary). */
  days: number;
  /** Net P&L across the run's trades. */
  net: number;
};

/**
 * Every maximal run of 2+ consecutive losses, in the given row order (a win or breakeven ends a
 * run — the same rule `streaks()` uses for `maxLossStreak`, so the two stay consistent). A run can
 * span multiple calendar days when nothing broke the streak in between.
 */
function losingStreakRuns(rows: Row[]): StreakRun[] {
  const runs: StreakRun[] = [];
  let cur: Row[] = [];
  const flush = () => {
    if (cur.length >= 2) {
      runs.push({
        length: cur.length,
        startDate: cur[0].day,
        endDate: cur[cur.length - 1].day,
        days: new Set(cur.map((r) => r.day)).size,
        net: cur.reduce((s, r) => s + r.net, 0),
      });
    }
    cur = [];
  };
  for (const r of rows) {
    if (r.outcome === "LOSS") cur.push(r);
    else flush();
  }
  flush();
  return runs.sort((a, b) => b.length - a.length || b.endDate.localeCompare(a.endDate));
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

function weekdayAndHour(iso: string, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(new Date(iso));
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { weekday, hour: hour % 24 };
}

function makeBucket(key: string, label: string, nets: number[], outcomes: Outcome[]): Bucket {
  const trades = nets.length;
  const wins = outcomes.filter((o) => o === "WIN").length;
  const losses = outcomes.filter((o) => o === "LOSS").length;
  const net = nets.reduce((s, n) => s + n, 0);
  return {
    key,
    label,
    trades,
    wins,
    losses,
    winRate: trades ? (wins / trades) * 100 : 0,
    net,
    avg: trades ? net / trades : 0,
  };
}

type Row = {
  t: BacktestTrade;
  net: number;
  outcome: Outcome;
  day: string;
};

function groupBuckets(
  rows: Row[],
  keyOf: (r: Row) => { key: string; label: string; order: number } | null
): Bucket[] {
  const groups = new Map<string, { label: string; order: number; rows: Row[] }>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    const g = groups.get(k.key) ?? { label: k.label, order: k.order, rows: [] };
    g.rows.push(r);
    groups.set(k.key, g);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) =>
      makeBucket(
        key,
        g.label,
        g.rows.map((r) => r.net),
        g.rows.map((r) => r.outcome)
      )
    );
}

function streaks(outcomes: Outcome[]) {
  let maxWin = 0;
  let maxLoss = 0;
  let w = 0;
  let l = 0;
  for (const o of outcomes) {
    if (o === "WIN") {
      w++;
      l = 0;
      maxWin = Math.max(maxWin, w);
    } else if (o === "LOSS") {
      l++;
      w = 0;
      maxLoss = Math.max(maxLoss, l);
    } else {
      w = 0;
      l = 0;
    }
  }
  return { maxWin, maxLoss };
}

function histogram(nets: number[], binCount = 12) {
  if (nets.length === 0) return [];
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  if (min === max) {
    return [{ label: fmtCompact(min), from: min, to: max, count: nets.length }];
  }
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const n of nets) {
    const idx = Math.min(binCount - 1, Math.floor((n - min) / width));
    bins[idx].count++;
  }
  return bins.map((b) => ({
    ...b,
    label: fmtCompact((b.from + b.to) / 2),
  }));
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * `countBreakeven` mirrors the global Settings toggle. When true, breakeven trades are scratches
 * inside the trade totals. When false they are left out of every trade-quality stat (total trades
 * becomes wins + losses, win rate is wins / (wins + losses), profit factor, expectancy, streaks
 * and the breakdowns). Dollar results always use every trade: net P&L, fees, equity curve,
 * drawdown, daily results and the daily trade limit.
 */
export function analyzeBacktest(
  strategy: Strategy,
  trades: BacktestTrade[],
  timeZone: string,
  countBreakeven = true
): BacktestAnalysis {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
  );

  const allRows: Row[] = sorted.map((t) => ({
    t,
    net: backtestNet(t, strategy),
    outcome: outcomeOf(t, strategy),
    day: zonedDayKey(t.entryTime, timeZone),
  }));
  // The rows behind trade-quality stats; equals allRows unless breakevens are excluded.
  const rows = countBreakeven ? allRows : allRows.filter((r) => r.outcome !== "SCRATCH");

  const winsR = rows.filter((r) => r.outcome === "WIN");
  const lossesR = rows.filter((r) => r.outcome === "LOSS");
  const scratchRows = allRows.filter((r) => r.outcome === "SCRATCH");
  const scratches = scratchRows.length;
  // Fees paid on breakeven trades are a real cost. When breakevens count, they join gross loss so
  // gross profit minus gross loss equals net P&L; when excluded they stay out of profit factor.
  const scratchFeeDrag = Math.abs(scratchRows.reduce((s, r) => s + Math.min(0, r.net), 0));
  const feeDragInPf = countBreakeven ? scratchFeeDrag : 0;

  const beRows = allRows.filter((r) => r.t.exitReason === "BE");
  const beWin = beRows.filter((r) => r.t.beOutcome === "WIN").length;
  const beLoss = beRows.filter((r) => r.t.beOutcome === "LOSS").length;
  const decided = winsR.length + lossesR.length;
  const beOutcomes = {
    total: beRows.length,
    win: beWin,
    loss: beLoss,
    undecided: beRows.length - beWin - beLoss,
    decidedWinRate: beWin + beLoss > 0 && decided > 0 ? (winsR.length / decided) * 100 : null,
    resolvedWinRate:
      beWin + beLoss > 0 && decided + beWin + beLoss > 0
        ? ((winsR.length + beWin) / (decided + beWin + beLoss)) * 100
        : null,
  };

  const grossProfit = winsR.reduce((s, r) => s + r.net, 0);
  const lossesAbs = Math.abs(lossesR.reduce((s, r) => s + r.net, 0));
  const grossLoss = lossesAbs + feeDragInPf;
  const totalFees = allRows.reduce((s, r) => s + r.t.fees, 0);
  const netPnl = allRows.reduce((s, r) => s + r.net, 0);
  const metricNet = rows.reduce((s, r) => s + r.net, 0);
  const total = rows.length;

  const avgWin = winsR.length ? grossProfit / winsR.length : 0;
  const avgLoss = lossesR.length ? lossesAbs / lossesR.length : 0;
  const avgWinPoints = winsR.length ? winsR.reduce((s, r) => s + r.t.points, 0) / winsR.length : 0;
  const avgLossPoints = lossesR.length
    ? Math.abs(lossesR.reduce((s, r) => s + r.t.points, 0)) / lossesR.length
    : 0;

  const expectancyPoints = total ? rows.reduce((s, r) => s + r.t.points, 0) / total : 0;
  const rules = strategyRules(strategy);
  const expectancyR = rules.sl && rules.sl > 0 && total ? expectancyPoints / rules.sl : null;

  // Equity curve and drawdown, measured trade by trade.
  const base = strategy.startingCapital;
  let running = base;
  let peak = base;
  let maxDrawdown = 0;
  let maxDrawdownPct: number | null = null;
  let ddStart = 0;
  let maxDdTrades = 0;
  const equity: BacktestAnalysis["equity"] = [{ index: 0, date: "start", equity: base, drawdown: 0 }];
  allRows.forEach((r, i) => {
    running += r.net;
    if (running > peak) {
      peak = running;
      ddStart = i + 1;
    }
    const dd = running - peak;
    if (-dd > maxDrawdown) {
      maxDrawdown = -dd;
      maxDrawdownPct = base > 0 && peak > 0 ? (maxDrawdown / peak) * 100 : null;
    }
    maxDdTrades = Math.max(maxDdTrades, i + 1 - ddStart);
    equity.push({ index: i + 1, date: r.t.entryTime, equity: running, drawdown: dd });
  });

  // Per-day rollup, flagging days that broke the max-trades-per-day rule.
  const dayMap = new Map<string, Row[]>();
  for (const r of allRows) {
    const arr = dayMap.get(r.day) ?? [];
    arr.push(r);
    dayMap.set(r.day, arr);
  }
  const cap = strategy.maxTradesPerDay && strategy.maxTradesPerDay > 0 ? strategy.maxTradesPerDay : null;
  const days: DayRow[] = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dr]) => ({
      date,
      trades: dr.length,
      net: dr.reduce((s, r) => s + r.net, 0),
      overCap: cap != null && dr.length > cap,
    }));

  let capInfo: BacktestAnalysis["cap"] = null;
  if (cap != null) {
    let netWithCap = 0;
    let tradesOver = 0;
    let daysOver = 0;
    for (const [, dr] of dayMap) {
      const kept = dr.slice(0, cap);
      netWithCap += kept.reduce((s, r) => s + r.net, 0);
      if (dr.length > cap) {
        daysOver++;
        tradesOver += dr.length - cap;
      }
    }
    capInfo = { max: cap, daysOver, tradesOver, netWithCap, netDelta: netWithCap - netPnl };
  }

  const bestDay = days.length ? days.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const worstDay = days.length ? days.reduce((a, b) => (b.net < a.net ? b : a)) : null;

  const st = streaks(rows.map((r) => r.outcome));
  const lossStreaks = losingStreakRuns(rows);

  const breakevenWinRate = rules.rr != null && rules.rr > 0 ? (1 / (1 + rules.rr)) * 100 : null;

  const weekdayOrder = (label: string) => {
    const i = WEEKDAYS.indexOf(label);
    return i < 0 ? 99 : i;
  };

  const monthKey = (r: Row) => r.day.slice(0, 7);

  return {
    totalTrades: total,
    wins: winsR.length,
    losses: lossesR.length,
    scratches,
    winRate: total ? (winsR.length / total) * 100 : 0,
    netPnl,
    grossProfit,
    grossLoss,
    totalFees,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWin,
    avgLoss,
    scratchFees: scratchFeeDrag,
    countBreakeven,
    excludedScratches: countBreakeven ? 0 : scratches,
    beOutcomes: beOutcomes,
    payoffRatio: avgLoss > 0 ? avgWin / avgLoss : null,
    expectancy: total ? metricNet / total : 0,
    expectancyPoints,
    expectancyR,
    avgWinPoints,
    avgLossPoints,
    largestWin: rows.length ? Math.max(0, ...rows.map((r) => r.net)) : 0,
    largestLoss: rows.length ? Math.min(0, ...rows.map((r) => r.net)) : 0,
    maxWinStreak: st.maxWin,
    maxLossStreak: st.maxLoss,
    maxDrawdown,
    maxDrawdownPct,
    maxDrawdownTrades: maxDdTrades,
    recoveryFactor: maxDrawdown > 0 ? netPnl / maxDrawdown : null,
    tradingDays: days.length,
    avgTradesPerDay: days.length ? total / days.length : 0,
    maxTradesInADay: days.reduce((m, d) => Math.max(m, d.trades), 0),
    winningDays: days.filter((d) => d.net > 0).length,
    losingDays: days.filter((d) => d.net < 0).length,
    bestDay,
    worstDay,
    lossStreaks,
    breakevenWinRate,
    firstTrade: allRows[0]?.t.entryTime ?? null,
    lastTrade: allRows[allRows.length - 1]?.t.entryTime ?? null,
    equity,
    days,
    bySide: groupBuckets(rows, (r) => ({
      key: r.t.side,
      label: r.t.side === "LONG" ? "Long" : "Short",
      order: r.t.side === "LONG" ? 0 : 1,
    })),
    byExit: groupBuckets(rows, (r) => {
      const reason = r.t.exitReason;
      const info = {
        TP: { label: "Take profit", order: 0 },
        SL: { label: "Stop loss", order: 1 },
        BE: { label: "Breakeven", order: 2 },
        MANUAL: { label: "Custom points", order: 3 },
      }[reason];
      return { key: reason, ...info };
    }),
    byWeekday: groupBuckets(rows, (r) => {
      const { weekday } = weekdayAndHour(r.t.entryTime, timeZone);
      return { key: weekday, label: weekday, order: weekdayOrder(weekday) };
    }),
    byHour: groupBuckets(rows, (r) => {
      if (!r.t.hasEntryTime) return null;
      const { hour } = weekdayAndHour(r.t.entryTime, timeZone);
      return {
        key: String(hour),
        label: `${String(hour).padStart(2, "0")}:00`,
        order: hour,
      };
    }),
    byMonth: groupBuckets(rows, (r) => {
      const k = monthKey(r);
      return { key: k, label: k, order: Number(k.replace("-", "")) };
    }),
    distribution: histogram(rows.map((r) => r.net)),
    tradesWithoutTime: rows.filter((r) => !r.t.hasEntryTime).length,
    cap: capInfo,
  };
}

export type Insight = { tone: "good" | "bad" | "warn" | "info"; text: string };

function money(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${abs}`;
}

/** Plain-language read of the numbers. Every line is derived only from logged data. */
export function buildInsights(a: BacktestAnalysis, strategy: Strategy): Insight[] {
  const out: Insight[] = [];
  if (a.totalTrades === 0) return out;

  if (a.totalTrades < 30) {
    out.push({
      tone: "warn",
      text: `Only ${a.totalTrades} trade${a.totalTrades === 1 ? "" : "s"} logged. Results this small are mostly noise; aim for 100 or more before trusting any of these numbers.`,
    });
  } else if (a.totalTrades < 100) {
    out.push({
      tone: "info",
      text: `${a.totalTrades} trades is a reasonable start, but 100 or more gives much more reliable statistics.`,
    });
  }

  if (a.expectancy > 0) {
    out.push({
      tone: "good",
      text: `Positive expectancy: each trade averages ${money(a.expectancy)} after fees${
        a.expectancyR != null ? ` (${a.expectancyR.toFixed(2)}R)` : ""
      }.`,
    });
  } else if (a.expectancy < 0) {
    out.push({
      tone: "bad",
      text: `Negative expectancy: each trade loses ${money(Math.abs(a.expectancy))} on average after fees. As logged, this strategy loses money over time.`,
    });
  }

  if (a.profitFactor != null) {
    if (a.profitFactor < 1) {
      out.push({ tone: "bad", text: `Profit factor is ${a.profitFactor.toFixed(2)}. Losses outweigh wins.` });
    } else if (a.profitFactor >= 1.5) {
      out.push({ tone: "good", text: `Profit factor is ${a.profitFactor.toFixed(2)}, a healthy margin between wins and losses.` });
    }
  }

  if (a.breakevenWinRate != null && a.totalTrades >= 10) {
    const diff = a.winRate - a.breakevenWinRate;
    out.push({
      tone: diff >= 0 ? "good" : "bad",
      text: `With your TP and SL, you need a ${a.breakevenWinRate.toFixed(1)}% win rate to break even before fees. You achieved ${a.winRate.toFixed(1)}%, ${Math.abs(diff).toFixed(1)} points ${diff >= 0 ? "above" : "below"} that line.`,
    });
  }

  if (a.scratches > 0 && a.scratchFees > 0) {
    out.push({
      tone: "info",
      text: a.countBreakeven
        ? `${a.scratches} breakeven trade${a.scratches === 1 ? "" : "s"} cost ${money(a.scratchFees)} in fees without moving price. They are counted in net P&L and in the gross loss behind the profit factor.`
        : `${a.scratches} breakeven trade${a.scratches === 1 ? "" : "s"} cost ${money(a.scratchFees)} in fees without moving price. Per your settings they are left out of win rate and profit factor, but they still reduce net P&L.`,
    });
  }

  if (a.grossProfit > 0 && a.totalFees / a.grossProfit >= 0.2) {
    out.push({
      tone: "warn",
      text: `Fees are ${((a.totalFees / a.grossProfit) * 100).toFixed(0)}% of gross profit (${money(a.totalFees)}). Costs are eating a large share of the edge.`,
    });
  }

  const rules = strategyRules(strategy);
  if (rules.tp != null && a.wins >= 5 && a.avgWinPoints < rules.tp * 0.85) {
    out.push({
      tone: "warn",
      text: `Winners average ${a.avgWinPoints.toFixed(1)} points against a ${rules.tp}-point target. Many trades are being closed before the target.`,
    });
  }
  if (rules.sl != null && a.losses >= 5 && a.avgLossPoints > rules.sl * 1.15) {
    out.push({
      tone: "bad",
      text: `Losers average ${a.avgLossPoints.toFixed(1)} points against a ${rules.sl}-point ${rules.mode === "rr" ? "risk" : "stop"}. Stops are being exceeded (slippage or moved stops).`,
    });
  }

  if (a.maxDrawdown > 0 && a.netPnl > 0) {
    out.push({
      tone: a.recoveryFactor != null && a.recoveryFactor >= 3 ? "good" : "info",
      text: `Worst drawdown was ${money(a.maxDrawdown)}${
        a.maxDrawdownPct != null ? ` (${a.maxDrawdownPct.toFixed(1)}% of peak equity)` : ""
      }, against ${money(a.netPnl)} of net profit${a.recoveryFactor != null ? ` (recovery factor ${a.recoveryFactor.toFixed(1)})` : ""}.`,
    });
  } else if (a.maxDrawdown > 0) {
    out.push({ tone: "info", text: `Worst drawdown was ${money(a.maxDrawdown)}.` });
  }

  const longestLossStreak = a.lossStreaks[0] ?? null;
  if (a.maxLossStreak >= 5) {
    const spanText =
      longestLossStreak && longestLossStreak.days > 1
        ? ` (${formatStreakDate(longestLossStreak.startDate)} to ${formatStreakDate(longestLossStreak.endDate)}, ${longestLossStreak.days} days)`
        : "";
    out.push({
      tone: "info",
      text: `The longest losing streak was ${a.maxLossStreak} trades in a row${spanText}. Make sure you could actually keep trading through that.`,
    });
  } else if (longestLossStreak && longestLossStreak.days > 1) {
    out.push({
      tone: "info",
      text: `The longest losing streak, ${longestLossStreak.length} trades, ran from ${formatStreakDate(longestLossStreak.startDate)} to ${formatStreakDate(longestLossStreak.endDate)} across ${longestLossStreak.days} days.`,
    });
  }

  const enough = (b: Bucket) => b.trades >= 5;
  const wd = a.byWeekday.filter(enough);
  if (wd.length >= 3) {
    const best = wd.reduce((x, y) => (y.net > x.net ? y : x));
    const worst = wd.reduce((x, y) => (y.net < x.net ? y : x));
    if (best.key !== worst.key && worst.net < 0) {
      out.push({
        tone: "info",
        text: `${best.label} is the strongest day (${money(best.net)}) and ${worst.label} the weakest (${money(worst.net)}).`,
      });
    }
  }
  const hr = a.byHour.filter(enough);
  if (hr.length >= 3) {
    const best = hr.reduce((x, y) => (y.net > x.net ? y : x));
    const worst = hr.reduce((x, y) => (y.net < x.net ? y : x));
    if (best.key !== worst.key && worst.net < 0) {
      out.push({
        tone: "info",
        text: `The ${best.label} hour performs best (${money(best.net)}); the ${worst.label} hour performs worst (${money(worst.net)}).`,
      });
    }
  }

  const long = a.bySide.find((b) => b.key === "LONG");
  const short = a.bySide.find((b) => b.key === "SHORT");
  if (long && short && long.trades >= 10 && short.trades >= 10 && Math.abs(long.winRate - short.winRate) >= 10) {
    const better = long.winRate > short.winRate ? long : short;
    const worse = better === long ? short : long;
    out.push({
      tone: "info",
      text: `${better.label} trades win ${better.winRate.toFixed(0)}% of the time versus ${worse.winRate.toFixed(0)}% for ${worse.label.toLowerCase()} trades.`,
    });
  }

  if (a.cap && a.cap.daysOver > 0) {
    out.push({
      tone: "warn",
      text: `${a.cap.daysOver} day${a.cap.daysOver === 1 ? "" : "s"} broke your limit of ${a.cap.max} trades. Enforcing the limit would ${
        a.cap.netDelta >= 0 ? "have added" : "have cost"
      } ${money(Math.abs(a.cap.netDelta))}.`,
    });
  } else if (a.cap) {
    out.push({ tone: "good", text: `You stayed within the limit of ${a.cap.max} trades per day on every day.` });
  }

  return out;
}

export type TradeGroupStats = {
  count: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  net: number;
};

export type WeekGroup = TradeGroupStats & {
  /** Monday of the week, "YYYY-MM-DD"; unique within a month. */
  key: string;
  /** e.g. "Mar 2 – Mar 8", clipped to the month when a week straddles two months. */
  label: string;
  trades: BacktestTrade[];
};

export type MonthGroup = TradeGroupStats & {
  key: string;
  label: string;
  weeks: WeekGroup[];
};

function utcDate(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const longMonth = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

function statsFor(trades: BacktestTrade[], strategy: Strategy, countBreakeven: boolean): TradeGroupStats {
  let wins = 0;
  let losses = 0;
  let net = 0;
  for (const t of trades) {
    net += backtestNet(t, strategy);
    const o = outcomeOf(t, strategy);
    if (o === "WIN") wins++;
    else if (o === "LOSS") losses++;
  }
  const scratches = trades.length - wins - losses;
  // With breakevens excluded, the trade count is wins + losses. Net stays the real dollar result.
  const count = countBreakeven ? trades.length : wins + losses;
  return { count, wins, losses, scratches, winRate: count ? (wins / count) * 100 : 0, net };
}

/**
 * Groups trades into calendar months (newest first) and, inside each month, Monday-start weeks
 * (newest first), using each trade's day in the app timezone. A week that crosses a month boundary
 * is split so every month's weeks add up to exactly that month's total. Trades keep their given
 * order inside a week, so pass them newest-first.
 */
export function groupTradesByMonthWeek(
  trades: BacktestTrade[],
  strategy: Strategy,
  timeZone: string,
  countBreakeven = true
): MonthGroup[] {
  const months = new Map<string, Map<string, BacktestTrade[]>>();
  for (const t of trades) {
    const day = zonedDayKey(t.entryTime, timeZone);
    const monthKey = day.slice(0, 7);
    const date = utcDate(day);
    const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000);
    const weekKey = dayKeyOf(monday);
    const weeks = months.get(monthKey) ?? new Map<string, BacktestTrade[]>();
    const list = weeks.get(weekKey) ?? [];
    list.push(t);
    weeks.set(weekKey, list);
    months.set(monthKey, weeks);
  }

  return [...months.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, weekMap]) => {
      const monthStart = utcDate(`${monthKey}-01`);
      const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
      const weeks: WeekGroup[] = [...weekMap.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([weekKey, list]) => {
          const monday = utcDate(weekKey);
          const sunday = new Date(monday.getTime() + 6 * 86400000);
          const from = monday < monthStart ? monthStart : monday;
          const to = sunday > monthEnd ? monthEnd : sunday;
          const label =
            dayKeyOf(from) === dayKeyOf(to)
              ? shortDay.format(from)
              : `${shortDay.format(from)} – ${shortDay.format(to)}`;
          return { key: weekKey, label, trades: list, ...statsFor(list, strategy, countBreakeven) };
        });
      const all = weeks.flatMap((w) => w.trades);
      return { key: monthKey, label: longMonth.format(monthStart), weeks, ...statsFor(all, strategy, countBreakeven) };
    });
}

/**
 * A view-only "what if": the same backtested points re-priced with another symbol and/or a different
 * number of contracts. Nothing is saved. `null` means "leave as logged".
 */
export type Scenario = {
  symbol: string | null;
  pointValue: number | null;
  contracts: number | null;
};

export const NO_SCENARIO: Scenario = { symbol: null, pointValue: null, contracts: null };

export function isScenarioActive(sc: Scenario): boolean {
  return sc.symbol != null || sc.pointValue != null || sc.contracts != null;
}

/**
 * Points stay exactly as logged; only the dollar value per point (symbol) and the size change.
 * Fees scale with size using each trade's own per-contract fee, so custom and breakeven fees carry over.
 */
export function applyScenario(
  strategy: Strategy,
  trades: BacktestTrade[],
  sc: Scenario
): { strategy: Strategy; trades: BacktestTrade[] } {
  const viewStrategy: Strategy = {
    ...strategy,
    symbol: sc.symbol ?? strategy.symbol,
    pointValue: sc.pointValue ?? strategy.pointValue,
  };
  const n = sc.contracts;
  if (n == null || n < 1) return { strategy: viewStrategy, trades };
  const viewTrades = trades.map((t) => ({
    ...t,
    contracts: n,
    fees: t.contracts > 0 ? (t.fees * n) / t.contracts : t.fees,
  }));
  return { strategy: viewStrategy, trades: viewTrades };
}

export type SizeComparisonRow = {
  contracts: number;
  net: number;
  maxDrawdown: number;
  worstDay: number;
  fees: number;
  /** Dollars lost when a full stop is hit at this size; null when the strategy has no stop size. */
  riskPerTrade: number | null;
};

/** The same backtest priced at several contract sizes, for a side-by-side view of dollar risk and result. */
export function compareSizes(
  strategy: Strategy,
  trades: BacktestTrade[],
  sizes: number[],
  timeZone: string,
  countBreakeven: boolean
): SizeComparisonRow[] {
  const sl = strategyRules(strategy).sl;
  return sizes.map((contracts) => {
    const view = applyScenario(strategy, trades, { symbol: null, pointValue: null, contracts });
    const a = analyzeBacktest(view.strategy, view.trades, timeZone, countBreakeven);
    return {
      contracts,
      net: a.netPnl,
      maxDrawdown: a.maxDrawdown,
      worstDay: a.worstDay ? a.worstDay.net : 0,
      fees: a.totalFees,
      riskPerTrade: sl != null ? sl * strategy.pointValue * contracts : null,
    };
  });
}
