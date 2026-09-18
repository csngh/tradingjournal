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
export type AppSettings = typeof appSettings.$inferSelect;
