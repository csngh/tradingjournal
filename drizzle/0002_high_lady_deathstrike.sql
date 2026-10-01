CREATE TABLE `backtest_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`strategy_id` text NOT NULL,
	`side` text NOT NULL,
	`entry_time` text NOT NULL,
	`contracts` integer NOT NULL,
	`points` real NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`exit_reason` text DEFAULT 'MANUAL' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`strategy_id`) REFERENCES `strategies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#d4af37' NOT NULL,
	`symbol` text NOT NULL,
	`timeframe` text NOT NULL,
	`point_value` real NOT NULL,
	`contracts` integer DEFAULT 1 NOT NULL,
	`tp_points` real,
	`sl_points` real,
	`max_trades_per_day` integer,
	`fee_per_contract` real DEFAULT 0 NOT NULL,
	`starting_capital` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
