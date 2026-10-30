import { notFound } from "next/navigation";
import { BACKTEST_ENABLED } from "@/lib/features";
import { getAllBacktestTrades, getAllStrategies, getTimezone } from "@/lib/data";
import { EvalSimClient } from "@/components/eval-sim-client";
import type { BacktestTrade } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function EvalSimPage() {
  if (!BACKTEST_ENABLED) notFound();

  const [strategies, allTrades, timeZone] = await Promise.all([
    getAllStrategies(),
    getAllBacktestTrades(),
    getTimezone(),
  ]);

  const tradesByStrategy: Record<string, BacktestTrade[]> = {};
  for (const t of allTrades) {
    (tradesByStrategy[t.strategyId] ??= []).push(t);
  }

  return <EvalSimClient strategies={strategies} tradesByStrategy={tradesByStrategy} timeZone={timeZone} />;
}
