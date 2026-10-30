import { notFound } from "next/navigation";
import { BACKTEST_ENABLED } from "@/lib/features";
import { getAllBacktestTrades, getAllStrategies, getAppSettings } from "@/lib/data";
import { MultiAccountSimClient } from "@/components/multi-account-sim-client";
import type { BacktestTrade } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function MultiAccountSimPage() {
  if (!BACKTEST_ENABLED) notFound();

  const [strategies, allTrades, settings] = await Promise.all([
    getAllStrategies(),
    getAllBacktestTrades(),
    getAppSettings(),
  ]);

  const tradesByStrategy: Record<string, BacktestTrade[]> = {};
  for (const t of allTrades) {
    (tradesByStrategy[t.strategyId] ??= []).push(t);
  }

  return (
    <MultiAccountSimClient
      strategies={strategies}
      tradesByStrategy={tradesByStrategy}
      timeZone={settings.timezone}
      countBreakeven={settings.countBreakeven}
      breakevenContinuesStreak={settings.breakevenContinuesStreak}
    />
  );
}
