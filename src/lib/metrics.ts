import type { Account, Trade } from "@/db/schema";
import { zonedDayKey } from "@/lib/timezone";

export type EquityPoint = { date: string; balance: number };

export function netPnl(trade: Trade): number {
  return trade.pnl - trade.fees;
}

/** A trade counts as a scratch if explicitly marked breakeven, or its net happens to land on exactly zero. */
export function isScratchTrade(trade: Trade): boolean {
  return trade.isBreakeven || netPnl(trade) === 0;
}

function sortedByExit(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()
  );
}

function baseBalance(account: Account): number {
  return account.startingBalance + (account.balanceAdjustment ?? 0);
}

export function computeBalance(account: Account, trades: Trade[]): number {
  const total = trades.reduce((sum, t) => sum + netPnl(t), 0);
  return baseBalance(account) + total;
}

export function computeEquitySeries(
  account: Account,
  trades: Trade[]
): EquityPoint[] {
  const sorted = sortedByExit(trades);
  const start = baseBalance(account);
  const points: EquityPoint[] = [{ date: "start", balance: start }];
  let running = start;
  for (const t of sorted) {
    running += netPnl(t);
    points.push({ date: t.exitTime, balance: running });
  }
  return points;
}

export function computeCombinedEquitySeries(
  accounts: Account[],
  trades: Trade[]
): EquityPoint[] {
  const startingTotal = accounts.reduce((s, a) => s + baseBalance(a), 0);
  const sorted = sortedByExit(trades);
  const points: EquityPoint[] = [{ date: "start", balance: startingTotal }];
  let running = startingTotal;
  for (const t of sorted) {
    running += netPnl(t);
    points.push({ date: t.exitTime, balance: running });
  }
  return points;
}

export type DrawdownInfo = {
  enabled: boolean;
  highWaterMark: number;
  threshold: number;
  distanceToBreach: number;
  currentBalance: number;
  isLocked: boolean;
  breached: boolean;
};

export function computeTrailingDrawdown(
  account: Account,
  trades: Trade[]
): DrawdownInfo {
  const currentBalance = computeBalance(account, trades);

  if (!account.trailingDrawdown || account.trailingDrawdown <= 0) {
    return {
      enabled: false,
      highWaterMark: currentBalance,
      threshold: 0,
      distanceToBreach: 0,
      currentBalance,
      isLocked: false,
      breached: false,
    };
  }

  const series = computeEquitySeries(account, trades);
  const highWaterMark = Math.max(
    account.highestBalance ?? -Infinity,
    ...series.map((p) => p.balance)
  );
  const lockAt = account.drawdownStopsAt ?? account.startingBalance;

  const rawThreshold = highWaterMark - account.trailingDrawdown;
  const threshold = Math.min(rawThreshold, lockAt);
  const isLocked = rawThreshold >= lockAt;
  const distanceToBreach = currentBalance - threshold;

  return {
    enabled: true,
    highWaterMark,
    threshold,
    distanceToBreach,
    currentBalance,
    isLocked,
    breached: distanceToBreach <= 0,
  };
}

export type TargetInfo = {
  enabled: boolean;
  target: number;
  gained: number;
  progressPct: number;
  remaining: number;
  reached: boolean;
};

export function computeTargetProgress(
  account: Account,
  trades: Trade[]
): TargetInfo {
  const currentBalance = computeBalance(account, trades);
  const gained = currentBalance - account.startingBalance;

  if (!account.targetProfit || account.targetProfit <= 0) {
    return {
      enabled: false,
      target: 0,
      gained,
      progressPct: 0,
      remaining: 0,
      reached: false,
    };
  }

  const progressPct = Math.max(0, (gained / account.targetProfit) * 100);
  return {
    enabled: true,
    target: account.targetProfit,
    gained,
    progressPct,
    remaining: Math.max(0, account.targetProfit - gained),
    reached: gained >= account.targetProfit,
  };
}

export type TradeStats = {
  totalTrades: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  totalPnl: number;
  totalFees: number;
  netPnl: number;
  grossWinAmount: number;
  grossLossAmount: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  bestDay: { date: string; pnl: number } | null;
  worstDay: { date: string; pnl: number } | null;
  currentStreak: number;
  maxWinStreak: number;
  maxLossStreak: number;
  avgContractsPerTrade: number;
};

/** Which calendar day a trade falls on, in the app's configured timezone. */
export function dayKey(iso: string, timeZone: string): string {
  return zonedDayKey(iso, timeZone);
}

export function groupTradesByDay(trades: Trade[], timeZone: string): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = dayKey(t.exitTime, timeZone);
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return map;
}

export type StreakInfo = {
  /** Signed: positive = trailing run of wins, negative = trailing run of losses. */
  current: number;
  maxWin: number;
  maxLoss: number;
};

function streaksFrom(values: number[]): StreakInfo {
  let maxWin = 0;
  let maxLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  for (const n of values) {
    if (n > 0) {
      runWin += 1;
      runLoss = 0;
      maxWin = Math.max(maxWin, runWin);
    } else if (n < 0) {
      runLoss += 1;
      runWin = 0;
      maxLoss = Math.max(maxLoss, runLoss);
    } else {
      runWin = 0;
      runLoss = 0;
    }
  }

  let current = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const n = values[i];
    if (n > 0 && current >= 0) current++;
    else if (n < 0 && current <= 0) current--;
    else break;
  }

  return { current, maxWin, maxLoss };
}

/** Streaks measured in trading days rather than individual trades. */
export function computeDayStreaks(trades: Trade[], timeZone: string): StreakInfo {
  const dayPnls = [...groupTradesByDay(trades, timeZone).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, dayTrades]) => dayTrades.reduce((s, t) => s + netPnl(t), 0));
  return streaksFrom(dayPnls);
}

export function computeTradeStats(trades: Trade[], timeZone: string): TradeStats {
  const sorted = sortedByExit(trades);
  const nets = sorted.map(netPnl);
  const scratchFlags = sorted.map(isScratchTrade);

  const wins = nets.filter((n, i) => !scratchFlags[i] && n > 0);
  const losses = nets.filter((n, i) => !scratchFlags[i] && n < 0);
  const scratches = nets.filter((n, i) => scratchFlags[i]);

  const grossWinAmount = wins.reduce((s, n) => s + n, 0);
  const grossLossAmount = Math.abs(losses.reduce((s, n) => s + n, 0));
  const totalFees = sorted.reduce((s, t) => s + t.fees, 0);
  const totalPnl = sorted.reduce((s, t) => s + t.pnl, 0);
  const net = totalPnl - totalFees;

  const winRate = sorted.length > 0 ? (wins.length / sorted.length) * 100 : 0;
  const avgWin = wins.length > 0 ? grossWinAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLossAmount / losses.length : 0;
  const profitFactor =
    grossLossAmount > 0 ? grossWinAmount / grossLossAmount : null;
  const expectancy = sorted.length > 0 ? net / sorted.length : 0;

  const byDay = groupTradesByDay(sorted, timeZone);
  let bestDay: { date: string; pnl: number } | null = null;
  let worstDay: { date: string; pnl: number } | null = null;
  for (const [date, dayTrades] of byDay) {
    const pnl = dayTrades.reduce((s, t) => s + netPnl(t), 0);
    if (!bestDay || pnl > bestDay.pnl) bestDay = { date, pnl };
    if (!worstDay || pnl < worstDay.pnl) worstDay = { date, pnl };
  }

  const streakValues = nets.map((n, i) => (scratchFlags[i] ? 0 : n));
  const tradeStreaks = streaksFrom(streakValues);

  const avgContractsPerTrade =
    sorted.length > 0
      ? sorted.reduce((s, t) => s + t.contracts, 0) / sorted.length
      : 0;

  return {
    totalTrades: sorted.length,
    wins: wins.length,
    losses: losses.length,
    scratches: scratches.length,
    winRate,
    totalPnl,
    totalFees,
    netPnl: net,
    grossWinAmount,
    grossLossAmount,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    bestTrade: nets.length ? Math.max(...nets) : 0,
    worstTrade: nets.length ? Math.min(...nets) : 0,
    bestDay,
    worstDay,
    currentStreak: tradeStreaks.current,
    maxWinStreak: tradeStreaks.maxWin,
    maxLossStreak: tradeStreaks.maxLoss,
    avgContractsPerTrade,
  };
}

export function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

