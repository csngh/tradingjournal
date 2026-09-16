import { db } from "@/db";
import { accounts, appSettings, trades } from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import type { Account, Trade } from "@/db/schema";
import { getSystemTimezone } from "@/lib/timezone";

export async function getAllAccounts(): Promise<Account[]> {
  return db.select().from(accounts).orderBy(asc(accounts.sortOrder));
}

export async function getAccountsByIds(ids: string[]): Promise<Account[]> {
  if (ids.length === 0) return [];
  return db.select().from(accounts).where(inArray(accounts.id, ids));
}

export async function getTradesForAccounts(
  accountIds: string[]
): Promise<Trade[]> {
  if (accountIds.length === 0) return [];
  return db
    .select()
    .from(trades)
    .where(inArray(trades.accountId, accountIds))
    .orderBy(asc(trades.exitTime));
}

export async function getFollowers(masterId: string): Promise<Account[]> {
  const all = await getAllAccounts();
  return all.filter((a) => a.masterId === masterId);
}

export async function getTimezone(): Promise<string> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
  if (row) return row.timezone;

  const fallback = getSystemTimezone();
  await db.insert(appSettings).values({ id: 1, timezone: fallback });
  return fallback;
}
