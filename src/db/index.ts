import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "trade-journal.db");

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

const sqlite = globalForDb.__tradeJournalDb ?? createConnection();
globalForDb.__tradeJournalDb = sqlite;

export const db = drizzle(sqlite, { schema });
