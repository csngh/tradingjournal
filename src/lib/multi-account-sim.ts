import type { BacktestTrade, Strategy } from "@/db/schema";
import { analyzeBacktest, backtestNet, type BacktestAnalysis } from "@/lib/backtest";

const GROUP_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function groupLabel(index: number): string {
  return GROUP_LABELS[index] ? `Group ${GROUP_LABELS[index]}` : `Group ${index + 1}`;
}

export type PayoutCycle = {
  /** 1-based cycle number within this stream. */
  cycle: number;
  /** 1-based index of the trade whose close triggered this cycle, matching `BacktestAnalysis.equity[].index`. */
  tradeIndex: number;
  /** Entry time of the trade whose close triggered this cycle. */
  date: string;
  /** Unwithdrawn profit at the instant it crossed the target (>= target; can overshoot on a big trade). */
  profitAtTrigger: number;
  /** Amount taken out of the account this cycle: always target minus buffer, regardless of split. */
  withdrawn: number;
  /** What's actually paid out: withdrawn times the profit split. */
  disbursed: number;
  /** What's left banked in the account right after this withdrawal (>= buffer; can exceed it on overshoot). */
  bufferAfter: number;
};

export type PayoutInfo = {
  /** Total actually disbursed over the life of the stream: sum of each cycle's `disbursed`. */
  totalPayout: number;
  /** Total taken out of the account over the life of the stream, before the profit split. */
  totalWithdrawn: number;
  /** How many times cumulative profit (since the last payout) reached the target. */
  cycles: number;
  /** Every individual withdrawal, in order, with the date and the buffer build-up/payout detail. */
  events: PayoutCycle[];
};

export type AccountGroup = {
  index: number;
  label: string;
  accounts: number;
  trades: BacktestTrade[];
  analysis: BacktestAnalysis;
  payout: PayoutInfo;
};

export type MultiAccountSimResult = {
  numGroups: number;
  accountsPerGroup: number;
  tradesPerRotation: number;
  totalAccounts: number;
  tradesUsed: number;
  payoutTarget: number | null;
  payoutBuffer: number | null;
  /** 0-100. Null means no split was configured, equivalent to 100 (the full amount is disbursed). */
  payoutSplit: number | null;
  /** The same trades, undivided, analyzed as a single account: the baseline every group is compared against. */
  fullAnalysis: BacktestAnalysis;
  fullPayout: PayoutInfo;
  groups: AccountGroup[];
};

/**
 * Models a profit-target withdrawal rule: every time cumulative profit since the last payout
 * reaches `target`, `target - buffer` is taken out of the account and `buffer` stays behind. No
 * payout happens until the account first reaches the target. Of what's taken out, only `split`
 * percent is actually disbursed (the rest is the firm's cut); the full amount still leaves the
 * account either way, so it's what determines when the next cycle triggers. A single large trade
 * can cross the target more than once, so each trade is checked in a loop. Invalid combinations
 * (no target, or a buffer that isn't strictly less than the target) pay out nothing.
 */
function computeMilestonePayout(
  trades: BacktestTrade[],
  strategy: Strategy,
  target: number | null,
  buffer: number | null,
  split: number | null
): PayoutInfo {
  if (target == null || target <= 0 || buffer == null || buffer < 0 || buffer >= target) {
    return { totalPayout: 0, totalWithdrawn: 0, cycles: 0, events: [] };
  }

  const splitFraction = split == null ? 1 : Math.max(0, Math.min(100, split)) / 100;
  const eligiblePerCycle = target - buffer;
  const disbursedPerCycle = eligiblePerCycle * splitFraction;
  let cum = 0;
  let baseline = 0;
  let totalPayout = 0;
  let totalWithdrawn = 0;
  const events: PayoutCycle[] = [];
  trades.forEach((t, i) => {
    cum += backtestNet(t, strategy);
    while (cum - baseline >= target) {
      const profitAtTrigger = cum - baseline;
      totalWithdrawn += eligiblePerCycle;
      totalPayout += disbursedPerCycle;
      baseline += eligiblePerCycle;
      events.push({
        cycle: events.length + 1,
        tradeIndex: i + 1,
        date: t.entryTime,
        profitAtTrigger,
        withdrawn: eligiblePerCycle,
        disbursed: disbursedPerCycle,
        bufferAfter: cum - baseline,
      });
    }
  });
  return { totalPayout, totalWithdrawn, cycles: events.length, events };
}

/**
 * Marks up the equity curve with each payout cycle's withdrawal, so the line actually dips when
 * money leaves the account (the sawtooth shape a real funded account sees), and tags the trade
 * where each withdrawal happened via the new `payout` field for the chart to mark. Uses the full
 * (pre-split) `withdrawn` amount, since that's what the account loses either way; the split only
 * decides who the firm sends it to. Drawdown and every other stat (max drawdown, recovery factor,
 * net P&L, win rate, etc.) are left exactly as `analyzeBacktest` computed them: a voluntary
 * withdrawal is not a loss, so it should never read as one. Returns the original analysis
 * unchanged when there are no payout cycles to apply.
 *
 * A withdrawal is applied starting from the trade *after* the one that triggered it, not that
 * trade itself, so the triggering trade's own point still shows the real, undiminished peak it
 * reached (the thing that was actually eligible for the payout) and the dip reads as the very
 * next step down from it, instead of the peak and the dip being silently collapsed into one point.
 */
export function applyPayoutsToAnalysis(analysis: BacktestAnalysis, payout: PayoutInfo): BacktestAnalysis {
  if (payout.events.length === 0) return analysis;

  const withdrawnByIndex = new Map<number, number>();
  for (const e of payout.events) {
    withdrawnByIndex.set(e.tradeIndex, (withdrawnByIndex.get(e.tradeIndex) ?? 0) + e.withdrawn);
  }

  let cumWithdrawn = 0;
  const equity: BacktestAnalysis["equity"] = analysis.equity.map((pt) => {
    const adjEquity = pt.equity - cumWithdrawn;
    const withdrawnHere = withdrawnByIndex.get(pt.index);
    cumWithdrawn += withdrawnHere ?? 0;
    return { ...pt, equity: adjEquity, payout: withdrawnHere };
  });

  return { ...analysis, equity };
}

/**
 * Splits a strategy's backtested trades round-robin across `numGroups` parent groups, in
 * chronological order and in blocks of `tradesPerRotation` trades at a time. So each group lives
 * through a thinned-out slice of the trade sequence instead of every trade. Every account inside
 * a group is an identical copy of that group, modeling the same strategy deployed to several
 * funded accounts that only take a share of the trades. Each stream runs through the normal
 * backtest analysis engine and the profit-target payout rule above.
 */
export function runMultiAccountSim(
  trades: BacktestTrade[],
  strategy: Strategy,
  timeZone: string,
  countBreakeven: boolean,
  breakevenContinuesStreak: boolean,
  numGroups: number,
  accountsPerGroup: number,
  tradesPerRotation = 1,
  payoutTarget: number | null = null,
  payoutBuffer: number | null = null,
  payoutSplit: number | null = null
): MultiAccountSimResult {
  const sorted = [...trades].sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());
  const rotation = Math.max(1, Math.round(tradesPerRotation) || 1);

  const buckets: BacktestTrade[][] = Array.from({ length: numGroups }, () => []);
  sorted.forEach((t, i) => {
    const groupIndex = Math.floor(i / rotation) % numGroups;
    buckets[groupIndex].push(t);
  });

  const groups: AccountGroup[] = buckets.map((groupTrades, index) => ({
    index,
    label: groupLabel(index),
    accounts: accountsPerGroup,
    trades: groupTrades,
    analysis: analyzeBacktest(strategy, groupTrades, timeZone, countBreakeven, breakevenContinuesStreak),
    payout: computeMilestonePayout(groupTrades, strategy, payoutTarget, payoutBuffer, payoutSplit),
  }));

  return {
    numGroups,
    accountsPerGroup,
    tradesPerRotation: rotation,
    totalAccounts: numGroups * accountsPerGroup,
    tradesUsed: sorted.length,
    payoutTarget: payoutTarget != null && payoutTarget > 0 ? payoutTarget : null,
    payoutBuffer: payoutBuffer != null && payoutBuffer >= 0 ? payoutBuffer : null,
    payoutSplit: payoutSplit != null && payoutSplit >= 0 && payoutSplit <= 100 ? payoutSplit : null,
    fullAnalysis: analyzeBacktest(strategy, sorted, timeZone, countBreakeven, breakevenContinuesStreak),
    fullPayout: computeMilestonePayout(sorted, strategy, payoutTarget, payoutBuffer, payoutSplit),
    groups,
  };
}
