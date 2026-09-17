import { getAllAccounts, getAppSettings, getTradesForAccounts } from "@/lib/data";
import { resolveSelectedAccountIds } from "@/lib/filter";
import { TradesClient } from "@/components/trades-client";

export const dynamic = "force-dynamic";

export default async function TradesPage({
  searchParams,
}: PageProps<"/trades">) {
  const params = await searchParams;
  const accountsParam = typeof params.accounts === "string" ? params.accounts : undefined;

  const [allAccounts, settings] = await Promise.all([getAllAccounts(), getAppSettings()]);
  const selectedIds = resolveSelectedAccountIds(accountsParam, allAccounts);
  const trades = await getTradesForAccounts(selectedIds);
  const sorted = [...trades].sort(
    (a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
  );

  return (
    <TradesClient
      accounts={allAccounts}
      trades={sorted}
      timeZone={settings.timezone}
      countBreakeven={settings.countBreakeven}
    />
  );
}
