import { format } from "date-fns";
import { getAllAccounts, getTimezone, getTradesForAccounts } from "@/lib/data";
import { resolveSelectedAccountIds } from "@/lib/filter";
import { CalendarClient } from "@/components/calendar-client";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const params = await searchParams;
  const accountsParam = typeof params.accounts === "string" ? params.accounts : undefined;
  const monthParam = typeof params.month === "string" ? params.month : format(new Date(), "yyyy-MM");

  const [allAccounts, timeZone] = await Promise.all([getAllAccounts(), getTimezone()]);
  const selectedIds = resolveSelectedAccountIds(accountsParam, allAccounts);
  const trades = await getTradesForAccounts(selectedIds);

  return (
    <CalendarClient monthParam={monthParam} accounts={allAccounts} trades={trades} timeZone={timeZone} />
  );
}
