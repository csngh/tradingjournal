"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accounts, appSettings, trades } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getAllAccounts, getFollowers } from "@/lib/data";

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
  tags?: string | null;
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
      tags: base.tags ?? null,
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
    tags: input.tags ?? null,
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
      tags: input.tags ?? null,
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
