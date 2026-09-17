CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`broker` text,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`role` text DEFAULT 'STANDALONE' NOT NULL,
	`master_id` text,
	`copy_ratio` real DEFAULT 1 NOT NULL,
	`account_type` text,
	`starting_balance` real NOT NULL,
	`balance_adjustment` real DEFAULT 0 NOT NULL,
	`highest_balance` real,
	`fee_per_contract` real,
	`trailing_drawdown` real,
	`drawdown_lock_enabled` integer DEFAULT true NOT NULL,
	`drawdown_stops_at` real,
	`target_profit` real,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`count_breakeven` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`copy_group_id` text,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`timeframe` text NOT NULL,
	`contracts` integer NOT NULL,
	`points` real NOT NULL,
	`point_value` real NOT NULL,
	`entry_time` text NOT NULL,
	`exit_time` text NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`pnl` real NOT NULL,
	`is_breakeven` integer DEFAULT false NOT NULL,
	`be_outcome` text,
	`tags` text,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
