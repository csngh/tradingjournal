import type { BacktestTrade, Strategy } from "@/db/schema";
import { backtestNet } from "@/lib/backtest";
import { zonedDayKey } from "@/lib/timezone";

export type DrawdownMode = "trailing" | "static";

/**
 * While the remaining drawdown (balance minus floor) is below `cushionBelow`, trades run on this
 * instrument instead of the strategy's own: same logged points, this point value, contracts and fee.
 * Only meaningful for an instrument that tracks the same underlying (e.g. NQ -> MNQ).
 */
export type SizeDownRule = {
  cushionBelow: number;
  symbol: string;
  pointValue: number;
  contracts: number;
  feePerContract: number;
};

export type EvalRules = {
  accountSize: number;
  profitTarget: number;
  maxDrawdown: number;
  drawdownMode: DrawdownMode;
  /** Trailing only: once the floor would rise past this level, it stops rising (the common "locks at breakeven" prop-firm rule). */
  lockEnabled: boolean;
  /** Trailing + lockEnabled only. `null` means lock at the starting account size. */
  lockAt: number | null;
  sizeDown: SizeDownRule | null;
};

export type EvalStep = {
  /** Index into the full chronological trade list this simulation was run against. */
  globalIndex: number;
  date: string;
  balance: number;
  floor: number;
  /** True when this trade ran on the size-down instrument. */
  sizedDown: boolean;
};

export type EvalCycle = {
  cycleNumber: number;
  outcome: "PASS" | "FAIL" | "IN_PROGRESS";
  startIndex: number;
  endIndex: number;
  trades: number;
  startDate: string;
  endDate: string;
  endBalance: number;
  netPnl: number;
  peakBalance: number;
  /** Deepest dollar drawdown reached from the cycle's own peak, regardless of outcome. */
  maxDrawdownSeen: number;
  /** Calendar days from the cycle's first trade to its last, including non-trading days. */
  daysToEnd: number;
  sizedDownTrades: number;
  steps: EvalStep[];
};

export type EvalSimResult = {
  rules: EvalRules;
  cycles: EvalCycle[];
  totalCycles: number;
  passes: number;
  fails: number;
  inProgress: number;
  /** Passes / (passes + fails) as a percentage; null when no cycle has resolved yet. */
  passRate: number | null;
  avgTradesToPass: number | null;
  avgTradesToFail: number | null;
  avgDaysToPass: number | null;
  avgDaysToFail: number | null;
  fastestPass: EvalCycle | null;
  slowestPass: EvalCycle | null;
  worstFail: EvalCycle | null;
  tradesUsed: number;
  sizedDownTrades: number;
};

/** Calendar days between two trades' dates in the app timezone, including non-trading days (e.g. same day = 0, next day = 1). */
function calendarDaysBetween(fromIso: string, toIso: string, timeZone: string): number {
  const toUtcMidnight = (iso: string) => {
    const [y, m, d] = zonedDayKey(iso, timeZone).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtcMidnight(toIso) - toUtcMidnight(fromIso)) / 86400000);
}

/** Mirrors `computeTrailingDrawdown`'s lock formula so a backtest eval and a live account agree on what "trailing, locked" means. */
function floorFor(rules: EvalRules, accountSize: number, peak: number): number {
  if (rules.drawdownMode === "static") {
    return accountSize - rules.maxDrawdown;
  }
  const rawThreshold = peak - rules.maxDrawdown;
  if (!rules.lockEnabled) return rawThreshold;
  const lockAt = rules.lockAt ?? accountSize;
  return Math.min(rawThreshold, lockAt);
}

/**
 * Simulates repeated funded-account evaluation cycles against a chronological run of backtest
 * trades: starting from `accountSize`, each cycle walks forward trade by trade until it either
 * reaches the profit target (PASS) or breaches the drawdown floor (FAIL), at which point the
 * account resets to `accountSize` and the next cycle starts on the very next trade. The last
 * cycle is marked IN_PROGRESS if the trades run out before it resolves either way.
 */
export function runEvalSimulation(
  trades: BacktestTrade[],
  strategy: Strategy,
  rules: EvalRules,
  timeZone: string
): EvalSimResult {
  const sorted = [...trades].sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());
  const target = rules.accountSize + rules.profitTarget;

  const cycles: EvalCycle[] = [];
  let i = 0;
  let cycleNumber = 1;

  while (i < sorted.length) {
    const startIndex = i;
    let balance = rules.accountSize;
    let peak = rules.accountSize;
    let maxDrawdownSeen = 0;
    let sizedDownTrades = 0;
    const steps: EvalStep[] = [];
    let outcome: EvalCycle["outcome"] = "IN_PROGRESS";
    let endIndex = startIndex;

    while (i < sorted.length) {
      const t = sorted[i];
      const sd = rules.sizeDown;
      // Decided before the trade from the state the previous trade left behind, so hitting the limit
      // mid-trade only affects the next one, and climbing back above it restores normal size.
      const sizedDown = sd != null && balance - floorFor(rules, rules.accountSize, peak) < sd.cushionBelow;
      balance += sd && sizedDown
        ? t.points * sd.pointValue * sd.contracts - sd.feePerContract * sd.contracts
        : backtestNet(t, strategy);
      if (sizedDown) sizedDownTrades++;
      if (balance > peak) peak = balance;
      const floor = floorFor(rules, rules.accountSize, peak);
      maxDrawdownSeen = Math.max(maxDrawdownSeen, peak - balance);
      steps.push({ globalIndex: i, date: t.entryTime, balance, floor, sizedDown });
      endIndex = i;
      i++;

      if (balance >= target) {
        outcome = "PASS";
        break;
      }
      if (balance <= floor) {
        outcome = "FAIL";
        break;
      }
    }

    const startDate = sorted[startIndex].entryTime;
    const endDate = sorted[endIndex].entryTime;
    cycles.push({
      cycleNumber,
      outcome,
      startIndex,
      endIndex,
      trades: endIndex - startIndex + 1,
      startDate,
      endDate,
      endBalance: balance,
      netPnl: balance - rules.accountSize,
      peakBalance: peak,
      maxDrawdownSeen,
      daysToEnd: calendarDaysBetween(startDate, endDate, timeZone),
      sizedDownTrades,
      steps,
    });
    cycleNumber++;
  }

  const passed = cycles.filter((c) => c.outcome === "PASS");
  const failed = cycles.filter((c) => c.outcome === "FAIL");
  const inProgress = cycles.filter((c) => c.outcome === "IN_PROGRESS");

  const avg = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null);

  const fastestPass = passed.length
    ? passed.reduce((a, b) => (b.trades < a.trades ? b : a))
    : null;
  const slowestPass = passed.length
    ? passed.reduce((a, b) => (b.trades > a.trades ? b : a))
    : null;
  const worstFail = failed.length
    ? failed.reduce((a, b) => (b.maxDrawdownSeen > a.maxDrawdownSeen ? b : a))
    : null;

  return {
    rules,
    cycles,
    totalCycles: cycles.length,
    passes: passed.length,
    fails: failed.length,
    inProgress: inProgress.length,
    passRate: passed.length + failed.length > 0 ? (passed.length / (passed.length + failed.length)) * 100 : null,
    avgTradesToPass: avg(passed.map((c) => c.trades)),
    avgTradesToFail: avg(failed.map((c) => c.trades)),
    avgDaysToPass: avg(passed.map((c) => c.daysToEnd)),
    avgDaysToFail: avg(failed.map((c) => c.daysToEnd)),
    fastestPass,
    slowestPass,
    worstFail,
    tradesUsed: sorted.length,
    sizedDownTrades: cycles.reduce((s, c) => s + c.sizedDownTrades, 0),
  };
}
