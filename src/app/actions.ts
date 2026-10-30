"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accounts, appSettings, backtestTrades, strategies, tags, trades } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getAllAccounts, getAllTags, getFollowers } from "@/lib/data";
import { validateBackup, validateBacktestBackup, type BackupData, type BacktestBackupData } from "@/lib/backup";
import { defaultFees } from "@/lib/backtest";

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

export async function updateBreakevenContinuesStreak(breakevenContinuesStreak: boolean) {
  await db
    .insert(appSettings)
    .values({ id: 1, breakevenContinuesStreak })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { breakevenContinuesStreak, updatedAt: new Date().toISOString() },
    });

  revalidatePath("/backtest");
  revalidatePath("/multi-account-sim");
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

// ---------- Backtesting ----------

export type StrategyInput = {
  name: string;
  description: string | null;
  color: string;
  symbol: string;
  timeframe: string;
  pointValue: number;
  contracts: number;
  tpPoints: number | null;
  slPoints: number | null;
  /** Reward-to-risk multiple; when set it replaces `tpPoints`. */
  rr: number | null;
  maxTradesPerDay: number | null;
  feePerContract: number;
  startingCapital: number;
  notes: string | null;
};

export type BacktestTradeInput = {
  strategyId: string;
  side: "LONG" | "SHORT";
  entryTime: string;
  /** False when only the date is known; the clock part of `entryTime` is then a placeholder. */
  hasEntryTime: boolean;
  contracts: number;
  points: number;
  fees: number;
  exitReason: "TP" | "SL" | "BE" | "MANUAL";
  /** Breakeven trades only: would it ultimately have been a win or a loss? Analytics only. */
  beOutcome: "WIN" | "LOSS" | null;
  /** Average True Range at entry. Optional, informational only. */
  atr: number | null;
  notes: string | null;
};

function positiveOrNull(n: number | null): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

function cleanStrategy(input: StrategyInput): StrategyInput {
  const name = input.name.trim();
  const symbol = input.symbol.trim().toUpperCase();
  if (!name) throw new Error("A strategy needs a name.");
  if (!symbol) throw new Error("A strategy needs a symbol.");
  if (!Number.isFinite(input.pointValue) || input.pointValue <= 0) {
    throw new Error("Point value must be greater than zero.");
  }
  return {
    ...input,
    name,
    symbol,
    description: input.description?.trim() || null,
    notes: input.notes?.trim() || null,
    contracts: Math.max(1, Math.round(input.contracts) || 1),
    rr: positiveOrNull(input.rr),
    tpPoints: positiveOrNull(input.rr) != null ? null : positiveOrNull(input.tpPoints),
    slPoints: positiveOrNull(input.slPoints),
    maxTradesPerDay:
      input.maxTradesPerDay != null && input.maxTradesPerDay > 0 ? Math.round(input.maxTradesPerDay) : null,
    feePerContract: Number.isFinite(input.feePerContract) && input.feePerContract > 0 ? input.feePerContract : 0,
    startingCapital: Number.isFinite(input.startingCapital) && input.startingCapital > 0 ? input.startingCapital : 0,
  };
}

function cleanBacktestTrade(input: BacktestTradeInput): BacktestTradeInput {
  if (!["LONG", "SHORT"].includes(input.side)) throw new Error("Invalid side.");
  if (!["TP", "SL", "BE", "MANUAL"].includes(input.exitReason)) throw new Error("Invalid exit reason.");
  if (Number.isNaN(Date.parse(input.entryTime))) throw new Error("Invalid entry time.");
  if (!Number.isFinite(input.points)) throw new Error("Points must be a number.");
  return {
    ...input,
    // A breakeven trade never moves points, but it still pays fees.
    points: input.exitReason === "BE" ? 0 : input.points,
    beOutcome:
      input.exitReason === "BE" && (input.beOutcome === "WIN" || input.beOutcome === "LOSS") ? input.beOutcome : null,
    hasEntryTime: input.hasEntryTime !== false,
    contracts: Math.max(1, Math.round(input.contracts) || 1),
    fees: Number.isFinite(input.fees) && input.fees > 0 ? input.fees : 0,
    atr: positiveOrNull(input.atr ?? null),
    notes: input.notes?.trim() || null,
  };
}

function revalidateBacktest(strategyId?: string) {
  revalidatePath("/backtest");
  if (strategyId) revalidatePath(`/backtest/${strategyId}`);
}

export async function createStrategy(input: StrategyInput) {
  const data = cleanStrategy(input);
  const id = randomUUID();
  await db.insert(strategies).values({ id, ...data });
  revalidateBacktest();
  return id;
}

export async function updateStrategy(id: string, input: StrategyInput) {
  const data = cleanStrategy(input);
  await db
    .update(strategies)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(strategies.id, id));
  revalidateBacktest(id);
}

export async function deleteStrategy(id: string) {
  await db.delete(strategies).where(eq(strategies.id, id));
  revalidateBacktest(id);
}

export async function createBacktestTrade(input: BacktestTradeInput) {
  const data = cleanBacktestTrade(input);
  await db.insert(backtestTrades).values({ id: randomUUID(), ...data });
  revalidateBacktest(data.strategyId);
}

export async function updateBacktestTrade(id: string, input: BacktestTradeInput) {
  const data = cleanBacktestTrade(input);
  await db.update(backtestTrades).set(data).where(eq(backtestTrades.id, id));
  revalidateBacktest(data.strategyId);
}

export async function deleteBacktestTrade(id: string) {
  const [existing] = await db.select().from(backtestTrades).where(eq(backtestTrades.id, id));
  if (!existing) return;
  await db.delete(backtestTrades).where(eq(backtestTrades.id, id));
  revalidateBacktest(existing.strategyId);
}

export async function clearBacktestTrades(strategyId: string) {
  await db.delete(backtestTrades).where(eq(backtestTrades.strategyId, strategyId));
  revalidateBacktest(strategyId);
}

/**
 * Reprices every already-logged trade for a strategy to a new contract count and/or fee per
 * contract. Points are never touched, only the size and the fee depending on it. Each trade's
 * fee is set from the strategy's current rate, not scaled from its old fee, so trades stay
 * consistent with the strategy's displayed fee. The user opts into this explicitly; nothing
 * resizes automatically.
 */
export async function bulkResizeBacktestTrades(
  strategyId: string,
  newContracts: number,
  feePerContract: number
): Promise<{ count: number }> {
  const size = Math.max(1, Math.round(newContracts) || 1);
  const targetFee = defaultFees({ feePerContract }, size);
  const rows = await db.select().from(backtestTrades).where(eq(backtestTrades.strategyId, strategyId));
  const changed = rows.filter((t) => t.contracts !== size || t.fees !== targetFee);
  if (changed.length === 0) return { count: 0 };

  db.transaction((tx) => {
    for (const t of changed) {
      tx.update(backtestTrades)
        .set({ contracts: size, fees: targetFee })
        .where(eq(backtestTrades.id, t.id))
        .run();
    }
  });

  revalidateBacktest(strategyId);
  return { count: changed.length };
}

/** Bulk-inserts already-parsed rows in one transaction; rejects the whole batch if any row is invalid. */
export async function importBacktestTrades(strategyId: string, rows: Omit<BacktestTradeInput, "strategyId">[]) {
  const cleaned = rows.map((r) => cleanBacktestTrade({ ...r, strategyId }));
  if (cleaned.length === 0) return { count: 0 };
  db.transaction((tx) => {
    for (let i = 0; i < cleaned.length; i += 200) {
      tx.insert(backtestTrades)
        .values(cleaned.slice(i, i + 200).map((r) => ({ id: randomUUID(), ...r })))
        .run();
    }
  });
  revalidateBacktest(strategyId);
  return { count: cleaned.length };
}

// ---------- Backtest-only export / import ----------

const BACKTEST_BACKUP_FORMAT_VERSION = 1;

export type { BacktestBackupData } from "@/lib/backup";

/** Every strategy and backtest trade, with no accounts, trades, tags, or settings. For moving just the Backtest section between devices. */
export async function exportBacktestData(): Promise<BacktestBackupData> {
  const [strategyRows, backtestTradeRows] = await Promise.all([
    db.select().from(strategies),
    db.select().from(backtestTrades),
  ]);

  return {
    formatVersion: BACKTEST_BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    strategies: strategyRows,
    backtestTrades: backtestTradeRows,
  };
}

/**
 * Replaces every strategy and backtest trade with the contents of a previously exported backtest
 * backup. Accounts, real trades, tags and settings are untouched. Same validate-then-transact
 * pattern as `importAllData`, scoped to just these two tables.
 */
export async function importBacktestData(input: unknown): Promise<ImportResult> {
  const { data, errors } = validateBacktestBackup(input);
  if (!data) return { ok: false, errors };

  try {
    db.transaction((tx) => {
      tx.delete(backtestTrades).run();
      tx.delete(strategies).run();

      if (data.strategies.length) tx.insert(strategies).values(data.strategies).run();
      if (data.backtestTrades.length) {
        for (let i = 0; i < data.backtestTrades.length; i += 200) {
          tx.insert(backtestTrades).values(data.backtestTrades.slice(i, i + 200)).run();
        }
      }
    });
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : "The database rejected this file."],
    };
  }

  revalidateBacktest();
  return { ok: true };
}

/** One strategy and only its own trades, in the same shape as the full backtest backup, for sharing or backing up a single strategy. */
export async function exportStrategyData(strategyId: string): Promise<BacktestBackupData> {
  const [strategyRows, tradeRows] = await Promise.all([
    db.select().from(strategies).where(eq(strategies.id, strategyId)),
    db.select().from(backtestTrades).where(eq(backtestTrades.strategyId, strategyId)),
  ]);
  if (!strategyRows[0]) throw new Error("Strategy not found.");

  return {
    formatVersion: BACKTEST_BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    strategies: strategyRows,
    backtestTrades: tradeRows,
  };
}

/**
 * Imports every strategy (and its trades) in a backtest backup file as brand-new strategies,
 * alongside what's already there. Unlike `importBacktestData`, nothing existing is deleted.
 * Ids from the file are remapped to fresh ones so the same file can be imported more than once
 * (or a strategy re-imported into the database it came from) without colliding.
 */
export async function importStrategiesAsNew(input: unknown): Promise<ImportResult> {
  const { data, errors } = validateBacktestBackup(input);
  if (!data) return { ok: false, errors };

  const idMap = new Map<string, string>();
  const newStrategies = data.strategies.map((s) => {
    const id = randomUUID();
    idMap.set(s.id, id);
    return { ...s, id };
  });
  const newTrades = data.backtestTrades.map((t) => ({
    ...t,
    id: randomUUID(),
    strategyId: idMap.get(t.strategyId)!,
  }));

  try {
    db.transaction((tx) => {
      if (newStrategies.length) tx.insert(strategies).values(newStrategies).run();
      if (newTrades.length) {
        for (let i = 0; i < newTrades.length; i += 200) {
          tx.insert(backtestTrades).values(newTrades.slice(i, i + 200)).run();
        }
      }
    });
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : "The database rejected this file."],
    };
  }

  revalidateBacktest();
  return { ok: true };
}

// ---------- Full data export / import ----------

const BACKUP_FORMAT_VERSION = 2;

export type { BackupData } from "@/lib/backup";

export async function exportAllData(): Promise<BackupData> {
  const [accountRows, tagRows, tradeRows, settingsRows, strategyRows, backtestTradeRows] = await Promise.all([
    db.select().from(accounts),
    db.select().from(tags),
    db.select().from(trades),
    db.select().from(appSettings).where(eq(appSettings.id, 1)),
    db.select().from(strategies),
    db.select().from(backtestTrades),
  ]);

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appSettings: settingsRows[0] ?? null,
    accounts: accountRows,
    tags: tagRows,
    trades: tradeRows,
    strategies: strategyRows,
    backtestTrades: backtestTradeRows,
  };
}

export type ImportResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Replaces every account, tag, trade, backtest strategy (with its trades), and the saved settings with the contents of a previously
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
      tx.delete(backtestTrades).run();
      tx.delete(strategies).run();
      tx.delete(trades).run();
      tx.delete(tags).run();
      tx.delete(accounts).run();

      if (data.strategies.length) tx.insert(strategies).values(data.strategies).run();
      if (data.backtestTrades.length) {
        for (let i = 0; i < data.backtestTrades.length; i += 200) {
          tx.insert(backtestTrades).values(data.backtestTrades.slice(i, i + 200)).run();
        }
      }
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
  revalidatePath("/backtest", "layout");
  return { ok: true };
}

/**
 * Wipes every account, trade, tag, backtest strategy, and saved setting, leaving a completely empty database (the
 * next read of app settings recreates a default row). This is strictly local to this device's
 * SQLite file; it can't reach browser storage or Electron/Chromium's own caches, so the client
 * is responsible for clearing localStorage and reloading after this resolves.
 */
export async function resetAllData() {
  db.transaction((tx) => {
    tx.delete(backtestTrades).run();
    tx.delete(strategies).run();
    tx.delete(trades).run();
    tx.delete(tags).run();
    tx.delete(accounts).run();
    tx.delete(appSettings).run();
  });

  revalidatePath("/backtest", "layout");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/trades");
  revalidatePath("/accounts");
  revalidatePath("/settings");
}
