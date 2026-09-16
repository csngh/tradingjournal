import { getAllAccounts, getTradesForAccounts } from "@/lib/data";
import { computeBalance, computeTargetProgress, computeTrailingDrawdown, netPnl } from "@/lib/metrics";
import { AccountsClient, type AccountWithMetrics } from "@/components/accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await getAllAccounts();
  const allTrades = await getTradesForAccounts(accounts.map((a) => a.id));
  const tradesByAccount = new Map<string, typeof allTrades>();
  for (const t of allTrades) {
    const arr = tradesByAccount.get(t.accountId) ?? [];
    arr.push(t);
    tradesByAccount.set(t.accountId, arr);
  }

  const items: AccountWithMetrics[] = accounts.map((account) => {
    const trades = tradesByAccount.get(account.id) ?? [];
    return {
      account,
      balance: computeBalance(account, trades),
      drawdown: computeTrailingDrawdown(account, trades),
      target: computeTargetProgress(account, trades),
      tradeCount: trades.length,
      tradesNet: trades.reduce((s, t) => s + netPnl(t), 0),
    };
  });

  return <AccountsClient items={items} />;
}
