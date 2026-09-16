import type { Account } from "@/db/schema";

export function resolveSelectedAccountIds(
  accountsParam: string | undefined,
  allAccounts: Account[]
): string[] {
  if (!accountsParam) return allAccounts.map((a) => a.id);
  const ids = new Set(accountsParam.split(",").filter(Boolean));
  const valid = allAccounts.filter((a) => ids.has(a.id)).map((a) => a.id);
  return valid.length > 0 ? valid : allAccounts.map((a) => a.id);
}
