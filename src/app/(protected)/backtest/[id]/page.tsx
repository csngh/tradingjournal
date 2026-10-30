import { notFound } from "next/navigation";
import { BACKTEST_ENABLED } from "@/lib/features";
import { getAppSettings, getBacktestTrades, getStrategy } from "@/lib/data";
import { analyzeBacktest } from "@/lib/backtest";
import { BacktestDetailClient } from "@/components/backtest-detail-client";

export const dynamic = "force-dynamic";

export default async function StrategyPage({ params }: PageProps<"/backtest/[id]">) {
  if (!BACKTEST_ENABLED) notFound();
  const { id } = await params;
  const strategy = await getStrategy(id);
  if (!strategy) notFound();

  const [trades, settings] = await Promise.all([getBacktestTrades(id), getAppSettings()]);
  const analysis = analyzeBacktest(
    strategy,
    trades,
    settings.timezone,
    settings.countBreakeven,
    settings.breakevenContinuesStreak
  );

  return (
    <BacktestDetailClient
      strategy={strategy}
      trades={trades}
      analysis={analysis}
      timeZone={settings.timezone}
      countBreakeven={settings.countBreakeven}
      breakevenContinuesStreak={settings.breakevenContinuesStreak}
    />
  );
}
