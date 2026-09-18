export type Timeframe = {
  value: string;
  label: string;
  minutes: number;
};

export const TIMEFRAMES: Timeframe[] = [
  { value: "1m", label: "1 minute", minutes: 1 },
  { value: "2m", label: "2 minutes", minutes: 2 },
  { value: "3m", label: "3 minutes", minutes: 3 },
  { value: "5m", label: "5 minutes", minutes: 5 },
  { value: "15m", label: "15 minutes", minutes: 15 },
  { value: "30m", label: "30 minutes", minutes: 30 },
  { value: "1h", label: "1 hour", minutes: 60 },
  { value: "2h", label: "2 hours", minutes: 120 },
  { value: "4h", label: "4 hours", minutes: 240 },
  { value: "1D", label: "Daily", minutes: 1440 },
];

export function minutesForTimeframe(value: string): number {
  return TIMEFRAMES.find((t) => t.value === value)?.minutes ?? 1;
}

/**
 * Snaps a datetime-local string ("YYYY-MM-DDTHH:mm") forward to the close of
 * the candle it falls inside for the given timeframe, e.g. 10:03 on a 5m
 * timeframe becomes 10:05, the close of the candle the entry happened in.
 */
export function bucketToCandleClose(localDateTimeStr: string, minutes: number): string {
  if (!localDateTimeStr) return localDateTimeStr;
  const d = new Date(localDateTimeStr);
  if (Number.isNaN(d.getTime())) return localDateTimeStr;

  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const minutesSinceMidnight = (d.getTime() - startOfDay.getTime()) / 60000;
  const bucketed = Math.ceil(minutesSinceMidnight / minutes) * minutes;
  const result = new Date(startOfDay.getTime() + bucketed * 60000);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${result.getFullYear()}-${pad(result.getMonth() + 1)}-${pad(result.getDate())}T${pad(result.getHours())}:${pad(result.getMinutes())}`;
}
