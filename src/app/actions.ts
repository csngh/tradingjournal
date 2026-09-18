"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accounts, appSettings, tags, trades } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getAllAccounts, getAllTags, getFollowers } from "@/lib/data";
import { validateBackup, type BackupData } from "@/lib/backup";

// ---------- Settings ----------

export async function updateTimezone(timezone: string) {
  await db
    .insert(appSettings)
    .values({ id: 1, timezone })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { timezone, updatedAt: new Date().toISOString() },
    });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trades");
  revalidatePath("/settings");
}

export async function updateCountBreakeven(countBreakeven: boolean) {
  await db
    .insert(appSettings)
    .values({ id: 1, countBreakeven })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { countBreakeven, updatedAt: new Date().toISOString() },
    });

  revalidatePath("/");
  revalidatePath("/settings");
}

// ---------- Tags ----------

export type TagInput = {
  name: string;
  color: string;
};

function revalidateTradePages() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trades");
  revalidatePath("/settings");
}

export async function createTag(input: TagInput) {
  const id = randomUUID();
  const all = await getAllTags();
  const maxSort = all.reduce((m, t) => Math.max(m, t.sortOrder), -1);

  await db.insert(tags).values({
    id,
    name: input.name,
    color: input.color,
    sortOrder: maxSort + 1,
  });

  revalidateTradePages();
  return id;
}

export async function updateTag(id: string, input: TagInput) {
  await db
    .update(tags)
    .set({ name: input.name, color: input.color })
    .where(eq(tags.id, id));

  revalidateTradePages();
}

export async function deleteTag(id: string) {
  // The tag_id column was added via a later migration (SQLite's ALTER TABLE ADD COLUMN doesn't
  // carry an ON DELETE action), so the FK alone won't null this out. Do it explicitly first.
  await db.update(trades).set({ tagId: null }).where(eq(trades.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
  revalidateTradePages();
}

// ---------- Accounts ----------

export type AccountInput = {
  name: string;
  broker?: string | null;
  color: string;
  role: "MASTER" | "FOLLOWER" | "STANDALONE";
  masterId?: string | null;
  copyRatio: number;
  accountType?: "CHALLENGE" | "FUNDED" | null;
  startingBalance: number;
  balanceAdjustment?: number;
  highestBalance?: number | null;
  feePerContract?: number | null;
  trailingDrawdown?: number | null;
  drawdownLockEnabled: boolean;
  drawdownStopsAt?: number | null;
  targetProfit?: number | null;
  status: "ACTIVE" | "PASSED" | "BLOWN" | "CLOSED";
};

export async function createAccount(input: AccountInput) {
  const id = randomUUID();
  const all = await getAllAccounts();
  const maxSort = all.reduce((m, a) => Math.max(m, a.sortOrder), -1);

  await db.insert(accounts).values({
    id,
    name: input.name,
    broker: input.broker ?? null,
    color: input.color,
    role: input.role,
    masterId: input.role === "FOLLOWER" ? input.masterId ?? null : null,
    copyRatio: input.copyRatio,
    accountType: input.accountType ?? null,
    startingBalance: input.startingBalance,
    balanceAdjustment: input.balanceAdjustment ?? 0,
    highestBalance: input.highestBalance ?? null,
    feePerContract: input.feePerContract ?? null,
    trailingDrawdown: input.trailingDrawdown ?? null,
    drawdownLockEnabled: input.drawdownLockEnabled,
    drawdownStopsAt: input.drawdownStopsAt ?? null,
    targetProfit: input.targetProfit ?? null,
    status: input.status,
    sortOrder: maxSort + 1,
  });

  revalidatePath("/");
  return id;
}

export async function updateAccount(id: string, input: AccountInput) {
  await db
    .update(accounts)
    .set({
      name: input.name,
      broker: input.broker ?? null,
      color: input.color,
      role: input.role,
      masterId: input.role === "FOLLOWER" ? input.masterId ?? null : null,
      copyRatio: input.copyRatio,
      accountType: input.accountType ?? null,
      startingBalance: input.startingBalance,
      balanceAdjustment: input.balanceAdjustment ?? 0,
      highestBalance: input.highestBalance ?? null,
      feePerContract: input.feePerContract ?? null,
      trailingDrawdown: input.trailingDrawdown ?? null,
      drawdownLockEnabled: input.drawdownLockEnabled,
      drawdownStopsAt: input.drawdownStopsAt ?? null,
      targetProfit: input.targetProfit ?? null,
      status: input.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(accounts.id, id));

  revalidatePath("/");
}

export async function deleteAccount(id: string) {
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath("/");
}

// ---------- Trades ----------

export type TradeInput = {
  accountId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  timeframe: string;
  contracts: number;
  points: number;
  pointValue: number;
  entryTime: string;
  fees: number;
  pnl: number;
  isBreakeven: boolean;
  beOutcome?: "WIN" | "LOSS" | null;
  tagId?: string | null;
  notes?: string | null;
};

async function propagateToFollowers(
  masterAccountId: string,
  copyGroupId: string,
  base: TradeInput
) {
  const followers = await getFollowers(masterAccountId);
  if (followers.length === 0) return;

  const perContractPnl = base.pnl / base.contracts;
  const perContractFees = base.fees / base.contracts;

  const rows = followers.map((f) => {
    const scaledContracts = Math.max(1, Math.round(base.contracts * f.copyRatio));
    const fee = f.feePerContract != null ? f.feePerContract * scaledContracts : perContractFees * scaledContracts;
    return {
      id: randomUUID(),
      accountId: f.id,
      copyGroupId,
      symbol: base.symbol,
      side: base.side,
      timeframe: base.timeframe,
      contracts: scaledContracts,
      points: base.points,
      pointValue: base.pointValue,
      entryTime: base.entryTime,
      exitTime: base.entryTime,
      fees: fee,
      pnl: perContractPnl * scaledContracts,
      isBreakeven: base.isBreakeven,
      beOutcome: base.beOutcome ?? null,
      tagId: base.tagId ?? null,
      notes: base.notes ?? null,
    };
  });

  await db.insert(trades).values(rows);
}

export async function createTrade(input: TradeInput) {
  const id = randomUUID();
  const copyGroupId = randomUUID();

  await db.insert(trades).values({
    id,
    copyGroupId,
    accountId: input.accountId,
    symbol: input.symbol.toUpperCase(),
    side: input.side,
    timeframe: input.timeframe,
    contracts: input.contracts,
    points: input.points,
    pointValue: input.pointValue,
    entryTime: input.entryTime,
    exitTime: input.entryTime,
    fees: input.fees,
    pnl: input.pnl,
    isBreakeven: input.isBreakeven,
    beOutcome: input.beOutcome ?? null,
    tagId: input.tagId ?? null,
    notes: input.notes ?? null,
  });

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId));

  if (account?.role === "MASTER") {
    await propagateToFollowers(account.id, copyGroupId, input);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trades");
  return id;
}

export async function updateTrade(id: string, input: TradeInput) {
  const [existing] = await db.select().from(trades).where(eq(trades.id, id));
  if (!existing) throw new Error("Trade not found");

  await db
    .update(trades)
    .set({
      accountId: input.accountId,
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      timeframe: input.timeframe,
      contracts: input.contracts,
      points: input.points,
      pointValue: input.pointValue,
      entryTime: input.entryTime,
      exitTime: input.entryTime,
      fees: input.fees,
      pnl: input.pnl,
      isBreakeven: input.isBreakeven,
      beOutcome: input.beOutcome ?? null,
      tagId: input.tagId ?? null,
      notes: input.notes ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(trades.id, id));

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId));

  if (account?.role === "MASTER" && existing.copyGroupId) {
    // Wipe and regenerate follower copies to stay in sync with the master.
    await db
      .delete(trades)
      .where(
        and(
          eq(trades.copyGroupId, existing.copyGroupId),
          ne(trades.accountId, account.id)
        )
      );
    await propagateToFollowers(account.id, existing.copyGroupId, input);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trades");
}

export async function deleteTrade(id: string) {
  const [existing] = await db.select().from(trades).where(eq(trades.id, id));
  if (!existing) return;

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, existing.accountId));

  if (account?.role === "MASTER" && existing.copyGroupId) {
    await db.delete(trades).where(eq(trades.copyGroupId, existing.copyGroupId));
  } else {
    await db.delete(trades).where(eq(trades.id, id));
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trades");
}

// ---------- Full data export / import ----------

const BACKUP_FORMAT_VERSION = 1;

export type { BackupData } from "@/lib/backup";

export async function exportAllData(): Promise<BackupData> {
  const [accountRows, tagRows, tradeRows, settingsRows] = await Promise.all([
    db.select().from(accounts),
    db.select().from(tags),
    db.select().from(trades),
    db.select().from(appSettings).where(eq(appSettings.id, 1)),
  ]);

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appSettings: settingsRows[0] ?? null,
    accounts: accountRows,
    tags: tagRows,
    trades: tradeRows,
  };
}

export type ImportResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Replaces every account, tag, trade, and the saved settings with the contents of a previously
 * exported backup. `validateBackup` checks required fields, enum values, and cross-references
 * (trade -> account, trade -> tag, account -> master account) before anything is written. The
 * write itself is wrapped in a single SQLite transaction (better-sqlite3 transactions must run
 * fully synchronously, hence `.run()` instead of `await` on each statement) so even a problem
 * validation missed rolls back cleanly instead of leaving the database half-wiped.
 */
export async function importAllData(input: unknown): Promise<ImportResult> {
  const { data, errors } = validateBackup(input);
  if (!data) return { ok: false, errors };

  try {
    db.transaction((tx) => {
      tx.delete(trades).run();
      tx.delete(tags).run();
      tx.delete(accounts).run();

      if (data.accounts.length) tx.insert(accounts).values(data.accounts).run();
      if (data.tags.length) tx.insert(tags).values(data.tags).run();
      if (data.trades.length) tx.insert(trades).values(data.trades).run();

      if (data.appSettings) {
        tx.insert(appSettings)
          .values({ ...data.appSettings, id: 1 })
          .onConflictDoUpdate({ target: appSettings.id, set: data.appSettings })
          .run();
      }
    });
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : "The database rejected this file."],
    };
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trades");
  revalidatePath("/accounts");
  revalidatePath("/settings");
  return { ok: true };
}
