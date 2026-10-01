import { notFound } from "next/navigation";
import { BACKTEST_ENABLED } from "@/lib/features";
import { getAllBacktestTrades, getAllStrategies, getAppSettings } from "@/lib/data";
import { analyzeBacktest } from "@/lib/backtest";
import { BacktestClient, type StrategySummary } from "@/components/backtest-client";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  if (!BACKTEST_ENABLED) notFound();
  const [strategies, allTrades, settings] = await Promise.all([
    getAllStrategies(),
    getAllBacktestTrades(),
    getAppSettings(),
  ]);

  const items: StrategySummary[] = strategies.map((strategy) => {
    const trades = allTrades.filter((t) => t.strategyId === strategy.id);
    const a = analyzeBacktest(strategy, trades, settings.timezone, settings.countBreakeven);
    return {
      strategy,
      trades: a.totalTrades,
      winRate: a.winRate,
      netPnl: a.netPnl,
      profitFactor: a.profitFactor,
      maxDrawdown: a.maxDrawdown,
    };
  });

  return <BacktestClient items={items} />;
}
