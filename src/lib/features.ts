/**
 * Backtest on/off switch. While false: the sidebar item is disabled and shows a "Coming soon" popup,
 * /backtest pages return "not found", and Settings no longer mentions it. Nothing is deleted:
 * strategies and trades already saved stay in the database and in backups.
 */
export const BACKTEST_ENABLED = true;
