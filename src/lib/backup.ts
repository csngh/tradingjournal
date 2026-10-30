import type { Account, AppSettings, BacktestTrade, Strategy, Tag, Trade } from "@/db/schema";

export type BackupData = {
  formatVersion: number;
  exportedAt: string;
  appSettings: AppSettings | null;
  accounts: Account[];
  tags: Tag[];
  trades: Trade[];
  strategies: Strategy[];
  backtestTrades: BacktestTrade[];
};

/** A backup scoped to just the Backtest section: strategies and their trades, nothing else. */
export type BacktestBackupData = {
  formatVersion: number;
  exportedAt: string;
  strategies: Strategy[];
  backtestTrades: BacktestTrade[];
};

const ACCOUNT_ROLES = ["MASTER", "FOLLOWER", "STANDALONE"];
const ACCOUNT_TYPES = ["CHALLENGE", "FUNDED"];
const ACCOUNT_STATUSES = ["ACTIVE", "PASSED", "BLOWN", "CLOSED"];
const TRADE_SIDES = ["LONG", "SHORT"];
const BE_OUTCOMES = ["WIN", "LOSS"];
const EXIT_REASONS = ["TP", "SL", "BE", "MANUAL"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidIsoDate(v: unknown): boolean {
  return typeof v === "string" && !Number.isNaN(Date.parse(v));
}

/** Shared by the full backup and the backtest-only backup, so the two never validate differently. */
function validateStrategies(strategies: unknown[]): { strategyIds: Set<string>; errors: string[] } {
  const strategyIds = new Set<string>();
  const errors: string[] = [];
  strategies.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      errors.push(`Strategy #${i + 1} isn't an object.`);
      return;
    }
    const st = raw as Record<string, unknown>;
    const label = isNonEmptyString(st.id) ? st.id : `#${i + 1}`;
    if (!isNonEmptyString(st.id)) {
      errors.push(`Strategy #${i + 1} is missing a valid "id".`);
    } else if (strategyIds.has(st.id)) {
      errors.push(`Duplicate strategy id "${st.id}".`);
    } else {
      strategyIds.add(st.id);
    }
    if (!isNonEmptyString(st.name)) errors.push(`Strategy "${label}" is missing a "name".`);
    if (!isNonEmptyString(st.symbol)) errors.push(`Strategy "${label}" is missing a "symbol".`);
    if (!isNonEmptyString(st.timeframe)) errors.push(`Strategy "${label}" is missing a "timeframe".`);
    if (!isFiniteNumber(st.pointValue) || st.pointValue <= 0) {
      errors.push(`Strategy "${label}" has an invalid "pointValue".`);
    }
    if (!isFiniteNumber(st.contracts)) errors.push(`Strategy "${label}" has an invalid "contracts" value.`);
    for (const key of ["tpPoints", "slPoints", "rr", "maxTradesPerDay"] as const) {
      if (st[key] != null && !isFiniteNumber(st[key])) {
        errors.push(`Strategy "${label}" has an invalid "${key}" value.`);
      }
    }
  });
  return { strategyIds, errors };
}

/** Shared by the full backup and the backtest-only backup, so the two never validate differently. */
function validateBacktestTrades(backtestTrades: unknown[], strategyIds: Set<string>): { errors: string[] } {
  const errors: string[] = [];
  const backtestTradeIds = new Set<string>();
  backtestTrades.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      errors.push(`Backtest trade #${i + 1} isn't an object.`);
      return;
    }
    const bt = raw as Record<string, unknown>;
    const label = isNonEmptyString(bt.id) ? bt.id : `#${i + 1}`;
    if (!isNonEmptyString(bt.id)) {
      errors.push(`Backtest trade #${i + 1} is missing a valid "id".`);
    } else if (backtestTradeIds.has(bt.id)) {
      errors.push(`Duplicate backtest trade id "${bt.id}".`);
    } else {
      backtestTradeIds.add(bt.id);
    }
    if (!isNonEmptyString(bt.strategyId)) {
      errors.push(`Backtest trade "${label}" is missing a "strategyId".`);
    } else if (!strategyIds.has(bt.strategyId)) {
      errors.push(`Backtest trade "${label}" references a strategy that doesn't exist in this file.`);
    }
    if (!TRADE_SIDES.includes(bt.side as string)) {
      errors.push(`Backtest trade "${label}" has an invalid side: "${bt.side}".`);
    }
    if (!isValidIsoDate(bt.entryTime)) errors.push(`Backtest trade "${label}" has an invalid "entryTime".`);
    if (bt.hasEntryTime !== undefined && typeof bt.hasEntryTime !== "boolean") {
      errors.push(`Backtest trade "${label}" has an invalid "hasEntryTime" flag.`);
    }
    if (!isFiniteNumber(bt.contracts)) errors.push(`Backtest trade "${label}" has an invalid "contracts" value.`);
    if (!isFiniteNumber(bt.points)) errors.push(`Backtest trade "${label}" has an invalid "points" value.`);
    if (bt.fees !== undefined && !isFiniteNumber(bt.fees)) errors.push(`Backtest trade "${label}" has an invalid "fees" value.`);
    if (bt.beOutcome != null && !BE_OUTCOMES.includes(bt.beOutcome as string)) {
      errors.push(`Backtest trade "${label}" has an invalid breakeven outcome: "${bt.beOutcome}".`);
    }
    if (bt.exitReason !== undefined && !EXIT_REASONS.includes(bt.exitReason as string)) {
      errors.push(`Backtest trade "${label}" has an invalid exit reason: "${bt.exitReason}".`);
    }
    if (bt.atr != null && !isFiniteNumber(bt.atr)) {
      errors.push(`Backtest trade "${label}" has an invalid "atr" value.`);
    }
  });
  return { errors };
}

/**
 * Validates an untrusted parsed-JSON value as a full backup before anything touches the
 * database: required fields, enum values, and cross-references between trades/accounts/tags.
 * Returns every problem found (not just the first) so a bad file can be fixed in one pass.
 */
export function validateBackup(value: unknown): { data: BackupData | null; errors: string[] } {
  if (!value || typeof value !== "object") {
    return { data: null, errors: ["The file isn't a valid JSON object."] };
  }
  const v = value as Record<string, unknown>;

  const shapeErrors: string[] = [];
  if (!Array.isArray(v.accounts)) shapeErrors.push('Missing or invalid "accounts" list.');
  if (!Array.isArray(v.tags)) shapeErrors.push('Missing or invalid "tags" list.');
  if (!Array.isArray(v.trades)) shapeErrors.push('Missing or invalid "trades" list.');
  if (shapeErrors.length > 0) return { data: null, errors: shapeErrors };

  const accounts = v.accounts as unknown[];
  const tags = v.tags as unknown[];
  const trades = v.trades as unknown[];
  // Backups from before the Backtest section existed simply don't have these lists.
  if (v.strategies != null && !Array.isArray(v.strategies)) shapeErrors.push('Invalid "strategies" list.');
  if (v.backtestTrades != null && !Array.isArray(v.backtestTrades)) shapeErrors.push('Invalid "backtestTrades" list.');
  if (shapeErrors.length > 0) return { data: null, errors: shapeErrors };
  const strategies = (v.strategies ?? []) as unknown[];
  const backtestTrades = (v.backtestTrades ?? []) as unknown[];
  const errors: string[] = [];

  const accountIds = new Set<string>();
  accounts.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      errors.push(`Account #${i + 1} isn't an object.`);
      return;
    }
    const a = raw as Record<string, unknown>;
    const label = isNonEmptyString(a.id) ? a.id : `#${i + 1}`;
    if (!isNonEmptyString(a.id)) {
      errors.push(`Account #${i + 1} is missing a valid "id".`);
    } else if (accountIds.has(a.id)) {
      errors.push(`Duplicate account id "${a.id}".`);
    } else {
      accountIds.add(a.id);
    }
    if (!isNonEmptyString(a.name)) errors.push(`Account "${label}" is missing a "name".`);
    if (a.role !== undefined && !ACCOUNT_ROLES.includes(a.role as string)) {
      errors.push(`Account "${label}" has an invalid role: "${a.role}".`);
    }
    if (a.accountType != null && !ACCOUNT_TYPES.includes(a.accountType as string)) {
      errors.push(`Account "${label}" has an invalid account type: "${a.accountType}".`);
    }
    if (a.status !== undefined && !ACCOUNT_STATUSES.includes(a.status as string)) {
      errors.push(`Account "${label}" has an invalid status: "${a.status}".`);
    }
    if (!isFiniteNumber(a.startingBalance)) {
      errors.push(`Account "${label}" has an invalid "startingBalance".`);
    }
  });
  accounts.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const a = raw as Record<string, unknown>;
    if (a.masterId != null && !accountIds.has(a.masterId as string)) {
      errors.push(`Account "${a.id ?? `#${i + 1}`}" references a master account that doesn't exist in this file.`);
    }
  });

  const tagIds = new Set<string>();
  tags.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      errors.push(`Tag #${i + 1} isn't an object.`);
      return;
    }
    const t = raw as Record<string, unknown>;
    const label = isNonEmptyString(t.id) ? t.id : `#${i + 1}`;
    if (!isNonEmptyString(t.id)) {
      errors.push(`Tag #${i + 1} is missing a valid "id".`);
    } else if (tagIds.has(t.id)) {
      errors.push(`Duplicate tag id "${t.id}".`);
    } else {
      tagIds.add(t.id);
    }
    if (!isNonEmptyString(t.name)) errors.push(`Tag "${label}" is missing a "name".`);
  });

  const tradeIds = new Set<string>();
  trades.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      errors.push(`Trade #${i + 1} isn't an object.`);
      return;
    }
    const t = raw as Record<string, unknown>;
    const label = isNonEmptyString(t.id) ? t.id : `#${i + 1}`;
    if (!isNonEmptyString(t.id)) {
      errors.push(`Trade #${i + 1} is missing a valid "id".`);
    } else if (tradeIds.has(t.id)) {
      errors.push(`Duplicate trade id "${t.id}".`);
    } else {
      tradeIds.add(t.id);
    }
    if (!isNonEmptyString(t.accountId)) {
      errors.push(`Trade "${label}" is missing an "accountId".`);
    } else if (!accountIds.has(t.accountId)) {
      errors.push(`Trade "${label}" references an account that doesn't exist in this file.`);
    }
    if (t.tagId != null && !tagIds.has(t.tagId as string)) {
      errors.push(`Trade "${label}" references a tag that doesn't exist in this file.`);
    }
    if (!isNonEmptyString(t.symbol)) errors.push(`Trade "${label}" is missing a "symbol".`);
    if (!TRADE_SIDES.includes(t.side as string)) {
      errors.push(`Trade "${label}" has an invalid side: "${t.side}".`);
    }
    if (!isNonEmptyString(t.timeframe)) errors.push(`Trade "${label}" is missing a "timeframe".`);
    if (!isFiniteNumber(t.contracts)) errors.push(`Trade "${label}" has an invalid "contracts" value.`);
    if (!isFiniteNumber(t.points)) errors.push(`Trade "${label}" has an invalid "points" value.`);
    if (!isFiniteNumber(t.pointValue)) errors.push(`Trade "${label}" has an invalid "pointValue".`);
    if (!isValidIsoDate(t.entryTime)) errors.push(`Trade "${label}" has an invalid "entryTime".`);
    if (!isValidIsoDate(t.exitTime)) errors.push(`Trade "${label}" has an invalid "exitTime".`);
    if (!isFiniteNumber(t.pnl)) errors.push(`Trade "${label}" has an invalid "pnl" value.`);
    if (t.fees !== undefined && !isFiniteNumber(t.fees)) errors.push(`Trade "${label}" has an invalid "fees" value.`);
    if (t.beOutcome != null && !BE_OUTCOMES.includes(t.beOutcome as string)) {
      errors.push(`Trade "${label}" has an invalid breakeven outcome: "${t.beOutcome}".`);
    }
  });

  const { strategyIds, errors: strategyErrors } = validateStrategies(strategies);
  errors.push(...strategyErrors);
  const { errors: backtestTradeErrors } = validateBacktestTrades(backtestTrades, strategyIds);
  errors.push(...backtestTradeErrors);

  if (v.appSettings != null) {
    if (typeof v.appSettings !== "object") {
      errors.push('"appSettings" must be an object or null.');
    } else {
      const s = v.appSettings as Record<string, unknown>;
      if (s.timezone !== undefined && !isNonEmptyString(s.timezone)) {
        errors.push("Saved settings have an invalid timezone.");
      }
      if (s.countBreakeven !== undefined && typeof s.countBreakeven !== "boolean") {
        errors.push("Saved settings have an invalid breakeven flag.");
      }
    }
  }

  if (errors.length > 0) return { data: null, errors };

  return {
    data: {
      formatVersion: typeof v.formatVersion === "number" ? v.formatVersion : 1,
      exportedAt: typeof v.exportedAt === "string" ? v.exportedAt : new Date().toISOString(),
      appSettings: (v.appSettings ?? null) as AppSettings | null,
      accounts: accounts as Account[],
      tags: tags as Tag[],
      trades: trades as Trade[],
      strategies: strategies as Strategy[],
      backtestTrades: backtestTrades as BacktestTrade[],
    },
    errors: [],
  };
}

/**
 * Validates an untrusted parsed-JSON value as a backup scoped to just the Backtest section:
 * strategies and their trades. Same field and cross-reference checks as the full backup's
 * strategies/backtestTrades, reused via `validateStrategies`/`validateBacktestTrades` so the two
 * import paths never drift apart.
 */
export function validateBacktestBackup(value: unknown): { data: BacktestBackupData | null; errors: string[] } {
  if (!value || typeof value !== "object") {
    return { data: null, errors: ["The file isn't a valid JSON object."] };
  }
  const v = value as Record<string, unknown>;

  const shapeErrors: string[] = [];
  if (!Array.isArray(v.strategies)) shapeErrors.push('Missing or invalid "strategies" list.');
  if (!Array.isArray(v.backtestTrades)) shapeErrors.push('Missing or invalid "backtestTrades" list.');
  if (shapeErrors.length > 0) return { data: null, errors: shapeErrors };

  const strategies = v.strategies as unknown[];
  const backtestTrades = v.backtestTrades as unknown[];

  const { strategyIds, errors: strategyErrors } = validateStrategies(strategies);
  const { errors: backtestTradeErrors } = validateBacktestTrades(backtestTrades, strategyIds);
  const errors = [...strategyErrors, ...backtestTradeErrors];

  if (errors.length > 0) return { data: null, errors };

  return {
    data: {
      formatVersion: typeof v.formatVersion === "number" ? v.formatVersion : 1,
      exportedAt: typeof v.exportedAt === "string" ? v.exportedAt : new Date().toISOString(),
      strategies: strategies as Strategy[],
      backtestTrades: backtestTrades as BacktestTrade[],
    },
    errors: [],
  };
}
