import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  broker: text("broker"),
  color: text("color").notNull().default("#6366f1"),

  role: text("role", { enum: ["MASTER", "FOLLOWER", "STANDALONE"] })
    .notNull()
    .default("STANDALONE"),
  masterId: text("master_id"),
  copyRatio: real("copy_ratio").notNull().default(1),

  accountType: text("account_type", { enum: ["CHALLENGE", "FUNDED"] }),

  startingBalance: real("starting_balance").notNull(),
  balanceAdjustment: real("balance_adjustment").notNull().default(0),
  highestBalance: real("highest_balance"),
  feePerContract: real("fee_per_contract"),
  trailingDrawdown: real("trailing_drawdown"),
  drawdownLockEnabled: integer("drawdown_lock_enabled", { mode: "boolean" }).notNull().default(true),
  drawdownStopsAt: real("drawdown_stops_at"),
  targetProfit: real("target_profit"),

  status: text("status", { enum: ["ACTIVE", "PASSED", "BLOWN", "CLOSED"] })
    .notNull()
    .default("ACTIVE"),
  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const trades = sqliteTable("trades", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  copyGroupId: text("copy_group_id"),

  symbol: text("symbol").notNull(),
  side: text("side", { enum: ["LONG", "SHORT"] }).notNull(),
  timeframe: text("timeframe").notNull(),
  contracts: integer("contracts").notNull(),
  points: real("points").notNull(),
  pointValue: real("point_value").notNull(),
  entryTime: text("entry_time").notNull(),
  exitTime: text("exit_time").notNull(),
  fees: real("fees").notNull().default(0),
  pnl: real("pnl").notNull(),
  isBreakeven: integer("is_breakeven", { mode: "boolean" }).notNull().default(false),
  beOutcome: text("be_outcome", { enum: ["WIN", "LOSS"] }),
  /** @deprecated Unused free-text tag field, superseded by tagId. Kept only so the column drop
   * doesn't require an ambiguous drizzle-kit rename-detection prompt against a real database. */
  tags: text("tags"),
  tagId: text("tag_id").references(() => tags.id, { onDelete: "set null" }),
  notes: text("notes"),

  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  timezone: text("timezone").notNull().default("UTC"),
  countBreakeven: integer("count_breakeven", { mode: "boolean" }).notNull().default(true),

  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const strategies = sqliteTable("strategies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#d4af37"),

  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  pointValue: real("point_value").notNull(),
  contracts: integer("contracts").notNull().default(1),
  /** Fixed take-profit size. Left null when the strategy is defined by `rr` instead. */
  tpPoints: real("tp_points"),
  /** Fixed stop size, or the typical risk per trade when the strategy is defined by `rr`. */
  slPoints: real("sl_points"),
  /** Reward-to-risk multiple (2 means 1:2). When set, it replaces the fixed take-profit points. */
  rr: real("rr"),
  maxTradesPerDay: integer("max_trades_per_day"),
  feePerContract: real("fee_per_contract").notNull().default(0),
  startingCapital: real("starting_capital").notNull().default(0),
  notes: text("notes"),

  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const backtestTrades = sqliteTable("backtest_trades", {
  id: text("id").primaryKey(),
  strategyId: text("strategy_id")
    .notNull()
    .references(() => strategies.id, { onDelete: "cascade" }),

  side: text("side", { enum: ["LONG", "SHORT"] }).notNull(),
  /** Always holds a date; when `hasEntryTime` is false the clock part is a placeholder (noon) and must be ignored. */
  entryTime: text("entry_time").notNull(),
  hasEntryTime: integer("has_entry_time", { mode: "boolean" }).notNull().default(true),
  contracts: integer("contracts").notNull(),
  /** Signed points per contract (gross, before fees). */
  points: real("points").notNull(),
  fees: real("fees").notNull().default(0),
  exitReason: text("exit_reason", { enum: ["TP", "SL", "BE", "MANUAL"] }).notNull().default("MANUAL"),
  /** For breakeven trades only: whether the trade would ultimately have been a win or a loss. Analytics only. */
  beOutcome: text("be_outcome", { enum: ["WIN", "LOSS"] }),
  notes: text("notes"),

  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const strategiesRelations = relations(strategies, ({ many }) => ({
  trades: many(backtestTrades),
}));

export const backtestTradesRelations = relations(backtestTrades, ({ one }) => ({
  strategy: one(strategies, {
    fields: [backtestTrades.strategyId],
    references: [strategies.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  master: one(accounts, {
    fields: [accounts.masterId],
    references: [accounts.id],
    relationName: "copyGroup",
  }),
  followers: many(accounts, { relationName: "copyGroup" }),
  trades: many(trades),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  account: one(accounts, {
    fields: [trades.accountId],
    references: [accounts.id],
  }),
  tag: one(tags, {
    fields: [trades.tagId],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  trades: many(trades),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;
export type BacktestTrade = typeof backtestTrades.$inferSelect;
export type NewBacktestTrade = typeof backtestTrades.$inferInsert;
export type AppSettings = typeof appSettings.$inferSelect;
