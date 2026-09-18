# Gringotts Trading Journal

A clean, local-first futures trading journal. Track multiple prop firm / broker
accounts, log trades, and see balance, trailing drawdown, targets, and
performance metrics, including automatic copy-trade propagation across
master/follower accounts.

All data lives in a local SQLite file (`data/trade-journal.db`); nothing is
sent anywhere.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- **Accounts**: create standalone, master, or follower accounts, each with
  its own starting balance, trailing drawdown limit, and profit target.
- **Copy trading**: log a trade once on a master account and it automatically
  propagates to every follower account, scaled by that follower's size ratio.
- **Calendar**: a monthly heatmap of daily P&L. Click any day to see its
  trades or log a new one.
- **Trades**: a sortable log of every trade with an auto P&L calculator for
  common futures contracts (ES, NQ, CL, GC, and more).
- **Dashboard**: balance, trailing-drawdown cushion, target progress, win
  rate, profit factor, expectancy, streaks, and an equity curve, filterable
  by one or many accounts at once.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, Drizzle ORM over SQLite
(`better-sqlite3`), Recharts for the equity curve.

## Data model

`src/db/schema.ts` defines three tables: `accounts`, `trades`, and `tags`. A
follower account references its master via `masterId`, and trades created on
a master account carry a shared `copyGroupId` so editing or deleting the
master trade keeps every follower's copy in sync.
