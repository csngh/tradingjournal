import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

// Electron sets TJ_DATA_DIR to the OS user-data directory so the database
// lives outside the (read-only, once packaged) app bundle. Web/dev usage
// falls back to a local ./data folder.
const dbDir = process.env.TJ_DATA_DIR ?? path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "trade-journal.db");
const migrationsFolder = path.join(process.cwd(), "drizzle");

// Reused across Next.js dev hot-reloads and build workers so we never open
// more than one connection to the same SQLite file from this process.
const globalForDb = globalThis as unknown as { __tradeJournalDb?: Database.Database };

function createConnection() {
  fs.mkdirSync(dbDir, { recursive: true });
  const sqlite = new Database(dbPath, { timeout: 5000 });
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

const existingConnection = globalForDb.__tradeJournalDb;
const sqlite = existingConnection ?? createConnection();
globalForDb.__tradeJournalDb = sqlite;

export const db = drizzle(sqlite, { schema });

// Brings a fresh database up to the latest schema automatically — no manual
// migration step required on first launch (dev, prod, or the packaged app).
if (!existingConnection) {
  migrate(db, { migrationsFolder });
}
